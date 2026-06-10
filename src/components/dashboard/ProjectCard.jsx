import React from 'react';
import { useNavigate } from 'react-router-dom';
import { MoreHorizontal } from 'lucide-react';
import moment from 'moment';

export default function ProjectCard({ project }) {
  const navigate = useNavigate();
  const chapterCount = project.chapter_count || 0;
  const updated = project.updated_date ? moment(project.updated_date).fromNow() : '';

  return (
    <button
      type="button"
      onClick={() => navigate(`/projects/${project.id}`)}
      className="group relative flex w-full flex-col rounded-xl border border-border/70 bg-card/80 text-left shadow-sm backdrop-blur-sm transition hover:border-border hover:shadow-lg"
    >
      {/* Stacked pages behind the card */}
      <div className="absolute -top-2 left-2 right-2 h-6 rounded-t-lg bg-muted/50 opacity-50" />
      <div className="absolute -top-1 left-1 right-1 h-4 rounded-t-lg bg-muted/70 opacity-70" />

      {/* Cover area */}
      <div className="relative z-10 flex h-28 items-center justify-center rounded-t-xl bg-secondary/60 px-4">
        {project.cover_image_url ? (
          <img src={project.cover_image_url} alt="" className="h-full w-full rounded-t-xl object-cover" />
        ) : (
          <p className="text-center font-display text-lg leading-tight text-foreground">
            {project.title || 'Untitled'}
          </p>
        )}
      </div>

      {/* Info area */}
      <div className="relative z-10 flex flex-1 flex-col gap-1 rounded-b-xl px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <p className="font-display text-sm font-semibold leading-tight text-foreground">
            {project.author_name || 'Unknown Author'}
          </p>
          <span className="shrink-0 rounded-full p-0.5 opacity-0 transition group-hover:opacity-100 hover:bg-muted">
            <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
          </span>
        </div>
        <div className="mt-auto flex items-center gap-3 text-[11px] text-muted-foreground">
          <span>{chapterCount} {chapterCount === 1 ? 'chapter' : 'chapters'}</span>
          {updated && <span>{updated}</span>}
        </div>
      </div>
    </button>
  );
}