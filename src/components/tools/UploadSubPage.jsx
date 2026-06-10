import React, { useState, useCallback, useRef } from 'react';
import { Upload, FileText, Sparkles, Loader2, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { parseDocxFile } from '@/lib/docxParser';
import FixPassagesEditor from '@/components/tools/FixPassagesEditor';
import UploadPolishView from '@/components/tools/UploadPolishView';

export default function UploadSubPage({ project, chapters, busyLabel, setBusyLabel, onCreateProjectFromUpload }) {
  const [parsed, setParsed] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [mode, setMode] = useState(null); // 'polish' | 'rewrite'
  const [editingChapterIdx, setEditingChapterIdx] = useState(null);
  const fileInputRef = useRef(null);

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

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  // Polish and critique are now handled by UploadPolishView

  // Removed — handled by UploadPolishView

  // Removed — handled by UploadPolishView

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
    <div className="space-y-6 overflow-y-auto h-full pr-1">
      {/* Upload zone */}
      {!parsed && (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border/70 bg-background/50 p-12 cursor-pointer hover:border-primary/50 hover:bg-accent/20 transition-colors"
        >
          {uploading ? (
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          ) : (
            <Upload className="h-8 w-8 text-muted-foreground" />
          )}
          <p className="text-sm font-medium text-foreground">
            {uploading ? 'Parsing document…' : 'Drop a .docx file here or click to browse'}
          </p>
          <p className="text-xs text-muted-foreground">Supports .docx, .doc, and .txt files</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".docx,.doc,.txt"
            className="hidden"
            onChange={(e) => handleFileSelect(e.target.files?.[0])}
          />
        </div>
      )}

      {/* Parsed file info */}
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

          {/* Two paths */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => setMode('polish')}
              className="flex flex-col items-center gap-3 rounded-2xl border border-border/70 bg-card/80 p-6 hover:border-primary/50 hover:bg-accent/20 transition-colors text-center"
            >
              <Sparkles className="h-8 w-8 text-chart-1" />
              <h4 className="font-display text-lg text-foreground">Polish & Fix</h4>
              <p className="text-xs text-muted-foreground">Run the full Polish pipeline, get a Clean Score, editorial critique, and export.</p>
            </button>
            <button
              onClick={() => setMode('rewrite')}
              className="flex flex-col items-center gap-3 rounded-2xl border border-border/70 bg-card/80 p-6 hover:border-primary/50 hover:bg-accent/20 transition-colors text-center"
            >
              <Wrench className="h-8 w-8 text-chart-2" />
              <h4 className="font-display text-lg text-foreground">Rewrite Chapters</h4>
              <p className="text-xs text-muted-foreground">Fix individual passages or rewrite full chapters with AI assistance.</p>
            </button>
          </div>
        </div>
      )}

      {/* POLISH MODE */}
      {parsed && mode === 'polish' && (
        <UploadPolishView
          parsed={parsed}
          setParsed={setParsed}
          busyLabel={busyLabel}
          setBusyLabel={setBusyLabel}
          onBack={() => setMode(null)}
        />
      )}

      {/* REWRITE MODE */}
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
                  <div className="flex gap-1.5 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-full text-[10px] h-7 px-2.5"
                      onClick={() => setEditingChapterIdx(idx)}
                    >
                      Fix Passages
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Busy indicator */}
      {busyLabel && (
        <div className="flex items-center gap-2 rounded-xl bg-primary/10 border border-primary/20 px-4 py-2.5">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="text-sm text-primary font-medium">{busyLabel}</span>
        </div>
      )}
    </div>
  );
}