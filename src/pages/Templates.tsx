import { useState, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Bold, Italic, List, ListOrdered, Link as LinkIcon, Plus, Save, Search, CheckCircle, Loader2, ChevronLeft, Type, Clock, Settings, FileText } from 'lucide-react';
import { useTemplates, type Template } from '../hooks/useTemplates';
import { motion, AnimatePresence } from 'framer-motion';

export function TemplatesPage() {
  const { templates, loading, saveTemplate } = useTemplates();
  const [activeTab, setActiveTab] = useState<'editor' | 'followups' | 'settings'>('editor');
  const [activeTemplate, setActiveTemplate] = useState<Template | null>(null);
  const [showEditorOnMobile, setShowEditorOnMobile] = useState(false);
  
  const [subject, setSubject] = useState('');
  const [name, setName] = useState('New Template');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [selectedAttachments, setSelectedAttachments] = useState<string[]>([]);
  
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Write your email body here...' })
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'prose prose-invert prose-sm max-w-none focus:outline-none min-h-[300px] text-text-primary',
      },
    },
  });

  useEffect(() => {
    if (activeTemplate && editor) {
      editor.commands.setContent(activeTemplate.body || '');
      setSubject(activeTemplate.subject || '');
      setName(activeTemplate.name || '');
      setSelectedAttachments(activeTemplate.attachment_ids || []);
    } else if (!activeTemplate && editor) {
      editor.commands.setContent('');
      setSubject('');
      setName('New Template');
      setSelectedAttachments([]);
    }
  }, [activeTemplate, editor]);

  const insertVariable = (variable: string) => {
    editor?.commands.insertContent(`{{${variable}}}`);
  };

  const handleSave = async () => {
    if (!editor) return;
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      const saved = await saveTemplate({
        id: activeTemplate?.id,
        name,
        subject,
        body: editor.getHTML(),
        attachment_ids: selectedAttachments,
      });
      setActiveTemplate(saved);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error(err);
      alert('Failed to save template');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="h-full flex overflow-hidden pb-20 md:pb-0">
      {/* Left List Pane - Hidden on mobile if editor is shown */}
      <div className={`w-full md:w-72 border-r border-border flex flex-col bg-surface/30 flex-shrink-0 ${showEditorOnMobile ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-5 border-b border-border flex items-center justify-between">
          <h2 className="text-xl font-display font-bold tracking-tight text-text-primary">Templates</h2>
          <button 
            onClick={() => {
              setActiveTemplate(null);
              setShowEditorOnMobile(true);
            }} 
            className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center hover:bg-primary hover:text-black transition-all active:scale-90"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 border-b border-border">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
            <input type="text" placeholder="Search templates..." className="input-field pl-10 h-10 bg-background/50 border-none ring-1 ring-border focus:ring-primary/50" />
          </div>
        </div>
        <div className="flex-1 overflow-auto p-3 space-y-2 custom-scrollbar">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-primary/50" />
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-12 px-6">
              <FileText className="w-10 h-10 text-text-tertiary mx-auto mb-3 opacity-20" />
              <p className="text-xs text-text-tertiary leading-relaxed">No templates found. Create your first one to start outreach.</p>
            </div>
          ) : templates.map(t => (
            <motion.div 
              key={t.id} 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              onClick={() => {
                setActiveTemplate(t);
                setShowEditorOnMobile(true);
              }}
              className={`p-4 rounded-xl border cursor-pointer transition-all active:scale-[0.98] ${
                activeTemplate?.id === t.id 
                  ? 'bg-primary/10 border-primary/40 shadow-sm' 
                  : 'bg-surface/50 border-transparent hover:bg-elevated'
              }`}
            >
              <span className={`text-sm font-bold tracking-tight block truncate ${activeTemplate?.id === t.id ? 'text-primary' : 'text-text-primary'}`}>
                {t.name || 'Untitled'}
              </span>
              <p className="text-[11px] text-text-tertiary truncate mt-1">{t.subject || 'No subject line'}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Editor Pane - Shown on mobile if triggered */}
      <div className={`flex-1 flex flex-col min-w-0 bg-background ${!showEditorOnMobile ? 'hidden md:flex' : 'flex'}`}>
        {/* Header */}
        <div className="h-14 border-b border-border flex items-center justify-between px-4 md:px-8 bg-surface/20 backdrop-blur-md sticky top-0 z-20">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setShowEditorOnMobile(false)}
              className="p-2 -ml-2 text-text-tertiary hover:text-text-primary md:hidden active:scale-90 transition-transform"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <div className="flex space-x-1 p-1 bg-elevated/50 rounded-lg">
              {[
                { id: 'editor', icon: Type, label: 'Compose' },
                { id: 'followups', icon: Clock, label: 'Follow-ups' },
                { id: 'settings', icon: Settings, label: 'Rules' }
              ].map(tab => (
                <button 
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wider transition-all ${
                    activeTab === tab.id ? 'bg-primary text-black' : 'text-text-tertiary hover:text-text-primary'
                  }`}
                >
                  <tab.icon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <AnimatePresence>
              {saveSuccess && (
                <motion.span 
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  className="hidden sm:flex items-center gap-1.5 text-xs text-primary font-bold"
                >
                  <CheckCircle className="w-4 h-4" /> Saved!
                </motion.span>
              )}
            </AnimatePresence>
            <button 
              onClick={handleSave} 
              disabled={isSaving} 
              className="btn btn-primary text-[11px] h-9 px-4 rounded-full font-black uppercase tracking-widest active:scale-95 transition-all"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span className="hidden sm:inline ml-2">{isSaving ? 'Syncing...' : 'Save Changes'}</span>
            </button>
          </div>
        </div>

        {/* Editor Area */}
        <div className="flex-1 overflow-auto p-4 md:p-10 custom-scrollbar">
          <div className="max-w-3xl mx-auto w-full">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-8"
              >
                {activeTab === 'editor' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="md:col-span-1">
                        <label className="label">Internal Name</label>
                        <input 
                          type="text" 
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="input-field h-12 bg-surface/50 border-none ring-1 ring-border focus:ring-primary/50 font-bold" 
                          placeholder="e.g. Q3 Outreach"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="label">Subject Line</label>
                        <input 
                          type="text" 
                          value={subject}
                          onChange={(e) => setSubject(e.target.value)}
                          className="input-field h-12 bg-surface/50 border-none ring-1 ring-border focus:ring-primary/50 text-base"
                          placeholder="Re: {{company}} x ZangSend"
                        />
                      </div>
                    </div>

                    <div className="border border-border rounded-2xl bg-surface/30 overflow-hidden flex flex-col shadow-xl ring-1 ring-white/5">
                      {/* Toolbar */}
                      <div className="h-12 border-b border-border bg-elevated/50 flex items-center px-4 overflow-x-auto no-scrollbar gap-2">
                        <button onClick={() => editor?.chain().focus().toggleBold().run()} className={`p-2 rounded-lg hover:bg-elevated transition-colors ${editor?.isActive('bold') ? 'text-primary bg-primary/10' : 'text-text-tertiary'}`}><Bold className="w-4 h-4" /></button>
                        <button onClick={() => editor?.chain().focus().toggleItalic().run()} className={`p-2 rounded-lg hover:bg-elevated transition-colors ${editor?.isActive('italic') ? 'text-primary bg-primary/10' : 'text-text-tertiary'}`}><Italic className="w-4 h-4" /></button>
                        <div className="w-px h-6 bg-border mx-1" />
                        <button onClick={() => editor?.chain().focus().toggleBulletList().run()} className="p-2 rounded-lg hover:bg-elevated text-text-tertiary"><List className="w-4 h-4" /></button>
                        <button onClick={() => editor?.chain().focus().toggleOrderedList().run()} className="p-2 rounded-lg hover:bg-elevated text-text-tertiary"><ListOrdered className="w-4 h-4" /></button>
                        <div className="flex-1 min-w-[20px]" />
                        <div className="flex items-center gap-1.5 whitespace-nowrap">
                          <span className="text-[10px] font-black uppercase text-text-tertiary mr-1">Dynamic:</span>
                          <button onClick={() => insertVariable('first_name')} className="px-2.5 py-1 rounded-md bg-background border border-border text-[10px] font-bold text-text-secondary hover:text-primary transition-all active:scale-95">Name</button>
                          <button onClick={() => insertVariable('company')} className="px-2.5 py-1 rounded-md bg-background border border-border text-[10px] font-bold text-text-secondary hover:text-primary transition-all active:scale-95">Company</button>
                        </div>
                      </div>
                      <div className="p-6 min-h-[400px]">
                        <EditorContent editor={editor} className="custom-scrollbar" />
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'followups' && (
                  <div className="space-y-6">
                    <div className="bg-surface/50 border border-border rounded-2xl p-6 shadow-sm">
                      <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">1</div>
                          <h3 className="font-bold text-text-primary">First Follow-up</h3>
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-text-tertiary bg-elevated px-3 py-1 rounded-full border border-border">After 3 Days</span>
                      </div>
                      <div className="space-y-4 opacity-50 pointer-events-none select-none">
                        <input type="text" defaultValue="Re: {{subject}}" className="input-field bg-background/50" />
                        <div className="input-field h-32 py-3 bg-background/50">Just wanted to make sure this stayed at the top of your inbox...</div>
                      </div>
                    </div>
                    <button className="btn border-2 border-dashed border-border w-full py-8 text-text-tertiary hover:border-primary/50 hover:text-primary transition-all group">
                      <Plus className="w-5 h-5 mr-3 group-hover:scale-125 transition-transform" />
                      <span className="font-bold uppercase tracking-widest text-xs">Architect Follow-up Sequence</span>
                    </button>
                  </div>
                )}

                {activeTab === 'settings' && (
                  <div className="space-y-8">
                    <div className="bg-surface/50 border border-border rounded-2xl p-6 space-y-6">
                      <h3 className="text-sm font-black uppercase tracking-widest text-text-secondary">Tracking Engine</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <label className="flex items-center justify-between p-4 bg-background/50 rounded-xl border border-border cursor-pointer hover:border-primary/30 transition-all">
                          <span className="text-sm font-medium text-text-primary">Engagement Pixel</span>
                          <input type="checkbox" defaultChecked className="w-5 h-5 accent-primary" />
                        </label>
                        <label className="flex items-center justify-between p-4 bg-background/50 rounded-xl border border-border cursor-pointer hover:border-primary/30 transition-all">
                          <span className="text-sm font-medium text-text-primary">Link Click Tracking</span>
                          <input type="checkbox" className="w-5 h-5 accent-primary" />
                        </label>
                      </div>
                    </div>
                    
                    <div className="bg-primary/5 border border-primary/10 rounded-2xl p-6 space-y-6">
                      <h3 className="text-sm font-black uppercase tracking-widest text-primary">Sequence Rules</h3>
                      <div className="space-y-6">
                        <div>
                          <p className="text-[11px] text-text-secondary mb-4">Select the days this specific sequence is allowed to dispatch.</p>
                          <div className="flex gap-2 justify-between">
                            {['M','T','W','T','F','S','S'].map((d, i) => (
                              <button key={i} className={`flex-1 aspect-square rounded-xl text-xs font-black transition-all active:scale-90 ${i < 5 ? 'bg-primary text-black' : 'bg-elevated text-text-tertiary border border-border'}`}>{d}</button>
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center justify-between pt-4 border-t border-primary/10">
                          <div className="flex items-center gap-2">
                            <input type="time" defaultValue="09:00" className="bg-transparent text-sm font-bold text-text-primary border-none p-0 w-16" />
                            <span className="text-primary text-[10px] font-black tracking-widest">TO</span>
                            <input type="time" defaultValue="17:00" className="bg-transparent text-sm font-bold text-text-primary border-none p-0 w-16" />
                          </div>
                          <span className="text-[10px] font-bold text-primary bg-primary/10 px-3 py-1 rounded-full">EST TIMEZONE</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
