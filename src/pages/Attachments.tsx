import { useState, useEffect, useRef } from 'react';
import { Paperclip, Upload, Trash2, Download, File, Loader2, Plus } from 'lucide-react';
import { supabase } from '../lib/supabase';

type Attachment = {
  id: string;
  filename: string;
  storage_path: string;
  size_bytes: number;
  created_at: string;
};

export function AttachmentsPage() {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchAttachments = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('attachments')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAttachments(data || []);
    } catch (err: any) {
      console.error('Error fetching attachments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttachments();
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('attachments')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase
        .from('attachments')
        .insert({
          user_id: user.id,
          filename: file.name,
          storage_path: filePath,
          size_bytes: file.size
        });

      if (dbError) throw dbError;

      await fetchAttachments();
    } catch (err: any) {
      console.error('Upload failed:', err);
      alert('Failed to upload attachment: ' + err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (id: string, storagePath: string) => {
    if (!window.confirm('Delete this attachment?')) return;
    
    try {
      const { error: storageError } = await supabase.storage
        .from('attachments')
        .remove([storagePath]);
        
      if (storageError) console.error('Storage deletion failed:', storageError);

      const { error: dbError } = await supabase
        .from('attachments')
        .delete()
        .eq('id', id);

      if (dbError) throw dbError;

      setAttachments(prev => prev.filter(a => a.id !== id));
    } catch (err: any) {
      console.error('Delete failed:', err);
      alert('Failed to delete attachment: ' + err.message);
    }
  };

  const handleDownload = async (storagePath: string, filename: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('attachments')
        .download(storagePath);
        
      if (error) throw error;
      
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      console.error('Download failed:', err);
      alert('Failed to download attachment.');
    }
  };

  function formatBytes(bytes: number) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 px-4 md:px-6 py-4 border-b border-border">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="slide-up">
            <h1 className="text-xl md:text-2xl font-display font-semibold tracking-tight">Attachments</h1>
            <p className="text-xs md:text-sm text-text-secondary mt-1">Files to attach to your templates</p>
          </div>
          
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleUpload}
            className="hidden"
            accept=".pdf,.doc,.docx,.txt,.csv,.jpg,.jpeg,.png"
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="btn btn-primary hidden md:flex slide-up"
          >
            {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
            {uploading ? 'Uploading...' : 'Upload File'}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 md:p-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-text-secondary gap-4">
            <div className="w-12 h-12 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <span className="text-sm">Loading attachments...</span>
          </div>
        ) : attachments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-4 scale-in">
            <div className="w-16 h-16 rounded-2xl bg-elevated flex items-center justify-center mb-4">
              <Paperclip className="w-8 h-8 text-text-tertiary" />
            </div>
            <p className="text-base font-medium text-text-primary mb-1">No attachments yet</p>
            <p className="text-sm text-text-secondary mb-4">Upload CVs, PDFs, and files for your templates</p>
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="btn btn-primary"
            >
              <Upload className="w-4 h-4 mr-2" /> Upload File
            </button>
          </div>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="md:hidden space-y-3 stagger-children">
              {attachments.map(att => (
                <div key={att.id} className="card-animated p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                      <File className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-text-primary truncate" title={att.filename}>
                        {att.filename}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-text-secondary mt-1">
                        <span>{formatBytes(att.size_bytes)}</span>
                        <span>{new Date(att.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border">
                    <button 
                      onClick={() => handleDownload(att.storage_path, att.filename)}
                      className="btn border border-border h-9 text-xs flex-1"
                    >
                      <Download className="w-4 h-4 mr-1" />
                      Download
                    </button>
                    <button 
                      onClick={() => handleDelete(att.id, att.storage_path)}
                      className="btn border border-border h-9 text-xs text-status-bounced hover:bg-status-bounced/10 hover:border-status-bounced/30"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block card-animated p-0 overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-elevated/30 border-b border-border">
                  <tr className="text-[11px] font-medium text-text-secondary uppercase tracking-wider">
                    <th className="px-5 py-4 w-[50%]">File</th>
                    <th className="px-5 py-4 w-[20%]">Size</th>
                    <th className="px-5 py-4 w-[20%]">Uploaded</th>
                    <th className="px-5 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {attachments.map(att => (
                    <tr key={att.id} className="hover:bg-elevated/20 transition-colors group">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                            <File className="w-5 h-5" />
                          </div>
                          <span className="text-sm font-medium text-text-primary truncate max-w-[300px]" title={att.filename}>
                            {att.filename}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm text-text-secondary">
                        {formatBytes(att.size_bytes)}
                      </td>
                      <td className="px-5 py-4 text-sm text-text-secondary">
                        {new Date(att.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => handleDownload(att.storage_path, att.filename)}
                            className="p-2.5 text-text-tertiary hover:text-primary transition-colors rounded-xl hover:bg-primary/10"
                            title="Download"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDelete(att.id, att.storage_path)}
                            className="p-2.5 text-text-tertiary hover:text-status-bounced transition-colors rounded-xl hover:bg-status-bounced/10"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
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

      {/* Mobile FAB */}
      <button 
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="fab md:hidden pulse-glow"
        aria-label="Upload File"
      >
        {uploading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Plus className="w-6 h-6" />}
      </button>
    </div>
  );
}
