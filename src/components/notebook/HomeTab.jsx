import React from 'react';
import { Link } from 'react-router-dom';
import { PenSquare, Settings, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import SettingsModal from '@/components/notebook/SettingsModal';
import { formatPhase } from '@/lib/autonovel';

const SCRIBBLE_PATH = 'M10,35 C10,10 40,2 90,2 C140,2 170,10 170,35 C170,60 140,68 90,68 C40,68 10,60 10,35 C10,22 32,8 60,5';

function ScribbleAction({ label, active, onClick, icon: Icon }) {
  return (
    <button type="button" onClick={onClick} className={`notebook-scribble ${active ? 'is-active' : ''}`}>
      <svg viewBox="0 0 180 70" className="notebook-scribble-svg" aria-hidden="true">
        <path d={SCRIBBLE_PATH} className="notebook-scribble-path" />
      </svg>
      <span className="notebook-scribble-content">
        <Icon className="h-4 w-4" /> {label}
      </span>
    </button>
  );
}

export default function HomeTab({ projects, onCreate }) {
  const [selectedProjectId, setSelectedProjectId] = React.useState(projects[0]?.id || null);
  const [activeAction, setActiveAction] = React.useState('new');
  const [settingsOpen, setSettingsOpen] = React.useState(false);

  React.useEffect(() => {
    if (!projects.some((project) => project.id === selectedProjectId)) {
      setSelectedProjectId(projects[0]?.id || null);
    }
  }, [projects, selectedProjectId]);

  const selectedProject = projects.find((project) => project.id === selectedProjectId) || null;

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div className="space-y-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="notebook-kicker">Tab 1</p>
              <h2 className="font-display text-3xl text-[var(--notebook-ink)]">Home</h2>
              <p className="mt-3 max-w-lg text-sm leading-7 text-[var(--notebook-muted)]">Start a new project or reopen an existing manuscript from your notebook library.</p>
            </div>
            <Button type="button" variant="outline" onClick={() => setSettingsOpen(true)} className="rounded-full bg-white/60">
              <Settings className="mr-2 h-4 w-4" /> Settings
            </Button>
          </div>

          <div className="space-y-4">
            <ScribbleAction
              label="New project"
              active={activeAction === 'new'}
              onClick={() => {
                setActiveAction('new');
                onCreate();
              }}
              icon={Sparkles}
            />
            <ScribbleAction
              label="Open project"
              active={activeAction === 'open'}
              onClick={() => setActiveAction('open')}
              icon={PenSquare}
            />
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--notebook-muted)]">Project browser</p>
            <div className="space-y-2">
              {projects.length ? projects.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => {
                    setActiveAction('open');
                    setSelectedProjectId(project.id);
                  }}
                  className={`notebook-project-row ${selectedProjectId === project.id ? 'is-active' : ''}`}
                >
                  <div>
                    <p className="font-medium text-[var(--notebook-ink)]">{project.title || 'Untitled Project'}</p>
                    <p className="text-sm text-[var(--notebook-muted)]">{project.genre || project.book_type || 'Book project'}</p>
                  </div>
                  <Badge variant="outline">{formatPhase(project.phase)}</Badge>
                </button>
              )) : (
                <div className="rounded-2xl border border-dashed border-border bg-white/40 p-5 text-sm text-[var(--notebook-muted)]">No projects yet — start with a new one.</div>
              )}
            </div>
          </div>
      </div>

      <div>
          {selectedProject ? (
            <div className="space-y-6">
              <div>
                <p className="notebook-kicker">Project preview</p>
                <h3 className="font-display text-3xl text-[var(--notebook-ink)]">{selectedProject.title || 'Untitled Project'}</h3>
                <p className="mt-4 max-w-2xl text-base leading-8 text-[var(--notebook-muted)]">{selectedProject.tagline || selectedProject.seed_concept}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="notebook-stat-card">
                  <p className="notebook-stat-label">Genre</p>
                  <p className="notebook-stat-value">{selectedProject.genre || 'General'}</p>
                </div>
                <div className="notebook-stat-card">
                  <p className="notebook-stat-label">Phase</p>
                  <p className="notebook-stat-value">{formatPhase(selectedProject.phase)}</p>
                </div>
                <div className="notebook-stat-card">
                  <p className="notebook-stat-label">Novel score</p>
                  <p className="notebook-stat-value">{(selectedProject.novel_score || 0).toFixed(1)}</p>
                </div>
                <div className="notebook-stat-card">
                  <p className="notebook-stat-label">Word target</p>
                  <p className="notebook-stat-value">~{Number(selectedProject.total_word_target || 0).toLocaleString()}</p>
                </div>
              </div>

              <div className="rounded-[1.5rem] border border-border/70 bg-white/45 p-5">
                <p className="text-xs uppercase tracking-[0.28em] text-[var(--notebook-muted)]">Draft progress</p>
                <p className="mt-3 text-lg text-[var(--notebook-ink)]">{selectedProject.chapter_count || 0} of {selectedProject.chapter_target || 0} chapters drafted</p>
              </div>

              <Button asChild className="rounded-full px-6">
                <Link to={`/projects/${selectedProject.id}`}>Open Studio</Link>
              </Button>
            </div>
          ) : (
            <div className="notebook-placeholder">
              <p className="notebook-kicker">Project preview</p>
              <h3 className="notebook-placeholder-title">Pick a manuscript</h3>
              <p className="notebook-placeholder-copy">Select a project from the left page to preview its phase, score, and progress before opening the studio.</p>
            </div>
          )}
      </div>

      <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}