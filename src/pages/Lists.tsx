import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Upload, MoreVertical, Search, X, ChevronRight, Plus, Users } from 'lucide-react';
import Papa from 'papaparse';
import { useLists } from '../hooks/useLists';

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

  return (
    <div className="h-full flex flex-col">
      {/* Header - Mobile Optimized */}
      <div className="flex-shrink-0 px-4 md:px-6 py-4 border-b border-border">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="slide-up">
            <h1 className="text-xl md:text-2xl font-display font-semibold tracking-tight">Lists</h1>
            <p className="text-xs md:text-sm text-text-secondary mt-1">Manage your contact lists</p>
          </div>
          
          {/* Desktop Upload Button */}
          <input 
            type="file" 
            accept=".csv" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            className="hidden" 
          />
          <button 
            className="btn btn-primary hidden md:flex items-center gap-2 slide-up"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <Upload className="w-4 h-4" />
            <span>{uploading ? 'Uploading...' : 'Upload CSV'}</span>
          </button>
        </div>
      </div>

      {/* Search Bar - Mobile Optimized */}
      <div className="flex-shrink-0 px-4 md:px-6 py-3 border-b border-border bg-surface/50">
        <div className="relative max-w-full md:max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <input 
            type="text" 
            placeholder="Search lists..." 
            className="input-field pl-10 h-11 md:h-10 text-base md:text-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* List Content */}
      <div className="flex-1 overflow-auto p-4 md:p-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full text-text-secondary gap-4">
            <div className="w-12 h-12 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <span className="text-sm">Loading lists...</span>
          </div>
        ) : filteredLists.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-text-secondary gap-4 px-8 text-center scale-in">
            <div className="w-16 h-16 rounded-2xl bg-elevated flex items-center justify-center mb-2">
              <Users className="w-8 h-8 text-text-tertiary" />
            </div>
            <p className="text-base font-medium text-text-primary">No lists yet</p>
            <p className="text-sm text-text-secondary">Upload a CSV to create your first list</p>
            <button 
              className="btn btn-primary mt-2"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-4 h-4 mr-2" /> Upload CSV
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 stagger-children">
            {filteredLists.map((list) => (
              <Link 
                to={`/lists/${list.id}`} 
                key={list.id} 
                className="block group relative card-animated"
              >
                {/* Card Header */}
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1 min-w-0 pr-4">
                    <h3 className="font-semibold text-text-primary tracking-tight truncate text-base group-hover:text-primary transition-colors duration-200">
                      {list.name}
                    </h3>
                  </div>
                  <div className="relative flex-shrink-0">
                    <button 
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setActiveDropdown(activeDropdown === list.id ? null : list.id);
                      }} 
                      className={`p-2 -m-2 rounded-xl text-text-tertiary hover:text-text-primary 
                               hover:bg-elevated transition-all duration-200 active:scale-95
                               ${activeDropdown === list.id ? 'bg-elevated text-text-primary' : ''}`}
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    
                    {/* Dropdown Menu */}
                    {activeDropdown === list.id && (
                      <div className="absolute right-0 top-8 bg-surface border border-border shadow-xl 
                                    rounded-xl py-1 z-20 w-36 spring-in overflow-hidden">
                        <button 
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleDeleteList(list.id, list.name);
                          }}
                          className="w-full text-left px-4 py-3 text-sm text-status-bounced 
                                   hover:bg-status-bounced/10 transition-colors active:bg-status-bounced/20"
                        >
                          Delete List
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Stats */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-text-secondary">Contacts</span>
                    <span className="font-mono font-medium text-text-primary">{list.rows}</span>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-text-secondary">Pending</span>
                    <span className="font-mono font-medium text-status-pending">{list.pending}</span>
                  </div>
                  
                  {/* Progress bar */}
                  <div className="h-1.5 bg-elevated rounded-full overflow-hidden mt-3">
                    <div 
                      className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${list.rows > 0 ? ((list.rows - list.pending) / list.rows) * 100 : 0}%` }}
                    />
                  </div>
                </div>

                {/* Footer */}
                <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between">
                  <span className={`text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full font-semibold ${
                    list.status === 'Active' ? 'bg-primary/10 text-primary' :
                    list.status === 'Completed' ? 'bg-elevated text-text-secondary' :
                    'bg-elevated text-text-tertiary'
                  }`}>
                    {list.status}
                  </span>
                  
                  <div className="flex items-center gap-1 text-text-tertiary group-hover:text-primary transition-colors duration-200">
                    <span className="text-xs font-medium">View</span>
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform duration-200" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Mobile FAB */}
      <button 
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="fab md:hidden pulse-glow"
        aria-label="Upload CSV"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Mapping Modal - Mobile Optimized */}
      {isMappingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
          <div 
            className="absolute inset-0 bg-black/80 backdrop-blur-sm fade-in"
            onClick={() => setIsMappingModalOpen(false)}
          />
          <div className="relative bg-surface border-t md:border border-border rounded-t-3xl md:rounded-2xl 
                        shadow-xl w-full md:max-w-2xl max-h-[90vh] overflow-hidden slide-up safe-area-bottom">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 md:p-6 border-b border-border sticky top-0 bg-surface z-10">
              <div>
                <h2 className="text-lg font-semibold text-text-primary">Map CSV Columns</h2>
                <p className="text-sm text-text-secondary mt-0.5">Match your CSV headers to fields</p>
              </div>
              <button 
                onClick={() => setIsMappingModalOpen(false)} 
                className="p-2 -m-2 text-text-tertiary hover:text-text-primary rounded-xl 
                         hover:bg-elevated transition-all active:scale-95"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Modal Content */}
            <div className="overflow-y-auto max-h-[60vh] p-4 md:p-6">
              <div className="space-y-3">
                {[
                  { key: 'first_name', label: 'First Name', required: false },
                  { key: 'last_name', label: 'Last Name', required: false },
                  { key: 'company_name', label: 'Company', required: false },
                  { key: 'title', label: 'Job Title', required: false },
                  { key: 'email', label: 'Email Address', required: true },
                  { key: 'linkedin_url', label: 'LinkedIn URL', required: true }
                ].map(field => (
                  <div key={field.key} className="bg-elevated rounded-xl p-4">
                    <label className="text-sm font-medium text-text-primary flex items-center mb-2">
                      {field.label}
                      {field.required && (
                        <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                          Required
                        </span>
                      )}
                    </label>
                    <select 
                      className="w-full bg-surface border border-border text-text-primary rounded-xl 
                               px-4 py-3 text-base focus:border-primary focus:ring-2 focus:ring-primary/20 
                               outline-none transition-all"
                      value={mapping[field.key as keyof typeof mapping]}
                      onChange={(e) => setMapping({...mapping, [field.key]: e.target.value})}
                    >
                      <option value="">-- Ignore this field --</option>
                      {csvHeaders.map(header => (
                        <option key={header} value={header}>{header}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              <p className="text-xs text-text-tertiary mt-4 px-1">
                LinkedIn URLs are used to automatically find emails via our Apify integration.
              </p>
            </div>

            {/* Modal Footer */}
            <div className="p-4 md:p-6 border-t border-border bg-surface sticky bottom-0 flex flex-col md:flex-row gap-3 md:justify-end">
              <button 
                onClick={() => setIsMappingModalOpen(false)} 
                className="btn border border-border text-text-secondary hover:text-text-primary 
                         order-2 md:order-1"
              >
                Cancel
              </button>
              <button 
                onClick={handleConfirmMapping} 
                className="btn btn-primary order-1 md:order-2"
              >
                Import {rawCsvData.length} Contacts
                <ChevronRight className="w-4 h-4 ml-1" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
