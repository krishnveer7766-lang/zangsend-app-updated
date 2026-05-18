import { useState, useEffect } from 'react';
import { Mail, Key, MessageCircle, Users, CreditCard, Check, Eye, EyeOff, Loader2, CheckCircle, XCircle, Trash2, Clock, LogOut, User, Edit2, X, ChevronRight, ShieldAlert } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState('account');
  const [botToken, setBotToken] = useState('');

  // Apify keys — persisted in localStorage
  const [primaryKey, setPrimaryKey] = useState(() => localStorage.getItem('apify_primary') || '');
  const [fallbackKey, setFallbackKey] = useState(() => localStorage.getItem('apify_fallback') || '');
  const [showPrimary, setShowPrimary] = useState(false);
  const [showFallback, setShowFallback] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [saveResult, setSaveResult] = useState<'success' | 'error' | null>(null);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);

  // Senders state
  const [senders, setSenders] = useState<any[]>([]);
  const [loadingSenders, setLoadingSenders] = useState(false);
  const [sendersError, setSendersError] = useState<string>('');
  const [editingSenderId, setEditingSenderId] = useState<string | null>(null);
  const [editingSenderName, setEditingSenderName] = useState<string>('');

  // Scheduling State
  const [workingHours, setWorkingHours] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('zangsend_working_hours') || '{"start":"09:00","end":"18:00"}');
    } catch {
      return { start: '09:00', end: '18:00' };
    }
  });

  useEffect(() => {
    if (activeTab === 'sender') {
      fetchSenders();
    }
  }, [activeTab]);

  useEffect(() => {
    if (window.location.search.includes('success=1')) {
      alert("Successfully connected Gmail account!");
      setActiveTab('sender');
      fetchSenders();
      window.history.replaceState({}, '', '/settings');
    }
  }, []);

  const handleGoogleSignIn = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not logged in");

      const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
      if (!clientId) {
        throw new Error("Missing VITE_GOOGLE_CLIENT_ID. Please configure it in your environment.");
      }
      const redirectUri = `${window.location.origin}/api/oauth-callback`;
      const scopes = encodeURIComponent('https://mail.google.com/ email profile');
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scopes}&access_type=offline&prompt=consent&state=${user.id}`;
      
      window.location.href = authUrl;
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  const fetchSenders = async () => {
    setLoadingSenders(true);
    setSendersError('');
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) {
        setSenders([]);
        setSendersError('Not authenticated');
        return;
      }

      const res = await fetch('/.netlify/functions/get-senders', {
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const payload = await res.json();
      if (!res.ok) {
        setSenders([]);
        setSendersError(payload?.error || 'Failed to load senders');
        return;
      }

      const rows = Array.isArray(payload?.senders) ? payload.senders : [];
      setSenders(rows);
    } catch (err: any) {
      console.error('Exception fetching senders:', err);
      setSendersError(err?.message || 'Failed to load senders');
      setSenders([]);
    } finally {
      setLoadingSenders(false);
    }
  };

  const handleDeleteSender = async (id: string) => {
    if (!confirm('Remove this sender?')) return;
    try {
      const { error } = await supabase.from('senders').delete().eq('id', id);
      if (error) throw error;
      setSenders(prev => prev.filter(s => s.id !== id));
    } catch (err: any) {
      alert('Error deleting sender: ' + err.message);
    }
  };

  const handleUpdateSenderName = async (id: string, name: string) => {
    try {
      const { error } = await supabase
        .from('senders')
        .update({ name: name.trim() })
        .eq('id', id);

      if (error) throw error;
      setSenders(prev => prev.map(s => s.id === id ? { ...s, name: name.trim() } : s));
      setEditingSenderId(null);
      setEditingSenderName('');
    } catch (err: any) {
      alert('Error updating sender name: ' + err.message);
    }
  };

  const handleSaveKeys = async () => {
    setSaving(true);
    setSaveResult(null);
    try {
      localStorage.setItem('apify_primary', primaryKey.trim());
      localStorage.setItem('apify_fallback', fallbackKey.trim());
      setSaveResult('success');
    } catch {
      setSaveResult('error');
    } finally {
      setSaving(false);
      setTimeout(() => setSaveResult(null), 3000);
    }
  };

  const handleTestKey = async () => {
    setTestStatus('testing');
    setTestMessage('');
    try {
      const res = await fetch('https://api.apify.com/v2/users/me', {
        headers: { 'Authorization': `Bearer ${primaryKey.trim()}` }
      });
      const data = await res.json();
      if (res.ok) {
        const usage = data.data?.monthlyUsage?.totalCostUsd ?? 0;
        const plan = data.data?.plan?.id ?? 'FREE';
        setTestStatus('ok');
        setTestMessage(`Connected as "${data.data?.username}" — Plan: ${plan} — Monthly usage: $${Number(usage).toFixed(2)}`);
      } else {
        setTestStatus('error');
        setTestMessage(`Invalid key: ${data.error?.message || 'Unknown error'}`);
      }
    } catch (err: any) {
      setTestStatus('error');
      setTestMessage(`Network error: ${err.message}`);
    }
  };

  const handleResetAccountData = async () => {
    if (!confirm('This will permanently delete all your app data (lists, contacts, templates, attachments, senders, schedule/history data). Continue?')) return;
    if (!confirm('Final confirmation: this cannot be undone. Reset all account data now?')) return;

    setResetting(true);
    try {
      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      const userId = userRes.user?.id;
      if (!userId) throw new Error('Not authenticated');

      const { data: attachmentRows, error: attachmentReadError } = await supabase
        .from('attachments')
        .select('storage_path')
        .eq('user_id', userId);
      if (attachmentReadError) throw attachmentReadError;

      const storagePaths = (attachmentRows || [])
        .map((r: any) => r.storage_path)
        .filter(Boolean);
      if (storagePaths.length > 0) {
        const { error: storageDeleteError } = await supabase.storage.from('attachments').remove(storagePaths);
        if (storageDeleteError) console.warn('Attachment storage cleanup warning:', storageDeleteError.message);
      }

      const safeDeleteByUser = async (table: string) => {
        const { error } = await supabase.from(table).delete().eq('user_id', userId);
        if (!error) return;
        if (error.code === '42P01' || error.code === 'PGRST205') return;
        throw error;
      };

      await Promise.all([
        safeDeleteByUser('contacts'),
        safeDeleteByUser('campaigns'),
        safeDeleteByUser('templates'),
        safeDeleteByUser('senders'),
        safeDeleteByUser('attachments'),
        safeDeleteByUser('lists'),
        safeDeleteByUser('apify_keys'),
        safeDeleteByUser('telegram_config'),
      ]);

      localStorage.removeItem('apify_primary');
      localStorage.removeItem('apify_fallback');
      localStorage.removeItem('zangsend_working_hours');

      alert('Account data reset complete.');
      window.location.href = '/lists';
      window.location.reload();
    } catch (err: any) {
      alert('Failed to reset account data: ' + (err?.message || 'Unknown error'));
    } finally {
      setResetting(false);
    }
  };

  const handleLogout = async () => {
    if (!confirm('Log out from this account now?')) return;
    setLoggingOut(true);
    try {
      await supabase.auth.signOut({ scope: 'global' });
    } catch (err: any) {
      console.error('Sign out error:', err?.message || err);
    } finally {
      localStorage.removeItem('apify_primary');
      localStorage.removeItem('apify_fallback');
      localStorage.removeItem('zangsend_working_hours');
      sessionStorage.clear();
      window.location.href = '/login';
    }
  };

  const tabs = [
    { id: 'account', icon: User, label: 'Account' },
    { id: 'apify', icon: Key, label: 'Apify Keys' },
    { id: 'sender', icon: Mail, label: 'Senders' },
    { id: 'scheduling', icon: Clock, label: 'Hours' },
    { id: 'telegram', icon: MessageCircle, label: 'Telegram' },
    { id: 'team', icon: Users, label: 'Team' },
    { id: 'billing', icon: CreditCard, label: 'Billing' },
    { id: 'danger', icon: ShieldAlert, label: 'Danger' },
  ];

  return (
    <div className="h-full flex flex-col pb-20 md:pb-0">
      <div className="flex-shrink-0 px-6 py-5 border-b border-border bg-surface/30">
        <h1 className="text-2xl font-display font-bold tracking-tight text-text-primary">Settings</h1>
      </div>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Navigation - Horizontal on Mobile, Sidebar on Desktop */}
        <div className="flex-shrink-0 w-full md:w-60 border-b md:border-b-0 md:border-r border-border bg-surface/50 backdrop-blur-md overflow-x-auto md:overflow-y-auto no-scrollbar">
          <nav className="flex md:flex-col p-3 gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center px-4 py-2.5 text-sm font-medium rounded-xl transition-all whitespace-nowrap active:scale-95 ${
                  activeTab === tab.id 
                    ? 'bg-primary text-black' 
                    : 'text-text-secondary hover:text-text-primary hover:bg-elevated/50'
                }`}
              >
                <tab.icon className={`w-4 h-4 mr-3 ${activeTab === tab.id ? 'text-black' : 'text-text-tertiary'}`} />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-10 custom-scrollbar">
          <div className="max-w-2xl mx-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              >
                {activeTab === 'account' && (
                  <div className="space-y-8">
                    <header>
                      <h2 className="text-2xl font-display font-bold text-text-primary">Profile</h2>
                      <p className="text-sm text-text-tertiary mt-2">Manage your account and authentication.</p>
                    </header>

                    <div className="bg-surface/50 border border-border rounded-2xl p-6 shadow-sm space-y-6">
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-elevated border-2 border-border flex items-center justify-center text-text-tertiary">
                          <User className="w-8 h-8" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-text-primary">Connected Account</p>
                          <p className="text-xs text-text-tertiary">You are currently logged in via Supabase.</p>
                        </div>
                      </div>
                      
                      <div className="pt-4 border-t border-border">
                        <button
                          onClick={handleLogout}
                          disabled={loggingOut}
                          className="btn btn-secondary w-full sm:w-auto h-11"
                        >
                          {loggingOut ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LogOut className="w-4 h-4 mr-2" />}
                          {loggingOut ? 'Logging out...' : 'Sign Out'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'apify' && (
                  <div className="space-y-8">
                    <header>
                      <h2 className="text-2xl font-display font-bold text-text-primary">Intelligence Engine</h2>
                      <p className="text-sm text-text-tertiary mt-2">Configure Apify API keys for email discovery.</p>
                    </header>

                    <div className="bg-surface/50 border border-border rounded-2xl p-6 shadow-sm space-y-8">
                      <div>
                        <label className="label">Primary API Token</label>
                        <div className="relative mt-2">
                          <input
                            type={showPrimary ? 'text' : 'password'}
                            value={primaryKey}
                            onChange={(e) => setPrimaryKey(e.target.value)}
                            className="input-field pr-12 font-mono text-xs tracking-wider h-12"
                            placeholder="apify_api_..."
                          />
                          <button
                            onClick={() => setShowPrimary(p => !p)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-text-tertiary hover:text-text-primary transition-colors"
                          >
                            {showPrimary ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        {testMessage && (
                          <motion.p 
                            initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
                            className={`text-[11px] mt-3 font-medium flex items-center gap-1.5 ${testStatus === 'ok' ? 'text-primary' : 'text-status-bounced'}`}
                          >
                            {testStatus === 'ok' ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                            {testMessage}
                          </motion.p>
                        )}
                      </div>

                      <div>
                        <label className="label">Fallback API Token</label>
                        <div className="relative mt-2">
                          <input
                            type={showFallback ? 'text' : 'password'}
                            value={fallbackKey}
                            onChange={(e) => setFallbackKey(e.target.value)}
                            className="input-field pr-12 font-mono text-xs tracking-wider h-12"
                            placeholder="apify_api_... (optional)"
                          />
                          <button
                            onClick={() => setShowFallback(p => !p)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-text-tertiary hover:text-text-primary transition-colors"
                          >
                            {showFallback ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-3 pt-4">
                        <button onClick={handleSaveKeys} disabled={saving} className="btn btn-primary h-11 flex-1 sm:flex-none px-8">
                          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                          Save Configuration
                        </button>
                        <button
                          onClick={handleTestKey}
                          disabled={testStatus === 'testing' || !primaryKey}
                          className="btn btn-secondary h-11"
                        >
                          {testStatus === 'testing' && <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />}
                          Test Primary Key
                        </button>
                      </div>
                    </div>

                    <div className="p-5 bg-elevated/30 border border-border rounded-xl space-y-3">
                      <h3 className="text-xs font-bold uppercase tracking-widest text-text-secondary flex items-center gap-2">
                        <ShieldAlert className="w-3.5 h-3.5 text-primary" />
                        Discovery Workflow
                      </h3>
                      <p className="text-[11px] text-text-tertiary leading-relaxed">
                        We use a proprietary waterfall engine that cycles through multiple LinkedIn scraper actors. If an email is not found by the first actor, the engine automatically attempts others to ensure maximum lead coverage.
                      </p>
                    </div>
                  </div>
                )}

                {activeTab === 'sender' && (
                  <div className="space-y-8">
                    <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <h2 className="text-2xl font-display font-bold text-text-primary">Senders</h2>
                        <p className="text-sm text-text-tertiary mt-2">Connect Gmail accounts via Secure OAuth.</p>
                      </div>
                      <button 
                        onClick={handleGoogleSignIn}
                        className="btn bg-white hover:bg-gray-100 text-black h-11 px-6 rounded-full active:scale-[0.98] transition-all"
                      >
                        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" className="w-4 h-4 mr-2" />
                        Connect Gmail
                      </button>
                    </header>

                    <div className="space-y-4">
                      {sendersError && (
                        <div className="p-4 bg-status-bounced/10 border border-status-bounced/20 rounded-xl text-xs text-status-bounced font-medium">
                          {sendersError}
                        </div>
                      )}
                      
                      {loadingSenders ? (
                        <div className="py-20 text-center">
                          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary/50" />
                        </div>
                      ) : senders.length === 0 ? (
                        <div className="py-16 border-2 border-dashed border-border rounded-3xl text-center">
                          <div className="w-16 h-16 bg-elevated rounded-full flex items-center justify-center mx-auto mb-4 opacity-50">
                            <Mail className="w-8 h-8 text-text-tertiary" />
                          </div>
                          <p className="text-sm font-medium text-text-secondary">No sender accounts yet.</p>
                          <p className="text-xs text-text-tertiary mt-2 max-w-xs mx-auto">Connect your first Gmail account to start sending campaigns.</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {senders.map(sender => (
                            <motion.div 
                              layout
                              key={sender.id} 
                              className="group bg-surface/50 border border-border rounded-2xl p-4 hover:border-primary/30 transition-all active:scale-[0.99]"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4 flex-1 min-w-0">
                                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary flex-shrink-0 group-hover:scale-110 transition-transform">
                                    <Mail className="w-6 h-6" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <h4 className="text-sm font-bold text-text-primary truncate">{sender.name || sender.email}</h4>
                                    <div className="flex items-center gap-2 mt-1">
                                      <span className="text-[10px] text-text-tertiary font-medium">{sender.email}</span>
                                      <span className="w-1 h-1 rounded-full bg-primary animate-pulse" />
                                      <span className="text-[9px] font-black uppercase tracking-widest text-primary">Active</span>
                                    </div>
                                  </div>
                                </div>
                                <button 
                                  onClick={() => handleDeleteSender(sender.id)}
                                  className="p-3 text-text-tertiary hover:text-status-bounced transition-colors"
                                >
                                  <Trash2 className="w-5 h-5" />
                                </button>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === 'scheduling' && (
                  <div className="space-y-8">
                    <header>
                      <h2 className="text-2xl font-display font-bold text-text-primary">Dispatch Rules</h2>
                      <p className="text-sm text-text-tertiary mt-2">Control when and how emails are dispatched.</p>
                    </header>

                    <div className="bg-surface/50 border border-border rounded-2xl p-6 shadow-sm space-y-8">
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <label className="label">Window Start</label>
                          <input 
                            type="time" 
                            value={workingHours.start}
                            onChange={(e) => setWorkingHours({...workingHours, start: e.target.value})}
                            className="input-field h-12 text-base font-mono" 
                          />
                        </div>
                        <div>
                          <label className="label">Window End</label>
                          <input 
                            type="time" 
                            value={workingHours.end}
                            onChange={(e) => setWorkingHours({...workingHours, end: e.target.value})}
                            className="input-field h-12 text-base font-mono" 
                          />
                        </div>
                      </div>

                      <div className="pt-4 border-t border-border">
                        <button 
                          onClick={() => {
                            localStorage.setItem('zangsend_working_hours', JSON.stringify(workingHours));
                            alert('Scheduling rules updated!');
                          }} 
                          className="btn btn-primary w-full h-12 rounded-xl"
                        >
                          Update Rules
                        </button>
                      </div>
                    </div>

                    <div className="p-5 bg-primary/5 border border-primary/10 rounded-xl space-y-4">
                      <div className="flex items-center gap-3">
                        <Clock className="w-5 h-5 text-primary" />
                        <h3 className="text-sm font-bold text-text-primary">Anti-Spam Intelligence</h3>
                      </div>
                      <ul className="space-y-2">
                        {[
                          "Distributed dispatching across active window.",
                          "Automatic rotation between multiple senders.",
                          "Safety cap of 45 emails per sender/day.",
                          "Randomized interval delay between sends."
                        ].map((rule, i) => (
                          <li key={i} className="flex items-center gap-2 text-[11px] text-text-secondary">
                            <Check className="w-3 h-3 text-primary" /> {rule}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {activeTab === 'danger' && (
                  <div className="space-y-8">
                    <header>
                      <h2 className="text-2xl font-display font-bold text-status-bounced">Danger Zone</h2>
                      <p className="text-sm text-text-tertiary mt-2">Irreversible account actions.</p>
                    </header>

                    <div className="bg-status-bounced/5 border border-status-bounced/20 rounded-2xl p-6 space-y-6">
                      <div>
                        <h3 className="text-base font-bold text-text-primary">Erase All Data</h3>
                        <p className="text-xs text-text-tertiary mt-2 leading-relaxed">
                          This will wipe all lists, contacts, templates, and history from our servers. Your authentication account will remain active, but all campaign data will be gone forever.
                        </p>
                      </div>
                      
                      <button
                        onClick={handleResetAccountData}
                        disabled={resetting}
                        className="btn border border-status-bounced/40 text-status-bounced hover:bg-status-bounced hover:text-white w-full h-12 rounded-xl transition-all"
                      >
                        {resetting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                        {resetting ? 'Processing Wipe...' : 'Permanently Delete All Data'}
                      </button>
                    </div>
                  </div>
                )}

                {['telegram', 'team', 'billing'].includes(activeTab) && (
                  <div className="py-20 flex flex-col items-center justify-center text-center space-y-4">
                    <div className="w-20 h-20 bg-elevated rounded-full flex items-center justify-center opacity-20">
                      <Clock className="w-10 h-10" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-text-primary">Coming Soon</h3>
                      <p className="text-sm text-text-tertiary mt-1">This feature is currently in active development.</p>
                    </div>
                    <button onClick={() => setActiveTab('account')} className="btn btn-secondary mt-4">Back to Account</button>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  );
}
