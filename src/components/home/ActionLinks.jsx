import React from 'react';
import { ArrowUpRight, BookOpen, FileText, Github, Headphones, Sparkles } from 'lucide-react';

const disabledButtonClass = 'flex min-h-12 items-center justify-between rounded-full border border-border bg-background/80 px-5 py-3 text-sm text-muted-foreground opacity-70';
const linkButtonClass = 'flex min-h-12 items-center justify-between rounded-full border border-border bg-background/80 px-5 py-3 text-sm text-foreground transition-colors duration-200 hover:bg-secondary';
const primaryLinkClass = 'flex min-h-12 items-center justify-between rounded-full bg-primary px-5 py-3 text-sm text-primary-foreground transition-colors duration-200 hover:bg-primary/90';

export default function ActionLinks() {
  return (
    <section className="grid gap-4 border-t border-border/80 pt-8 md:grid-cols-2">
      <div className="rounded-[2rem] border border-border/70 bg-card/70 p-6 backdrop-blur-sm">
        <p className="mb-4 text-xs uppercase tracking-[0.3em] text-muted-foreground">Book Formats</p>
        <div className="grid gap-3">
          <button type="button" disabled className={disabledButtonClass}>
            <span className="flex items-center gap-3"><FileText className="h-4 w-4" /> Download PDF</span>
            <span>Unavailable</span>
          </button>
          <button type="button" disabled className={disabledButtonClass}>
            <span className="flex items-center gap-3"><BookOpen className="h-4 w-4" /> ePub</span>
            <span>Unavailable</span>
          </button>
          <button type="button" disabled className={disabledButtonClass}>
            <span className="flex items-center gap-3"><Headphones className="h-4 w-4" /> Audiobook</span>
            <span>Unavailable</span>
          </button>
        </div>
      </div>

      <div className="rounded-[2rem] border border-border/70 bg-card/70 p-6 backdrop-blur-sm">
        <p className="mb-4 text-xs uppercase tracking-[0.3em] text-muted-foreground">Explore More</p>
        <div className="grid gap-3">
          <button type="button" disabled className={disabledButtonClass}>
            <span className="flex items-center gap-3"><Sparkles className="h-4 w-4" /> Hermes Agent</span>
            <span>Unavailable</span>
          </button>
          <a
            href="https://github.com/NousResearch/autonovel"
            target="_blank"
            rel="noreferrer"
            className={primaryLinkClass}
          >
            <span className="flex items-center gap-3"><Github className="h-4 w-4" /> autonovel on GitHub</span>
            <ArrowUpRight className="h-4 w-4" />
          </a>
          <a
            href="https://github.com/NousResearch/autonovel/blob/master/README.md"
            target="_blank"
            rel="noreferrer"
            className={linkButtonClass}
          >
            <span className="flex items-center gap-3"><FileText className="h-4 w-4" /> Read the Pipeline</span>
            <ArrowUpRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    </section>
  );
}