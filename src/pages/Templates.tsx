import { useState, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Bold, Italic, List, ListOrdered, Link as LinkIcon, Plus, Save, Search, CheckCircle, Loader2, ChevronLeft, X } from 'lucide-react';
import { useTemplates, type Template } from '../hooks/useTemplates';

export function TemplatesPage() {
  const { templates, loading, saveTemplate } = useTemplates();
  const [activeTab, setActiveTab] = useState<'editor' | 'followups' | 'settings'>('editor');
  const [activeTemplate, setActiveTemplate] = useState<Template | null>(null);
  const [showMobileList, setShowMobileList] = useState(true);
  
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
        class: 'prose prose-invert prose-sm max-w-none focus:outline-none min-h-[200px] md:min-h-[300px] text-text-primary',
      },
    },
  });

  useEffect(() => {
    if (activeTemplate && editor) {
      editor.commands.setContent(activeTemplate.body || '');
      setSubject(activeTemplate.subject || '');
      setName(activeTemplate.name || '');
      setSelectedAttachments(activeTemplate.attachment_ids || []);
      setShowMobileList(false);
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

  const handleNewTemplate = () => {
    setActiveTemplate(null);
    setShowMobileList(false);
  };

  const handleBackToList = () => {
    setShowMobileList(true);
  };

  return (
    <div className="h-full flex flex-col md:flex-row">
      {/* Template List Pane */}
      <div className={`${showMobileList ? 'flex' : 'hidden'} md:flex w-full md:w-64 border-r border-border flex-col bg-surface flex-shrink-0`}>
        {/* List Header */}
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="font-display font-semibold text-base">Templates</h2>
          <button 
            onClick={handleNewTemplate} 
            className="p-2 text-text-secondary hover:text-primary hover:bg-primary/10 rounded-xl transition-all active:scale-95"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-border">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
            <input type="text" placeholder="Search templates..." className="input-field pl-10 h-10 text-sm" />
          </div>
        </div>

        {/* Template List */}
        <div className="flex-1 overflow-auto p-2 space-y-1 stagger-children">
          {loading ? (
            <div className="text-center text-text-secondary text-sm py-8">
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
              Loading...
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center text-text-tertiary text-sm py-12 px-4">
              <p>No templates yet</p>
              <p className="text-xs mt-1">Tap + to create one</p>
            </div>
          ) : templates.map(t => (
            <button 
              key={t.id} 
              onClick={() => setActiveTemplate(t)}
              className={`w-full text-left p-3 rounded-xl border transition-all duration-200 active:scale-[0.98]
                ${activeTemplate?.id === t.id 
                  ? 'bg-primary/10 border-primary/30' 
                  : 'bg-transparent border-transparent hover:bg-elevated'}`}
            >
              <span className="text-sm font-medium text-text-primary block truncate">{t.name || 'Untitled'}</span>
              <p className="text-xs text-text-secondary truncate mt-0.5">{t.subject || 'No subject'}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Editor Pane */}
      <div className={`${!showMobileList ? 'flex' : 'hidden'} md:flex flex-1 flex-col min-w-0`}>
        {/* Editor Header */}
        <div className="h-14 md:h-12 border-b border-border flex items-center justify-between px-4 md:px-6 bg-background flex-shrink-0">
          <div className="flex items-center gap-2">
            {/* Mobile Back Button */}
            <button 
              onClick={handleBackToList}
              className="p-2 -ml-2 text-text-secondary hover:text-text-primary rounded-xl md:hidden active:scale-95"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            
            {/* Tabs */}
            <div className="flex gap-1 md:gap-2">
              {(['editor', 'followups', 'settings'] as const).map(tab => (
                <button 
                  key={tab}
                  className={`px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200
                    ${activeTab === tab 
                      ? 'bg-primary/10 text-primary' 
                      : 'text-text-secondary hover:text-text-primary'}`} 
                  onClick={() => setActiveTab(tab)}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Save Button */}
          <div className="flex items-center gap-2">
            {saveSuccess && (
              <span className="text-xs text-primary flex items-center gap-1.5 spring-in">
                <CheckCircle className="w-4 h-4" /> Saved!
              </span>
            )}
            <button onClick={handleSave} disabled={isSaving} className="btn btn-primary text-sm h-9 px-4">
              {isSaving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              <span className="hidden md:inline">{isSaving ? 'Saving...' : 'Save'}</span>
            </button>
          </div>
        </div>

        {/* Editor Area */}
        <div className="flex-1 overflow-auto p-4 md:p-8">
          <div className="max-w-3xl mx-auto">
            {activeTab === 'editor' && (
              <div className="space-y-5 slide-up">
                {/* Template Name & Subject */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="label">Template Name</label>
                    <input 
                      type="text" 
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="input-field font-medium" 
                      placeholder="e.g. Q3 Intro"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="label">Subject Line</label>
                    <input 
                      type="text" 
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="input-field font-medium"
                      placeholder='e.g. Quick intro from {{first_name}}'
                    />
                  </div>
                </div>

                {/* Rich Text Editor */}
                <div className="card-animated p-0 overflow-hidden">
                  {/* Toolbar */}
                  <div className="border-b border-border bg-elevated/30 flex items-center p-2 gap-1 overflow-x-auto">
                    <button 
                      onClick={() => editor?.chain().focus().toggleBold().run()} 
                      className={`p-2.5 rounded-lg transition-all active:scale-95 ${editor?.isActive('bold') ? 'bg-primary/10 text-primary' : 'text-text-secondary hover:text-text-primary hover:bg-elevated'}`}
                    >
                      <Bold className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => editor?.chain().focus().toggleItalic().run()} 
                      className={`p-2.5 rounded-lg transition-all active:scale-95 ${editor?.isActive('italic') ? 'bg-primary/10 text-primary' : 'text-text-secondary hover:text-text-primary hover:bg-elevated'}`}
                    >
                      <Italic className="w-4 h-4" />
                    </button>
                    <div className="w-px h-5 bg-border mx-1" />
                    <button 
                      onClick={() => editor?.chain().focus().toggleBulletList().run()} 
                      className="p-2.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-elevated transition-all active:scale-95"
                    >
                      <List className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => editor?.chain().focus().toggleOrderedList().run()} 
                      className="p-2.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-elevated transition-all active:scale-95"
                    >
                      <ListOrdered className="w-4 h-4" />
                    </button>
                    <button className="p-2.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-elevated transition-all active:scale-95">
                      <LinkIcon className="w-4 h-4" />
                    </button>
                    
                    <div className="flex-1" />
                    
                    {/* Variable insertion */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-text-tertiary hidden md:inline">Insert:</span>
                      <button 
                        onClick={() => insertVariable('first_name')} 
                        className="px-2 py-1.5 rounded-lg bg-elevated border border-border text-xs text-text-secondary hover:text-primary transition-all active:scale-95"
                      >
                        {'{{first_name}}'}
                      </button>
                      <button 
                        onClick={() => insertVariable('company')} 
                        className="px-2 py-1.5 rounded-lg bg-elevated border border-border text-xs text-text-secondary hover:text-primary transition-all active:scale-95 hidden md:block"
                      >
                        {'{{company}}'}
                      </button>
                    </div>
                  </div>

                  {/* Editor Content */}
                  <div className="p-4 min-h-[200px] md:min-h-[300px]">
                    <EditorContent editor={editor} />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'followups' && (
              <div className="space-y-4 slide-up">
                <div className="card-animated p-4 md:p-5">
                  <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-2 mb-4">
                    <h3 className="font-medium">Follow-up 1</h3>
                    <span className="text-xs text-text-secondary">If no reply after 3 days</span>
                  </div>
                  <input 
                    type="text" 
                    defaultValue='Re: Quick question for {{company}}' 
                    readOnly 
                    className="input-field mb-3 text-text-secondary opacity-70" 
                  />
                  <textarea 
                    className="input-field h-24 py-3 resize-none" 
                    readOnly 
                    defaultValue="Just bubbling this up. Any thoughts?" 
                  />
                </div>
                <button className="btn border border-dashed border-border w-full text-text-secondary hover:text-primary hover:border-primary transition-all active:scale-[0.99]">
                  <Plus className="w-4 h-4 mr-2" /> Add Follow-up Step
                </button>
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="space-y-6 slide-up">
                {/* Tracking Options */}
                <div className="space-y-3">
                  <label className="flex items-center gap-3 p-3 rounded-xl hover:bg-elevated cursor-pointer transition-colors active:bg-elevated/80">
                    <input type="checkbox" defaultChecked className="rounded border-border bg-background focus:ring-primary accent-primary w-5 h-5" />
                    <span className="text-sm">Track Opens (adds tracking pixel)</span>
                  </label>
                  <label className="flex items-center gap-3 p-3 rounded-xl hover:bg-elevated cursor-pointer transition-colors active:bg-elevated/80">
                    <input type="checkbox" className="rounded border-border bg-background focus:ring-primary accent-primary w-5 h-5" />
                    <span className="text-sm">Track Link Clicks</span>
                  </label>
                </div>

                {/* Sending Window */}
                <div className="pt-4 border-t border-border">
                  <label className="label">Sending Window</label>
                  <p className="text-xs text-text-secondary mb-4">Emails will only be sent during these hours</p>
                  
                  {/* Day Selection */}
                  <div className="flex gap-2 mb-4 flex-wrap">
                    {['M','T','W','T','F','S','S'].map((d, i) => (
                      <button 
                        key={i} 
                        className={`w-10 h-10 rounded-xl text-sm font-medium transition-all active:scale-95
                          ${i < 5 
                            ? 'bg-primary/10 text-primary border border-primary/30' 
                            : 'bg-elevated border border-border text-text-secondary'}`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>

                  {/* Time Range */}
                  <div className="flex items-center gap-3">
                    <input type="time" defaultValue="09:00" className="input-field flex-1 md:w-32 md:flex-none" />
                    <span className="text-text-secondary text-sm">to</span>
                    <input type="time" defaultValue="17:00" className="input-field flex-1 md:w-32 md:flex-none" />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
