import React, { useState, useCallback, useRef } from 'react';
import { FileText, Sparkles, Loader2, Wrench, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { parseDocxFile } from '@/lib/docxParser';
import FixPassagesEditor from '@/components/tools/FixPassagesEditor';
import UploadPolishView from '@/components/tools/UploadPolishView';
import SourceSelector from '@/components/tools/SourceSelector';
import UploadZone from '@/components/tools/UploadZone';
import ProjectPolishView from '@/components/tools/ProjectPolishView';
import SeriesBibleView from '@/components/tools/SeriesBibleView';

export default function PolishSubPage({ project, chapters, busyLabel, setBusyLabel }) {
  const [source, setSource] = useState(project?.id ? 'project' : 'upload');
  const [parsed, setParsed] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [mode, setMode] = useState(null);
  const [editingChapterIdx, setEditingChapterIdx] = useState(null);

  const handleFileSelect = useCallback(async (file) => {
    if (!file) return;
    if (!file.name.endsWith('.docx') && !file.name.endsWith('.doc') && !file.name.endsWith('.txt')) {
      toast.error('Please upload a .docx, .doc, or .txt file');
      return;
    }
    setUploading(true);
    setParsed(null);
    setMode(null);
    try {
      const result = await parseDocxFile(file);
      setParsed(result);
    } catch (err) {
      toast.error('Failed to parse file: ' + (err.message || 'Unknown error'));
    } finally {
      setUploading(false);
    }
  }, []);

  // Fix Passages editor
  if (editingChapterIdx !== null && parsed?.chapters?.[editingChapterIdx]) {
    return (
      <FixPassagesEditor
        chapter={parsed.chapters[editingChapterIdx]}
        chapterIndex={editingChapterIdx}
        onSave={(newContent) => {
          setParsed(prev => {
            const updated = [...prev.chapters];
            updated[editingChapterIdx] = { ...updated[editingChapterIdx], content: newContent };
            return { ...prev, chapters: updated };
          });
          setEditingChapterIdx(null);
        }}
        onBack={() => setEditingChapterIdx(null)}
        busyLabel={busyLabel}
        setBusyLabel={setBusyLabel}
      />
    );
  }

  return (
    <div className="space-y-4 overflow-y-auto h-full pr-1">
      <div>
        <p className="notebook-kicker">Manuscript Tools</p>
        <h2 className="font-display text-2xl text-foreground">Polish & Fix</h2>
        <p className="text-xs text-muted-foreground mt-1">Run the full polish pipeline, get a clean score, editorial critique, and export.</p>
      </div>

      <SourceSelector source={source} setSource={(s) => { setSource(s); setMode(null); }} project={project} />

      {/* PROJECT MODE */}
      {source === 'project' && project?.id && (
        <ProjectPolishView
          project={project}
          chapters={chapters}
          busyLabel={busyLabel}
          setBusyLabel={setBusyLabel}
        />
      )}

      {/* UPLOAD MODE */}
      {source === 'upload' && (
        <>
          {!parsed && <UploadZone onFileSelect={handleFileSelect} uploading={uploading} />}

          {parsed && !mode && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  <h3 className="font-display text-lg">Manuscript Loaded</h3>
                </div>
                <Button variant="ghost" size="sm" onClick={() => { setParsed(null); setMode(null); }} className="rounded-full text-xs">
                  Upload Different File
                </Button>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-border/50 bg-card/80 p-3 text-center">
                  <p className="text-2xl font-bold text-foreground">{parsed.totalWords.toLocaleString()}</p>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Words</p>
                </div>
                <div className="rounded-xl border border-border/50 bg-card/80 p-3 text-center">
                  <p className="text-2xl font-bold text-foreground">{parsed.chapterCount}</p>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Chapters</p>
                </div>
                <div className="rounded-xl border border-border/50 bg-card/80 p-3 text-center">
                  <p className="text-2xl font-bold text-foreground">~{parsed.estimatedPages}</p>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Pages</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button onClick={() => setMode('polish')} className="flex flex-col items-center gap-3 rounded-2xl border border-border/70 bg-card/80 p-6 hover:border-primary/50 hover:bg-accent/20 transition-colors text-center">
                  <Sparkles className="h-8 w-8 text-chart-1" />
                  <h4 className="font-display text-lg text-foreground">Polish & Fix</h4>
                  <p className="text-xs text-muted-foreground">Run the full Polish pipeline, get a Clean Score, editorial critique, and export.</p>
                </button>
                <button onClick={() => setMode('rewrite')} className="flex flex-col items-center gap-3 rounded-2xl border border-border/70 bg-card/80 p-6 hover:border-primary/50 hover:bg-accent/20 transition-colors text-center">
                  <Wrench className="h-8 w-8 text-chart-2" />
                  <h4 className="font-display text-lg text-foreground">Rewrite Chapters</h4>
                  <p className="text-xs text-muted-foreground">Fix individual passages or rewrite full chapters with AI assistance.</p>
                </button>
                <button onClick={() => setMode('series')} className="flex flex-col items-center gap-3 rounded-2xl border border-border/70 bg-card/80 p-6 hover:border-primary/50 hover:bg-accent/20 transition-colors text-center md:col-span-2">
                  <BookOpen className="h-8 w-8 text-chart-4" />
                  <h4 className="font-display text-lg text-foreground">Create / Continue Series</h4>
                  <p className="text-xs text-muted-foreground">Analyze this manuscript and extract a Series Bible — characters, world, plot threads, and voice. Use it as the foundation for the next book with full continuity.</p>
                </button>
              </div>
            </div>
          )}

          {parsed && mode === 'polish' && (
            <UploadPolishView parsed={parsed} setParsed={setParsed} busyLabel={busyLabel} setBusyLabel={setBusyLabel} onBack={() => setMode(null)} />
          )}

          {parsed && mode === 'series' && (
            <SeriesBibleView parsed={parsed} project={project} busyLabel={busyLabel} setBusyLabel={setBusyLabel} onBack={() => setMode(null)} />
          )}

          {parsed && mode === 'rewrite' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg">Rewrite Chapters</h3>
                <Button variant="ghost" size="sm" onClick={() => setMode(null)} className="rounded-full text-xs">← Back</Button>
              </div>
              <p className="text-xs text-muted-foreground">Select a chapter to rewrite entirely or fix specific passages.</p>
              <div className="space-y-2">
                {parsed.chapters.map((ch, idx) => {
                  const words = (ch.content || '').split(/\s+/).filter(Boolean).length;
                  return (
                    <div key={idx} className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-card/80 p-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">{ch.title || `Chapter ${idx + 1}`}</p>
                        <p className="text-[10px] text-muted-foreground">{words.toLocaleString()} words</p>
                      </div>
                      <Button variant="outline" size="sm" className="rounded-full text-[10px] h-7 px-2.5" onClick={() => setEditingChapterIdx(idx)}>
                        Fix Passages
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {busyLabel && (
        <div className="flex items-center gap-2 rounded-xl bg-primary/10 border border-primary/20 px-4 py-2.5">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="text-sm text-primary font-medium">{busyLabel}</span>
        </div>
      )}
    </div>
  );
}