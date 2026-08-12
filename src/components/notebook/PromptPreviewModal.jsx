/* ============================================================================
 * ⚠️  DEAD CODE — DO NOT EDIT EXPECTING UI CHANGES  (WAVE5-DEADSTAMP, Aug 2026)
 *
 * Nothing imports this file. Editing it has NO effect on the running app —
 * past AI sessions repeatedly wasted hours "fixing" components like this one.
 * Live implementation: the live Ideas UI is IdeasCatalogBrowser.
 * Kept (not deleted) at the owner's request; recoverable context only.
 * ========================================================================== */
import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BookOpen, X, Pencil } from 'lucide-react';

export default function PromptPreviewModal({ prompt, onUse, onClose }) {
  const [editing, setEditing] = useState(false);
  const [editedContent, setEditedContent] = useState('');

  useEffect(() => {
    if (prompt) {
      setEditedContent(prompt.content || '');
      setEditing(false);
    }
  }, [prompt]);

  if (!prompt) return null;

  const handleUse = () => {
    onUse({ ...prompt, content: editing ? editedContent : prompt.content });
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-[92%] max-w-[560px] max-h-[80vh] flex flex-col rounded-2xl border border-border/70 bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 p-6 pb-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              {prompt.book_type && (
                <Badge variant="outline" className="text-[10px] capitalize">{prompt.book_type}</Badge>
              )}
              {prompt.genre && (
                <Badge variant="secondary" className="text-[10px]">{prompt.genre}</Badge>
              )}
              {prompt.category && (
                <Badge variant="secondary" className="text-[10px]">{prompt.category}</Badge>
              )}
            </div>
            <h2 className="font-display text-xl text-foreground leading-tight">
              {prompt.title || 'Untitled Idea'}
            </h2>
            {prompt.description && (
              <p className="mt-1 text-sm text-muted-foreground">{prompt.description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-full p-1.5 text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 pb-3">
          {editing ? (
            <textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              className="w-full min-h-[180px] rounded-xl border border-border bg-background p-4 text-sm leading-7 text-foreground resize-y focus:outline-none focus:ring-1 focus:ring-primary/40"
              placeholder="Edit the idea, add details, tweak the concept…"
            />
          ) : (
            prompt.content && (
              <div className="rounded-xl border border-border/50 bg-background/70 p-4">
                <p className="text-sm leading-7 text-foreground whitespace-pre-wrap">{prompt.content}</p>
              </div>
            )
          )}

          {/* Tags */}
          {prompt.tags?.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {prompt.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-accent/40 px-2 py-0.5 text-[10px] text-accent-foreground">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {prompt.word_count > 0 && (
            <p className="mt-2 text-[10px] text-muted-foreground">
              Suggested length: ~{prompt.word_count.toLocaleString()} words
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between border-t border-border/50 p-4">
          <Button
            variant={editing ? 'secondary' : 'ghost'}
            onClick={() => setEditing(!editing)}
            className="rounded-full gap-2 text-sm"
          >
            <Pencil className="h-3.5 w-3.5" />
            {editing ? 'Done Editing' : 'Modify'}
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose} className="rounded-full">
              Cancel
            </Button>
            <Button onClick={handleUse} className="rounded-full gap-2">
              <BookOpen className="h-4 w-4" /> Use This Idea
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}