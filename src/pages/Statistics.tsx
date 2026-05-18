import { useState, useEffect } from 'react';
import { Mail, Eye, MousePointerClick, Users, Search, RefreshCw, BarChart3 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';

export function StatisticsPage() {
  const [loading, setLoading] = useState(true);
  const [allContacts, setAllContacts] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const { data: cams } = await supabase
        .from('campaigns')
        .select('*')
        .order('sent_at', { ascending: false });
      if (cams) setCampaigns(cams);

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

  const filteredLeads = filteredContacts.filter(l => 
    l.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.company_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const trackerLeads = filteredLeads.filter(l => l.opened_at || l.clicked_at);

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    show: { opacity: 1, scale: 1 }
  };

  return (
    <div className="h-full flex flex-col pb-20 md:pb-0">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-5 border-b border-border bg-surface/30">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold tracking-tight text-text-primary flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-primary" />
              Insights
            </h1>
            <p className="text-xs text-text-secondary mt-1">Real-time engagement tracking.</p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <select
              className="bg-elevated border border-border rounded-lg px-4 py-2 text-xs outline-none focus:ring-1 focus:ring-primary transition-all text-text-primary"
              value={selectedCampaignId}
              onChange={e => setSelectedCampaignId(e.target.value)}
            >
              <option value="all">All Campaigns</option>
              {campaigns.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <button 
              onClick={fetchStats} 
              className="btn btn-secondary text-xs h-10 px-4 flex items-center gap-2 active:rotate-180 transition-transform duration-500"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="sm:hidden">Refresh</span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 md:p-6 space-y-8 custom-scrollbar">
        {/* Stats Grid */}
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6"
        >
          <motion.div variants={itemVariants} className="bg-surface/50 border border-border rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 text-text-tertiary mb-4">
              <div className="p-2 bg-primary/10 rounded-xl text-primary">
                <Mail className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-bold uppercase tracking-wider">Delivered</span>
            </div>
            <div className="text-4xl font-mono font-bold text-text-primary tracking-tighter">{totalSent}</div>
          </motion.div>

          <motion.div variants={itemVariants} className="bg-surface/50 border border-border rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 text-status-opened mb-4">
              <div className="p-2 bg-status-opened/10 rounded-xl">
                <Eye className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-bold uppercase tracking-wider">Unique Opens</span>
            </div>
            <div className="flex items-baseline gap-3">
              <div className="text-4xl font-mono font-bold text-text-primary tracking-tighter">{totalOpened}</div>
              <div className="text-xs font-bold text-status-opened bg-status-opened/10 px-2 py-0.5 rounded-full">
                {totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0}%
              </div>
            </div>
          </motion.div>

          <motion.div variants={itemVariants} className="bg-surface/50 border border-border rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 text-primary mb-4">
              <div className="p-2 bg-primary/10 rounded-xl">
                <MousePointerClick className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-bold uppercase tracking-wider">Engagements</span>
            </div>
            <div className="flex items-baseline gap-3">
              <div className="text-4xl font-mono font-bold text-text-primary tracking-tighter">{totalClicked}</div>
              <div className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                {totalSent > 0 ? Math.round((totalClicked / totalSent) * 100) : 0}%
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* Lead Tracking Section */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <h2 className="text-lg font-display font-bold flex items-center gap-2">
              <Users className="w-5 h-5 text-text-tertiary" />
              Recent Engagement
            </h2>
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
              <input 
                type="text"
                placeholder="Search leads..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="input-field pl-10 h-10 w-full"
              />
            </div>
          </div>

          {/* Desktop Table / Mobile Cards */}
          <div className="bg-surface/30 border border-border rounded-2xl overflow-hidden">
            <div className="hidden md:block">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border bg-elevated/20">
                    <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-text-tertiary">Lead</th>
                    <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-text-tertiary">Company</th>
                    <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-text-tertiary text-center">Status</th>
                    <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-text-tertiary">Activity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {loading ? (
                    <tr><td colSpan={4} className="px-6 py-20 text-center text-text-tertiary">Analyzing data...</td></tr>
                  ) : trackerLeads.length === 0 ? (
                    <tr><td colSpan={4} className="px-6 py-20 text-center text-text-tertiary">No engagement recorded yet.</td></tr>
                  ) : trackerLeads.map(lead => (
                    <tr key={lead.id} className="hover:bg-elevated/10 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-text-primary group-hover:text-primary transition-colors">
                            {lead.first_name} {lead.last_name || ''}
                          </span>
                          <span className="text-xs text-text-tertiary">{lead.email}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs text-text-secondary">{lead.company_name || '—'}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`text-[9px] font-black tracking-widest px-2 py-0.5 rounded-md ${
                          lead.clicked_at ? 'bg-primary/20 text-primary border border-primary/20' : 
                          lead.opened_at ? 'bg-status-opened/20 text-status-opened border border-status-opened/20' : 'bg-border text-text-tertiary'
                        }`}>
                          {lead.clicked_at ? 'CLICKED' : lead.opened_at ? 'OPENED' : 'SENT'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-xs text-text-secondary">
                            {lead.clicked_at ? new Date(lead.clicked_at).toLocaleDateString() : 
                             lead.opened_at ? new Date(lead.opened_at).toLocaleDateString() : '—'}
                          </span>
                          <span className="text-[10px] text-text-tertiary">
                            {lead.clicked_at ? new Date(lead.clicked_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 
                             lead.opened_at ? new Date(lead.opened_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-border/50">
              {loading ? (
                <div className="p-10 text-center text-text-tertiary">Syncing stats...</div>
              ) : trackerLeads.length === 0 ? (
                <div className="p-10 text-center text-text-tertiary">No activity yet.</div>
              ) : trackerLeads.map(lead => (
                <div key={lead.id} className="p-5 active:bg-elevated/20 transition-colors">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="text-sm font-bold text-text-primary">{lead.first_name} {lead.last_name || ''}</div>
                      <div className="text-[10px] text-text-tertiary mt-0.5">{lead.email}</div>
                    </div>
                    <span className={`text-[8px] font-black tracking-widest px-1.5 py-0.5 rounded ${
                      lead.clicked_at ? 'bg-primary/20 text-primary' : 
                      lead.opened_at ? 'bg-status-opened/20 text-status-opened' : 'bg-border text-text-tertiary'
                    }`}>
                      {lead.clicked_at ? 'CLICKED' : 'OPENED'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-text-secondary">{lead.company_name || 'Individual'}</span>
                    <span className="text-text-tertiary">
                      {lead.clicked_at ? new Date(lead.clicked_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 
                       new Date(lead.opened_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
