import { useState, useEffect } from 'react';
import { Mail, Key, MessageCircle, Users, CreditCard, Check, Eye, EyeOff, Loader2, CheckCircle, XCircle, Trash2, Clock, LogOut, User, Edit2, X, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState('apify');
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
        throw new Error(
          "Missing VITE_GOOGLE_CLIENT_ID. Add it in Netlify Environment Variables and redeploy."
        );
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
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
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
        setTestMessage(`Connected as "${data.data?.username}" — Plan: ${plan} — Usage: $${Number(usage).toFixed(2)}`);
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
    if (!confirm('This will permanently delete all your app data. Continue?')) return;
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
        if (storageDeleteError) {
          console.warn('Attachment storage cleanup warning:', storageDeleteError.message);
        }
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
    { id: 'sender', icon: Mail, label: 'Sender Email' },
    { id: 'scheduling', icon: Clock, label: 'Scheduling' },
    { id: 'telegram', icon: MessageCircle, label: 'Telegram' },
    { id: 'team', icon: Users, label: 'Team' },
    { id: 'billing', icon: CreditCard, label: 'Billing' },
    { id: 'danger', icon: Trash2, label: 'Danger Zone' },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 px-4 md:px-6 py-4 border-b border-border">
        <div className="slide-up">
          <h1 className="text-xl md:text-2xl font-display font-semibold tracking-tight">Settings</h1>
          <p className="text-xs md:text-sm text-text-secondary mt-1">Manage your account and preferences</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Mobile Tab Navigation - Horizontal Scroll */}
        <div className="flex-shrink-0 md:hidden border-b border-border bg-surface overflow-x-auto scrollbar-none">
          <div className="flex gap-1 p-2 min-w-max">
            {tabs.map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium
                          whitespace-nowrap transition-all duration-200 active:scale-95
                          ${activeTab === id 
                            ? 'bg-primary/10 text-primary' 
                            : 'text-text-secondary hover:text-text-primary hover:bg-elevated'}`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Desktop Sidebar */}
        <div className="hidden md:flex w-56 border-r border-border bg-surface p-4 flex-col gap-1 overflow-y-auto flex-shrink-0">
          {tabs.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center px-3 py-2.5 text-sm rounded-xl transition-all duration-200
                        ${activeTab === id 
                          ? 'bg-primary/10 text-primary' 
                          : 'text-text-secondary hover:text-text-primary hover:bg-elevated'}`}
            >
              <Icon className="w-4 h-4 mr-3" /> {label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-2xl mx-auto md:mx-0">
            {/* Account Tab */}
            {activeTab === 'account' && (
              <div className="space-y-6 slide-up">
                <div>
                  <h2 className="text-lg font-semibold mb-1">Account</h2>
                  <p className="text-sm text-text-secondary">Manage your login session</p>
                </div>

                <div className="card-animated p-5 space-y-4">
                  <p className="text-sm text-text-secondary">
                    Log out from your account on this device.
                  </p>
                  <button
                    onClick={handleLogout}
                    disabled={loggingOut}
                    className="btn border border-border hover:bg-elevated w-full md:w-auto"
                  >
                    {loggingOut ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <LogOut className="w-4 h-4 mr-2" />
                    )}
                    {loggingOut ? 'Logging out...' : 'Log Out'}
                  </button>
                </div>
              </div>
            )}

            {/* Apify Tab */}
            {activeTab === 'apify' && (
              <div className="space-y-6 slide-up">
                <div>
                  <h2 className="text-lg font-semibold mb-1">Apify API Keys</h2>
                  <p className="text-sm text-text-secondary">
                    Used to find emails from LinkedIn profiles
                  </p>
                </div>

                <div className="card-animated p-5 space-y-5">
                  {/* Primary Key */}
                  <div>
                    <label className="label flex items-center gap-2">
                      Primary Key
                      <span className="text-primary text-[10px] px-1.5 py-0.5 rounded bg-primary/10 font-semibold">Active</span>
                    </label>
                    <div className="flex flex-col md:flex-row gap-2 mt-1">
                      <div className="relative flex-1">
                        <input
                          type={showPrimary ? 'text' : 'password'}
                          value={primaryKey}
                          onChange={(e) => setPrimaryKey(e.target.value)}
                          className="input-field w-full font-mono text-sm pr-12"
                          placeholder="apify_api_..."
                        />
                        <button
                          type="button"
                          onClick={() => setShowPrimary(p => !p)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-text-tertiary hover:text-text-primary rounded transition-colors"
                        >
                          {showPrimary ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                      <button
                        onClick={handleTestKey}
                        disabled={testStatus === 'testing'}
                        className="btn border border-border hover:bg-elevated whitespace-nowrap"
                      >
                        {testStatus === 'testing' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Test Key'}
                      </button>
                    </div>
                    {testMessage && (
                      <p className={`text-xs mt-2 flex items-center gap-1.5 ${testStatus === 'ok' ? 'text-primary' : 'text-status-bounced'}`}>
                        {testStatus === 'ok' ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                        {testMessage}
                      </p>
                    )}
                  </div>

                  {/* Fallback Key */}
                  <div>
                    <label className="label">
                      Fallback Key
                      <span className="text-text-tertiary text-[10px] ml-2 font-normal">Auto-used if primary hits quota</span>
                    </label>
                    <div className="relative mt-1">
                      <input
                        type={showFallback ? 'text' : 'password'}
                        value={fallbackKey}
                        onChange={(e) => setFallbackKey(e.target.value)}
                        className="input-field w-full font-mono text-sm pr-12"
                        placeholder="apify_api_... (optional)"
                      />
                      <button
                        type="button"
                        onClick={() => setShowFallback(p => !p)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-text-tertiary hover:text-text-primary rounded transition-colors"
                      >
                        {showFallback ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <button onClick={handleSaveKeys} disabled={saving} className="btn btn-primary">
                      {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Save Keys
                    </button>
                    {saveResult === 'success' && (
                      <span className="flex items-center gap-1.5 text-sm text-primary spring-in">
                        <CheckCircle className="w-4 h-4" /> Saved!
                      </span>
                    )}
                    {saveResult === 'error' && (
                      <span className="flex items-center gap-1.5 text-sm text-status-bounced spring-in">
                        <XCircle className="w-4 h-4" /> Failed
                      </span>
                    )}
                  </div>
                </div>

                <div className="card-animated p-4 bg-elevated/50 text-xs text-text-secondary space-y-1.5">
                  <p className="font-medium text-text-primary mb-2">How email finding works</p>
                  <p>1. Email finding runs through your Supabase Edge Function.</p>
                  <p>2. It uses a waterfall of LinkedIn email actors.</p>
                  <p>3. The free Apify plan gives about $5/month in credits.</p>
                </div>
              </div>
            )}

            {/* Telegram Tab */}
            {activeTab === 'telegram' && (
              <div className="space-y-6 slide-up">
                <div>
                  <h2 className="text-lg font-semibold mb-1">Telegram Bot</h2>
                  <p className="text-sm text-text-secondary">Control ZangSends from your phone</p>
                </div>
                <div className="card-animated p-5 space-y-4">
                  <div>
                    <label className="label">Bot Token</label>
                    <p className="text-xs text-text-secondary mb-2">Obtain from @BotFather on Telegram</p>
                    <div className="flex flex-col md:flex-row gap-2">
                      <input 
                        type="password" 
                        value={botToken} 
                        onChange={(e) => setBotToken(e.target.value)} 
                        className="input-field flex-1 font-mono text-sm" 
                      />
                      <button className="btn btn-primary">Save</button>
                    </div>
                  </div>
                  {botToken && (
                    <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-xl p-3 text-sm spring-in">
                      <Check className="w-4 h-4 text-primary" />
                      <span className="text-text-primary">Webhook active. Message your bot on Telegram.</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Sender Tab */}
            {activeTab === 'sender' && (
              <div className="space-y-6 slide-up">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold mb-1">Sender Accounts</h2>
                    <p className="text-sm text-text-secondary">Connect Gmail accounts via Google OAuth</p>
                  </div>
                  <button 
                    onClick={handleGoogleSignIn}
                    className="btn bg-white hover:bg-gray-100 text-gray-900 border border-gray-200 w-full md:w-auto"
                  >
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-4 h-4 mr-2" />
                    Sign in with Google
                  </button>
                </div>

                <div className="space-y-3">
                  {sendersError && (
                    <div className="p-4 border border-status-bounced/20 bg-status-bounced/5 rounded-xl text-sm text-status-bounced spring-in">
                      Failed to load senders: {sendersError}
                    </div>
                  )}
                  {loadingSenders ? (
                    <div className="py-12 text-center text-text-tertiary">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 opacity-50" />
                      Loading accounts...
                    </div>
                  ) : senders.length === 0 ? (
                    <div className="py-12 border border-dashed border-border rounded-xl text-center">
                      <Mail className="w-8 h-8 text-text-tertiary mx-auto mb-3 opacity-20" />
                      <p className="text-sm text-text-secondary">No sender accounts connected yet.</p>
                    </div>
                  ) : (
                    senders.map(sender => {
                      const isEditing = editingSenderId === sender.id;
                      return (
                        <div key={sender.id} className="card-animated p-4">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                              <Mail className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              {isEditing ? (
                                <div className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    value={editingSenderName}
                                    onChange={(e) => setEditingSenderName(e.target.value)}
                                    className="input-field py-2 px-3 text-sm flex-1"
                                    placeholder="Display name..."
                                    autoFocus
                                  />
                                  <button
                                    onClick={() => handleUpdateSenderName(sender.id, editingSenderName)}
                                    className="p-2 text-primary hover:bg-primary/10 rounded-xl transition-colors"
                                  >
                                    <Check className="w-5 h-5" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      setEditingSenderId(null);
                                      setEditingSenderName('');
                                    }}
                                    className="p-2 text-text-tertiary hover:text-text-primary hover:bg-elevated rounded-xl transition-colors"
                                  >
                                    <X className="w-5 h-5" />
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <div className="flex items-center gap-2">
                                    <p className="font-medium text-text-primary truncate">
                                      {sender.name || sender.email}
                                    </p>
                                    <button
                                      onClick={() => {
                                        setEditingSenderId(sender.id);
                                        setEditingSenderName(sender.name || '');
                                      }}
                                      className="p-1.5 text-text-tertiary hover:text-primary rounded-lg transition-colors"
                                    >
                                      <Edit2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                  {sender.name && <p className="text-xs text-text-secondary truncate mt-0.5">{sender.email}</p>}
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="text-[10px] uppercase tracking-wider text-text-tertiary">Gmail SMTP</span>
                                    <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                                    <span className="text-[10px] text-primary uppercase tracking-wider font-medium">Verified</span>
                                  </div>
                                </>
                              )}
                            </div>
                            {!isEditing && (
                              <button 
                                onClick={() => handleDeleteSender(sender.id)}
                                className="p-2.5 text-text-tertiary hover:text-status-bounced hover:bg-status-bounced/10 rounded-xl transition-all"
                              >
                                <Trash2 className="w-5 h-5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="card-animated p-4 bg-status-opened/5 border-status-opened/20 text-xs text-status-opened/80 space-y-1.5">
                  <p className="font-medium text-status-opened mb-2 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" /> Setting up Gmail App Passwords
                  </p>
                  <p>1. Go to your Google Account settings</p>
                  <p>2. Navigate to Security and enable 2-Step Verification</p>
                  <p>3. Search for &quot;App Passwords&quot;</p>
                  <p>4. Create a new app password and copy the 16-character code</p>
                </div>
              </div>
            )}

            {/* Scheduling Tab */}
            {activeTab === 'scheduling' && (
              <div className="space-y-6 slide-up">
                <div>
                  <h2 className="text-lg font-semibold mb-1">Working Hours (IST)</h2>
                  <p className="text-sm text-text-secondary">Set the daily window for sending scheduled emails</p>
                </div>

                <div className="card-animated p-5 space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label">Start Time</label>
                      <input 
                        type="time" 
                        value={workingHours.start}
                        onChange={(e) => setWorkingHours({...workingHours, start: e.target.value})}
                        className="input-field" 
                      />
                    </div>
                    <div>
                      <label className="label">End Time</label>
                      <input 
                        type="time" 
                        value={workingHours.end}
                        onChange={(e) => setWorkingHours({...workingHours, end: e.target.value})}
                        className="input-field" 
                      />
                    </div>
                  </div>

                  <button 
                    onClick={() => {
                      localStorage.setItem('zangsend_working_hours', JSON.stringify(workingHours));
                      alert('Working hours saved!');
                    }} 
                    className="btn btn-primary w-full md:w-auto"
                  >
                    Save Settings
                  </button>
                </div>

                <div className="card-animated p-4 bg-elevated/50 text-xs text-text-secondary space-y-1.5">
                  <p className="font-medium text-text-primary mb-2">How Scheduling Works</p>
                  <p>1. Send times are distributed evenly between start and end times</p>
                  <p>2. The scheduler switches between connected Gmail accounts</p>
                  <p>3. Each account is limited to 45 emails per day</p>
                </div>
              </div>
            )}

            {/* Team & Billing */}
            {(activeTab === 'team' || activeTab === 'billing') && (
              <div className="flex flex-col items-center justify-center py-20 text-text-secondary slide-up">
                <div className="w-16 h-16 rounded-2xl bg-elevated flex items-center justify-center mb-4">
                  {activeTab === 'team' ? <Users className="w-8 h-8 text-text-tertiary" /> : <CreditCard className="w-8 h-8 text-text-tertiary" />}
                </div>
                <p className="text-lg font-medium text-text-primary mb-1">Coming Soon</p>
                <p className="text-sm">This feature is under development</p>
              </div>
            )}

            {/* Danger Zone */}
            {activeTab === 'danger' && (
              <div className="space-y-6 slide-up">
                <div>
                  <h2 className="text-lg font-semibold mb-1 text-status-bounced">Danger Zone</h2>
                  <p className="text-sm text-text-secondary">Permanently remove all app data</p>
                </div>

                <div className="card-animated p-5 border-status-bounced/30 bg-status-bounced/5 space-y-4">
                  <p className="text-sm text-status-bounced/80">
                    This deletes: lists, contacts, templates, scheduled/sent history, senders, attachments, and app settings.
                  </p>
                  <button
                    onClick={handleResetAccountData}
                    disabled={resetting}
                    className="btn btn-destructive w-full md:w-auto"
                  >
                    {resetting ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4 mr-2" />
                    )}
                    {resetting ? 'Resetting...' : 'Reset Account Data'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
