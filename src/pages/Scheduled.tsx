import { useState, useEffect } from 'react';
import { Calendar, Search, Clock, X, RotateCcw, AlertCircle, FileText, Loader2, RefreshCw, ChevronDown } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { invokeNetlifyFunction } from '../lib/api';

export function ScheduledPage() {
  const [scheduled, setScheduled] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [editingTimeId, setEditingTimeId] = useState<string | null>(null);
  const [editTimeValue, setEditTimeValue] = useState<string>('');
  const [sortBy, setSortBy] = useState<'time-asc' | 'time-desc' | 'name'>('time-asc');
  const [draftingId, setDraftingId] = useState<string | null>(null);

  useEffect(() => {
    fetchScheduled();
  }, []);

  const fetchScheduled = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    
    try {
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

      setScheduled(formatted);
    } catch (err: any) {
      console.error("Error fetching scheduled:", err);
      alert("Error loading scheduled emails: " + err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
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
    const MIN_GAP_MS = 90 * 1000;

    const conflictingEmail = scheduled.find(s => {
      if (s.id === id) return false;
      if (!s.scheduled_send_at) return false;
      const existingTime = new Date(s.scheduled_send_at).getTime();
      const newTimeMs = newTime.getTime();
      return Math.abs(existingTime - newTimeMs) < MIN_GAP_MS;
    });

    if (conflictingEmail) {
      alert(`Cannot schedule within 90 seconds of another email.`);
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
    if (!confirm(`Unschedule ${targetIds.length} email(s)?`)) return;
    
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

  const handleCreateDraft = async (row: any) => {
    if (draftingId) return;
    setDraftingId(row.id);
    try {
      const senderId = row.sender_id || row.data?.sender_id;
      if (!senderId) throw new Error("No sender account linked.");

      const { data: sender, error: senderErr } = await supabase
        .from('senders')
        .select('*')
        .eq('id', senderId)
        .single();

      if (senderErr || !sender) throw new Error("Sender not found.");

      if (!row.template_id) throw new Error("No template linked.");
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

      await supabase.from('contacts').update({
        status: 'sent',
        sent_at: new Date().toISOString()
      }).eq('id', row.id);

      alert(`Draft created for ${row.email}!`);
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
      {/* Header */}
      <div className="flex-shrink-0 px-4 md:px-6 py-4 border-b border-border">
        <div className="slide-up">
          <h1 className="text-xl md:text-2xl font-display font-semibold tracking-tight">Scheduled</h1>
          <p className="text-xs md:text-sm text-text-secondary mt-1">Emails queued for delivery</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex-shrink-0 px-4 md:px-6 py-3 border-b border-border bg-surface/50">
        <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
          {/* Search */}
          <div className="relative flex-1 max-w-full md:max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
            <input 
              type="text" 
              placeholder="Search scheduled..." 
              className="input-field pl-10 h-10 text-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2">
            {/* Sort Dropdown */}
            <div className="relative flex-1 md:flex-none">
              <select 
                value={sortBy}
                onChange={(e: any) => setSortBy(e.target.value)}
                className="input-field h-10 text-sm pr-8 appearance-none"
              >
                <option value="time-asc">Soonest First</option>
                <option value="time-desc">Latest First</option>
                <option value="name">Name (A-Z)</option>
              </select>
              <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none" />
            </div>

            <button 
              onClick={() => fetchScheduled(true)} 
              disabled={refreshing}
              className="btn border border-border h-10 px-3"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-text-secondary gap-4">
            <div className="w-12 h-12 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <span className="text-sm">Loading scheduled emails...</span>
          </div>
        ) : filteredScheduled.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-4 scale-in">
            <div className="w-16 h-16 rounded-2xl bg-elevated flex items-center justify-center mb-4">
              <Calendar className="w-8 h-8 text-text-tertiary" />
            </div>
            <p className="text-base font-medium text-text-primary mb-1">No scheduled emails</p>
            <p className="text-sm text-text-secondary">Schedule a campaign to see emails here</p>
          </div>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="md:hidden p-4 space-y-3 stagger-children">
              {filteredScheduled.map((row) => (
                <div key={row.id} className="card-animated p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <input 
                        type="checkbox" 
                        checked={selectedRows.includes(row.id)}
                        onChange={() => handleSelectRow(row.id)}
                        className="w-5 h-5 rounded border-border accent-primary"
                      />
                      <div>
                        <p className="font-medium text-text-primary">{row.first_name} {row.last_name}</p>
                        <p className="text-xs text-text-secondary truncate max-w-[180px]">{row.email}</p>
                      </div>
                    </div>
                    {row.status === 'bounced' && (
                      <span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-full bg-status-bounced/10 text-status-bounced font-medium flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Failed
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm mb-3">
                    <Clock className="w-4 h-4 text-primary" />
                    <span className="text-status-finding font-mono">
                      {row.scheduled_send_at ? new Date(row.scheduled_send_at).toLocaleString() : 'Not set'}
                    </span>
                    {row.scheduled_send_at && new Date(row.scheduled_send_at).getTime() < Date.now() && row.status !== 'bounced' && (
                      <span className="text-[10px] uppercase px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400">
                        Overdue
                      </span>
                    )}
                  </div>
                  
                  {row.status === 'bounced' && row.data?.last_error && (
                    <p className="text-xs text-status-bounced/80 mb-3 bg-status-bounced/5 p-2 rounded-lg">
                      {row.data.last_error}
                    </p>
                  )}

                  <div className="flex items-center gap-2">
                    {row.status === 'bounced' && (
                      <button 
                        onClick={() => handleCreateDraft(row)} 
                        disabled={draftingId === row.id}
                        className="btn btn-secondary h-9 text-xs flex-1"
                      >
                        {draftingId === row.id ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-1" />
                        ) : (
                          <FileText className="w-4 h-4 mr-1" />
                        )}
                        Add to Draft
                      </button>
                    )}
                    <button 
                      onClick={() => handleUnschedule([row.id])} 
                      className="btn border border-border h-9 text-xs text-text-secondary hover:text-status-bounced flex-1"
                    >
                      <X className="w-4 h-4 mr-1" />
                      Cancel
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border bg-surface text-[11px] uppercase tracking-wider text-text-secondary">
                    <th className="px-6 py-3 font-medium w-10">
                      <input 
                        type="checkbox" 
                        checked={selectedRows.length === filteredScheduled.length && filteredScheduled.length > 0}
                        onChange={handleSelectAll}
                        className="w-4 h-4 rounded border-border accent-primary"
                      />
                    </th>
                    <th className="px-6 py-3 font-medium">Scheduled For</th>
                    <th className="px-6 py-3 font-medium">Email</th>
                    <th className="px-6 py-3 font-medium">Name</th>
                    <th className="px-6 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {filteredScheduled.map((row) => (
                    <tr key={row.id} className="border-b border-border hover:bg-elevated/30 transition-colors group">
                      <td className="px-6 py-4">
                        <input 
                          type="checkbox" 
                          checked={selectedRows.includes(row.id)}
                          onChange={() => handleSelectRow(row.id)}
                          className="w-4 h-4 rounded border-border accent-primary"
                        />
                      </td>
                      <td className="px-6 py-4 font-mono">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-primary" />
                          {editingTimeId === row.id ? (
                            <div className="flex items-center gap-2">
                              <input 
                                type="datetime-local" 
                                value={editTimeValue}
                                onChange={(e) => setEditTimeValue(e.target.value)}
                                className="input-field h-8 text-xs"
                                autoFocus
                              />
                              <button onClick={() => handleSaveTime(row.id)} className="text-primary hover:underline text-xs">Save</button>
                              <button onClick={() => setEditingTimeId(null)} className="text-text-tertiary hover:underline text-xs">Cancel</button>
                            </div>
                          ) : (
                            <div 
                              className="flex items-center gap-2 cursor-pointer group/time" 
                              onClick={() => row.status !== 'bounced' ? handleEditTime(row.id, row.scheduled_send_at) : undefined}
                            >
                              <span className="text-status-finding">
                                {row.scheduled_send_at ? new Date(row.scheduled_send_at).toLocaleString() : 'Not set'}
                              </span>
                              {row.scheduled_send_at && new Date(row.scheduled_send_at).getTime() < Date.now() && row.status !== 'bounced' && (
                                <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400">
                                  Overdue
                                </span>
                              )}
                              {row.status === 'bounced' && (
                                <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-status-bounced/15 text-status-bounced flex items-center gap-1">
                                  <AlertCircle className="w-3 h-3" /> Failed
                                </span>
                              )}
                              {row.scheduled_send_at && row.status !== 'bounced' && (
                                <span className="text-[10px] text-primary opacity-0 group-hover/time:opacity-100 transition-opacity">Edit</span>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <span className="font-mono text-text-primary">{row.email}</span>
                          {row.status === 'bounced' && row.data?.last_error && (
                            <p className="text-xs text-status-bounced/80 mt-0.5 max-w-xs truncate">
                              {row.data.last_error}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-text-secondary">{row.first_name} {row.last_name}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {row.status === 'bounced' && (
                            <button 
                              onClick={() => handleCreateDraft(row)} 
                              disabled={draftingId === row.id}
                              className="btn btn-secondary h-8 text-xs px-3"
                            >
                              {draftingId === row.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <FileText className="w-3.5 h-3.5 mr-1" />
                              )}
                              Draft
                            </button>
                          )}
                          <button 
                            onClick={() => handleUnschedule([row.id])} 
                            className="btn border border-border h-8 text-xs px-3 text-text-secondary hover:text-status-bounced hover:border-status-bounced/30"
                          >
                            <X className="w-3.5 h-3.5 mr-1" />
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Selection Action Bar */}
      {selectedRows.length > 0 && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 
                      bg-surface border border-border shadow-2xl rounded-2xl 
                      px-5 py-3 flex items-center gap-4 z-50 spring-in">
          <span className="text-sm font-medium text-primary">{selectedRows.length} selected</span>
          <div className="w-px h-5 bg-border" />
          <button 
            onClick={() => handleUnschedule([...selectedRows])} 
            className="flex items-center text-sm text-text-secondary hover:text-status-bounced gap-1.5 transition-colors"
          >
            <RotateCcw className="w-4 h-4" /> Unschedule
          </button>
          <button 
            onClick={() => setSelectedRows([])} 
            className="flex items-center text-sm text-text-tertiary hover:text-text-primary gap-1.5 transition-colors"
          >
            <X className="w-4 h-4" /> Clear
          </button>
        </div>
      )}
    </div>
  );
}
