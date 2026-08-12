/* ============================================================================
 * ⚠️  DEAD CODE — DO NOT EDIT EXPECTING UI CHANGES  (WAVE5-DEADSTAMP, Aug 2026)
 *
 * Nothing imports this file. Editing it has NO effect on the running app —
 * past AI sessions repeatedly wasted hours "fixing" components like this one.
 * Live implementation: the live Ideas UI is IdeasCatalogBrowser.
 * Kept (not deleted) at the owner's request; recoverable context only.
 * ========================================================================== */
import React, { useState, useEffect } from 'react';
import { ArrowRight, BookOpen, Tag, Layers, FileText, MessageCircle, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import IdeasChat from '@/components/notebook/IdeasChat';

export default function IdeasPreview({ prompt, onUse }) {
  const [mode, setMode] = useState('preview');

  // Switch to preview when a new prompt is selected
  useEffect(() => {
    if (prompt) setMode('preview');
  }, [prompt?.id]);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Mode toggle */}
      <div className="shrink-0 flex items-center justify-between mb-4">
        <p className="notebook-kicker">{mode === 'chat' ? 'Brainstorm' : 'Preview'}</p>
        <div className="flex rounded-full border border-border/70 bg-white/50 p-0.5">
          <button
            type="button"
            onClick={() => setMode('preview')}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              mode === 'preview' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Eye className="h-3 w-3" /> Preview
          </button>
          <button
            type="button"
            onClick={() => setMode('chat')}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              mode === 'chat' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <MessageCircle className="h-3 w-3" /> Chat
          </button>
        </div>
      </div>

      {/* Chat mode */}
      {mode === 'chat' && (
        <div className="flex-1 min-h-0">
          <IdeasChat activePrompt={prompt} />
        </div>
      )}

      {/* Preview mode */}
      {mode === 'preview' && (
        <div className="flex-1 min-h-0 overflow-y-auto">
          {!prompt ? (
            <div className="flex flex-col items-center justify-center text-center px-8 pt-12">
              <div className="rounded-full bg-accent/30 p-4 mb-4">
                <BookOpen className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <h3 className="font-display text-2xl text-[var(--notebook-ink)]">Select an idea</h3>
              <p className="mt-2 max-w-sm text-sm leading-7 text-[var(--notebook-muted)]">
                Browse prompts on the left page and click one to preview here, or switch to Chat to brainstorm freely.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              <h2 className="font-display text-3xl leading-tight text-[var(--notebook-ink)]">{prompt.title}</h2>

              <div className="flex flex-wrap gap-2">
                {prompt.book_type && (
                  <Badge variant="outline" className="gap-1 capitalize"><FileText className="h-3 w-3" /> {prompt.book_type}</Badge>
                )}
                {prompt.genre && (
                  <Badge variant="outline" className="gap-1"><Layers className="h-3 w-3" /> {prompt.genre}</Badge>
                )}
                {prompt.category && <Badge variant="secondary">{prompt.category}</Badge>}
                {prompt.subcategory && <Badge variant="secondary" className="text-[10px]">{prompt.subcategory}</Badge>}
                {prompt.word_count > 0 && <Badge variant="outline" className="text-[10px]">~{prompt.word_count?.toLocaleString()} words</Badge>}
              </div>

              {prompt.description && (
                <div className="rounded-[1.25rem] border border-border/50 bg-white/40 p-4">
                  <p className="text-sm leading-7 text-foreground/80 italic">{prompt.description}</p>
                </div>
              )}

              {prompt.content && (
                <div className="rounded-[1.25rem] border border-border/70 bg-background/70 p-5">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Full Prompt</p>
                  <p className="whitespace-pre-wrap text-sm leading-7 text-foreground">{prompt.content}</p>
                </div>
              )}

              {(prompt.tags || []).length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                  {prompt.tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-accent/40 px-2.5 py-0.5 text-[11px] text-accent-foreground">{tag}</span>
                  ))}
                </div>
              )}

              <Button onClick={() => onUse(prompt)} className="w-full rounded-full min-h-11 gap-2 text-sm">
                Use this prompt <ArrowRight className="h-4 w-4" />
              </Button>

              <p className="text-center text-[10px] text-muted-foreground">
                This will populate the premise field on the Setup page.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}