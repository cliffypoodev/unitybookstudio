import React, { useState } from 'react';
import { Settings, User, Sparkles, BookOpen, Key, FileText, Layout, Plus, Trash2, Check, Pencil, X, Loader2, Download, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { NOTEBOOK_ACCENTS, NOTEBOOK_THEMES, useNotebookTheme } from '@/components/notebook/ThemeProvider';
import { base44 } from '@/api/base44Client';
import { resolveChapterContent, chapterHasContent } from '@/lib/chapterStorage';
import { isBodyChapter } from '@/lib/bibliographyGenerator';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import { useUserSettings } from '@/lib/userSettings';
import { useAuth } from '@/lib/AuthContext';
import toast from 'react-hot-toast';

const TABS = [
  { id: 'personas', label: 'Author Personas', icon: User },
  { id: 'polish', label: 'Polish & Quality', icon: Sparkles },
  { id: 'publishing', label: 'Publishing', icon: BookOpen },
  { id: 'api', label: 'API Keys', icon: Key },
  { id: 'export', label: 'Export', icon: FileText },
  { id: 'workspace', label: 'Workspace', icon: Layout },
  { id: 'theme', label: 'Theme', icon: Settings },
  { id: 'backup', label: 'Backup', icon: Download },
];

const BEAT_STYLES = [
  'Fast-Paced Thriller', 'Gritty Cinematic', 'Hollywood Blockbuster', 'Slow Burn',
  'Clean Romance', 'Faith-Infused Contemporary', 'Investigative / Nonfiction',
  'Reference / Educational', 'Intellectual Psychological', 'Dark Suspense',
  'Satirical', 'Epic Historical', 'Whimsical Cozy', 'Hard-Boiled Noir',
  'Grandiose Space Opera', 'Visceral Horror', 'Poetic Magical Realism',
  'Clinical Procedural', 'Hyper-Stylized Action', 'Nostalgic Coming-of-Age',
  'Cerebral Sci-Fi', 'High-Stakes Political', 'Surrealist Avant-Garde',
  'Melancholic Literary', 'Urban Gritty Fantasy',
];

function SettingRow({ label, description, children }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-border/30 last:border-0">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{label}</div>
        {description && <div className="text-[11px] text-muted-foreground mt-0.5">{description}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Select({ value, onChange, options, className = '' }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className={'h-8 rounded border border-border bg-background px-2 text-xs ' + className}>
      {options.map(o => <option key={o.id ?? o} value={o.id ?? o}>{o.label ?? o}</option>)}
    </select>
  );
}

function Toggle({ checked, onChange }) {
  return (
    <button onClick={() => onChange(!checked)}
      className={'relative inline-flex h-6 w-11 items-center rounded-full transition-colors ' + (checked ? 'bg-primary' : 'bg-muted')}>
      <span className={'inline-block h-4 w-4 transform rounded-full bg-white transition-transform ' + (checked ? 'translate-x-6' : 'translate-x-1')} />
    </button>
  );
}

function Slider({ value, onChange, min, max, step = 1, suffix = '' }) {
  return (
    <div className="flex items-center gap-2">
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-32 h-1.5 accent-primary" />
      <span className="text-xs font-mono w-12 text-right">{value}{suffix}</span>
    </div>
  );
}

function PersonasTab({ personas, activePersona, addPersona, updatePersona, deletePersona, setActivePersona }) {
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({});
  const [adding, setAdding] = useState(false);

  const startEdit = (persona) => { setEditingId(persona.id); setDraft({ ...persona }); };
  const cancelEdit = () => { setEditingId(null); setDraft({}); setAdding(false); };

  const saveEdit = async () => {
    if (adding) {
      const created = await addPersona(draft);
      if (created) toast.success('Persona created');
      setAdding(false);
    } else {
      await updatePersona(editingId, draft);
      toast.success('Persona updated');
    }
    setEditingId(null); setDraft({});
  };

  const startAdd = () => {
    setAdding(true); setEditingId('new');
    setDraft({ persona_name: '', pen_name: '', bio: '', genres: '', default_genre: '', default_beat_style: 'Fast-Paced Thriller', default_language_intensity: 2, default_pov: 'third-close', default_tense: 'past', voice_notes: '' });
  };

  const Field = ({ label, field, type = 'text', options }) => (
    <div className="flex items-center gap-2 text-xs">
      <label className="w-28 shrink-0 text-muted-foreground">{label}</label>
      {type === 'select' ? (
        <select value={draft[field] || ''} onChange={(e) => setDraft(d => ({ ...d, [field]: e.target.value }))}
          className="flex-1 h-7 rounded border border-border bg-background px-2 text-xs">
          {options.map(o => <option key={o.id ?? o} value={o.id ?? o}>{o.label ?? o}</option>)}
        </select>
      ) : type === 'textarea' ? (
        <textarea value={draft[field] || ''} onChange={(e) => setDraft(d => ({ ...d, [field]: e.target.value }))}
          className="flex-1 h-16 rounded border border-border bg-background px-2 py-1 text-xs resize-none" />
      ) : type === 'number' ? (
        <input type="number" value={draft[field] || 0} onChange={(e) => setDraft(d => ({ ...d, [field]: Number(e.target.value) }))}
          className="w-20 h-7 rounded border border-border bg-background px-2 text-xs" />
      ) : (
        <input value={draft[field] || ''} onChange={(e) => setDraft(d => ({ ...d, [field]: e.target.value }))}
          className="flex-1 h-7 rounded border border-border bg-background px-2 text-xs" />
      )}
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Manage multiple pen names with different default settings.</p>
        <Button size="sm" onClick={startAdd} disabled={adding} className="text-xs h-7 gap-1"><Plus className="h-3 w-3" /> Add Persona</Button>
      </div>
      {personas.map(p => (
        <div key={p.id} className={'rounded-lg border p-3 ' + (p.id === activePersona?.id ? 'border-primary bg-primary/5' : 'border-border/50')}>
          {editingId === p.id ? (
            <div className="space-y-2">
              <Field label="Persona Name" field="persona_name" />
              <Field label="Pen Name" field="pen_name" />
              <Field label="Genres" field="genres" />
              <Field label="Default Genre" field="default_genre" />
              <Field label="Beat Style" field="default_beat_style" type="select" options={BEAT_STYLES} />
              <Field label="Language (0-4)" field="default_language_intensity" type="number" />
              <Field label="POV" field="default_pov" type="select" options={['third-close','third-multi','first','second','omniscient','nf-direct','nf-reported']} />
              <Field label="Tense" field="default_tense" type="select" options={['past','present']} />
              <Field label="Author Bio" field="bio" type="textarea" />
              <Field label="Voice Notes" field="voice_notes" type="textarea" />
              <Field label="BISAC Codes" field="bisac_categories" />
              <div className="flex gap-2 mt-2">
                <Button size="sm" onClick={saveEdit} className="text-xs h-7 gap-1"><Check className="h-3 w-3" /> Save</Button>
                <Button size="sm" variant="ghost" onClick={cancelEdit} className="text-xs h-7">Cancel</Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-sm">{p.pen_name || p.persona_name || 'Unnamed'}</div>
                <div className="text-[10px] text-muted-foreground">{p.genres || 'No genres'} · {p.default_beat_style || '—'} · Lang {p.default_language_intensity ?? '—'}</div>
              </div>
              <div className="flex items-center gap-1">
                {p.id !== activePersona?.id && <Button size="sm" variant="outline" onClick={() => setActivePersona(p.id)} className="text-[10px] h-6 px-2">Set Active</Button>}
                {p.id === activePersona?.id && <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/20 text-primary font-medium">Active</span>}
                <button onClick={() => startEdit(p)} className="p-1 rounded hover:bg-accent"><Pencil className="h-3 w-3 text-muted-foreground" /></button>
                {personas.length > 1 && <button onClick={() => deletePersona(p.id)} className="p-1 rounded hover:bg-accent"><Trash2 className="h-3 w-3 text-red-500" /></button>}
              </div>
            </div>
          )}
        </div>
      ))}
      {adding && editingId === 'new' && (
        <div className="rounded-lg border border-primary/50 bg-primary/5 p-3 space-y-2">
          <div className="text-xs font-medium text-primary mb-1">New Persona</div>
          <Field label="Persona Name" field="persona_name" />
          <Field label="Pen Name" field="pen_name" />
          <Field label="Genres" field="genres" />
          <Field label="Beat Style" field="default_beat_style" type="select" options={BEAT_STYLES} />
          <Field label="Language (0-4)" field="default_language_intensity" type="number" />
          <Field label="POV" field="default_pov" type="select" options={['third-close','third-multi','first','second','omniscient']} />
          <Field label="Tense" field="default_tense" type="select" options={['past','present']} />
          <Field label="Author Bio" field="bio" type="textarea" />
          <Field label="Voice Notes" field="voice_notes" type="textarea" />
          <div className="flex gap-2 mt-2">
            <Button size="sm" onClick={saveEdit} className="text-xs h-7 gap-1"><Check className="h-3 w-3" /> Create</Button>
            <Button size="sm" variant="ghost" onClick={cancelEdit} className="text-xs h-7">Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}

const IMPORT_STORE_MAP = {
  projects:     'NovelProject',
  chapters:     'Chapter',
  coverArt:     'CoverArtGallery',
  authorStyles: 'AuthorStyle',
  seriesBibles: 'SeriesBible',
  folders:      'ProjectFolder',
  prompts:      'PromptCatalog',
};

function openImportDB() {
  const DB_NAME = 'UnityBookStudio';
  const DB_VERSION = 1;
  const STORES = ['NovelProject','Chapter','SeriesBible','AuthorStyle','CoverArtGallery','PromptCatalog','ProjectFolder','BookProject','_FileStore'];
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      for (const name of STORES) {
        if (!db.objectStoreNames.contains(name)) {
          const s = db.createObjectStore(name, { keyPath: 'id' });
          s.createIndex('created_by', 'created_by', { unique: false });
          s.createIndex('project_id', 'project_id', { unique: false });
          s.createIndex('created_date', 'created_date', { unique: false });
          s.createIndex('updated_date', 'updated_date', { unique: false });
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function putImportBatch(db, storeName, records) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    let count = 0, errors = 0;
    for (const rec of records) {
      try {
        const r = store.put(rec);
        r.onsuccess = () => { count++; };
        r.onerror = (ev) => { errors++; ev.preventDefault(); };
      } catch { errors++; }
    }
    tx.oncomplete = () => resolve({ count, errors });
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function BackupTab() {
  const [busy, setBusy] = React.useState(false);
  const [progress, setProgress] = React.useState('');
  const [currentUser, setCurrentUser] = React.useState(null);
  const [importBusy, setImportBusy] = React.useState(false);
  const [importProgress, setImportProgress] = React.useState('');
  const [importLog, setImportLog] = React.useState([]);
  const fileRef = React.useRef(null);

  React.useEffect(() => { base44.auth.me().then(setCurrentUser).catch(() => {}); }, []);

  const handleBackup = async () => {
    if (!currentUser?.email) return;
    setBusy(true);
    try {
      setProgress('Loading zip library…');
      if (!window.JSZip) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
          script.onload = resolve;
          script.onerror = () => reject(new Error('Failed to load JSZip'));
          document.head.appendChild(script);
        });
      }
      const zip = new window.JSZip();

      setProgress('Loading projects…');
      const projects = await base44.entities.NovelProject.filter({ created_by: currentUser.email }, '-updated_date', 100);
      if (!projects.length) { setProgress('No projects found.'); setBusy(false); return; }

      for (let pi = 0; pi < projects.length; pi++) {
        const project = projects[pi];
        const safeTitle = (project.title || 'Untitled').replace(/[^a-zA-Z0-9 _-]/g, '').substring(0, 50).trim() || 'Untitled';
        setProgress(`Exporting ${pi + 1}/${projects.length}: ${safeTitle}…`);

        const chapters = await base44.entities.Chapter.filter({ project_id: project.id }, 'chapter_number', 200);
        const bodyChapters = chapters.filter(ch => chapterHasContent(ch)).sort((a, b) => (a.chapter_number || 0) - (b.chapter_number || 0));

        const docChildren = [
          new Paragraph({ text: project.title || 'Untitled', heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER }),
          new Paragraph({ text: project.author_name || '', alignment: AlignmentType.CENTER }),
          new Paragraph({ text: '' }),
        ];

        for (const ch of bodyChapters) {
          const content = await resolveChapterContent(ch);
          if (!content) continue;
          docChildren.push(new Paragraph({ children: [new TextRun({ break: 1 })], pageBreakBefore: true }));
          docChildren.push(new Paragraph({ text: ch.title || '', heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER }));
          const paragraphs = content.split(/\n+/).filter(p => p.trim());
          for (const para of paragraphs) {
            docChildren.push(new Paragraph({ children: [new TextRun(para.trim())] }));
          }
        }

        const doc = new Document({ sections: [{ children: docChildren }] });
        const blob = await Packer.toBlob(doc);
        zip.file(`${safeTitle}.docx`, blob);
        await new Promise(r => setTimeout(r, 300));
      }

      setProgress('Building zip file…');
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `UBS-Backup-${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 5000);

      setProgress(`Done! ${projects.length} manuscripts backed up.`);
    } catch (err) {
      setProgress('Backup failed: ' + err.message);
    } finally {
      setBusy(false);
    }
  };

  const addLog = (msg, type = 'info') => {
    setImportLog(prev => [...prev, { msg, type }]);
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileRef.current) fileRef.current.value = '';

    setImportBusy(true);
    setImportLog([]);
    setImportProgress('');

    try {
      addLog(`Reading ${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB)…`);
      setImportProgress('Reading file…');

      const text = await file.text();
      setImportProgress('Parsing JSON…');
      const data = JSON.parse(text);

      addLog(`Export version: ${data.version || 'unknown'}`);
      addLog(`Exported at: ${data.exported_at || 'unknown'}`);
      if (data.counts) {
        addLog(`Expected: ${data.counts.projects || 0} projects, ${data.counts.chapters || 0} chapters, ${data.counts.coverArt || 0} covers, ${data.counts.seriesBibles || 0} bibles, ${data.counts.folders || 0} folders, ${data.counts.prompts || 0} prompts`);
      }

      setImportProgress('Opening database…');
      const db = await openImportDB();
      addLog('Database opened', 'done');

      const keys = Object.keys(IMPORT_STORE_MAP);
      const totalRecords = keys.reduce((s, k) => s + (data[k]?.length || 0), 0);
      let processed = 0;
      const summary = {};

      for (const jsonKey of keys) {
        const storeName = IMPORT_STORE_MAP[jsonKey];
        const records = data[jsonKey];

        if (!records || !Array.isArray(records) || records.length === 0) {
          summary[jsonKey] = { total: 0, imported: 0, errors: 0 };
          continue;
        }

        addLog(`${jsonKey} → ${storeName}: ${records.length} records…`);

        const prepared = records.map(r => {
          const rec = { ...r };
          if (!rec.id) rec.id = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
          if (rec.created_by) {
            rec.original_created_by = rec.created_by;
            rec.created_by = 'local@unitybookstudio.app';
          }
          return rec;
        });

        let totalImported = 0, totalErrors = 0;
        const BATCH = 200;

        for (let i = 0; i < prepared.length; i += BATCH) {
          const batch = prepared.slice(i, i + BATCH);
          try {
            const result = await putImportBatch(db, storeName, batch);
            totalImported += result.count;
            totalErrors += result.errors;
          } catch (err) {
            addLog(`  Batch error: ${err.message}`, 'error');
            totalErrors += batch.length;
          }
          processed += batch.length;
          const pct = Math.round((processed / totalRecords) * 100);
          setImportProgress(`Importing ${storeName}: ${Math.min(i + BATCH, prepared.length)}/${prepared.length} (${pct}% overall)`);
          await new Promise(r => setTimeout(r, 0));
        }

        summary[jsonKey] = { total: records.length, imported: totalImported, errors: totalErrors };
        addLog(`  ✅ ${totalImported} imported${totalErrors > 0 ? `, ❌ ${totalErrors} errors` : ''}`, totalErrors > 0 ? 'warn' : 'done');
      }

      const totalImported = Object.values(summary).reduce((s, r) => s + r.imported, 0);
      addLog(`Import complete: ${totalImported} records imported`, 'done');
      addLog(`  ${summary.projects?.imported || 0} projects, ${summary.chapters?.imported || 0} chapters, ${summary.coverArt?.imported || 0} covers`, 'done');
      setImportProgress(`Done! ${totalImported} records imported. Refresh the page to see your library.`);
      toast.success(`Imported ${summary.projects?.imported || 0} projects and ${summary.chapters?.imported || 0} chapters!`);
    } catch (err) {
      addLog(`FATAL: ${err.message}`, 'error');
      setImportProgress('Import failed: ' + err.message);
      toast.error('Import failed: ' + err.message);
    } finally {
      setImportBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Export */}
      <div>
        <h3 className="text-sm font-medium mb-1">Backup All Projects</h3>
        <p className="text-xs text-muted-foreground mb-3">Download your entire library as a single zip file containing one .docx per project.</p>
        <Button onClick={handleBackup} disabled={busy || importBusy} variant="outline" className="rounded-full gap-2">
          <Download className="h-4 w-4" /> Download Library Backup (.zip)
        </Button>
        {progress && (
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            {busy && <Loader2 className="h-3 w-3 animate-spin" />}
            {progress}
          </div>
        )}
      </div>

      <div className="border-t border-border/30" />

      {/* Import */}
      <div>
        <h3 className="text-sm font-medium mb-1">Import from JSON Export</h3>
        <p className="text-xs text-muted-foreground mb-3">Import a full UBS JSON export file. This restores all projects, chapters, cover art, series bibles, folders, and prompts with original metadata.</p>
        <input ref={fileRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
        <Button onClick={() => fileRef.current?.click()} disabled={busy || importBusy} variant="outline" className="rounded-full gap-2">
          {importBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {importBusy ? 'Importing…' : 'Import JSON Export'}
        </Button>
        {importProgress && (
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            {importBusy && <Loader2 className="h-3 w-3 animate-spin" />}
            {importProgress}
          </div>
        )}
        {importLog.length > 0 && (
          <div className="mt-3 rounded-lg bg-black/30 border border-border/30 p-3 max-h-48 overflow-y-auto font-mono text-[11px] leading-relaxed">
            {importLog.map((l, i) => (
              <div key={i} className={l.type === 'done' ? 'text-green-400' : l.type === 'error' ? 'text-red-400' : l.type === 'warn' ? 'text-yellow-400' : 'text-muted-foreground'}>
                {l.msg}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SettingsModal({ open, onOpenChange }) {
  const { settings: themeSettings, updateSettings: updateTheme } = useNotebookTheme();
  const { settings, authorPersonas, loading, saveSettings } = useUserSettings();
  const personas = authorPersonas || [];
  const activePersona = personas[0] || null;
  const updateSettings = saveSettings;
  const addPersona = async (p) => { console.warn('[SETTINGS] addPersona not persisted in local mode', p); return p; };
  const updatePersona = async (id, p) => { console.warn('[SETTINGS] updatePersona not persisted in local mode', id); return p; };
  const deletePersona = async (id) => { console.warn('[SETTINGS] deletePersona not persisted in local mode', id); };
  const setActivePersona = (id) => { console.warn('[SETTINGS] setActivePersona not persisted in local mode', id); };
  const { logout } = useAuth();
  const [tab, setTab] = useState('personas');

  if (loading) return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl"><div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div></DialogContent>
    </Dialog>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Settings className="h-5 w-5" /> Settings</DialogTitle></DialogHeader>
        <div className="flex gap-4 flex-1 min-h-0">
          <div className="w-40 shrink-0 space-y-0.5 border-r border-border/30 pr-3 flex flex-col">
            <div className="flex-1 space-y-0.5">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={'w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors ' +
                  (tab === t.id ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-accent/50')}>
                <t.icon className="h-3.5 w-3.5" /> {t.label}
              </button>
            ))}
            </div>
            <div className="pt-3 border-t border-border/30 mt-3">
              <button onClick={() => { if (window.confirm('Log out of Unity Book Studio?')) logout(); }}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors">
                <X className="h-3.5 w-3.5" /> Log Out
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto pr-1">
            {tab === 'personas' && <PersonasTab personas={personas} activePersona={activePersona} addPersona={addPersona} updatePersona={updatePersona} deletePersona={deletePersona} setActivePersona={setActivePersona} />}
            {tab === 'polish' && (
              <div>
                <SettingRow label="Progressive Threshold" description="Convert above this rate (per 10K)"><Slider value={settings.progressive_threshold} onChange={(v) => updateSettings({ progressive_threshold: v })} min={4} max={20} suffix="/10K" /></SettingRow>
                <SettingRow label="Em-Dash Target" description="Reduce above this (per 1K)"><Slider value={settings.emdash_target} onChange={(v) => updateSettings({ emdash_target: v })} min={3} max={10} suffix="/1K" /></SettingRow>
                <SettingRow label="'The' Starter Target" description="Vary above this %"><Slider value={settings.the_starter_target} onChange={(v) => updateSettings({ the_starter_target: v })} min={10} max={25} suffix="%" /></SettingRow>
                <SettingRow label="Auto-Polish After Gen"><Toggle checked={settings.auto_polish_after_gen} onChange={(v) => updateSettings({ auto_polish_after_gen: v })} /></SettingRow>
                <SettingRow label="Auto Final Check"><Toggle checked={settings.auto_final_check_after_polish} onChange={(v) => updateSettings({ auto_final_check_after_polish: v })} /></SettingRow>
                <SettingRow label="Custom Banned Words" description="Comma-separated"><textarea value={settings.custom_banned_words} onChange={(e) => updateSettings({ custom_banned_words: e.target.value })} className="w-64 h-16 rounded border border-border bg-background px-2 py-1 text-xs resize-none" placeholder="word1, word2" /></SettingRow>
                <SettingRow label="Custom Banned Names" description="Comma-separated"><textarea value={settings.custom_banned_names} onChange={(e) => updateSettings({ custom_banned_names: e.target.value })} className="w-64 h-16 rounded border border-border bg-background px-2 py-1 text-xs resize-none" placeholder="Elara, Kaelen" /></SettingRow>
              </div>
            )}
            {tab === 'publishing' && (
              <div>
                <SettingRow label="Default Trim Size"><Select value={settings.default_trim_size} onChange={(v) => updateSettings({ default_trim_size: v })} options={['5x8','5.25x8','5.5x8.5','6x9','6.14x9.21','6.69x9.61','7x10','8.5x11']} className="w-36" /></SettingRow>
                <SettingRow label="Marketplace"><Select value={settings.default_marketplace} onChange={(v) => updateSettings({ default_marketplace: v })} options={[{id:'amazon_us',label:'Amazon US'},{id:'amazon_uk',label:'Amazon UK'},{id:'amazon_de',label:'Amazon DE'},{id:'amazon_ca',label:'Amazon CA'}]} className="w-40" /></SettingRow>
                <SettingRow label="Active Pen Name"><span className="text-sm font-medium">{activePersona?.pen_name || activePersona?.persona_name || '—'}</span></SettingRow>
              </div>
            )}
            {tab === 'api' && (
              <div>
                <p className="text-xs text-muted-foreground mb-3">API keys are stored on your account. Keep them private.</p>
                <SettingRow label="OpenRouter API Key"><input type="password" value={settings.openrouter_api_key} onChange={(e) => updateSettings({ openrouter_api_key: e.target.value })} className="w-64 h-8 rounded border border-border bg-background px-2 text-xs font-mono" placeholder="sk-or-..." /></SettingRow>
                <SettingRow label="OpenAI API Key"><input type="password" value={settings.openai_api_key} onChange={(e) => updateSettings({ openai_api_key: e.target.value })} className="w-64 h-8 rounded border border-border bg-background px-2 text-xs font-mono" placeholder="sk-..." /></SettingRow>
                <SettingRow label="Gemini API Key"><input type="password" value={settings.gemini_api_key} onChange={(e) => updateSettings({ gemini_api_key: e.target.value })} className="w-64 h-8 rounded border border-border bg-background px-2 text-xs font-mono" placeholder="AIza..." /></SettingRow>
              </div>
            )}
            {tab === 'export' && (
              <div>
                <SettingRow label="Default Format"><Select value={settings.default_export_format} onChange={(v) => updateSettings({ default_export_format: v })} options={['docx','epub','pdf','md']} className="w-32" /></SettingRow>
                <SettingRow label="Default Font"><Select value={settings.default_export_font} onChange={(v) => updateSettings({ default_export_font: v })} options={['Garamond','Times New Roman','Georgia','Palatino','Book Antiqua','Cambria','Crimson Text','Libre Baskerville']} className="w-44" /></SettingRow>
                <SettingRow label="Front Matter"><Toggle checked={settings.include_front_matter} onChange={(v) => updateSettings({ include_front_matter: v })} /></SettingRow>
                <SettingRow label="Back Matter"><Toggle checked={settings.include_back_matter} onChange={(v) => updateSettings({ include_back_matter: v })} /></SettingRow>
              </div>
            )}
            {tab === 'workspace' && (
              <div>
                <SettingRow label="Auto-Save Interval"><Slider value={settings.autosave_interval} onChange={(v) => updateSettings({ autosave_interval: v })} min={10} max={120} step={10} suffix="s" /></SettingRow>
                <SettingRow label="Floating Brainstorm"><Toggle checked={settings.enable_floating_brainstorm} onChange={(v) => updateSettings({ enable_floating_brainstorm: v })} /></SettingRow>
                <SettingRow label="Default Project Type"><Select value={settings.default_project_type} onChange={(v) => updateSettings({ default_project_type: v })} options={['fiction','nonfiction','anthology']} className="w-32" /></SettingRow>
              </div>
            )}
            {tab === 'theme' && (
              <div className="space-y-5">
                <div>
                  <div className="mb-2 text-sm font-medium">Themes</div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {NOTEBOOK_THEMES.map((theme) => (
                      <button key={theme.id} onClick={() => updateTheme({ theme: theme.id })}
                        className={'rounded-xl border p-3 text-left transition ' + (themeSettings.theme === theme.id ? 'border-primary bg-primary/5' : 'border-border bg-card hover:bg-accent/30')}>
                        <p className="font-medium text-sm">{theme.label}</p>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mb-2 text-sm font-medium">Accent color</div>
                  <div className="flex flex-wrap gap-2">
                    {NOTEBOOK_ACCENTS.map((accent) => (
                      <button key={accent} onClick={() => updateTheme({ accent })}
                        className={'h-7 w-7 rounded-full border-2 ' + (themeSettings.accent === accent ? 'scale-110 border-foreground' : 'border-white/60')}
                        style={{ backgroundColor: accent }} />
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mb-2 text-sm font-medium">Font size</div>
                  <div className="flex flex-wrap gap-2">
                    {[{id:'sm',label:'Small'},{id:'base',label:'Base'},{id:'lg',label:'Large'},{id:'xl',label:'XL'}].map(o => (
                      <Button key={o.id} variant={themeSettings.fontSize === o.id ? 'default' : 'outline'} onClick={() => updateTheme({ fontSize: o.id })} className="rounded-full text-xs">{o.label}</Button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mb-2 text-sm font-medium">Display</div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant={themeSettings.ruledLines ? 'default' : 'outline'} onClick={() => updateTheme({ ruledLines: !themeSettings.ruledLines })} className="rounded-full text-xs">Ruled lines</Button>
                    <Button variant={themeSettings.showMargin ? 'default' : 'outline'} onClick={() => updateTheme({ showMargin: !themeSettings.showMargin })} className="rounded-full text-xs">Margin line</Button>
                    <Button variant={themeSettings.coloredTabs ? 'default' : 'outline'} onClick={() => updateTheme({ coloredTabs: !themeSettings.coloredTabs })} className="rounded-full text-xs">Colored tabs</Button>
                  </div>
                </div>
              </div>
            )}
            {tab === 'backup' && <BackupTab />}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}