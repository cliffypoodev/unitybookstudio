/* ============================================================================
 * ⚠️  DEAD CODE — DO NOT EDIT EXPECTING UI CHANGES  (WAVE5-DEADSTAMP, Aug 2026)
 *
 * Nothing imports this file. Editing it has NO effect on the running app —
 * past AI sessions repeatedly wasted hours "fixing" components like this one.
 * Live implementation: pages/Dashboard re-implements all of this inline.
 * Kept (not deleted) at the owner's request; recoverable context only.
 * ========================================================================== */
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { ArrowLeft, FolderPlus, ChevronRight, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import FolderCard from '@/components/dashboard/FolderCard';
import DraggableProjectCard from '@/components/dashboard/DraggableProjectCard';
import CreateFolderDialog from '@/components/dashboard/CreateFolderDialog';

export default function ProjectBrowser({ projects, onBack }) {
  const queryClient = useQueryClient();
  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [renamingFolder, setRenamingFolder] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [dragOverFolderId, setDragOverFolderId] = useState(null);

  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => {});
  }, []);



  const { data: folders = [] } = useQuery({
    queryKey: ['project-folders', currentUser?.email],
    queryFn: async () => {
      if (!currentUser?.email) return [];
      return base44.entities.ProjectFolder.filter({}, 'sort_order', 100); // AUTH-2: per-user store IS the scope
    },
    enabled: !!currentUser?.email,
    initialData: [],
  });

  const createFolder = useMutation({
    mutationFn: (data) => base44.entities.ProjectFolder.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['project-folders'] }),
  });

  const updateFolder = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ProjectFolder.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['project-folders'] }),
  });

  const deleteFolder = useMutation({
    mutationFn: async (folderId) => {
      // Unassign all projects from this folder first
      const assigned = projects.filter((p) => p.folder_id === folderId || p.series_id === folderId);
      for (const p of assigned) {
        const updates = {};
        if (p.folder_id === folderId) updates.folder_id = '';
        if (p.series_id === folderId) updates.series_id = '';
        await base44.entities.NovelProject.update(p.id, updates);
      }
      await base44.entities.ProjectFolder.delete(folderId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-folders'] });
      queryClient.invalidateQueries({ queryKey: ['novel-projects'] });
      if (currentFolderId) setCurrentFolderId(null);
    },
  });

  const moveProject = useMutation({
    mutationFn: ({ projectId, data }) => base44.entities.NovelProject.update(projectId, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['novel-projects'] }),
  });

  const deleteProject = useMutation({
    mutationFn: async (projectId) => {
      // Delete all chapters first
      const chapters = await base44.entities.Chapter.filter({ project_id: projectId }, 'chapter_number', 200);
      for (const ch of chapters) {
        await base44.entities.Chapter.delete(ch.id);
      }
      await base44.entities.NovelProject.delete(projectId);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['novel-projects'] }),
  });

  // Navigation: build breadcrumb path
  const currentFolder = folders.find((f) => f.id === currentFolderId);
  const breadcrumbs = [];
  if (currentFolder) {
    if (currentFolder.parent_id) {
      const parent = folders.find((f) => f.id === currentFolder.parent_id);
      if (parent) breadcrumbs.push(parent);
    }
    breadcrumbs.push(currentFolder);
  }

  // Current view items
  const visibleFolders = currentFolderId
    ? folders.filter((f) => f.parent_id === currentFolderId)
    : folders.filter((f) => !f.parent_id);

  const isSeriesFolder = currentFolder?.folder_type === 'series';

  const visibleProjects = currentFolderId
    ? projects
        .filter((p) => p.folder_id === currentFolderId || p.series_id === currentFolderId)
        .sort((a, b) => isSeriesFolder ? (a.series_order || 999) - (b.series_order || 999) : 0)
    : projects.filter((p) => !p.folder_id && !p.series_id);

  const unfolderedCount = projects.filter((p) => !p.folder_id && !p.series_id).length;

  // Drag and drop
  const handleDragEnd = (result) => {
    setDragOverFolderId(null);
    if (!result.destination) return;

    const { draggableId, destination } = result;

    // Dropped on a folder droppable
    if (destination.droppableId.startsWith('folder-')) {
      const targetFolderId = destination.droppableId.replace('folder-', '');
      const folder = folders.find((f) => f.id === targetFolderId);
      if (!folder) return;
      const field = folder.folder_type === 'series' ? 'series_id' : 'folder_id';
      moveProject.mutate({ projectId: draggableId, data: { [field]: targetFolderId } });
    }
  };

  const handleDragUpdate = (update) => {
    if (update.destination?.droppableId?.startsWith('folder-')) {
      setDragOverFolderId(update.destination.droppableId.replace('folder-', ''));
    } else {
      setDragOverFolderId(null);
    }
  };

  const handleMoveToFolder = (projectId, folderId, field) => {
    moveProject.mutate({ projectId, data: { [field]: folderId } });
  };

  const handleRemoveFromFolder = (projectId, field) => {
    moveProject.mutate({ projectId, data: { [field]: '' } });
  };

  const handleRenameFolder = (folder) => {
    setRenamingFolder(folder.id);
    setRenameValue(folder.name);
  };

  const submitRename = () => {
    if (renamingFolder && renameValue.trim()) {
      updateFolder.mutate({ id: renamingFolder, data: { name: renameValue.trim() } });
    }
    setRenamingFolder(null);
    setRenameValue('');
  };

  const cycleColor = (folder) => {
    const colors = ['amber', 'blue', 'emerald', 'purple', 'rose', 'cyan', 'orange'];
    const idx = colors.indexOf(folder.color || 'amber');
    const next = colors[(idx + 1) % colors.length];
    updateFolder.mutate({ id: folder.id, data: { color: next } });
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd} onDragUpdate={handleDragUpdate}>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={currentFolderId ? () => setCurrentFolderId(null) : onBack} className="min-h-11 rounded-full px-5">
            <ArrowLeft className="mr-2 h-4 w-4" /> {currentFolderId ? 'All Projects' : 'Back'}
          </Button>

          {/* Breadcrumbs */}
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <button type="button" onClick={() => setCurrentFolderId(null)} className="hover:text-foreground transition">
              <Home className="h-3.5 w-3.5" />
            </button>
            {breadcrumbs.map((bc) => (
              <React.Fragment key={bc.id}>
                <ChevronRight className="h-3 w-3" />
                <button
                  type="button"
                  onClick={() => setCurrentFolderId(bc.id)}
                  className="font-display text-sm hover:text-foreground transition truncate max-w-[120px]"
                >
                  {bc.name}
                </button>
              </React.Fragment>
            ))}
          </div>

          <div className="ml-auto">
            <Button variant="outline" size="sm" onClick={() => setFolderDialogOpen(true)} className="gap-2 rounded-full">
              <FolderPlus className="h-4 w-4" /> New Folder
            </Button>
          </div>
        </div>

        {/* Folders grid */}
        {visibleFolders.length > 0 && (
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">Folders</p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {visibleFolders.map((folder) => (
                <Droppable key={folder.id} droppableId={`folder-${folder.id}`} isDropDisabled={false}>
                  {(provided, snapshot) => (
                    <div ref={provided.innerRef} {...provided.droppableProps}>
                      {renamingFolder === folder.id ? (
                        <div className="rounded-xl border border-primary/50 bg-card/80 p-4">
                          <input
                            autoFocus
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onBlur={submitRename}
                            onKeyDown={(e) => { if (e.key === 'Enter') submitRename(); if (e.key === 'Escape') setRenamingFolder(null); }}
                            className="w-full rounded border border-input bg-transparent px-2 py-1 text-sm font-display"
                          />
                        </div>
                      ) : (
                        <FolderCard
                          folder={folder}
                          projectCount={projects.filter((p) => p.folder_id === folder.id || p.series_id === folder.id).length}
                          isOver={snapshot.isDraggingOver || dragOverFolderId === folder.id}
                          onClick={() => setCurrentFolderId(folder.id)}
                          onRename={() => handleRenameFolder(folder)}
                          onDelete={() => deleteFolder.mutate(folder.id)}
                          onColorChange={() => cycleColor(folder)}
                        />
                      )}
                      <div className="hidden">{provided.placeholder}</div>
                    </div>
                  )}
                </Droppable>
              ))}
            </div>
          </div>
        )}

        {/* Projects grid with drag */}
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            {currentFolderId ? `Projects in ${currentFolder?.name || 'Folder'}` : 'Unfiled Projects'}
            {!currentFolderId && unfolderedCount > 0 && ` (${unfolderedCount})`}
          </p>

          <Droppable droppableId="projects-grid" direction="horizontal" isDropDisabled={true}>
            {(provided) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4"
              >
                {visibleProjects.length === 0 ? (
                  <div className="col-span-full flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
                    <p className="text-sm">
                      {currentFolderId ? 'No projects in this folder yet. Drag projects here.' : 'No unfiled projects.'}
                    </p>
                  </div>
                ) : (
                  visibleProjects.map((project, index) => (
                    <Draggable key={project.id} draggableId={project.id} index={index}>
                      {(dragProvided, dragSnapshot) => (
                        <div
                          ref={dragProvided.innerRef}
                          {...dragProvided.draggableProps}
                        >
                          <DraggableProjectCard
                            project={project}
                            folders={folders}
                            onMoveToFolder={handleMoveToFolder}
                            onRemoveFromFolder={handleRemoveFromFolder}
                            onDelete={(id) => deleteProject.mutate(id)}
                            dragHandleProps={dragProvided.dragHandleProps}
                            isDragging={dragSnapshot.isDragging}
                            showSeriesOrder={isSeriesFolder}
                            onSeriesOrderChange={isSeriesFolder ? (projectId, order) => {
                              moveProject.mutate({ projectId, data: { series_order: order } });
                            } : undefined}
                          />
                        </div>
                      )}
                    </Draggable>
                  ))
                )}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </div>
      </div>

      <CreateFolderDialog
        open={folderDialogOpen}
        onOpenChange={setFolderDialogOpen}
        onCreate={(data) => createFolder.mutate({ ...data, parent_id: currentFolderId || '' })}
      />
    </DragDropContext>
  );
}