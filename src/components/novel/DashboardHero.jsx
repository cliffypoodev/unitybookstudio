/* ============================================================================
 * ⚠️  DEAD CODE — DO NOT EDIT EXPECTING UI CHANGES  (WAVE5-DEADSTAMP, Aug 2026)
 *
 * Nothing imports this file. Editing it has NO effect on the running app —
 * past AI sessions repeatedly wasted hours "fixing" components like this one.
 * Live implementation: the live dashboard is pages/Dashboard.
 * Kept (not deleted) at the owner's request; recoverable context only.
 * ========================================================================== */
import React from 'react';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function DashboardHero({ onCreate }) {
  return (
    <section className="rounded-[2rem] border border-border/70 bg-card/80 p-8 shadow-[0_24px_80px_rgba(0,0,0,0.08)] backdrop-blur-sm">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.35em] text-muted-foreground">Autonovel Studio</p>
          <h1 className="font-display text-5xl leading-none text-foreground sm:text-6xl">Build novels like a pipeline, not a blank page.</h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-muted-foreground sm:text-lg">
            Start from a seed concept, generate the foundation docs, draft chapters, evaluate the manuscript, create cover art, and export a readable manuscript from one workspace.
          </p>
        </div>
        <Button onClick={onCreate} className="min-h-12 rounded-full px-6 text-sm">
          <Sparkles className="mr-2 h-4 w-4" /> New Project
        </Button>
      </div>
    </section>
  );
}