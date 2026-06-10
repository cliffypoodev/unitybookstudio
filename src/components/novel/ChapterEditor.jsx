import React from 'react';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import MarkdownPanel from '@/components/novel/MarkdownPanel';

export default function ChapterEditor({ chapter, chapterDraft, onDraftChange, onSave, isSaving }) {
  if (!chapter) {
    return <div className="rounded-[2rem] border border-dashed border-border bg-card/70 p-8 text-sm text-muted-foreground">Select a chapter to view its plan and draft.</div>;
  }

  return (
    <div className="rounded-[2rem] border border-border/70 bg-card/80 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.06)] backdrop-blur-sm sm:p-8">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Chapter {chapter.chapter_number}</p>
          <h2 className="mt-2 font-display text-3xl text-foreground">{chapter.title}</h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">{chapter.beat_summary}</p>
        </div>
        <Button onClick={onSave} disabled={isSaving} className="min-h-11 rounded-full px-5">
          <Save className="mr-2 h-4 w-4" /> {isSaving ? 'Saving…' : 'Save Draft'}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="chapter-draft">Draft</Label>
          <Textarea id="chapter-draft" value={chapterDraft} onChange={(event) => onDraftChange(event.target.value)} className="min-h-[34rem] rounded-[1.5rem] bg-background/80 p-5" />
        </div>
        <div className="space-y-2">
          <Label>Preview</Label>
          <MarkdownPanel content={chapterDraft} emptyLabel="No draft yet. Generate this chapter from the pipeline sidebar." />
        </div>
      </div>
    </div>
  );
}