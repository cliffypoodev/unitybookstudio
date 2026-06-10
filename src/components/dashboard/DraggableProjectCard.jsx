import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GripVertical, MoreHorizontal, FolderInput, Trash2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import moment from 'moment';

export default function DraggableProjectCard({ project, folders, onMoveToFolder, onRemoveFromFolder, onDelete, dragHandleProps, isDragging, showSeriesOrder, onSeriesOrderChange }) {
  const navigate = useNavigate();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const chapterCount = project.chapter_count || 0;
  const updated = project.updated_date ? moment(project.updated_date).fromNow() : '';

  const authorFolders = folders.filter((f) => f.folder_type === 'author');
  const seriesFolders = folders.filter((f) => f.folder_type === 'series');
  const customFolders = folders.filter((f) => f.folder_type === 'custom');

  return (
    <div
      className={`group relative flex w-full flex-col rounded-xl border border-border/70 bg-card/80 shadow-sm backdrop-blur-sm transition hover:border-border hover:shadow-lg ${
        isDragging ? 'opacity-50 shadow-xl scale-[1.02]' : ''
      }`}
    >
      {/* Stacked pages behind the card */}
      <div className="absolute -top-2 left-2 right-2 h-6 rounded-t-lg bg-muted/50 opacity-50" />
      <div className="absolute -top-1 left-1 right-1 h-4 rounded-t-lg bg-muted/70 opacity-70" />

      {/* Drag handle */}
      <div
        {...dragHandleProps}
        className="absolute left-1 top-1/2 z-20 -translate-y-1/2 cursor-grab rounded p-1 opacity-0 transition hover:bg-muted/80 group-hover:opacity-60 active:cursor-grabbing"
      >
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
      </div>

      {/* Cover area */}
      <button
        type="button"
        onClick={() => navigate(`/projects/${project.id}`)}
        className="relative z-10 flex h-28 items-center justify-center rounded-t-xl bg-secondary/60 px-4 text-left"
      >
        {project.cover_image_url ? (
          <img src={project.cover_image_url} alt="" className="h-full w-full rounded-t-xl object-cover" />
        ) : (
          <p className="text-center font-display text-lg leading-tight text-foreground">
            {project.title || 'Untitled'}
          </p>
        )}
      </button>

      {/* Info area */}
      <div className="relative z-10 flex flex-1 flex-col gap-1 rounded-b-xl px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <button
            type="button"
            onClick={() => navigate(`/projects/${project.id}`)}
            className="font-display text-sm font-semibold leading-tight text-foreground text-left truncate"
          >
            {showSeriesOrder && project.series_order ? `${project.series_order}. ` : ''}{project.title || 'Untitled'}
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="shrink-0 rounded-full p-0.5 opacity-0 transition group-hover:opacity-100 hover:bg-muted">
                <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {authorFolders.length > 0 && (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger><FolderInput className="mr-2 h-3.5 w-3.5" /> Move to Author</DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {authorFolders.map((f) => (
                      <DropdownMenuItem key={f.id} onClick={() => onMoveToFolder(project.id, f.id, 'folder_id')}>
                        {f.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              )}
              {seriesFolders.length > 0 && (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger><FolderInput className="mr-2 h-3.5 w-3.5" /> Move to Series</DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {seriesFolders.map((f) => (
                      <DropdownMenuItem key={f.id} onClick={() => onMoveToFolder(project.id, f.id, 'series_id')}>
                        {f.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              )}
              {customFolders.length > 0 && (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger><FolderInput className="mr-2 h-3.5 w-3.5" /> Move to Folder</DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {customFolders.map((f) => (
                      <DropdownMenuItem key={f.id} onClick={() => onMoveToFolder(project.id, f.id, 'folder_id')}>
                        {f.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              )}
              {(project.folder_id || project.series_id) && (
                <>
                  <DropdownMenuSeparator />
                  {project.folder_id && (
                    <DropdownMenuItem onClick={() => onRemoveFromFolder(project.id, 'folder_id')}>
                      Remove from folder
                    </DropdownMenuItem>
                  )}
                  {project.series_id && (
                    <DropdownMenuItem onClick={() => onRemoveFromFolder(project.id, 'series_id')}>
                      Remove from series
                    </DropdownMenuItem>
                  )}
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setDeleteOpen(true)} className="text-destructive focus:text-destructive">
                <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete Project
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete "{project.title || 'Untitled'}"?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete this project and all of its chapters. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => onDelete(project.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
        <p className="text-[11px] text-muted-foreground truncate">{project.author_name || 'Unknown Author'}</p>
        <div className="mt-auto flex items-center gap-3 text-[11px] text-muted-foreground">
          {showSeriesOrder && (
            <span className="flex items-center gap-1">
              <span className="text-[10px] text-muted-foreground/70">Vol</span>
              <input
                type="number"
                min={1}
                value={project.series_order || ''}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => {
                  const v = parseInt(e.target.value);
                  onSeriesOrderChange?.(project.id, isNaN(v) ? 0 : v);
                }}
                className="w-8 rounded border border-input bg-transparent px-1 py-0 text-[11px] text-center outline-none focus:border-primary/50"
                placeholder="#"
              />
            </span>
          )}
          <span>{chapterCount} ch</span>
          {updated && <span>{updated}</span>}
        </div>
      </div>
    </div>
  );
}