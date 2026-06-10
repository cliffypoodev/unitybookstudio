import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import RewriteFromManuscript from './RewriteFromManuscript';

const PROJECT_TYPES = [
  {
    type: 'ideas',
    emoji: '💡',
    label: 'I Need an Idea',
    description: 'Not sure what to write yet? Browse the prompt catalog, chat with the AI brainstorming assistant, or mash up concepts to find your next book.',
  },
  {
    type: 'fiction',
    emoji: '📖',
    label: 'Fiction',
    description: 'Novels, novellas, short stories. Sci-fi, fantasy, thriller, literary, horror, romance, and more. Full story bible, character arcs, and scene-by-scene generation.',
  },
  {
    type: 'nonfiction',
    emoji: '📚',
    label: 'Nonfiction',
    description: 'Investigative journalism, history, biography, memoir, true crime, self-help, business. Deep research pipeline, source tracking, and bibliography generation.',
  },
  {
    type: 'erotica',
    emoji: '🔥',
    label: 'Erotica',
    description: 'Adult fiction with explicit content. All fiction genres with spice level, language intensity, and prose register controls. Routes to Lumimaid for prose generation.',
  },

];

export default function NewProjectModal({ open, onClose, onCreate, onRewriteCreated }) {
  const [seriesBibles, setSeriesBibles] = useState([]);
  const [isContinuing, setIsContinuing] = useState(false);
  const [selectedBibleId, setSelectedBibleId] = useState('');
  const [showRewrite, setShowRewrite] = useState(false);

  useEffect(() => {
    if (open) {
      base44.entities.SeriesBible.list('-created_date', 50).then(setSeriesBibles).catch(() => {});
      setIsContinuing(false);
      setSelectedBibleId('');
      setShowRewrite(false);
    }
  }, [open]);

  if (!open) return null;

  const handleCreate = (type) => {
    if (type === 'ideas') {
      onCreate(type);
      return;
    }
    if (isContinuing && selectedBibleId) {
      const bible = seriesBibles.find(sb => sb.id === selectedBibleId);
      onCreate(type, {
        series_bible_id: selectedBibleId,
        series_name: bible?.series_name || '',
        series_number: Number(bible?.books_analyzed || 0) + 1,
      });
    } else {
      onCreate(type);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[520px] max-h-[90vh] overflow-y-auto rounded-2xl border border-border/70 bg-card p-5 sm:p-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-center font-display text-2xl text-foreground">
          Start a New Project
        </h2>
        <p className="mt-1 mb-6 text-center text-sm text-muted-foreground">
          Choose your project type to configure the writing pipeline
        </p>

        <div className="flex flex-col gap-3">
          {PROJECT_TYPES.map((pt) => (
            <button
              key={pt.type}
              onClick={() => handleCreate(pt.type)}
              className="flex items-center gap-3 sm:gap-4 rounded-xl border border-border/70 bg-background px-3 sm:px-5 py-3 sm:py-4 text-left transition-colors hover:border-primary/60 hover:bg-accent/30"
            >
              <span className="text-2xl sm:text-3xl">{pt.emoji}</span>
              <div>
                <div className="text-base font-bold text-foreground">{pt.label}</div>
                <div className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  {pt.description}
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Divider + Rewrite from Manuscript */}
        <div className="flex items-center gap-3 my-3">
          <div className="flex-1 h-px bg-border/50" />
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">or</span>
          <div className="flex-1 h-px bg-border/50" />
        </div>

        {!showRewrite ? (
          <button
            onClick={() => setShowRewrite(true)}
            className="flex items-center gap-3 sm:gap-4 w-full rounded-xl border-2 border-dashed border-border/70 bg-background px-3 sm:px-5 py-3 sm:py-4 text-left transition-colors hover:border-primary/60 hover:bg-accent/30"
          >
            <span className="text-3xl">🔄</span>
            <div>
              <div className="text-base font-bold text-foreground">Rewrite from Manuscript</div>
              <div className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                Upload an existing manuscript to analyze. The AI extracts characters, world, plot, and voice to build a complete story bible — then rewrite the book using our pipeline.
              </div>
            </div>
          </button>
        ) : (
          <RewriteFromManuscript
            onCreated={(project) => { onRewriteCreated(project); }}
            onCancel={() => setShowRewrite(false)}
          />
        )}

        {seriesBibles.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border/50">
            <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
              <input type="checkbox" checked={isContinuing} onChange={e => setIsContinuing(e.target.checked)} className="rounded" />
              This is part of a series (continuing from a previous book)
            </label>
            {isContinuing && (
              <select
                value={selectedBibleId}
                onChange={e => setSelectedBibleId(e.target.value)}
                className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="">— Select series bible —</option>
                {seriesBibles.map(sb => (
                  <option key={sb.id} value={sb.id}>
                    {sb.series_name} (Book {sb.books_analyzed + 1})
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        <button
          onClick={onClose}
          className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}