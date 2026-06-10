import React, { useState } from 'react';
import { ChevronDown, ChevronUp, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function PromptCard({ prompt, onSelect, onTagClick }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-[1.25rem] border border-border/70 bg-white/50 p-4 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-lg leading-tight text-foreground">{prompt.title}</h3>
          {prompt.description && (
            <p className="mt-1 text-sm leading-6 text-muted-foreground line-clamp-2">{prompt.description}</p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {prompt.genre && (
              <Badge variant="outline" className="text-[10px]">{prompt.genre}</Badge>
            )}
            {prompt.category && (
              <Badge variant="secondary" className="text-[10px]">{prompt.category}</Badge>
            )}
            {(prompt.tags || []).slice(0, 4).map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => onTagClick?.(tag)}
                className="rounded-full bg-accent/40 px-2 py-0.5 text-[10px] text-accent-foreground hover:bg-accent/70 transition-colors"
              >
                {tag}
              </button>
            ))}
            {(prompt.tags || []).length > 4 && (
              <span className="text-[10px] text-muted-foreground">+{prompt.tags.length - 4}</span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-1.5">
          <Button size="sm" onClick={() => onSelect(prompt)} className="rounded-full gap-1.5">
            Use <ArrowRight className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setExpanded(!expanded)}
            className="rounded-full gap-1"
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {expanded ? 'Less' : 'Preview'}
          </Button>
        </div>
      </div>

      {expanded && prompt.content && (
        <div className="mt-3 rounded-xl border border-border/50 bg-background/70 p-4">
          <p className="whitespace-pre-wrap text-sm leading-7 text-foreground/80">{prompt.content}</p>
          {prompt.word_count > 0 && (
            <p className="mt-2 text-[10px] text-muted-foreground">Target: ~{prompt.word_count?.toLocaleString()} words</p>
          )}
          <Button size="sm" onClick={() => onSelect(prompt)} className="mt-3 rounded-full gap-1.5">
            Use this prompt <ArrowRight className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
}