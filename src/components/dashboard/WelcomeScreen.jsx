/* ============================================================================
 * ⚠️  DEAD CODE — DO NOT EDIT EXPECTING UI CHANGES  (WAVE5-DEADSTAMP, Aug 2026)
 *
 * Nothing imports this file. Editing it has NO effect on the running app —
 * past AI sessions repeatedly wasted hours "fixing" components like this one.
 * Live implementation: pages/Dashboard renders its own empty state.
 * Kept (not deleted) at the owner's request; recoverable context only.
 * ========================================================================== */
import React from 'react';
import { FilePlus, FolderOpen, Library } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function WelcomeScreen({ onNewProject, onOpenProject, projectCount, isLoading }) {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-10">
      <div className="text-center">
        <h1 className="font-display text-5xl tracking-tight text-foreground sm:text-6xl">Unity Book Studio</h1>
        <p className="mt-3 text-base text-muted-foreground">AI-powered novel drafting engine</p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
        <button
          type="button"
          onClick={onNewProject}
          className="group flex w-56 flex-col items-center gap-4 rounded-2xl border border-border/70 bg-card/80 px-8 py-10 shadow-sm backdrop-blur-sm transition hover:border-border hover:bg-card hover:shadow-lg"
        >
          <FilePlus className="h-10 w-10 text-muted-foreground transition group-hover:text-foreground" />
          <span className="font-display text-lg text-foreground/80 transition group-hover:text-foreground">New Project</span>
        </button>

        <button
          type="button"
          onClick={onOpenProject}
          className="group flex w-56 flex-col items-center gap-4 rounded-2xl border border-border/70 bg-card/80 px-8 py-10 shadow-sm backdrop-blur-sm transition hover:border-border hover:bg-card hover:shadow-lg"
        >
          <FolderOpen className="h-10 w-10 text-muted-foreground transition group-hover:text-foreground" />
          <div className="flex flex-col items-center gap-1">
            <span className="font-display text-lg text-foreground/80 transition group-hover:text-foreground">Open Project</span>
            {isLoading ? (
              <span className="text-xs text-muted-foreground">Loading…</span>
            ) : projectCount > 0 ? (
              <span className="text-xs text-muted-foreground">{projectCount} {projectCount === 1 ? 'project' : 'projects'}</span>
            ) : null}
          </div>
        </button>

        <button
          type="button"
          onClick={() => navigate('/series')}
          className="group flex w-56 flex-col items-center gap-4 rounded-2xl border border-border/70 bg-card/80 px-8 py-10 shadow-sm backdrop-blur-sm transition hover:border-border hover:bg-card hover:shadow-lg"
        >
          <Library className="h-10 w-10 text-muted-foreground transition group-hover:text-foreground" />
          <div className="flex flex-col items-center gap-1">
            <span className="font-display text-lg text-foreground/80 transition group-hover:text-foreground">Series</span>
            <span className="text-xs text-muted-foreground">Create sequels &amp; volumes</span>
          </div>
        </button>
      </div>
    </div>
  );
}