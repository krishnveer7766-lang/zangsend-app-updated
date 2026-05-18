import { useState, useEffect } from 'react';
import { Clock, FileText, UserPlus, CheckCircle2, AlertCircle, Filter, RefreshCw, History } from 'lucide-react';
import { supabase } from '../lib/supabase';

export function HistoryPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activities, setActivities] = useState<any[]>([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchActivityLog();
  }, []);

  const fetchActivityLog = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select(`
          id, email, status, 
          created_at, sent_at, scheduled_send_at, data,
          templates(name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const events: any[] = [];
      data?.forEach(contact => {
        const firstName = contact?.data?.first_name || '';
        const lastName = contact?.data?.last_name || '';
        const fallbackEmail = contact?.data?.email || contact?.email || 'Unknown contact';
        const name = `${firstName} ${lastName}`.trim() || fallbackEmail;
        
        events.push({
          id: `${contact.id}-created`,
          type: 'added',
          title: 'Contact added to list',
          description: `Added ${name} to your lead list.`,
          timestamp: contact.created_at,
          icon: UserPlus,
          color: 'text-text-tertiary',
          bg: 'bg-elevated'
        });

        const templates: any = contact.templates;
        const templateName = Array.isArray(templates) ? templates[0]?.name : templates?.name;
        const activity = contact.data?.activity || {};

        if (contact.scheduled_send_at || activity.scheduled_at) {
          events.push({
            id: `${contact.id}-scheduled`,
            type: 'scheduled',
            title: 'Email Scheduled',
            description: `Scheduled campaign for ${name} using "${templateName || 'Default'}" template.`,
            timestamp: contact.scheduled_send_at || activity.scheduled_at,
            icon: Clock,
            color: 'text-status-finding',
            bg: 'bg-status-finding/10'
          });
        }

        if (contact.status === 'draft' || activity.drafted_at) {
          events.push({
            id: `${contact.id}-draft`,
            type: 'draft',
            title: 'Created Draft',
            description: `Gmail draft created for ${name}.`,
            timestamp: activity.drafted_at || contact.created_at,
            icon: FileText,
            color: 'text-text-secondary',
            bg: 'bg-elevated'
          });
        }

        if (contact.status === 'processing' || activity.processing_at) {
          events.push({
            id: `${contact.id}-processing`,
            type: 'processing',
            title: 'Email Processing',
            description: `Started sending email to ${name}.`,
            timestamp: activity.processing_at || contact.scheduled_send_at || contact.created_at,
            icon: Clock,
            color: 'text-primary',
            bg: 'bg-primary-ghost'
          });
        }

        if (contact.sent_at || activity.sent_at) {
          events.push({
            id: `${contact.id}-sent`,
            type: 'sent',
            title: 'Email Sent Successfully',
            description: `Campaign email delivered to ${name}.`,
            timestamp: contact.sent_at || activity.sent_at,
            icon: CheckCircle2,
            color: 'text-primary',
            bg: 'bg-primary-ghost'
          });
        }

        if (contact.status === 'bounced' || activity.failed_at) {
          events.push({
            id: `${contact.id}-failed`,
            type: 'failed',
            title: 'Delivery Failed',
            description: `Could not send email to ${name}. Please check SMTP settings.`,
            timestamp: activity.failed_at || contact.sent_at || contact.created_at,
            icon: AlertCircle,
            color: 'text-status-bounced',
            bg: 'bg-status-bounced/10'
          });
        }
      });

      events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setActivities(events);

    } catch (err) {
      console.error('Error fetching activity log:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const filteredActivities = filter === 'all' 
    ? activities 
    : activities.filter(a => a.type === filter);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 px-4 md:px-6 py-4 border-b border-border">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="slide-up">
            <h1 className="text-xl md:text-2xl font-display font-semibold tracking-tight">History</h1>
            <p className="text-xs md:text-sm text-text-secondary mt-1">Activity timeline</p>
          </div>
          <div className="flex items-center gap-2 slide-up" style={{ animationDelay: '50ms' }}>
            <div className="flex items-center gap-2 flex-1 md:flex-none">
              <Filter className="w-4 h-4 text-text-tertiary" />
              <select 
                value={filter}
                onChange={e => setFilter(e.target.value)}
                className="bg-surface border border-border rounded-xl px-3 py-2.5 text-sm 
                         focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary
                         flex-1 md:flex-none md:min-w-[140px]"
              >
                <option value="all">All Activities</option>
                <option value="sent">Sent</option>
                <option value="scheduled">Scheduled</option>
                <option value="draft">Drafts</option>
                <option value="processing">Processing</option>
                <option value="failed">Failed</option>
                <option value="added">New Leads</option>
              </select>
            </div>
            <button 
              onClick={() => fetchActivityLog(true)} 
              disabled={refreshing}
              className="btn border border-border h-10 px-3"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Timeline Content */}
      <div className="flex-1 overflow-auto p-4 md:p-8">
        <div className="max-w-3xl mx-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-text-secondary gap-4">
              <div className="w-12 h-12 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              <span className="text-sm">Loading activity history...</span>
            </div>
          ) : filteredActivities.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center scale-in">
              <div className="w-16 h-16 rounded-2xl bg-elevated flex items-center justify-center mb-4">
                <History className="w-8 h-8 text-text-tertiary" />
              </div>
              <p className="text-base font-medium text-text-primary mb-1">No activity yet</p>
              <p className="text-sm text-text-secondary">Actions will appear here as you use ZangSends</p>
            </div>
          ) : (
            <div className="relative stagger-children">
              {/* Timeline Line */}
              <div className="absolute left-5 md:left-[18px] top-6 bottom-6 w-px bg-border" />

              <div className="space-y-4 md:space-y-6">
                {filteredActivities.map((activity, index) => (
                  <div 
                    key={activity.id} 
                    className="relative pl-14 md:pl-14 group"
                    style={{ animationDelay: `${Math.min(index * 30, 300)}ms` }}
                  >
                    {/* Timeline Dot */}
                    <div className={`absolute left-0 top-0 w-10 h-10 md:w-9 md:h-9 rounded-xl ${activity.bg} 
                                  flex items-center justify-center border border-border 
                                  group-hover:border-primary/30 transition-all duration-200 z-10 shadow-sm
                                  group-hover:scale-105`}>
                      <activity.icon className={`w-4 h-4 ${activity.color}`} />
                    </div>

                    {/* Card Content */}
                    <div className="card-animated p-4">
                      <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3 mb-2">
                        <h3 className="text-sm font-semibold text-text-primary">{activity.title}</h3>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-text-tertiary font-mono uppercase tracking-wider bg-elevated px-2 py-0.5 rounded-md">
                            {new Date(activity.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span className="text-[10px] text-text-tertiary">
                            {new Date(activity.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-text-secondary leading-relaxed">
                        {activity.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
