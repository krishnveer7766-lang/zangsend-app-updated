import { useState, useRef, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronLeft, Upload, Search, Download, X, Play, Plus, Loader2, ChevronRight, Clock } from 'lucide-react';
import Papa from 'papaparse';
import { useContacts } from '../hooks/useContacts';
import { useTemplates } from '../hooks/useTemplates';
import { supabase } from '../lib/supabase';
import { invokeNetlifyFunction } from '../lib/api';
import { distributeEmails } from '../utils/scheduler';

export function ListDetailPage() {
  const { id } = useParams();
  const { contacts, loading, totalCount, currentPage, pageSize, goToPage, insertContacts, updateContactLocally, bulkUpdateContactsLocally } = useContacts(id);
  const { templates } = useTemplates();
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [findingEmails, setFindingEmails] = useState(false);
  const stopFindingRef = useRef(false); // cancellation flag
  const [processingEmails, setProcessingEmails] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState('All');
  const [uploading, setUploading] = useState(false);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [senders, setSenders] = useState<any[]>([]);
  const [selectedSenderId, setSelectedSenderId] = useState<string>('');
  const [isSending, setIsSending] = useState(false);
  const [schedulingType, setSchedulingType] = useState<'send' | 'draft' | 'schedule' | null>(null);
  const [sendProgress, setSendProgress] = useState({ current: 0, total: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // List Name & Campaign States
  const [listName, setListName] = useState('List');
  const [isCampaignModalOpen, setIsCampaignModalOpen] = useState(false);
  const [campaignMode, setCampaignMode] = useState<'create' | 'existing'>('create');
  const [newCampaignName, setNewCampaignName] = useState('');
  const [selectedCampaignIdForRun, setSelectedCampaignIdForRun] = useState('');
  const [existingCampaigns, setExistingCampaigns] = useState<any[]>([]);
  const [pendingAction, setPendingAction] = useState<'send' | 'draft' | 'schedule' | null>(null);

  // Mass Edit State
  const [isMassEditModalOpen, setIsMassEditModalOpen] = useState(false);
  const [massEditTemplateId, setMassEditTemplateId] = useState('');
  const [massEditAttachmentId, setMassEditAttachmentId] = useState('');
  
  // Scheduling State
  const [workingHours] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('zangsend_working_hours') || '{"start":"09:00","end":"18:00"}');
    } catch {
      return { start: '09:00', end: '18:00' };
    }
  });
  
  useEffect(() => {
    if (id) {
      supabase.from('lists').select('name').eq('id', id).single().then(({ data }) => {
        if (data) setListName(data.name);
      });
      
      const fetchCampaigns = async () => {
        try {
          const { data } = await supabase
            .from('campaigns')
            .select('*')
            .eq('list_id', id)
            .order('sent_at', { ascending: false });
          if (data) {
            setExistingCampaigns(data);
            if (data.length > 0) {
              setSelectedCampaignIdForRun(data[0].id);
            }
          }
        } catch (err) {
          console.error('Error fetching campaigns:', err);
        }
      };
      fetchCampaigns();
    }

    supabase.from('attachments').select('id, filename, storage_path').then(({ data }) => {
      if (data) setAttachments(data);
    });
    
    const fetchSenders = async () => {
      try {
        const { data } = await supabase.from('senders').select('*');
        if (data) {
          setSenders(data);
          if (data.length > 0) setSelectedSenderId(data[0].id);
        }
      } catch (err) {
        console.error('Error fetching senders:', err);
      }
    };
    fetchSenders();
  }, [id]);

  const handleMassEdit = async () => {
    const updates: any = {};
    if (massEditTemplateId !== '') updates.template_id = massEditTemplateId === 'none' ? null : massEditTemplateId;
    if (massEditAttachmentId !== '') updates.attachment_id = massEditAttachmentId === 'none' ? null : massEditAttachmentId;

    if (Object.keys(updates).length === 0) {
      alert("Please select a template or attachment to apply.");
      return;
    }

    try {
      await supabase.from('contacts').update(updates).in('id', selectedRows);
      bulkUpdateContactsLocally(selectedRows, updates);
      setIsMassEditModalOpen(false);
      setMassEditTemplateId('');
      setMassEditAttachmentId('');
    } catch (err: any) {
      alert('Failed to mass update contacts: ' + err.message);
    }
  };
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAutofilling, setIsAutofilling] = useState(false);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [newContact, setNewContact] = useState({
    linkedin_url: '',
    first_name: '',
    last_name: '',
    company_name: '',
    title: '',
    email: ''
  });

  // CSV Mapping State
  const [isCsvMappingModalOpen, setIsCsvMappingModalOpen] = useState(false);
  const [rawCsvData, setRawCsvData] = useState<any[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState({
    first_name: '',
    last_name: '',
    company_name: '',
    title: '',
    email: '',
    linkedin_url: ''
  });

  const autoMatchHeader = (headers: string[], field: string) => {
    const f = field.toLowerCase();
    return headers.find(h => {
      const hn = h.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (f === 'first_name' && (hn === 'firstname' || hn === 'first')) return true;
      if (f === 'last_name' && (hn === 'lastname' || hn === 'last')) return true;
      if (f === 'company_name' && hn.includes('company')) return true;
      if (f === 'title' && (hn === 'title' || hn.includes('job') || hn.includes('position'))) return true;
      if (f === 'email' && hn.includes('email')) return true;
      if (f === 'linkedin_url' && (hn.includes('linkedin') || hn.includes('profile'))) return true;
      return false;
    }) || '';
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().replace(/^\uFEFF/, ''),
      complete: (results) => {
        if (results.data && results.data.length > 0) {
          const headers = Object.keys(results.data[0] as any);
          setCsvHeaders(headers);
          setRawCsvData(results.data);
          setMapping({
            first_name: autoMatchHeader(headers, 'first_name'),
            last_name: autoMatchHeader(headers, 'last_name'),
            company_name: autoMatchHeader(headers, 'company_name'),
            title: autoMatchHeader(headers, 'title'),
            email: autoMatchHeader(headers, 'email'),
            linkedin_url: autoMatchHeader(headers, 'linkedin_url')
          });
          setIsCsvMappingModalOpen(true);
        } else {
          alert('CSV appears to be empty.');
        }
      },
      error: (error) => {
        console.error('CSV Parse Error:', error);
        alert('Failed to parse CSV file.');
      }
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleConfirmCsvMapping = async () => {
    setIsCsvMappingModalOpen(false);
    setUploading(true);
    
    try {
      const newContacts = rawCsvData.map(row => ({
        list_id: id,
        first_name: mapping.first_name ? row[mapping.first_name] : null,
        last_name: mapping.last_name ? row[mapping.last_name] : null,
        company_name: mapping.company_name ? row[mapping.company_name] : null,
        title: mapping.title ? row[mapping.title] : null,
        email: mapping.email ? row[mapping.email] : null,
        linkedin_url: mapping.linkedin_url ? row[mapping.linkedin_url] : null,
        status: 'pending'
      })).filter(c => c.linkedin_url || c.email || c.first_name || c.last_name || c.company_name);
      
      if (newContacts.length === 0) {
        alert('No valid contacts found. Please map at least one field containing data.');
        setUploading(false);
        return;
      }

      // insertContacts handles injecting the user_id
      const chunkSize = 100;
      for (let i = 0; i < newContacts.length; i += chunkSize) {
        await insertContacts(newContacts.slice(i, i + chunkSize));
      }
    } catch (err) {
      console.error('Error uploading contacts:', err);
      alert('Failed to process CSV import.');
    } finally {
      setUploading(false);
    }
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedRows(contacts.map(c => c.id));
    } else {
      setSelectedRows([]);
    }
  };

  const handleSelectRow = (contactId: string) => {
    if (selectedRows.includes(contactId)) {
      setSelectedRows(selectedRows.filter(id => id !== contactId));
    } else {
      setSelectedRows([...selectedRows, contactId]);
    }
  };

  const handleStopFindEmails = () => {
    stopFindingRef.current = true;
  };

  const handleFindEmails = async () => {
    if (selectedRows.length === 0) return;

    // Reset stop flag and start
    stopFindingRef.current = false;
    setFindingEmails(true);

    const selectedContacts = contacts.filter(
      c => selectedRows.includes(c.id)
    );

    const withUrl = selectedContacts.filter(c => c.linkedin_url);
    const withoutUrl = selectedContacts.filter(c => !c.linkedin_url);

    if (withoutUrl.length > 0 && withUrl.length === 0) {
      alert(`⚠️ ${withoutUrl.length} contacts skipped: They are missing LinkedIn URLs.`);
      setFindingEmails(false);
      return;
    }

    // Process with concurrency of 3
    const queue = [...withUrl];
    const concurrency = 3;
    
    const processNext = async () => {
      if (queue.length === 0 || stopFindingRef.current) return;
      const contact = queue.shift()!;
      
      setProcessingEmails(prev => new Set(prev).add(contact.id));

      try {
        // Trigger Netlify background function
        await fetch('/.netlify/functions/find-email-background', {
          method: 'POST',
          body: JSON.stringify({ url: contact.linkedin_url, contact_id: contact.id })
        });

        // Poll for result for up to 5 minutes
        let attempts = 0;
        let found = false;
        while (attempts < 60 && !stopFindingRef.current) {
          await new Promise(r => setTimeout(r, 5000));
          const { data: updated, error: fetchErr } = await supabase
            .from('contacts')
            .select('status, email')
            .eq('id', contact.id)
            .single();

          if (fetchErr) break;
          if (updated.status === 'email_found' || updated.status === 'email_not_found') {
            updateContactLocally(contact.id, { email: updated.email, status: updated.status });
            found = true;
            break;
          }
          attempts++;
        }

        if (!found && !stopFindingRef.current) {
          console.warn(`Finding timed out for ${contact.linkedin_url}`);
        }
      } catch (err: any) {
        console.error(`Finding error:`, err.message);
      } finally {

        setProcessingEmails(prev => {
          const next = new Set(prev);
          next.delete(contact.id);
          return next;
        });
        await processNext();
      }
    };

    // Start workers
    await Promise.all(Array(Math.min(concurrency, queue.length)).fill(null).map(processNext));

    setFindingEmails(false);
    stopFindingRef.current = false;
    setSelectedRows([]);
  };

  const triggerCampaignSetup = (type: 'send' | 'draft' | 'schedule') => {
    if (selectedRows.length === 0) return;
    if (type === 'send' && !selectedSenderId) {
      alert('Please connect a Gmail account in Settings first.');
      return;
    }
    if (type !== 'send' && senders.length === 0) {
      alert('Please connect at least one Gmail account in Settings first.');
      return;
    }

    const selectedContacts = contacts.filter(c => selectedRows.includes(c.id));
    const withEmail = selectedContacts.filter(c => c.email);

    if (withEmail.length === 0) {
      alert('None of the selected contacts have email addresses.');
      return;
    }

    const missingEmailsCount = selectedContacts.length - withEmail.length;
    if (missingEmailsCount > 0) {
      const proceed = window.confirm(
        `⚠️ Warning: ${missingEmailsCount} out of the ${selectedContacts.length} selected contacts do not have email addresses. They will be skipped and remain in "pending" status.\n\nDo you want to proceed with scheduling the remaining ${withEmail.length} contacts?`
      );
      if (!proceed) return;
    }

    const missingTemplates = withEmail.filter(c => !c.template_id);
    if (missingTemplates.length > 0) {
      alert(`Please assign a template to all selected contacts. ${missingTemplates.length} contacts are missing a template.`);
      return;
    }

    setPendingAction(type);
    const dateStr = new Date().toLocaleDateString();
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setNewCampaignName(`Campaign - ${listName} - ${dateStr} ${timeStr}`);
    setIsCampaignModalOpen(true);
  };

  const handleCampaignConfirm = async () => {
    setIsCampaignModalOpen(false);
    let campaignId = selectedCampaignIdForRun;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      if (campaignMode === 'create') {
        if (!newCampaignName.trim()) {
          alert('Please enter a campaign name');
          return;
        }

        const selectedContacts = contacts.filter(c => selectedRows.includes(c.id));
        const firstTemplateId = selectedContacts.find(c => c.template_id)?.template_id || null;
        const sender = senders.find(s => s.id === selectedSenderId) || senders[0];

        const { data: newCam, error: camErr } = await supabase
          .from('campaigns')
          .insert({
            user_id: user.id,
            list_id: id,
            name: newCampaignName.trim(),
            template_id: firstTemplateId,
            sent_by_email: sender?.email || null,
            sent_at: new Date().toISOString()
          })
          .select()
          .single();

        if (camErr) throw camErr;
        if (newCam) {
          campaignId = newCam.id;
          setExistingCampaigns(prev => [newCam, ...prev]);
        }
      }

      if (!campaignId) {
        alert('Campaign ID not selected/created.');
        return;
      }

      if (pendingAction === 'send') {
        await executeSendCampaign(campaignId);
      } else if (pendingAction === 'draft') {
        await executeScheduleCampaign('draft', campaignId);
      } else if (pendingAction === 'schedule') {
        await executeScheduleCampaign('scheduled', campaignId);
      }
    } catch (err: any) {
      console.error('Error starting campaign:', err);
      alert('Failed to configure campaign: ' + err.message);
    }
  };

  const executeSendCampaign = async (campaignId: string) => {
    const sender = senders.find(s => s.id === selectedSenderId);
    if (!sender) return;

    const selectedContacts = contacts.filter(c => selectedRows.includes(c.id));
    const withEmail = selectedContacts.filter(c => c.email);

    setIsSending(true);
    setSchedulingType('send');
    setSendProgress({ current: 0, total: withEmail.length });

    for (let i = 0; i < withEmail.length; i++) {
      const contact = withEmail[i];
      setSendProgress(prev => ({ ...prev, current: i + 1 }));

      try {
        // 1. Get Template content
        let subject = '';
        let html = '';

        const template = templates.find(t => t.id === contact.template_id);
        if (template) {
          subject = template.subject || 'No Subject';
          html = template.body || '';
          
          // Basic variable replacement
          html = html
            .replace(/\{\{first_name\}\}/g, contact.first_name || '')
            .replace(/\{\{last_name\}\}/g, contact.last_name || '')
            .replace(/\{\{company_name\}\}/g, contact.company_name || '')
            .replace(/\{\{title\}\}/g, contact.title || '');
        }

        // 2. Prepare Attachment
        let targetAttachmentId = contact.attachment_id;
        
        // Fallback to template's attachment
        if (!targetAttachmentId && template && template.attachment_ids && template.attachment_ids.length > 0) {
          targetAttachmentId = template.attachment_ids[0];
        }

        let attachmentConfig = null;
        if (targetAttachmentId) {
          const attachment = attachments.find(a => a.id === targetAttachmentId);
          if (attachment && attachment.storage_path) {
            // Download the file directly to avoid nodemailer URL streaming issues
            const { data, error } = await supabase.storage.from('attachments').download(attachment.storage_path);
            if (data) {
              const arrayBuffer = await data.arrayBuffer();
              const base64 = btoa(new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), ''));
              attachmentConfig = { 
                filename: attachment.filename, 
                content: base64, 
                encoding: 'base64' 
              };
            } else {
              console.error('Failed to download attachment:', error);
            }
          }
        }

        // 3. Send via Netlify Function
        const sendData = await invokeNetlifyFunction('send-email', {
          to: contact.email,
          subject: subject,
          html: html,
          from_email: sender.email,
          app_password: sender.app_password,
          sender_name: sender.name || sender.sender_name || undefined,
          attachment: attachmentConfig,
          contact_id: contact.id
        });

        if (sendData.success) {
          await supabase.from('contacts').update({ 
            status: 'sent', 
            sent_at: new Date().toISOString(),
            campaign_id: campaignId,
            opened_at: null,
            clicked_at: null
          }).eq('id', contact.id);
          updateContactLocally(contact.id, { 
            status: 'sent', 
            sent_at: new Date().toISOString(),
            campaign_id: campaignId,
            opened_at: null,
            clicked_at: null
          });
        } else {
          console.error('Failed to send email:', sendData.error);
          alert(`Failed to send to ${contact.email}: ${sendData.error}`);
        }
      } catch (err: any) {
        console.error('Error in send campaign:', err);
        alert(`Error sending to ${contact.email}: ${err.message}`);
      }
    }

    setIsSending(false);
    setSchedulingType(null);
    setSelectedRows([]);
    alert(`Campaign complete! Sent ${withEmail.length} emails.`);
  };

  const executeScheduleCampaign = async (type: 'draft' | 'scheduled', campaignId: string) => {
    const selectedContacts = contacts.filter(c => selectedRows.includes(c.id));
    const withEmail = selectedContacts.filter(c => c.email);

    // Fetch existing scheduled and sent emails for today and future from Supabase to enforce 45 limit
    const senderIds = senders.map(s => s.id);
    const existingScheduledCounts: Record<string, Record<string, number>> = {};

    const getLocalDateString = (date: Date): string => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    try {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const startOfTodayIso = startOfToday.toISOString();

      const { data: existingEmails, error: existingError } = await supabase
        .from('contacts')
        .select('sender_id, scheduled_send_at, status, sent_at')
        .in('sender_id', senderIds)
        .in('status', ['scheduled', 'sent', 'processing'])
        .or(`scheduled_send_at.gte.${startOfTodayIso},sent_at.gte.${startOfTodayIso}`);

      if (existingError) {
        console.error('Error fetching existing scheduled emails:', existingError);
      } else if (existingEmails) {
        existingEmails.forEach(email => {
          const sId = email.sender_id;
          if (!sId) return;

          const dateVal = email.status === 'sent' ? email.sent_at : email.scheduled_send_at;
          if (!dateVal) return;

          const dateStr = getLocalDateString(new Date(dateVal));
          if (!existingScheduledCounts[sId]) {
            existingScheduledCounts[sId] = {};
          }
          existingScheduledCounts[sId][dateStr] = (existingScheduledCounts[sId][dateStr] || 0) + 1;
        });
      }
    } catch (e) {
      console.error('Failed to parse/fetch existing scheduled emails:', e);
    }

    // Distribute emails passing existingScheduledCounts
    const schedules = distributeEmails(withEmail, senders, workingHours, 45, existingScheduledCounts);
    
    setIsSending(true);
    setSchedulingType(type === 'draft' ? 'draft' : 'schedule');
    setSendProgress({ current: 0, total: schedules.length });

    try {
      // Process database updates in chunks of 3 in parallel to stay safely below the browser's 6-connection limit
      const DB_CHUNK_SIZE = 3;
      for (let i = 0; i < schedules.length; i += DB_CHUNK_SIZE) {
        const chunk = schedules.slice(i, i + DB_CHUNK_SIZE);
        await Promise.all(chunk.map(async s => {
          const contact = withEmail.find(c => c.id === s.contactId);
          if (!contact) return;
          const currentData = (contact as any)?.data || {};
          const nowIso = new Date().toISOString();
          
          const { error } = await supabase
            .from('contacts')
            .update({
              status: type === 'draft' ? 'draft' : 'scheduled',
              scheduled_send_at: type === 'draft' ? null : s.scheduled_send_at,
              sender_id: s.sender_id,
              campaign_id: campaignId,
              sent_at: null,
              opened_at: null,
              clicked_at: null,
              data: {
                ...currentData,
                sender_id: s.sender_id,
                is_draft: type === 'draft',
                activity: {
                  ...(currentData.activity || {}),
                  scheduled_at: type === 'scheduled' ? nowIso : (currentData.activity?.scheduled_at || null),
                  drafted_at: type === 'draft' ? nowIso : (currentData.activity?.drafted_at || null),
                  sent_at: null,
                  opened_at: null,
                  clicked_at: null
                }
              }
            })
            .eq('id', s.contactId);

          if (error) {
            throw new Error(`Failed to update contact ${contact.email || s.contactId}: ${error.message}`);
          }

          // Update local state immediately after database success
          updateContactLocally(s.contactId, { 
            status: type === 'draft' ? 'draft' : 'scheduled', 
            scheduled_send_at: type === 'draft' ? null : s.scheduled_send_at,
            sender_id: s.sender_id,
            campaign_id: campaignId,
            sent_at: null,
            opened_at: null,
            clicked_at: null,
            data: {
              ...currentData,
              sender_id: s.sender_id,
              is_draft: type === 'draft',
              activity: {
                ...(currentData.activity || {}),
                scheduled_at: type === 'scheduled' ? nowIso : (currentData.activity?.scheduled_at || null),
                drafted_at: type === 'draft' ? nowIso : (currentData.activity?.drafted_at || null),
                sent_at: null,
                opened_at: null,
                clicked_at: null
              }
            }
          } as any);
        }));

        if (type !== 'draft') {
          setSendProgress({ current: Math.min(i + DB_CHUNK_SIZE, schedules.length), total: schedules.length });
        }
      }

      if (type === 'draft') {
        // Automatically create drafts in Gmail using the edge function
        const createDraft = async (s: any) => {
          const contact = withEmail.find(c => c.id === s.contactId);
          const sender = senders.find(x => x.id === s.sender_id);
          const template = templates.find(t => t.id === contact?.template_id);
          
          if (!contact || !sender || !template) return;

          let subject = template.subject || 'No Subject';
          let html = template.body || '';
          
          const rep = (str: string) => str
            .replace(/\{\{first_name\}\}/g, contact.first_name || '')
            .replace(/\{\{last_name\}\}/g, contact.last_name || '')
            .replace(/\{\{company_name\}\}/g, contact.company_name || '')
            .replace(/\{\{title\}\}/g, contact.title || '');

          subject = rep(subject);
          html = rep(html);

          const attachment = attachments.find(a => a.id === contact.attachment_id);
          let attachmentUrl = undefined;
          let attachmentFilename = undefined;
          
          if (attachment?.storage_path) {
            // BUG FIX 2.4: Use signed URL instead of public URL
            const { data: signedUrlData } = await supabase.storage
              .from('attachments')
              .createSignedUrl(attachment.storage_path, 3600); // 1 hour expiry
            
            attachmentUrl = signedUrlData?.signedUrl;
            attachmentFilename = attachment.filename;
          }

          const data = await invokeNetlifyFunction('create-draft', {
            to: contact.email,
            subject: subject,
            html: html,
            from_email: sender.email,
            app_password: sender.app_password,
            sender_name: sender.name || sender.sender_name || undefined,
            attachment_url: attachmentUrl,
            attachment_filename: attachmentFilename
          });

          if (data?.error) {
            throw new Error(`Draft failed for ${contact.email}: ${data.error}`);
          }
          return data;
        };

        // BUG FIX 2.5: Process in chunks (concurrency limit)
        const chunkSize = 3;
        const allResults = [];
        for (let i = 0; i < schedules.length; i += chunkSize) {
          const chunk = schedules.slice(i, i + chunkSize);
          // BUG FIX 2.1: Use Promise.allSettled
          const results = await Promise.allSettled(chunk.map(s => createDraft(s)));
          allResults.push(...results);
          
          setSendProgress({ current: Math.min(i + chunkSize, schedules.length), total: schedules.length });
        }
        
        const failed = allResults.filter(r => r.status === 'rejected');
        if (failed.length > 0) {
          console.error('Some drafts failed:', failed);
          alert(`${failed.length} drafts failed to create in Gmail. Check console for details.`);
        }
      }

      alert(`Successfully ${type === 'draft' ? 'created drafts in Gmail' : 'scheduled'} ${withEmail.length} emails.`);
      setSelectedRows([]);
    } catch (err: any) {
      alert('Failed to schedule emails: ' + err.message);
    } finally {
      setIsSending(false);
      setSchedulingType(null);
    }
  };

  const handleAutofill = async () => {
    if (!newContact.linkedin_url) return;
    setIsAutofilling(true);
    try {
      const data = await invokeNetlifyFunction('find-email', {
        url: newContact.linkedin_url
      });
      if (data) {
        setNewContact(prev => ({
          ...prev,
          first_name: data.first_name || prev.first_name,
          last_name: data.last_name || prev.last_name,
          company_name: data.company_name || prev.company_name,
          title: data.title || prev.title,
          email: data.email || prev.email,
        }));
      }
    } catch (err) {
      console.error('Autofill error:', err);
      alert('Failed to autofill from LinkedIn.');
    } finally {
      setIsAutofilling(false);
    }
  };

  const handleSaveNewContact = async () => {
    if (editingContactId) {
      // Update existing contact
      try {
        await supabase.from('contacts').update({
          linkedin_url: newContact.linkedin_url,
          first_name: newContact.first_name,
          last_name: newContact.last_name,
          company_name: newContact.company_name,
          title: newContact.title,
          email: newContact.email
        }).eq('id', editingContactId);
        
        updateContactLocally(editingContactId, {
          linkedin_url: newContact.linkedin_url,
          first_name: newContact.first_name,
          last_name: newContact.last_name,
          company_name: newContact.company_name,
          title: newContact.title,
          email: newContact.email
        });
      } catch (err: any) {
        alert('Failed to update contact: ' + err.message);
      }
    } else {
      // Insert new contact
      await insertContacts([{ ...newContact, status: 'pending' }]);
    }
    
    setIsModalOpen(false);
    setEditingContactId(null);
    setNewContact({ linkedin_url: '', first_name: '', last_name: '', company_name: '', title: '', email: '' });
  };

  const handleDeleteContact = async (id: string) => {
    if (!window.confirm('Delete this contact?')) return;
    try {
      await supabase.from('contacts').delete().eq('id', id);
      goToPage(currentPage);
    } catch (err: any) {
      alert('Failed to delete contact: ' + err.message);
    }
  };

  const handleEditContact = (contact: any) => {
    setEditingContactId(contact.id);
    setNewContact({
      linkedin_url: contact.linkedin_url || '',
      first_name: contact.first_name || '',
      last_name: contact.last_name || '',
      company_name: contact.company_name || '',
      title: contact.title || '',
      email: contact.email || ''
    });
    setIsModalOpen(true);
  };

  const filteredContacts = contacts.filter(c => {
    const matchesSearch = (c.first_name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
      (c.last_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.company_name || '').toLowerCase().includes(searchQuery.toLowerCase());
      
    if (!matchesSearch) return false;
    
    if (activeTab === 'All') return true;
    if (activeTab === 'Pending') return c.status?.toLowerCase() === 'pending';
    if (activeTab === 'Email Found') return c.status?.toLowerCase() === 'email_found';
    if (activeTab === 'Scheduled') return c.status?.toLowerCase() === 'scheduled';
    if (activeTab === 'Sent') return c.status?.toLowerCase() === 'sent';
    if (activeTab === 'Bounced') return c.status?.toLowerCase() === 'bounced' || c.status?.toLowerCase() === 'email_not_found';
    if (activeTab === 'Draft') return c.status?.toLowerCase() === 'draft';
    
    return true;
  });

  const totalPages = Math.ceil(totalCount / pageSize);

  const handleDownloadCsv = () => {
    const csv = Papa.unparse(filteredContacts.map(c => ({
      first_name: c.first_name,
      last_name: c.last_name,
      company_name: c.company_name,
      title: c.title,
      email: c.email,
      linkedin_url: c.linkedin_url,
      status: c.status
    })));
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'contacts_export.csv';
    link.click();
  };

  return (
    <div className="h-full flex flex-col relative">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-4">
          <Link to="/lists" className="text-text-secondary hover:text-text-primary transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-display font-medium tracking-tight">{listName}</h1>
              <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-medium bg-primary-ghost text-primary-text">Active</span>
            </div>
            <p className="text-xs text-text-secondary mt-1">
              {totalCount.toLocaleString()} contacts • {contacts.filter(c => c.status === 'pending').length} pending
            </p>
          </div>
        </div>
        <div className="flex space-x-3">
          <input 
            type="file" 
            accept=".csv" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            className="hidden" 
          />
          <button 
            onClick={() => {
              setEditingContactId(null);
              setNewContact({ linkedin_url: '', first_name: '', last_name: '', company_name: '', title: '', email: '' });
              setIsModalOpen(true);
            }} 
            className="btn border border-border hover:bg-elevated transition-colors text-xs h-8"
          >
            <Plus className="w-3.5 h-3.5 mr-2" /> Add Manually
          </button>
          <button 
            className="btn border border-border hover:bg-elevated transition-colors text-xs h-8"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <Upload className="w-3.5 h-3.5 mr-2" />}
            {uploading ? 'Appending...' : 'Append CSV'}
          </button>
        </div>
      </div>

      {/* Tabs & Toolbar */}
      <div className="flex-shrink-0 bg-surface border-b border-border flex flex-col">
        <div className="flex px-6 space-x-6 border-b border-border">
          {['All', 'Pending', 'Email Found', 'Scheduled', 'Sent', 'Bounced', 'Draft'].map(tab => (
            <button 
              key={tab} 
              onClick={() => setActiveTab(tab)}
              className={`py-3 text-sm font-medium border-b-2 transition-colors ${tab === activeTab ? 'border-primary text-text-primary' : 'border-transparent text-text-secondary hover:text-text-primary'}`}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="px-6 py-3 flex items-center justify-between space-x-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
            <input 
              type="text" 
              placeholder="Search contacts..." 
              className="input-field pl-9 h-8 text-xs"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center space-x-3">
            <button onClick={handleDownloadCsv} className="btn btn-secondary text-xs h-8 px-3">
              <Download className="w-3.5 h-3.5 mr-2" /> Export
            </button>
          </div>
        </div>
      </div>

      {/* Power Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left border-collapse whitespace-nowrap">
          <thead className="sticky top-0 bg-surface z-10 shadow-sm border-b border-border">
            <tr className="text-[11px] uppercase tracking-wider text-text-secondary">
              <th className="px-6 py-3 font-medium w-10">
                <input 
                  type="checkbox" 
                  className="rounded border-border bg-background focus:ring-primary accent-primary" 
                  checked={selectedRows.length === filteredContacts.length && filteredContacts.length > 0}
                  onChange={handleSelectAll}
                />
              </th>
              <th className="px-6 py-3 font-medium">Status</th>
              <th className="px-6 py-3 font-medium">First Name</th>
              <th className="px-6 py-3 font-medium">Last Name</th>
              <th className="px-6 py-3 font-medium">Company</th>
              <th className="px-6 py-3 font-medium">Title</th>
              <th className="px-6 py-3 font-medium">LinkedIn URL</th>
              <th className="px-6 py-3 font-medium">Email</th>
              <th className="px-6 py-3 font-medium">Campaign</th>
              <th className="px-6 py-3 font-medium">Template</th>
              <th className="px-6 py-3 font-medium">Attachment</th>
              <th className="px-6 py-3 font-medium">Sent At</th>
              <th className="px-6 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="text-[12.5px]">
            {loading ? (
              <tr><td colSpan={12} className="text-center py-8 text-text-secondary">Loading contacts...</td></tr>
            ) : filteredContacts.length === 0 ? (
              <tr><td colSpan={12} className="text-center py-8 text-text-secondary">No contacts found in this list.</td></tr>
            ) : filteredContacts.map((contact) => (
              <tr key={contact.id} className={`border-b border-border-soft hover:bg-elevated/50 transition-colors group cursor-pointer ${selectedRows.includes(contact.id) ? 'bg-primary-ghost/30' : ''}`}>
                <td className="px-6 py-3">
                  <input 
                    type="checkbox" 
                    className="rounded border-border bg-background focus:ring-primary accent-primary" 
                    checked={selectedRows.includes(contact.id)}
                    onChange={() => handleSelectRow(contact.id)}
                  />
                </td>
                <td className="px-6 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-medium tracking-wider ${
                    contact.status === 'sent' ? 'bg-status-sent/10 text-status-sent' : 
                    contact.status === 'scheduled' ? 'bg-primary/20 text-primary' :
                    contact.status === 'email_found' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-status-pending/20 text-status-pending'
                  }`}>
                    {contact.status}
                  </span>
                </td>
                <td className="px-6 py-3 font-medium text-text-primary">{contact.first_name || '-'}</td>
                <td className="px-6 py-3 text-text-secondary">{contact.last_name || '-'}</td>
                <td className="px-6 py-3 text-text-secondary">{contact.company_name || '-'}</td>
                <td className="px-6 py-3 text-text-secondary">{contact.title || '-'}</td>
                <td className="px-6 py-3">
                  <a 
                    href={contact.linkedin_url || undefined} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline text-xs truncate max-w-[150px] block"
                  >
                    {contact.linkedin_url?.replace('https://www.linkedin.com/in/', '') || '-'}
                  </a>
                </td>
                <td className="px-6 py-3 font-mono">
                  {processingEmails.has(contact.id) ? (
                    <span className="flex items-center gap-1 text-amber-400 text-xs font-sans">
                      <Loader2 className="w-3 h-3 animate-spin" /> Searching...
                    </span>
                  ) : contact.email ? (
                    <span className="text-text-primary text-xs">{contact.email}</span>
                  ) : contact.status === 'email_not_found' ? (
                    <span className="px-2 py-0.5 rounded text-[10px] bg-red-500/10 text-red-400 font-medium">Not Found</span>
                  ) : (
                    <span className="text-text-tertiary">—</span>
                  )}
                </td>
                <td className="px-6 py-3 text-text-secondary truncate max-w-[130px]" title={existingCampaigns.find(c => c.id === contact.campaign_id)?.name || contact.data?.campaign_name || ''}>
                  {existingCampaigns.find(c => c.id === contact.campaign_id)?.name || contact.data?.campaign_name || '—'}
                </td>
                <td className="px-6 py-3 text-text-secondary">
                  <select 
                    className="bg-transparent border border-transparent hover:border-border focus:border-primary focus:bg-background rounded px-1.5 py-1 text-[12.5px] outline-none w-full max-w-[140px] appearance-none transition-colors"
                    value={contact.template_id || ''}
                    onClick={(e) => e.stopPropagation()} 
                    onChange={async (e) => {
                      const template_id = e.target.value || null;
                      await supabase.from('contacts').update({ template_id }).eq('id', contact.id);
                      updateContactLocally(contact.id, { template_id });
                    }}
                  >
                    <option value="">None</option>
                    {templates.map(t => (
                      <option key={t.id} value={t.id}>{t.name || 'Untitled'}</option>
                    ))}
                  </select>
                </td>
                <td className="px-6 py-3 text-text-secondary">
                  <select 
                    className="bg-transparent border border-transparent hover:border-border focus:border-primary focus:bg-background rounded px-1.5 py-1 text-[12.5px] outline-none w-full max-w-[140px] appearance-none transition-colors"
                    value={contact.attachment_id || ''}
                    onClick={(e) => e.stopPropagation()} 
                    onChange={async (e) => {
                      const attachment_id = e.target.value || null;
                      await supabase.from('contacts').update({ attachment_id }).eq('id', contact.id);
                      updateContactLocally(contact.id, { attachment_id });
                    }}
                  >
                    <option value="">None</option>
                    {attachments.map(a => (
                      <option key={a.id} value={a.id}>{a.filename || 'Untitled'}</option>
                    ))}
                  </select>
                </td>
                <td className="px-6 py-3 text-text-tertiary font-mono">
                  {contact.status === 'scheduled' ? (
                    <span className="text-primary">{new Date(contact.scheduled_send_at!).toLocaleString()}</span>
                  ) : contact.sent_at ? (
                    <span className="text-status-sent">{new Date(contact.sent_at).toLocaleString()}</span>
                  ) : '-'}
                </td>
                <td className="px-6 py-3 text-right">
                  <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditContact(contact);
                      }}
                      className="text-xs text-primary hover:underline px-2 py-1 rounded hover:bg-primary/10 transition-colors"
                    >
                      Edit
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteContact(contact.id);
                      }}
                      className="text-xs text-red-400 hover:text-red-300 hover:underline px-2 py-1 rounded hover:bg-red-500/10 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-3 border-t border-border bg-surface">
          <span className="text-xs text-text-secondary">
            Page {currentPage} of {totalPages} — {totalCount.toLocaleString()} total contacts
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1 || loading}
              className="px-3 py-1 rounded text-xs border border-border hover:bg-elevated disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              ← Prev
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              const page = currentPage <= 4 ? i + 1 : currentPage - 3 + i;
              if (page < 1 || page > totalPages) return null;
              return (
                <button
                  key={page}
                  onClick={() => goToPage(page)}
                  className={`px-3 py-1 rounded text-xs border transition-colors ${
                    page === currentPage
                      ? 'border-primary bg-primary-ghost text-primary-text'
                      : 'border-border hover:bg-elevated'
                  }`}
                >
                  {page}
                </button>
              );
            })}
            <button
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages || loading}
              className="px-3 py-1 rounded text-xs border border-border hover:bg-elevated disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* Sticky Action Bar */}
      {selectedRows.length > 0 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-elevated border border-border shadow-[0_8px_30px_rgb(0,0,0,0.5)] rounded-lg px-6 py-3 flex items-center space-x-6 z-50 animate-in slide-in-from-bottom-4 duration-200">
          <span className="text-sm font-medium text-primary-text">{selectedRows.length} rows selected</span>
          <div className="w-px h-5 bg-border"></div>
          <button 
            onClick={findingEmails ? handleStopFindEmails : handleFindEmails} 
            disabled={false}
            className={`flex items-center text-sm transition-colors gap-2 ${
              findingEmails 
                ? 'text-red-400 hover:text-red-300' 
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {findingEmails ? (
              <><X className="w-4 h-4" /> Stop Finding</>
            ) : (
              <><Search className="w-4 h-4" /> Find Emails</>
            )}
          </button>
          <div className="w-px h-5 bg-border"></div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase text-text-tertiary">Sender:</span>
            <select 
              className="bg-surface border border-border rounded px-2 py-1 text-xs outline-none focus:border-primary transition-colors max-w-[150px]"
              value={selectedSenderId}
              onChange={(e) => setSelectedSenderId(e.target.value)}
            >
              {senders.map(s => (
                <option key={s.id} value={s.id}>{s.email}</option>
              ))}
              {senders.length === 0 && <option value="">No Accounts</option>}
            </select>
          </div>
          <button 
            onClick={() => triggerCampaignSetup('draft')}
            disabled={isSending}
            className="flex items-center text-sm text-text-secondary hover:text-text-primary transition-colors gap-2 disabled:opacity-50"
          >
            {isSending && schedulingType === 'draft' ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Drafting ({sendProgress.current}/{sendProgress.total})</>
            ) : (
              <><Clock className="w-4 h-4 opacity-50" /> Add to Drafts</>
            )}
          </button>
          <button 
            onClick={() => triggerCampaignSetup('schedule')}
            disabled={isSending}
            className="flex items-center text-sm text-text-secondary hover:text-primary transition-colors gap-2 disabled:opacity-50"
          >
            {isSending && schedulingType === 'schedule' ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Scheduling ({sendProgress.current}/{sendProgress.total})</>
            ) : (
              <><Clock className="w-4 h-4" /> Schedule</>
            )}
          </button>
          <button 
            onClick={() => setIsMassEditModalOpen(true)}
            disabled={isSending}
            className="flex items-center text-sm text-text-secondary hover:text-text-primary transition-colors gap-2 disabled:opacity-50"
          >
            Mass Edit
          </button>
          <button 
            onClick={() => triggerCampaignSetup('send')} 
            disabled={isSending}
            className="flex items-center text-sm text-text-secondary hover:text-status-sent transition-colors gap-2 disabled:opacity-50"
          >
            {isSending && schedulingType === 'send' ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Sending ({sendProgress.current}/{sendProgress.total})</>
            ) : (
              <><Play className="w-4 h-4" /> Send Now</>
            )}
          </button>
          <div className="w-px h-5 bg-border"></div>
          <button onClick={() => setSelectedRows([])} className="flex items-center text-sm text-text-tertiary hover:text-text-primary transition-colors gap-2">
            <X className="w-4 h-4" /> Clear
          </button>
        </div>
      )}

      {/* Add Contact Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="bg-surface border border-border rounded-lg shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-medium text-text-primary">
                {editingContactId ? 'Edit Contact' : 'Add Contact Manually'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-text-tertiary hover:text-text-primary">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="label">LinkedIn URL</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="https://linkedin.com/in/..." 
                    className="input-field flex-1"
                    value={newContact.linkedin_url}
                    onChange={e => setNewContact({...newContact, linkedin_url: e.target.value})}
                  />
                  <button onClick={handleAutofill} disabled={isAutofilling} className="btn btn-secondary whitespace-nowrap text-xs px-3">
                    {isAutofilling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Autofill'}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">First Name</label>
                  <input type="text" className="input-field" value={newContact.first_name} onChange={e => setNewContact({...newContact, first_name: e.target.value})} />
                </div>
                <div>
                  <label className="label">Last Name</label>
                  <input type="text" className="input-field" value={newContact.last_name} onChange={e => setNewContact({...newContact, last_name: e.target.value})} />
                </div>
              </div>

              <div>
                <label className="label">Company Name</label>
                <input type="text" className="input-field" value={newContact.company_name} onChange={e => setNewContact({...newContact, company_name: e.target.value})} />
              </div>

              <div>
                <label className="label">Title</label>
                <input type="text" className="input-field" value={newContact.title} onChange={e => setNewContact({...newContact, title: e.target.value})} />
              </div>

              <div>
                <label className="label">Email Address</label>
                <input type="email" className="input-field" value={newContact.email} onChange={e => setNewContact({...newContact, email: e.target.value})} />
              </div>
            </div>

            <div className="mt-8 flex justify-end gap-3">
              <button onClick={() => setIsModalOpen(false)} className="btn border border-border text-text-secondary hover:text-text-primary text-sm px-4">Cancel</button>
              <button onClick={handleSaveNewContact} className="btn btn-primary text-sm px-6">Save Contact</button>
            </div>
          </div>
        </div>
      )}

      {/* CSV Mapping Modal */}
      {isCsvMappingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="bg-surface border border-border rounded-lg shadow-xl w-full max-w-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-medium text-text-primary">Map CSV Columns</h2>
                <p className="text-sm text-text-secondary mt-1">Match your CSV headers to ZangSends fields.</p>
              </div>
              <button onClick={() => setIsCsvMappingModalOpen(false)} className="text-text-tertiary hover:text-text-primary">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="bg-elevated border border-border rounded-lg overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface border-b border-border text-text-secondary">
                  <tr>
                    <th className="px-4 py-3 font-medium w-1/3">ZangSends Field</th>
                    <th className="px-4 py-3 font-medium">CSV Column Header</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[
                    { key: 'first_name', label: 'First Name', required: false },
                    { key: 'last_name', label: 'Last Name', required: false },
                    { key: 'company_name', label: 'Company', required: false },
                    { key: 'title', label: 'Job Title', required: false },
                    { key: 'email', label: 'Email Address', required: true },
                    { key: 'linkedin_url', label: 'LinkedIn URL', required: true }
                  ].map(field => (
                    <tr key={field.key} className="hover:bg-surface transition-colors">
                      <td className="px-4 py-3 font-medium text-text-primary flex items-center">
                        {field.label}
                        {field.required && <span className="ml-1 text-[10px] text-text-tertiary font-normal">(Req*)</span>}
                      </td>
                      <td className="px-4 py-3">
                        <select 
                          className="w-full bg-background border border-border text-text-primary rounded px-3 py-1.5 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                          value={mapping[field.key as keyof typeof mapping]}
                          onChange={(e) => setMapping({...mapping, [field.key]: e.target.value})}
                        >
                          <option value="">-- Ignore this field --</option>
                          {csvHeaders.map(header => (
                            <option key={header} value={header}>{header}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-text-tertiary mt-4">* Note: We use LinkedIn URLs to automatically find emails via our Apify Waterfall.</p>

            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setIsCsvMappingModalOpen(false)} className="btn border border-border text-text-secondary hover:text-text-primary px-4">Cancel</button>
              <button onClick={handleConfirmCsvMapping} className="btn btn-primary px-6 flex items-center">
                Append {rawCsvData.length} Contacts <ChevronRight className="w-4 h-4 ml-1" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mass Edit Modal */}
      {isMassEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="bg-surface border border-border rounded-lg shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-medium text-text-primary">Mass Edit Selected</h2>
              <button onClick={() => setIsMassEditModalOpen(false)} className="text-text-tertiary hover:text-text-primary">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="space-y-4">
              <p className="text-sm text-text-secondary">
                Apply changes to all {selectedRows.length} selected contacts. Leave a dropdown as "No Change" to keep their current values.
              </p>
              <div>
                <label className="label">Template</label>
                <select 
                  className="input-field"
                  value={massEditTemplateId}
                  onChange={(e) => setMassEditTemplateId(e.target.value)}
                >
                  <option value="">-- No Change --</option>
                  <option value="none">None (Clear Template)</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>{t.name || 'Untitled'}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Attachment</label>
                <select 
                  className="input-field"
                  value={massEditAttachmentId}
                  onChange={(e) => setMassEditAttachmentId(e.target.value)}
                >
                  <option value="">-- No Change --</option>
                  <option value="none">None (Clear Attachment)</option>
                  {attachments.map(a => (
                    <option key={a.id} value={a.id}>{a.filename || 'Untitled'}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-8 flex justify-end gap-3">
              <button onClick={() => setIsMassEditModalOpen(false)} className="btn border border-border text-text-secondary hover:text-text-primary text-sm px-4">Cancel</button>
              <button onClick={handleMassEdit} className="btn btn-primary text-sm px-6">Apply to {selectedRows.length} Contacts</button>
            </div>
          </div>
        </div>
      )}

      {/* Campaign Setup Modal */}
      {isCampaignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="bg-surface border border-border rounded-xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-display font-medium text-text-primary">
                Campaign Setup
              </h2>
              <button onClick={() => setIsCampaignModalOpen(false)} className="text-text-tertiary hover:text-text-primary">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <p className="text-xs text-text-secondary mb-6">
              Group these {contacts.filter(c => selectedRows.includes(c.id) && c.email).length} contacts into a campaign for clean tracking.
            </p>

            <div className="space-y-6">
              {/* Campaign Type Selection */}
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <input
                    type="radio"
                    name="campaignMode"
                    value="create"
                    checked={campaignMode === 'create'}
                    onChange={() => setCampaignMode('create')}
                    className="accent-primary text-primary focus:ring-primary border-border bg-background"
                  />
                  Start New Campaign
                </label>
                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <input
                    type="radio"
                    name="campaignMode"
                    value="existing"
                    checked={campaignMode === 'existing'}
                    disabled={existingCampaigns.length === 0}
                    onChange={() => setCampaignMode('existing')}
                    className="accent-primary text-primary focus:ring-primary border-border bg-background disabled:opacity-50"
                  />
                  Add to Existing Campaign
                </label>
              </div>

              {campaignMode === 'create' ? (
                <div>
                  <label className="label text-xs mb-2 block font-medium">New Campaign Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Campaign Round 1"
                    className="input-field"
                    value={newCampaignName}
                    onChange={e => setNewCampaignName(e.target.value)}
                  />
                </div>
              ) : (
                <div>
                  <label className="label text-xs mb-2 block font-medium">Select Campaign</label>
                  <select
                    className="input-field py-2"
                    value={selectedCampaignIdForRun}
                    onChange={e => setSelectedCampaignIdForRun(e.target.value)}
                  >
                    {existingCampaigns.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({new Date(c.sent_at).toLocaleDateString()})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="mt-8 flex justify-end gap-3">
              <button
                onClick={() => setIsCampaignModalOpen(false)}
                className="btn border border-border text-text-secondary hover:text-text-primary text-xs px-4"
              >
                Cancel
              </button>
              <button
                onClick={handleCampaignConfirm}
                className="btn btn-primary text-xs px-4"
              >
                Proceed & Start
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Schedule Modal as requested by user */}
    </div>
  );
}
