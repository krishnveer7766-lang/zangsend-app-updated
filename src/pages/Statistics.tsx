import { useState, useEffect } from 'react';
import { Mail, Eye, MousePointerClick, Users, Search, RefreshCw, TrendingUp } from 'lucide-react';
import { supabase } from '../lib/supabase';

export function StatisticsPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [allContacts, setAllContacts] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    
    try {
      const { data: cams } = await supabase
        .from('campaigns')
        .select('*')
        .order('sent_at', { ascending: false });
      if (cams) {
        setCampaigns(cams);
      }

      const { data: contacts, error } = await supabase
        .from('contacts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (contacts) {
        const mapped = contacts.map((c: any) => {
          const openedAt = c.opened_at || c.data?.activity?.opened_at || null;
          const clickedAt = c.clicked_at || c.data?.activity?.clicked_at || null;
          const sentAt = c.sent_at || c.data?.activity?.sent_at || null;
          return {
            ...c,
            first_name: c.first_name || c.data?.first_name || c.data?.firstName || null,
            last_name: c.last_name || c.data?.last_name || c.data?.lastName || null,
            company_name: c.company_name || c.data?.company_name || c.data?.company || null,
            opened_at: openedAt,
            clicked_at: clickedAt,
            sent_at: sentAt
          };
        });
        setAllContacts(mapped);
      }
    } catch (err) {
      console.error('Error fetching statistics:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const filteredContacts = allContacts.filter((c: any) => {
    const statusLower = c.status?.toLowerCase();
    const isSent = statusLower === 'sent' || c.sent_at;
    if (!isSent) return false;
    
    if (selectedCampaignId !== 'all') {
      return c.campaign_id === selectedCampaignId;
    }
    return true;
  });

  const totalSent = filteredContacts.length;
  const totalOpened = filteredContacts.filter((c: any) => c.opened_at).length;
  const totalClicked = filteredContacts.filter((c: any) => c.clicked_at).length;

  const openRate = totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0;
  const clickRate = totalSent > 0 ? Math.round((totalClicked / totalSent) * 100) : 0;

  const filteredLeads = filteredContacts.filter(l => 
    l.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.company_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const trackerLeads = filteredLeads.filter(l => l.opened_at || l.clicked_at);

  return (
    <div className="h-full flex flex-col">
      {/* Header - Mobile Optimized */}
      <div className="flex-shrink-0 px-4 md:px-6 py-4 border-b border-border">
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between">
            <div className="slide-up">
              <h1 className="text-xl md:text-2xl font-display font-semibold tracking-tight">Statistics</h1>
              <p className="text-xs md:text-sm text-text-secondary mt-1">Track email engagement</p>
            </div>
            <button 
              onClick={() => fetchStats(true)} 
              disabled={refreshing}
              className="btn border border-border text-sm h-10 px-3 md:px-4"
            >
              <RefreshCw className={`w-4 h-4 md:mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden md:inline">Refresh</span>
            </button>
          </div>
          
          {/* Campaign Filter - Mobile Optimized */}
          <div className="slide-up" style={{ animationDelay: '50ms' }}>
            <select
              className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm 
                       outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 
                       transition-all text-text-primary"
              value={selectedCampaignId}
              onChange={e => setSelectedCampaignId(e.target.value)}
            >
              <option value="all">All Campaigns</option>
              {campaigns.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 md:p-6 space-y-4 md:space-y-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-text-secondary gap-4">
            <div className="w-12 h-12 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <span className="text-sm">Loading statistics...</span>
          </div>
        ) : (
          <>
            {/* Stats Cards - Mobile Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 stagger-children">
              {/* Sent Card */}
              <div className="card-animated p-4 md:p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Mail className="w-5 h-5 text-primary" />
                    </div>
                    <span className="text-sm font-medium text-text-secondary">Total Sent</span>
                  </div>
                </div>
                <div className="text-3xl md:text-4xl font-mono font-bold text-text-primary">{totalSent}</div>
              </div>

              {/* Opens Card */}
              <div className="card-animated p-4 md:p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-status-opened/10 flex items-center justify-center">
                      <Eye className="w-5 h-5 text-status-opened" />
                    </div>
                    <span className="text-sm font-medium text-text-secondary">Opens</span>
                  </div>
                  <div className="flex items-center gap-1 text-primary text-sm font-medium">
                    <TrendingUp className="w-4 h-4" />
                    {openRate}%
                  </div>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl md:text-4xl font-mono font-bold text-text-primary">{totalOpened}</span>
                </div>
                {/* Progress bar */}
                <div className="h-1.5 bg-elevated rounded-full overflow-hidden mt-3">
                  <div 
                    className="h-full bg-status-opened rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${openRate}%` }}
                  />
                </div>
              </div>

              {/* Clicks Card */}
              <div className="card-animated p-4 md:p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <MousePointerClick className="w-5 h-5 text-primary" />
                    </div>
                    <span className="text-sm font-medium text-text-secondary">Clicks</span>
                  </div>
                  <div className="flex items-center gap-1 text-primary text-sm font-medium">
                    <TrendingUp className="w-4 h-4" />
                    {clickRate}%
                  </div>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl md:text-4xl font-mono font-bold text-text-primary">{totalClicked}</span>
                </div>
                {/* Progress bar */}
                <div className="h-1.5 bg-elevated rounded-full overflow-hidden mt-3">
                  <div 
                    className="h-full bg-primary rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${clickRate}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Leads Table */}
            <div className="card-animated overflow-hidden p-0">
              {/* Table Header */}
              <div className="px-4 md:px-5 py-4 border-b border-border flex flex-col md:flex-row md:items-center gap-3 md:justify-between bg-elevated/30">
                <h2 className="text-sm font-semibold flex items-center gap-2">
                  <Users className="w-4 h-4 text-text-tertiary" />
                  Lead Tracking
                  <span className="text-text-tertiary font-normal">({trackerLeads.length})</span>
                </h2>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
                  <input 
                    type="text"
                    placeholder="Search leads..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="input-field pl-10 h-10 w-full md:w-64 text-sm"
                  />
                </div>
              </div>

              {/* Mobile Card View / Desktop Table */}
              <div className="md:hidden">
                {trackerLeads.length === 0 ? (
                  <div className="py-12 text-center text-text-tertiary">
                    <Eye className="w-8 h-8 mx-auto mb-3 opacity-20" />
                    <p className="text-sm">No engagement tracked yet</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {trackerLeads.map(lead => (
                      <div key={lead.id} className="p-4 hover:bg-elevated/30 transition-colors">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <span className="font-medium text-text-primary">
                              {lead.first_name} {lead.last_name || ''}
                            </span>
                            <p className="text-xs text-text-tertiary mt-0.5">{lead.email}</p>
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                            lead.clicked_at ? 'bg-primary/20 text-primary' : 
                            lead.opened_at ? 'bg-status-opened/20 text-status-opened' : 'bg-elevated text-text-tertiary'
                          }`}>
                            {lead.clicked_at ? 'CLICKED' : lead.opened_at ? 'OPENED' : 'SENT'}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-text-secondary">
                          <span>{lead.company_name || 'No company'}</span>
                          {lead.opened_at && (
                            <span>Opened {new Date(lead.opened_at).toLocaleDateString()}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-elevated/10">
                      <th className="px-5 py-3 text-[10px] uppercase tracking-wider font-bold text-text-tertiary">Lead</th>
                      <th className="px-5 py-3 text-[10px] uppercase tracking-wider font-bold text-text-tertiary">Company</th>
                      <th className="px-5 py-3 text-[10px] uppercase tracking-wider font-bold text-text-tertiary text-center">Status</th>
                      <th className="px-5 py-3 text-[10px] uppercase tracking-wider font-bold text-text-tertiary">Last Opened</th>
                      <th className="px-5 py-3 text-[10px] uppercase tracking-wider font-bold text-text-tertiary">Link Clicked</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {trackerLeads.length === 0 ? (
                      <tr><td colSpan={5} className="px-5 py-20 text-center text-text-tertiary">No engagement tracked yet.</td></tr>
                    ) : trackerLeads.map(lead => (
                      <tr key={lead.id} className="hover:bg-elevated/5 transition-colors group">
                        <td className="px-5 py-4">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-text-primary">
                              {lead.first_name} {lead.last_name || ''}
                            </span>
                            <span className="text-xs text-text-tertiary">{lead.email}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className="text-xs text-text-secondary">{lead.company_name || '—'}</span>
                        </td>
                        <td className="px-5 py-4 text-center">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            lead.clicked_at ? 'bg-primary/20 text-primary' : 
                            lead.opened_at ? 'bg-status-opened/20 text-status-opened' : 'bg-text-tertiary/10 text-text-tertiary'
                          }`}>
                            {lead.clicked_at ? 'CLICKED' : lead.opened_at ? 'OPENED' : 'SENT'}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          {lead.opened_at ? (
                            <div className="flex flex-col">
                              <span className="text-xs text-text-secondary">{new Date(lead.opened_at).toLocaleDateString()}</span>
                              <span className="text-[10px] text-text-tertiary">{new Date(lead.opened_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-text-tertiary italic">Not opened yet</span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          {lead.clicked_at ? (
                            <div className="flex flex-col">
                              <span className="text-xs text-primary font-medium">{new Date(lead.clicked_at).toLocaleDateString()}</span>
                              <span className="text-[10px] text-primary/70">{new Date(lead.clicked_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-text-tertiary">No clicks</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
