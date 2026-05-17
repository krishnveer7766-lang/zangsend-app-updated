import { useState, useEffect } from 'react';
import { Mail, Key, MessageCircle, Users, CreditCard, Check, Eye, EyeOff, Loader2, CheckCircle, XCircle, Trash2, Clock, LogOut, User, Edit2, X } from 'lucide-react';
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
      // Clean up URL
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
          "Missing VITE_GOOGLE_CLIENT_ID. Add it in Netlify Environment Variables and redeploy (Clear cache and deploy site)."
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

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 px-6 py-4 border-b border-border">
        <h1 className="text-xl font-display font-medium tracking-tight">Settings</h1>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className="w-56 border-r border-border bg-surface p-4 space-y-1 overflow-y-auto">
          {([
            { id: 'account', icon: User, label: 'Account' },
            { id: 'apify', icon: Key, label: 'Apify Keys' },
            { id: 'sender', icon: Mail, label: 'Sender Email' },
            { id: 'scheduling', icon: Clock, label: 'Scheduling' },
            { id: 'telegram', icon: MessageCircle, label: 'Telegram Bot' },
            { id: 'team', icon: Users, label: 'Team' },
            { id: 'billing', icon: CreditCard, label: 'Billing' },
            { id: 'danger', icon: Trash2, label: 'Danger Zone' },
          ] as { id: string; icon: any; label: string }[]).map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`w-full flex items-center px-3 py-2 text-sm rounded-md transition-colors ${activeTab === id ? 'bg-primary-ghost text-primary-text' : 'text-text-secondary hover:text-text-primary hover:bg-elevated'}`}
            >
              <Icon className="w-4 h-4 mr-3" /> {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 max-w-3xl">
          {activeTab === 'account' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-medium mb-1">Account</h2>
                <p className="text-sm text-text-secondary">Manage your login session.</p>
              </div>

              <div className="p-5 border border-border bg-surface rounded-lg space-y-4">
                <p className="text-sm text-text-secondary">
                  Completely log out from your account on this device.
                </p>
                <button
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="btn border border-border text-sm hover:bg-elevated"
                >
                  {loggingOut ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LogOut className="w-4 h-4 mr-2" />}
                  {loggingOut ? 'Logging out...' : 'Log Out'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'apify' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-medium mb-1">Apify API Keys</h2>
                <p className="text-sm text-text-secondary">
                  Used to find emails from LinkedIn profiles. The primary key is used first; fallback kicks in on quota limits.
                </p>
              </div>

              <div className="p-5 border border-border bg-surface rounded-lg space-y-5">
                {/* Primary */}
                <div>
                  <label className="label">
                    Primary Key
                    <span className="text-primary text-[10px] ml-2 uppercase tracking-wider font-medium">Active</span>
                  </label>
                  <div className="flex gap-2 mt-1">
                    <div className="relative flex-1">
                      <input
                        type={showPrimary ? 'text' : 'password'}
                        value={primaryKey}
                        onChange={(e) => setPrimaryKey(e.target.value)}
                        className="input-field w-full font-mono text-xs pr-10"
                        placeholder="apify_api_..."
                      />
                      <button
                        onClick={() => setShowPrimary(p => !p)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary"
                      >
                        {showPrimary ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <button
                      onClick={handleTestKey}
                      disabled={testStatus === 'testing'}
                      className="btn border border-border hover:bg-elevated text-xs h-10 px-4 whitespace-nowrap"
                    >
                      {testStatus === 'testing' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Test Key'}
                    </button>
                  </div>
                  {testMessage && (
                    <p className={`text-xs mt-2 flex items-center gap-1.5 ${testStatus === 'ok' ? 'text-green-400' : 'text-red-400'}`}>
                      {testStatus === 'ok' ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                      {testMessage}
                    </p>
                  )}
                </div>

                {/* Fallback */}
                <div>
                  <label className="label">
                    Fallback Key
                    <span className="text-text-tertiary text-[10px] ml-2">Auto-used if primary hits quota</span>
                  </label>
                  <div className="relative mt-1">
                    <input
                      type={showFallback ? 'text' : 'password'}
                      value={fallbackKey}
                      onChange={(e) => setFallbackKey(e.target.value)}
                      className="input-field w-full font-mono text-xs pr-10"
                      placeholder="apify_api_... (optional)"
                    />
                    <button
                      onClick={() => setShowFallback(p => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary"
                    >
                      {showFallback ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button onClick={handleSaveKeys} disabled={saving} className="btn btn-primary text-sm">
                    {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Save Keys
                  </button>
                  {saveResult === 'success' && (
                    <span className="flex items-center gap-1.5 text-sm text-green-400">
                      <CheckCircle className="w-4 h-4" /> Saved.
                    </span>
                  )}
                  {saveResult === 'error' && (
                    <span className="flex items-center gap-1.5 text-sm text-red-400">
                      <XCircle className="w-4 h-4" /> Failed to save.
                    </span>
                  )}
                </div>
              </div>

              <div className="p-4 bg-elevated border border-border rounded-lg text-xs text-text-secondary space-y-1.5">
                <p className="font-medium text-text-primary mb-2">How email finding works</p>
                <p>1. Email finding runs through your deployed Supabase Edge Function.</p>
                <p>2. It uses a waterfall of LinkedIn email actors and returns the first valid email found.</p>
                <p>3. Keep your Apify tokens set as Supabase function secrets for production reliability.</p>
                <p>4. The free Apify plan gives about $5/month in usage credits.</p>
              </div>
            </div>
          )}

          {activeTab === 'telegram' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-medium mb-1">Telegram Bot Configuration</h2>
                <p className="text-sm text-text-secondary">Connect a Telegram bot to control ZangSends from your phone.</p>
              </div>
              <div className="p-5 border border-border bg-surface rounded-lg space-y-4">
                <div>
                  <label className="label">Bot Token</label>
                  <p className="text-xs text-text-secondary mb-2">Obtain from @BotFather on Telegram.</p>
                  <div className="flex gap-2">
                    <input type="password" value={botToken} onChange={(e) => setBotToken(e.target.value)} className="input-field flex-1 font-mono" />
                    <button className="btn btn-primary">Save & Validate</button>
                  </div>
                </div>
                {botToken && (
                  <div className="flex items-center gap-2 bg-primary-ghost border border-primary/20 rounded p-3 text-sm">
                    <Check className="w-4 h-4 text-primary" />
                    <span>Webhook active. You can now message your bot on Telegram.</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'sender' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-medium mb-1">Sender Accounts</h2>
                  <p className="text-sm text-text-secondary">Connect Gmail accounts securely via Google OAuth to send campaigns.</p>
                </div>
                <button 
                  onClick={handleGoogleSignIn}
                  className="btn bg-white hover:bg-gray-50 text-gray-900 text-xs h-9 px-4 font-medium border border-gray-200"
                >
                  <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-4 h-4 mr-2" />
                  Sign in with Google
                </button>
              </div>

              <div className="space-y-3">
                {sendersError && (
                  <div className="p-3 border border-red-500/20 bg-red-500/5 rounded-lg text-xs text-red-300">
                    Failed to load senders: {sendersError}
                  </div>
                )}
                {loadingSenders ? (
                  <div className="py-10 text-center text-text-tertiary">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 opacity-50" />
                    Loading accounts...
                  </div>
                ) : senders.length === 0 ? (
                  <div className="py-12 border border-dashed border-border rounded-lg text-center">
                    <Mail className="w-8 h-8 text-text-tertiary mx-auto mb-3 opacity-20" />
                    <p className="text-sm text-text-secondary">No sender accounts connected yet.</p>
                  </div>
                ) : (
                  senders.map(sender => {
                    const isEditing = editingSenderId === sender.id;
                    return (
                      <div key={sender.id} className="flex items-center justify-between p-4 border border-border bg-surface rounded-lg hover:border-border-soft transition-colors group">
                        <div className="flex-1 flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-primary-ghost flex items-center justify-center text-primary flex-shrink-0">
                            <Mail className="w-5 h-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            {isEditing ? (
                              <div className="flex items-center gap-2 max-w-md">
                                <input
                                  type="text"
                                  value={editingSenderName}
                                  onChange={(e) => setEditingSenderName(e.target.value)}
                                  className="input-field py-1 px-2 text-sm w-full font-sans"
                                  placeholder="Recipient displays this name..."
                                  autoFocus
                                />
                                <button
                                  onClick={() => handleUpdateSenderName(sender.id, editingSenderName)}
                                  className="p-1.5 text-green-400 hover:text-green-300 hover:bg-green-500/10 rounded transition-colors flex-shrink-0"
                                  title="Save Name"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingSenderId(null);
                                    setEditingSenderName('');
                                  }}
                                  className="p-1.5 text-text-tertiary hover:text-text-primary hover:bg-elevated rounded transition-colors flex-shrink-0"
                                  title="Cancel"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium text-text-primary truncate">
                                  {sender.name || sender.email}
                                </p>
                                <button
                                  onClick={() => {
                                    setEditingSenderId(sender.id);
                                    setEditingSenderName(sender.name || '');
                                  }}
                                  className="p-1 text-text-tertiary hover:text-primary rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                  title="Edit Display Name"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                            {sender.name && <p className="text-xs text-text-secondary truncate mt-0.5">{sender.email}</p>}
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px] uppercase tracking-wider text-text-tertiary">Gmail SMTP</span>
                              <span className="w-1 h-1 rounded-full bg-green-500"></span>
                              <span className="text-[10px] text-green-500 uppercase tracking-wider">Verified</span>
                            </div>
                          </div>
                        </div>
                        <button 
                          onClick={() => handleDeleteSender(sender.id)}
                          className="p-2 text-text-tertiary hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all ml-4"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-lg text-xs text-blue-300/80 space-y-1.5">
                <p className="font-medium text-blue-200 mb-2 flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5" /> Setting up Gmail App Passwords
                </p>
                <p>1. Go to your <strong>Google Account</strong> settings.</p>
                <p>2. Navigate to <strong>Security</strong> and enable <strong>2-Step Verification</strong>.</p>
                <p>3. Search for <strong>"App Passwords"</strong> in the search bar at the top.</p>
                <p>4. Create a new app password (e.g., name it "ZangSends") and copy the 16-character code.</p>
              </div>
            </div>
          )}

          {activeTab === 'scheduling' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-medium mb-1">Working Hours (IST)</h2>
                <p className="text-sm text-text-secondary">Set the daily window during which scheduled emails will be sent.</p>
              </div>

              <div className="p-5 border border-border bg-surface rounded-lg space-y-5">
                <div className="flex items-center gap-4">
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

                <div className="flex items-center gap-3 pt-2">
                  <button 
                    onClick={() => {
                      localStorage.setItem('zangsend_working_hours', JSON.stringify(workingHours));
                      alert('Working hours saved!');
                    }} 
                    className="btn btn-primary text-sm"
                  >
                    Save Settings
                  </button>
                </div>
              </div>

              <div className="p-4 bg-elevated border border-border rounded-lg text-xs text-text-secondary space-y-1.5">
                <p className="font-medium text-text-primary mb-2">How Scheduling Works</p>
                <p>1. When you schedule an email campaign, the send times are <strong>distributed evenly</strong> between the start and end times you configure here.</p>
                <p>2. The scheduler will automatically switch between your connected Gmail accounts.</p>
                <p>3. To protect your accounts from being marked as spam, it will limit each account to <strong>45 emails per day</strong>.</p>
              </div>
            </div>
          )}

          {(activeTab === 'team' || activeTab === 'billing') && (
            <div className="flex flex-col items-center justify-center py-20 text-text-secondary">
              <p>This settings panel is under construction.</p>
            </div>
          )}

          {activeTab === 'danger' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-medium mb-1">Danger Zone</h2>
                <p className="text-sm text-text-secondary">Permanently remove all app data while keeping your login account.</p>
              </div>

              <div className="p-5 border border-red-500/30 bg-red-500/5 rounded-lg space-y-4">
                <p className="text-sm text-red-300">
                  This deletes: lists, contacts, templates, scheduled/sent history, senders, attachments, and app settings data.
                </p>
                <button
                  onClick={handleResetAccountData}
                  disabled={resetting}
                  className="btn border border-red-500/40 text-red-300 hover:bg-red-500/10 text-sm"
                >
                  {resetting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                  {resetting ? 'Resetting...' : 'Reset Account Data'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
