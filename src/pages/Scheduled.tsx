import { useState, useEffect } from 'react';
import { Calendar, Search, Clock, X, RotateCcw, AlertCircle, FileText, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { invokeNetlifyFunction } from '../lib/api';

export function ScheduledPage() {
  const [scheduled, setScheduled] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [editingTimeId, setEditingTimeId] = useState<string | null>(null);
  const [editTimeValue, setEditTimeValue] = useState<string>('');
  const [sortBy, setSortBy] = useState<'time-asc' | 'time-desc' | 'name'>('time-asc');

  useEffect(() => {
    fetchScheduled();
  }, []);

  const fetchScheduled = async () => {
    setLoading(true);
    try {
      // Fetch everything that has a scheduled time
      const { data: contacts, error: contactsError } = await supabase
        .from('contacts')
        .select('*')
        .not('scheduled_send_at', 'is', null)
        .order('scheduled_send_at', { ascending: true });
      
      if (contactsError) throw contactsError;

      const { data: templates } = await supabase.from('templates').select('id, name');
      const { data: lists } = await supabase.from('lists').select('id, name');

      const templateMap = new Map((templates || []).map(t => [t.id, t.name]));
      const listMap = new Map((lists || []).map(l => [l.id, l.name]));

      const formatted = (contacts || [])
        .filter(c => {
          const s = (c.status || '').toLowerCase();
          // Show scheduled, processing, or bounced (failed)
          return s === 'scheduled' || s === 'processing' || s === 'bounced';
        })
        .map(c => ({
          ...c,
          first_name: c.first_name || c.data?.first_name || '',
          last_name: c.last_name || c.data?.last_name || '',
          email: c.email || c.data?.email || '',
          display_status: c.status || 'scheduled',
          template: { name: templateMap.get(c.template_id) || 'None' },
          list: { name: listMap.get(c.list_id) || 'Unknown List' }
        }));

      console.log(`Fetched ${formatted.length} scheduled emails`);
      setScheduled(formatted);
    } catch (err: any) {
      console.error("Error fetching scheduled:", err);
      alert("Error loading scheduled emails: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedRows(scheduled.map(s => s.id));
    } else {
      setSelectedRows([]);
    }
  };

  const handleSelectRow = (id: string) => {
    setSelectedRows(prev => 
      prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
    );
  };

  const handleEditTime = (id: string, currentIsoTime: string) => {
    setEditingTimeId(id);
    if (currentIsoTime) {
      const date = new Date(currentIsoTime);
      date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
      setEditTimeValue(date.toISOString().slice(0, 16));
    } else {
      setEditTimeValue('');
    }
  };

  const handleSaveTime = async (id: string) => {
    if (!editTimeValue) return;

    const newTime = new Date(editTimeValue);
    const newIsoTime = newTime.toISOString();
    const MIN_GAP_MS = 90 * 1000; // 90 seconds minimum gap

    // Check for conflicts with other scheduled emails
    const conflictingEmail = scheduled.find(s => {
      if (s.id === id) return false; // Skip self
      if (!s.scheduled_send_at) return false;
      const existingTime = new Date(s.scheduled_send_at).getTime();
      const newTimeMs = newTime.getTime();
      return Math.abs(existingTime - newTimeMs) < MIN_GAP_MS;
    });

    if (conflictingEmail) {
      alert(`Cannot schedule within 90 seconds of another email. Conflict with: ${conflictingEmail.email}`);
      return;
    }

    try {
      await supabase.from('contacts').update({ scheduled_send_at: newIsoTime }).eq('id', id);
      setScheduled(prev => prev.map(s => s.id === id ? { ...s, scheduled_send_at: newIsoTime } : s));
      setEditingTimeId(null);
    } catch (err: any) {
      alert("Failed to update time: " + err.message);
    }
  };

  const handleUnschedule = async (ids?: string[]) => {
    const targetIds = ids && ids.length > 0 ? ids : selectedRows;
    if (targetIds.length === 0) return;
    if (!confirm(`Are you sure you want to unschedule ${targetIds.length} contacts?`)) return;
    
    try {
      const { error } = await supabase
        .from('contacts')
        .update({
          status: 'pending',
          scheduled_send_at: null
        })
        .in('id', targetIds)
        .not('status', 'in', '(sent,bounced)');

      if (error) throw error;

      setScheduled(prev => prev.filter(s => !targetIds.includes(s.id)));
      setSelectedRows([]);
      await fetchScheduled();
    } catch (err: any) {
      alert('Failed to unschedule: ' + err.message);
    }
  };

  const handleUnscheduleSelected = () => {
    void handleUnschedule([...selectedRows]);
  };

  const [draftingId, setDraftingId] = useState<string | null>(null);

  const handleCreateDraft = async (row: any) => {
    if (draftingId) return;
    setDraftingId(row.id);
    try {
      const senderId = row.sender_id || row.data?.sender_id;
      if (!senderId) throw new Error("No sender account is linked to this contact.");

      const { data: sender, error: senderErr } = await supabase
        .from('senders')
        .select('*')
        .eq('id', senderId)
        .single();

      if (senderErr || !sender) throw new Error("Sender account not found.");

      if (!row.template_id) throw new Error("No template is linked to this scheduled email.");
      const { data: template, error: tempErr } = await supabase
        .from('templates')
        .select('*')
        .eq('id', row.template_id)
        .single();

      if (tempErr || !template) throw new Error("Template not found.");

      let subject = template.subject || 'No Subject';
      let html = template.body || '';
      
      const fName = row.first_name || row.data?.first_name || '';
      const lName = row.last_name || row.data?.last_name || '';
      const cName = row.company_name || row.data?.company_name || row.company || row.data?.company || '';
      const titleVal = row.title || row.data?.title || '';

      const rep = (str: string) => str
        .replace(/\{\{first_name\}\}/g, fName)
        .replace(/\{\{last_name\}\}/g, lName)
        .replace(/\{\{company_name\}\}/g, cName)
        .replace(/\{\{company\}\}/g, cName)
        .replace(/\{\{title\}\}/g, titleVal);

      subject = rep(subject);
      html = rep(html);

      let attachmentUrl = undefined;
      let attachmentFilename = undefined;
      if (row.attachment_id) {
        const { data: attachment } = await supabase
          .from('attachments')
          .select('*')
          .eq('id', row.attachment_id)
          .single();

        if (attachment?.storage_path) {
          const { data: signedUrlData } = await supabase.storage
            .from('attachments')
            .createSignedUrl(attachment.storage_path, 3600);
          
          attachmentUrl = signedUrlData?.signedUrl;
          attachmentFilename = attachment.filename;
        }
      }

      const res = await invokeNetlifyFunction('create-draft', {
        to: row.email,
        subject: subject,
        html: html,
        from_email: sender.email,
        app_password: sender.app_password,
        sender_name: sender.name || sender.sender_name || undefined,
        attachment_url: attachmentUrl,
        attachment_filename: attachmentFilename,
        auth_type: sender.auth_type
      });

      if (res?.error) throw new Error(res.error);

      // Update database status so it goes to History as sent/resolved
      await supabase.from('contacts').update({
        status: 'sent',
        sent_at: new Date().toISOString()
      }).eq('id', row.id);

      alert(`Draft created successfully in Gmail for ${row.email}!`);
      setScheduled(prev => prev.filter(s => s.id !== row.id));
    } catch (err: any) {
      alert("Failed to create draft: " + err.message);
    } finally {
      setDraftingId(null);
    }
  };

  const sortedScheduled = [...scheduled].sort((a, b) => {
    if (sortBy === 'time-asc') {
      return new Date(a.scheduled_send_at || 0).getTime() - new Date(b.scheduled_send_at || 0).getTime();
    }
    if (sortBy === 'time-desc') {
      return new Date(b.scheduled_send_at || 0).getTime() - new Date(a.scheduled_send_at || 0).getTime();
    }
    if (sortBy === 'name') {
      return (a.first_name || '').localeCompare(b.first_name || '');
    }
    return 0;
  });

  const filteredScheduled = sortedScheduled.filter(s => 
    (s.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.first_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.last_name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-border">
        <div>
          <h1 className="text-xl font-display font-medium tracking-tight">Scheduled</h1>
          <p className="text-xs text-text-secondary mt-1">Emails queued for future delivery.</p>
        </div>
      </div>

      <div className="flex-shrink-0 flex items-center px-6 py-3 border-b border-border space-x-4 bg-surface">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
          <input 
            type="text" 
            placeholder="Search scheduled emails..." 
            className="bg-background border border-border rounded-lg pl-9 pr-4 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary w-full"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-text-tertiary">Sort by:</span>
          <select 
            value={sortBy}
            onChange={(e: any) => setSortBy(e.target.value)}
            className="bg-elevated border border-border text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="time-asc">Time (Soonest First)</option>
            <option value="time-desc">Time (Latest First)</option>
            <option value="name">Name (A-Z)</option>
          </select>
        </div>

        <button className="btn border border-border text-xs h-8 px-3" onClick={fetchScheduled}>
          Refresh
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border bg-surface text-[11px] uppercase tracking-wider text-text-secondary">
              <th className="px-6 py-3 font-medium w-10">
                <input 
                  type="checkbox" 
                  checked={selectedRows.length === filteredScheduled.length && filteredScheduled.length > 0}
                  onChange={handleSelectAll}
                />
              </th>
              <th className="px-6 py-3 font-medium">Scheduled For</th>
              <th className="px-6 py-3 font-medium">Email</th>
              <th className="px-6 py-3 font-medium">Name</th>
              <th className="px-6 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="text-[12.5px]">
            {loading ? (
              <tr><td colSpan={5} className="text-center py-8 text-text-secondary">Loading...</td></tr>
            ) : filteredScheduled.map((row) => (
              <tr key={row.id} className="border-b border-border-soft hover:bg-elevated/50 transition-colors group">
                <td className="px-6 py-3">
                  <input 
                    type="checkbox" 
                    checked={selectedRows.includes(row.id)}
                    onChange={() => handleSelectRow(row.id)}
                  />
                </td>
                <td className="px-6 py-3 font-mono flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-primary" />
                  {editingTimeId === row.id ? (
                    <div className="flex items-center gap-2">
                      <input 
                        type="datetime-local" 
                        value={editTimeValue}
                        onChange={(e) => setEditTimeValue(e.target.value)}
                        className="bg-background border border-border rounded px-2 py-1 text-xs outline-none focus:border-primary"
                        autoFocus
                      />
                      <button onClick={() => handleSaveTime(row.id)} className="text-primary hover:underline text-xs">Save</button>
                      <button onClick={() => setEditingTimeId(null)} className="text-text-tertiary hover:underline text-xs">Cancel</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 group/time cursor-pointer" onClick={() => row.status !== 'bounced' ? handleEditTime(row.id, row.scheduled_send_at) : undefined}>
                      <span className="text-status-finding">
                        {row.scheduled_send_at ? new Date(row.scheduled_send_at).toLocaleString() : 'Not set'}
                      </span>
                      {row.scheduled_send_at && new Date(row.scheduled_send_at).getTime() < Date.now() && row.status !== 'bounced' && (
                        <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400">
                          Overdue
                        </span>
                      )}
                      {row.status === 'bounced' && (
                        <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 font-sans flex items-center gap-1" title={row.data?.last_error || 'Failed to send'}>
                          <AlertCircle className="w-3 h-3" /> Failed
                        </span>
                      )}
                      {row.scheduled_send_at && row.status !== 'bounced' && <span className="text-[10px] text-primary opacity-0 group-hover/time:opacity-100 transition-opacity">Edit</span>}
                    </div>
                  )}
                </td>
                <td className="px-6 py-3 font-mono text-text-primary">
                  {row.email}
                  {row.status === 'bounced' && row.data?.last_error && (
                    <p className="text-[10.5px] text-red-400/80 mt-0.5 italic max-w-xs truncate" title={row.data.last_error}>
                      Error: {row.data.last_error}
                    </p>
                  )}
                </td>
                <td className="px-6 py-3 text-text-secondary">{row.first_name} {row.last_name}</td>
                <td className="px-6 py-3 text-right">
                  <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {row.status === 'bounced' && (
                      <button 
                        onClick={() => handleCreateDraft(row)} 
                        disabled={draftingId === row.id}
                        className="text-primary hover:text-primary-hover flex items-center gap-1 px-2 py-1 text-xs border border-primary/20 hover:border-primary bg-primary/5 hover:bg-primary/10 rounded transition-all"
                      >
                        {draftingId === row.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <FileText className="w-3 h-3" />
                        )}
                        Add to Draft
                      </button>
                    )}
                    <button onClick={() => handleUnschedule([row.id])} className="text-text-tertiary hover:text-status-bounced flex items-center gap-1 px-2 py-1 text-xs hover:bg-red-500/10 rounded transition-colors">
                      <X className="w-3.5 h-3.5" />
                      Cancel
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {!loading && filteredScheduled.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-text-tertiary">
            <Calendar className="w-10 h-10 mb-4 opacity-50" />
            <p>No emails scheduled.</p>
          </div>
        )}
      </div>

      {selectedRows.length > 0 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-elevated border border-border shadow-2xl rounded-lg px-6 py-3 flex items-center space-x-6 z-50">
          <span className="text-sm font-medium text-primary">{selectedRows.length} selected</span>
          <button onClick={handleUnscheduleSelected} className="flex items-center text-sm text-text-secondary hover:text-red-400 gap-2">
            <RotateCcw className="w-4 h-4" /> Unschedule
          </button>
          <button onClick={() => setSelectedRows([])} className="text-sm text-text-tertiary hover:text-text-primary flex items-center gap-2">
            <X className="w-4 h-4" /> Clear
          </button>
        </div>
      )}
    </div>
  );
}
