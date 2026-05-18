import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Upload, MoreVertical, Search, X, ChevronRight, Plus } from 'lucide-react';
import Papa from 'papaparse';
import { useLists } from '../hooks/useLists';
import { motion, AnimatePresence } from 'framer-motion';

export function ListsPage() {
  const { lists, loading, createList, deleteList } = useLists();
  const [searchQuery, setSearchQuery] = useState('');
  const [uploading, setUploading] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // CSV Mapping State
  const [isMappingModalOpen, setIsMappingModalOpen] = useState(false);
  const [rawCsvData, setRawCsvData] = useState<any[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [pendingListName, setPendingListName] = useState('');
  
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

    const listName = file.name.replace('.csv', '');
    setPendingListName(listName);

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
          
          setIsMappingModalOpen(true);
        } else {
          alert('CSV appears to be empty.');
        }
      },
      error: (error) => {
        console.error('CSV Parse Error:', error);
        alert('Failed to parse CSV file.');
      }
    });
    
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleConfirmMapping = async () => {
    setIsMappingModalOpen(false);
    setUploading(true);
    
    try {
      const newList = await createList(pendingListName);
      
      const contacts = rawCsvData.map(row => ({
        list_id: newList.id,
        first_name: mapping.first_name ? row[mapping.first_name] : null,
        last_name: mapping.last_name ? row[mapping.last_name] : null,
        company_name: mapping.company_name ? row[mapping.company_name] : null,
        title: mapping.title ? row[mapping.title] : null,
        email: mapping.email ? row[mapping.email] : null,
        linkedin_url: mapping.linkedin_url ? row[mapping.linkedin_url] : null,
        status: 'pending'
      })).filter(c => c.linkedin_url || c.email || c.first_name || c.last_name || c.company_name); 
      
      if (contacts.length === 0) {
        alert('No valid contacts found. Please map at least one field containing data.');
        setUploading(false);
        return;
      }

      const { supabase } = await import('../lib/supabase');
      const { data: { user } } = await supabase.auth.getUser();
      
      const contactsWithUser = contacts.map(c => {
        const { first_name, last_name, company_name, title, linkedin_url, ...rest } = c;
        return {
          ...rest,
          user_id: user?.id,
          data: { first_name, last_name, company_name, title, linkedin_url }
        };
      });
      
      // Insert in chunks to avoid payload too large
      const chunkSize = 100;
      for (let i = 0; i < contactsWithUser.length; i += chunkSize) {
        const { error } = await supabase.from('contacts').insert(contactsWithUser.slice(i, i + chunkSize));
        if (error) throw error;
      }
      
      window.location.reload();
    } catch (err) {
      console.error('Error uploading contacts:', err);
      alert('Failed to process CSV import.');
      setUploading(false);
    }
  };

  const handleDeleteList = async (id: string, name: string) => {
    setActiveDropdown(null);
    if (!window.confirm(`Delete "${name}" and all its contacts? This cannot be undone.`)) return;
    try {
      await deleteList(id);
    } catch (err: any) {
      alert('Failed to delete list: ' + (err.message || err));
    }
  };

  const filteredLists = lists.filter(l => l.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <div className="h-full flex flex-col pb-20 md:pb-0">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-6 py-5 border-b border-border bg-surface/30">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight text-text-primary">Lists</h1>
          <p className="text-xs text-text-secondary mt-1">Manage your contact segments.</p>
        </div>
        <div className="hidden md:flex space-x-3">
          <input 
            type="file" 
            accept=".csv" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            className="hidden" 
          />
          <button 
            className="btn btn-primary flex items-center space-x-2"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <Upload className="w-4 h-4" />
            <span>{uploading ? 'Uploading...' : 'Upload CSV'}</span>
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex-shrink-0 flex items-center px-4 md:px-6 py-4 border-b border-border bg-surface/50 backdrop-blur-md sticky top-0 z-20">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <input 
            type="text" 
            placeholder="Search your lists..." 
            className="input-field pl-10 h-10 bg-background/50 border-none ring-1 ring-border focus:ring-primary/50"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* List Grid / Table */}
      <div className="flex-1 overflow-auto p-4 md:p-6 custom-scrollbar">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full text-text-secondary space-y-4">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-medium">Loading segments...</span>
          </div>
        ) : filteredLists.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center h-full text-text-secondary space-y-6 text-center max-w-xs mx-auto"
          >
            <div className="w-16 h-16 bg-elevated rounded-full flex items-center justify-center border border-border">
              <Plus className="w-8 h-8 text-text-tertiary" />
            </div>
            <div>
              <p className="text-sm font-medium text-text-primary">No lists found</p>
              <p className="text-xs mt-2">Upload a CSV file to start building your mailing audience.</p>
            </div>
            <button className="btn btn-primary text-xs h-9 px-6 rounded-full" onClick={() => fileInputRef.current?.click()}>
              <Upload className="w-3.5 h-3.5 mr-2" /> Upload CSV
            </button>
          </motion.div>
        ) : (
          <motion.div 
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {filteredLists.map((list) => (
              <motion.div variants={itemVariants} key={list.id}>
                <Link 
                  to={`/lists/${list.id}`} 
                  className="block group relative bg-surface/40 border border-border rounded-xl p-5 hover:border-primary/40 hover:bg-surface/60 transition-all cursor-pointer active:scale-[0.98]"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-text-primary tracking-tight truncate pr-4 text-base">{list.name}</h3>
                      <p className="text-[10px] text-text-tertiary mt-0.5 font-mono uppercase tracking-wider">{list.id.split('-')[0]}</p>
                    </div>
                    <div className="relative">
                      <button 
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setActiveDropdown(activeDropdown === list.id ? null : list.id);
                        }} 
                        className={`p-1.5 rounded-full text-text-tertiary hover:text-text-primary hover:bg-elevated transition-all ${activeDropdown === list.id ? 'opacity-100 bg-elevated' : 'opacity-0 group-hover:opacity-100'}`}
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      <AnimatePresence>
                        {activeDropdown === list.id && (
                          <motion.div 
                            initial={{ opacity: 0, scale: 0.9, y: -10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: -10 }}
                            className="absolute right-0 top-10 bg-elevated border border-border shadow-2xl rounded-lg py-1 z-30 w-40 overflow-hidden"
                          >
                            <button 
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleDeleteList(list.id, list.name);
                              }}
                              className="w-full text-left px-4 py-2.5 text-sm text-status-bounced hover:bg-status-bounced/10 transition-colors flex items-center"
                            >
                              <X className="w-3.5 h-3.5 mr-2" /> Delete List
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-5">
                    <div className="bg-background/40 rounded-lg p-3 border border-border/50">
                      <span className="text-[10px] uppercase tracking-wider text-text-tertiary block mb-1">Contacts</span>
                      <span className="text-lg font-mono font-bold text-text-primary">{list.rows}</span>
                    </div>
                    <div className="bg-background/40 rounded-lg p-3 border border-border/50">
                      <span className="text-[10px] uppercase tracking-wider text-text-tertiary block mb-1">Pending</span>
                      <span className="text-lg font-mono font-bold text-status-pending">{list.pending}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-border/50">
                    <span className={`text-[10px] uppercase tracking-widest px-2.5 py-0.5 rounded-full font-bold ${
                      list.status === 'Active' ? 'bg-primary-glow text-primary-text border border-primary/20' :
                      list.status === 'Completed' ? 'bg-border text-text-secondary' :
                      'bg-border/50 text-text-tertiary'
                    }`}>
                      {list.status}
                    </span>
                    
                    <span className="text-[10px] text-text-tertiary font-medium">
                      {list.lastSent !== 'Never' ? `Last: ${list.lastSent}` : 'Not started'}
                    </span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>

      {/* Mobile Floating Action Button */}
      <div className="fixed right-6 bottom-24 md:hidden z-30">
        <button 
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="w-14 h-14 bg-primary text-black rounded-full flex items-center justify-center active:scale-90 transition-transform disabled:opacity-50"
          style={{ boxShadow: '0 20px 25px -5px rgba(34, 197, 94, 0.4), 0 8px 10px -6px rgba(34, 197, 94, 0.4)' }}
        >
          {uploading ? (
            <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin" />
          ) : (
            <Plus className="w-7 h-7" />
          )}
        </button>
      </div>

      {/* Mapping Modal */}
      <AnimatePresence>
        {isMappingModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
              onClick={() => setIsMappingModalOpen(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-2xl p-6 relative z-10 overflow-hidden"
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-display font-bold text-text-primary">Map CSV Columns</h2>
                  <p className="text-xs text-text-secondary mt-1">Configure your contact data schema.</p>
                </div>
                <button onClick={() => setIsMappingModalOpen(false)} className="p-2 text-text-tertiary hover:text-text-primary hover:bg-elevated rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="bg-elevated/50 border border-border rounded-xl overflow-hidden mb-4">
                <div className="max-h-[40vh] overflow-y-auto custom-scrollbar">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-surface/80 border-b border-border text-text-secondary sticky top-0 z-10 backdrop-blur-md">
                      <tr>
                        <th className="px-4 py-3 font-semibold text-[11px] uppercase tracking-wider">Field</th>
                        <th className="px-4 py-3 font-semibold text-[11px] uppercase tracking-wider">CSV Header</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {[
                        { key: 'first_name', label: 'First Name', required: false },
                        { key: 'last_name', label: 'Last Name', required: false },
                        { key: 'company_name', label: 'Company', required: false },
                        { key: 'title', label: 'Job Title', required: false },
                        { key: 'email', label: 'Email Address', required: true },
                        { key: 'linkedin_url', label: 'LinkedIn URL', required: true }
                      ].map(field => (
                        <tr key={field.key} className="hover:bg-surface/30 transition-colors">
                          <td className="px-4 py-4 font-medium text-text-primary">
                            <div className="flex flex-col">
                              <span>{field.label}</span>
                              {field.required && <span className="text-[9px] text-primary font-bold uppercase tracking-tighter mt-0.5">Required</span>}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <select 
                              className="w-full bg-background border border-border text-text-primary rounded-lg px-3 py-2 focus:ring-1 focus:ring-primary outline-none transition-all"
                              value={mapping[field.key as keyof typeof mapping]}
                              onChange={(e) => setMapping({...mapping, [field.key]: e.target.value})}
                            >
                              <option value="">-- Ignore --</option>
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
              </div>

              <div className="bg-primary/5 border border-primary/10 rounded-lg p-3 flex items-start space-x-3">
                <div className="p-1 bg-primary/20 rounded-md">
                  <Plus className="w-3.5 h-3.5 text-primary" />
                </div>
                <p className="text-[10px] text-text-secondary leading-relaxed">
                  Tip: Mapping <span className="text-primary font-bold italic underline">LinkedIn URLs</span> allows us to automatically discover verified emails using our Apify Waterfall engine.
                </p>
              </div>

              <div className="mt-8 flex justify-end gap-3">
                <button onClick={() => setIsMappingModalOpen(false)} className="btn text-text-secondary hover:text-text-primary px-4">Cancel</button>
                <button onClick={handleConfirmMapping} className="btn btn-primary px-8 rounded-full">
                  Import {rawCsvData.length} Contacts <ChevronRight className="w-4 h-4 ml-1" />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
