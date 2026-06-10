import React from 'react';
import ReactQuill from 'react-quill';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ManuscriptEditor({ chapters, selectedChapterId, onSelectChapter, editorValue, onEditorChange, onSaveChapter, theme, isSaving }) {
  const ordered = [...chapters].sort((a, b) => a.chapter_number - b.chapter_number);

  return (
    <div className="min-w-0 flex-1 flex flex-col rounded-2xl border border-border/70 bg-card/80 p-3 backdrop-blur-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">Editor</p>
        <Button onClick={onSaveChapter} disabled={isSaving || !selectedChapterId} size="sm" className="rounded-full text-xs">
          <Save className="mr-1.5 h-3.5 w-3.5" /> {isSaving ? 'Saving…' : 'Save'}
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 gap-3">
        <div className="w-36 shrink-0 space-y-1.5 overflow-y-auto rounded-xl border border-border/70 bg-background/70 p-2">
          {ordered.map((chapter) => (
            <button
              key={chapter.id}
              type="button"
              onClick={() => onSelectChapter(chapter.id)}
              className={`w-full rounded-lg border px-2 py-2 text-left text-xs transition ${selectedChapterId === chapter.id ? 'border-primary bg-primary/5' : 'border-transparent bg-transparent hover:bg-accent/30'}`}
            >
              <p className="font-medium text-foreground">Ch {chapter.chapter_number}</p>
              <p className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground">{chapter.title}</p>
            </button>
          ))}
        </div>

        <div className="min-w-0 flex-1 rounded-xl border border-border/70 bg-white">
          <div
            style={{
              fontFamily: theme.bodyFont,
              fontSize: `${theme.bodySize}pt`,
              lineHeight: theme.lineHeight,
            }}
          >
            <ReactQuill value={editorValue} onChange={onEditorChange} theme="snow" className="min-h-[50vh] [&_.ql-editor]:min-h-[42vh]" />
          </div>
        </div>
      </div>
    </div>
  );
}