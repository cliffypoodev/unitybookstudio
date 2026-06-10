import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { base44 } from '@/api/base44Client';
import { FolderPlus, Home, ChevronRight, Search, FilePlus, Library, Settings, Loader2, Trash2, MoreHorizontal, FolderInput, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import NewProjectModal from '@/components/dashboard/NewProjectModal';
import FolderCard from '@/components/dashboard/FolderCard';
import CreateFolderDialog from '@/components/dashboard/CreateFolderDialog';
import SettingsModal from '@/components/notebook/SettingsModal';
import moment from 'moment';

const PHASE_COLORS = {
  foundation: { bg: 'linear-gradient(160deg, #2a3a5a 0%, #101a30 100%)', accent: '#6788a3', label: 'Foundation' },
  outline:    { bg: 'linear-gradient(160deg, #3a5a40 0%, #1e3a2b 100%)', accent: '#d4af37', label: 'Drafting' },
  review:     { bg: 'linear-gradient(160deg, #4a1e1e 0%, #2a0808 100%)', accent: '#c49a4a', label: 'Polish' },
  export:     { bg: 'linear-gradient(160deg, #3a2e1e 0%, #1e1408 100%)', accent: '#b48a57', label: 'Publishing' },
};

function BookCard({ project, onOpen, dragHandleProps, isDragging, folders, onMoveToFolder, onRemoveFromFolder, onDelete }) {
  const [hover, setHover] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const phase = project.phase || 'outline';
  const colors = PHASE_COLORS[phase] || PHASE_COLORS.outline;
  const words = project.total_word_count || 0;
  const target = project.total_word_target || 70000;
  const progress = target > 0 ? Math.min(words / target, 1) : 0;
  const chapters = project.chapter_count || 0;
  const totalChapters = project.chapter_target || 20;
  const updated = project.updated_date ? moment(project.updated_date).fromNow() : '';

  const authorFolders = (folders || []).filter(f => f.folder_type === 'author');
  const seriesFolders = (folders || []).filter(f => f.folder_type === 'series');
  const customFolders = (folders || []).filter(f => f.folder_type === 'custom');

  return (
    <div style={{ opacity: isDragging ? 0.5 : 1 }}>
      <div
        onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
        style={{ cursor: 'pointer', transition: 'transform 220ms', transform: hover ? 'translateY(-10px)' : 'translateY(0)', position: 'relative' }}
      >
        {/* Drag handle */}
        <div {...(dragHandleProps || {})} style={{ position: 'absolute', left: 2, top: '40%', zIndex: 20, cursor: 'grab', padding: 2, opacity: hover ? 0.6 : 0, transition: 'opacity 150ms' }}>
          <GripVertical size={14} style={{ color: 'rgba(255,255,255,.5)' }} />
        </div>
        {/* Menu */}
        <div style={{ position: 'absolute', right: 6, top: 6, zIndex: 20 }} onClick={e => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button style={{ background: 'rgba(0,0,0,.3)', border: 'none', borderRadius: 999, width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', opacity: hover ? 1 : 0, transition: 'opacity 150ms' }}>
                <MoreHorizontal size={14} style={{ color: '#fff' }} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {authorFolders.length > 0 && (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger><FolderInput className="mr-2 h-3.5 w-3.5" /> Move to Author</DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>{authorFolders.map(f => <DropdownMenuItem key={f.id} onClick={() => onMoveToFolder(project.id, f.id, 'folder_id')}>{f.name}</DropdownMenuItem>)}</DropdownMenuSubContent>
                </DropdownMenuSub>
              )}
              {seriesFolders.length > 0 && (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger><FolderInput className="mr-2 h-3.5 w-3.5" /> Move to Series</DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>{seriesFolders.map(f => <DropdownMenuItem key={f.id} onClick={() => onMoveToFolder(project.id, f.id, 'series_id')}>{f.name}</DropdownMenuItem>)}</DropdownMenuSubContent>
                </DropdownMenuSub>
              )}
              {customFolders.length > 0 && (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger><FolderInput className="mr-2 h-3.5 w-3.5" /> Move to Folder</DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>{customFolders.map(f => <DropdownMenuItem key={f.id} onClick={() => onMoveToFolder(project.id, f.id, 'folder_id')}>{f.name}</DropdownMenuItem>)}</DropdownMenuSubContent>
                </DropdownMenuSub>
              )}
              {(project.folder_id || project.series_id) && (<><DropdownMenuSeparator />{project.folder_id && <DropdownMenuItem onClick={() => onRemoveFromFolder(project.id, 'folder_id')}>Remove from folder</DropdownMenuItem>}{project.series_id && <DropdownMenuItem onClick={() => onRemoveFromFolder(project.id, 'series_id')}>Remove from series</DropdownMenuItem>}</>)}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setDeleteOpen(true)} className="text-destructive"><Trash2 className="mr-2 h-3.5 w-3.5" /> Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {/* Cover */}
        <div onClick={onOpen} style={{
          aspectRatio: '2/3', borderRadius: '3px 6px 6px 3px',
          background: project.cover_image_url ? `url(${project.cover_image_url}) center/cover` : colors.bg,
          boxShadow: hover
            ? '0 24px 40px -12px rgba(35,20,5,.5), inset 3px 0 0 rgba(0,0,0,.25)'
            : '0 10px 24px -6px rgba(35,20,5,.35), inset 3px 0 0 rgba(0,0,0,.25)',
          padding: '22px 18px 18px 26px', color: '#fff',
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        }}>
          {!project.cover_image_url && (<>
            <div style={{ height: 2, background: colors.accent, width: '60%', boxShadow: `0 0 8px ${colors.accent}` }} />
            <div>
              <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 20, fontWeight: 500, lineHeight: 1.15, color: colors.accent, textShadow: '0 1px 2px rgba(0,0,0,.4)' }}>
                {project.title || 'Untitled'}
              </div>
              <div style={{ marginTop: 4, fontFamily: 'Inter, sans-serif', fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(255,255,255,.6)' }}>
                {colors.label}
              </div>
              <div style={{ marginTop: 10, height: 3, background: 'rgba(255,255,255,.12)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ width: `${progress * 100}%`, height: '100%', background: colors.accent }} />
              </div>
            </div>
          </>)}
        </div>
        {/* Meta below cover */}
        <div style={{ marginTop: 12, fontFamily: 'Inter, sans-serif' }}>
          <div style={{ fontSize: 13, color: '#2a2218', fontWeight: 500 }}>{words.toLocaleString()} / {target.toLocaleString()} words</div>
          <div style={{ fontSize: 11, color: '#756a59', marginTop: 2 }}>
            Ch {chapters}/{totalChapters}{updated ? ` · ${updated}` : ''}
          </div>
        </div>
      </div>
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{project.title || 'Untitled'}"?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete this project and all chapters.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => onDelete(project.id)} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [renamingFolder, setRenamingFolder] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [dragOverFolderId, setDragOverFolderId] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => { base44.auth.me().then(setCurrentUser).catch(() => {}); }, []);

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['novel-projects', currentUser?.email],
    queryFn: () => currentUser?.email ? base44.entities.NovelProject.filter({ created_by: currentUser.email }, '-updated_date', 100) : [],
    enabled: !!currentUser?.email,
  });

  const { data: folders = [] } = useQuery({
    queryKey: ['project-folders', currentUser?.email],
    queryFn: () => currentUser?.email ? base44.entities.ProjectFolder.filter({ created_by: currentUser.email }, 'sort_order', 100) : [],
    enabled: !!currentUser?.email,
    initialData: [],
  });

  const createFolder = useMutation({ mutationFn: (data) => base44.entities.ProjectFolder.create(data), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['project-folders'] }) });
  const updateFolder = useMutation({ mutationFn: ({ id, data }) => base44.entities.ProjectFolder.update(id, data), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['project-folders'] }) });
  const deleteFolder = useMutation({
    mutationFn: async (folderId) => {
      const assigned = projects.filter(p => p.folder_id === folderId || p.series_id === folderId);
      for (const p of assigned) { const u = {}; if (p.folder_id === folderId) u.folder_id = ''; if (p.series_id === folderId) u.series_id = ''; await base44.entities.NovelProject.update(p.id, u); }
      await base44.entities.ProjectFolder.delete(folderId);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['project-folders'] }); queryClient.invalidateQueries({ queryKey: ['novel-projects'] }); if (currentFolderId) setCurrentFolderId(null); },
  });
  const moveProject = useMutation({ mutationFn: ({ projectId, data }) => base44.entities.NovelProject.update(projectId, data), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['novel-projects'] }) });
  const deleteProject = useMutation({
    mutationFn: async (projectId) => { const chs = await base44.entities.Chapter.filter({ project_id: projectId }, 'chapter_number', 200); for (const ch of chs) await base44.entities.Chapter.delete(ch.id); await base44.entities.NovelProject.delete(projectId); },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['novel-projects'] }),
  });

  const currentFolder = folders.find(f => f.id === currentFolderId);
  const visibleFolders = currentFolderId ? folders.filter(f => f.parent_id === currentFolderId) : folders.filter(f => !f.parent_id);
  const isSeriesFolder = currentFolder?.folder_type === 'series';
  const visibleProjects = currentFolderId
    ? projects.filter(p => p.folder_id === currentFolderId || p.series_id === currentFolderId).sort((a, b) => isSeriesFolder ? (a.series_order || 999) - (b.series_order || 999) : 0)
    : projects.filter(p => !p.folder_id && !p.series_id);
  const filtered = searchQuery ? visibleProjects.filter(p => (p.title || '').toLowerCase().includes(searchQuery.toLowerCase())) : visibleProjects;

  const breadcrumbs = [];
  if (currentFolder) { if (currentFolder.parent_id) { const parent = folders.find(f => f.id === currentFolder.parent_id); if (parent) breadcrumbs.push(parent); } breadcrumbs.push(currentFolder); }

  const totalWords = projects.reduce((s, p) => s + (p.total_word_count || 0), 0);

  const handleDragEnd = (result) => { setDragOverFolderId(null); if (!result.destination) return; const { draggableId, destination } = result; if (destination.droppableId.startsWith('folder-')) { const fid = destination.droppableId.replace('folder-', ''); const f = folders.find(x => x.id === fid); if (!f) return; moveProject.mutate({ projectId: draggableId, data: { [f.folder_type === 'series' ? 'series_id' : 'folder_id']: fid } }); } };
  const handleDragUpdate = (update) => { if (update.destination?.droppableId?.startsWith('folder-')) setDragOverFolderId(update.destination.droppableId.replace('folder-', '')); else setDragOverFolderId(null); };
  const cycleColor = (folder) => { const colors = ['amber','blue','emerald','purple','rose','cyan','orange']; const idx = colors.indexOf(folder.color || 'amber'); updateFolder.mutate({ id: folder.id, data: { color: colors[(idx + 1) % colors.length] } }); };
  const submitRename = () => { if (renamingFolder && renameValue.trim()) updateFolder.mutate({ id: renamingFolder, data: { name: renameValue.trim() } }); setRenamingFolder(null); setRenameValue(''); };

  const handleCreateProject = async (projectType, seriesOverrides) => {
    setShowNewProjectModal(false);
    if (projectType === 'ideas') { const p = await base44.entities.NovelProject.create({ title: 'Untitled Project', seed_concept: '', author_name: 'Hermes Agent', book_type: 'fiction', project_type: 'fiction', beat_style: 'Tension-Driven', scene_beat_style: 'Tension-Driven', chapter_target: 20, chapter_length_preset: 'standard', chapter_length_target: 3500, target_chapter_words: 3500, total_word_target: 70000, phase: 'foundation', status: 'idle' }); queryClient.invalidateQueries({ queryKey: ['novel-projects'] }); navigate(`/projects/${p.id}?tab=tools`); return; }
    const shared = { title: 'Untitled Project', seed_concept: '', author_name: 'Hermes Agent', beat_style: 'Tension-Driven', scene_beat_style: 'Tension-Driven', chapter_target: 20, chapter_length_preset: 'standard', chapter_length_target: 3500, target_chapter_words: 3500, total_word_target: 70000, phase: 'foundation', status: 'idle' };
    const typeDefaults = { fiction: { book_type: 'fiction', project_type: 'fiction', genre: '', pov_mode: 'Third Person Limited', tense: 'Past', spice_level: 0, language_intensity: 0, protagonist_pronouns: 'she/her' }, nonfiction: { book_type: 'nonfiction', project_type: 'nonfiction', genre: '', pov_mode: 'First Person', tense: 'Past', spice_level: 0, language_intensity: 0 }, erotica: { book_type: 'fiction', project_type: 'erotica', genre: '', pov_mode: 'Third Person Limited', tense: 'Past', spice_level: 3, language_intensity: 2, erotica_register: 1, protagonist_pronouns: 'she/her' }, anthology: { book_type: 'fiction', project_type: 'anthology', genre: '', pov_mode: 'third-close', tense: 'past', beat_style: 'Character Study', scene_beat_style: 'Character Study', chapter_target: 12, chapter_length_preset: 'standard', chapter_length_target: 3500, target_chapter_words: 3500, total_word_target: 42000, spice_level: 0, language_intensity: 2, anthology_theme: '', anthology_theme_type: 'topic', anthology_story_length: 'short', anthology_variety: 'high' } };
    const seriesFields = seriesOverrides || {};
    let seriesStoryFields = {};
    if (seriesFields.series_bible_id) { try { const bibles = await base44.entities.SeriesBible.filter({ id: seriesFields.series_bible_id }); const bible = bibles?.[0]; if (bible) { const { formatCharactersForStoryBible, buildCanonFromSeriesBible, formatUnresolvedThreads } = await import('@/lib/seriesBible'); let characters = []; try { characters = JSON.parse(bible.characters_json || '[]'); } catch {} let unresolvedThreads = []; try { unresolvedThreads = JSON.parse(bible.unresolved_threads || '[]'); } catch {} let resolvedThreads = []; try { resolvedThreads = JSON.parse(bible.resolved_threads || '[]'); } catch {} let deathsAndLosses = []; try { deathsAndLosses = JSON.parse(bible.deaths_and_losses || '[]'); } catch {} let secretsRevealed = []; try { secretsRevealed = JSON.parse(bible.secrets_revealed || '[]'); } catch {} seriesStoryFields = { characters_md: formatCharactersForStoryBible(characters), world_md: bible.world_state || '', canon_md: buildCanonFromSeriesBible({ characters, rules_and_systems: bible.rules_and_systems, deaths_and_losses: deathsAndLosses, secrets_revealed: secretsRevealed, resolved_threads: resolvedThreads }), voice_md: bible.voice_profile || '', mystery_md: formatUnresolvedThreads(unresolvedThreads), seed_concept: 'Continuation of ' + (seriesFields.series_name || 'the series'), title: (seriesFields.series_name || 'Series') + ' — Book ' + (seriesFields.series_number || 2) }; } } catch (e) { console.warn('[SERIES] Failed:', e.message); } }
    const p = await base44.entities.NovelProject.create({ ...shared, ...typeDefaults[projectType], ...seriesFields, ...seriesStoryFields });
    queryClient.invalidateQueries({ queryKey: ['novel-projects'] }); navigate(`/projects/${p.id}`);
  };

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-0 h-[30rem] w-[30rem] -translate-x-1/2 rounded-full bg-accent/35 blur-3xl" />
        <div className="absolute right-0 top-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
      </div>
      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-10 sm:px-10 lg:px-16 lg:py-14">
        {/* Header */}
        <div className="mb-7">
          {/* Title row */}
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-3xl sm:text-[44px]" style={{ margin: 0, fontFamily: 'Cormorant Garamond, serif', fontWeight: 500, color: '#2a2218', letterSpacing: '-0.02em', lineHeight: 1.1 }}>Your Library</h1>
              <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#756a59', marginTop: 4 }}>
                {isLoading ? 'Loading…' : `${projects.length} books · ${totalWords.toLocaleString()} words`}
              </div>
            </div>
            <Button onClick={() => setShowNewProjectModal(true)} className="rounded-full gap-1.5 shrink-0"><FilePlus className="h-4 w-4" /> New Book</Button>
          </div>
          {/* Search + actions row */}
          <div className="mt-4 flex items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search books…" className="w-full" style={{ padding: '9px 14px 9px 34px', fontFamily: 'Inter, sans-serif', fontSize: 13, background: 'rgba(255,253,247,.8)', border: '1px solid #d8cdbd', borderRadius: 999, outline: 'none', color: '#2a2218' }} />
              <Search size={14} style={{ position: 'absolute', left: 12, top: 11, color: '#a89987' }} />
            </div>
            <Button variant="outline" size="sm" onClick={() => setFolderDialogOpen(true)} className="rounded-full gap-1.5 h-9 shrink-0"><FolderPlus className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Folder</span></Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/series')} className="rounded-full gap-1.5 h-9 shrink-0"><Library className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Series</span></Button>
            <Button variant="ghost" size="icon" onClick={() => setSettingsOpen(true)} className="rounded-full h-9 w-9 shrink-0"><Settings className="h-4 w-4" /></Button>
          </div>
        </div>

        {/* Breadcrumbs */}
        {currentFolderId && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#756a59' }}>
            <button onClick={() => setCurrentFolderId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#756a59' }}><Home size={14} /></button>
            {breadcrumbs.map(bc => (
              <React.Fragment key={bc.id}>
                <ChevronRight size={12} />
                <button onClick={() => setCurrentFolderId(bc.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2a2218', fontWeight: 500 }}>{bc.name}</button>
              </React.Fragment>
            ))}
          </div>
        )}

        <DragDropContext onDragEnd={handleDragEnd} onDragUpdate={handleDragUpdate}>
          {/* Folders */}
          {visibleFolders.length > 0 && (() => {
            const prominentFolders = visibleFolders.filter(f => f.folder_type !== 'author');
            const authorFoldersList = visibleFolders.filter(f => f.folder_type === 'author').sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            return (
            <div style={{ marginBottom: 24 }}>
              {prominentFolders.length > 0 && (<>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.15em', color: '#756a59', marginBottom: 12 }}>Collections</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: authorFoldersList.length > 0 ? 20 : 0 }}>
                {prominentFolders.map(folder => (
                  <Droppable key={folder.id} droppableId={`folder-${folder.id}`}>
                    {(provided, snapshot) => (
                      <div ref={provided.innerRef} {...provided.droppableProps}>
                        {renamingFolder === folder.id ? (
                          <div style={{ borderRadius: 12, border: '1px solid #b48a57', padding: 12, background: 'rgba(255,253,247,.9)' }}>
                            <input autoFocus value={renameValue} onChange={e => setRenameValue(e.target.value)} onBlur={submitRename} onKeyDown={e => { if (e.key === 'Enter') submitRename(); if (e.key === 'Escape') setRenamingFolder(null); }} style={{ width: '100%', border: '1px solid #d8cdbd', borderRadius: 8, padding: '6px 10px', fontSize: 13, fontFamily: 'Inter, sans-serif' }} />
                          </div>
                        ) : (
                          <FolderCard folder={folder} projectCount={projects.filter(p => p.folder_id === folder.id || p.series_id === folder.id).length} isOver={snapshot.isDraggingOver || dragOverFolderId === folder.id} onClick={() => setCurrentFolderId(folder.id)} onRename={() => { setRenamingFolder(folder.id); setRenameValue(folder.name); }} onDelete={() => deleteFolder.mutate(folder.id)} onColorChange={() => cycleColor(folder)} />
                        )}
                        <div style={{ display: 'none' }}>{provided.placeholder}</div>
                      </div>
                    )}
                  </Droppable>
                ))}
              </div>
              </>)}
              {authorFoldersList.length > 0 && (<>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.15em', color: '#756a59', marginBottom: 10 }}>Pen Names</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
                {authorFoldersList.map(folder => (
                  <Droppable key={folder.id} droppableId={`folder-${folder.id}`}>
                    {(provided, snapshot) => (
                      <div ref={provided.innerRef} {...provided.droppableProps}>
                        {renamingFolder === folder.id ? (
                          <div style={{ borderRadius: 12, border: '1px solid #b48a57', padding: 12, background: 'rgba(255,253,247,.9)' }}>
                            <input autoFocus value={renameValue} onChange={e => setRenameValue(e.target.value)} onBlur={submitRename} onKeyDown={e => { if (e.key === 'Enter') submitRename(); if (e.key === 'Escape') setRenamingFolder(null); }} style={{ width: '100%', border: '1px solid #d8cdbd', borderRadius: 8, padding: '6px 10px', fontSize: 13, fontFamily: 'Inter, sans-serif' }} />
                          </div>
                        ) : (
                          <FolderCard folder={folder} projectCount={projects.filter(p => p.folder_id === folder.id || p.series_id === folder.id).length} isOver={snapshot.isDraggingOver || dragOverFolderId === folder.id} onClick={() => setCurrentFolderId(folder.id)} onRename={() => { setRenamingFolder(folder.id); setRenameValue(folder.name); }} onDelete={() => deleteFolder.mutate(folder.id)} onColorChange={() => cycleColor(folder)} />
                        )}
                        <div style={{ display: 'none' }}>{provided.placeholder}</div>
                      </div>
                    )}
                  </Droppable>
                ))}
              </div>
              </>)}
            </div>
            );
          })()}

          {/* Bookshelf */}
          <div>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.15em', color: '#756a59', marginBottom: 12 }}>
              {currentFolderId ? currentFolder?.name || 'Folder' : 'All Books'}
            </p>
            <div style={{ position: 'relative', background: 'linear-gradient(180deg, #d9c3a0 0%, #c2a77d 100%)', borderRadius: 10, padding: '40px 32px 22px', boxShadow: 'inset 0 4px 12px rgba(80,55,25,.2), 0 8px 22px rgba(80,55,25,.15)' }}>
              <Droppable droppableId="projects-grid" direction="horizontal" isDropDisabled={true}>
                {(provided) => (
                  <div ref={provided.innerRef} {...provided.droppableProps} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 28, alignItems: 'end' }}>
                    {filtered.length === 0 ? (
                      <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px 0', color: '#756a59', fontFamily: 'Inter, sans-serif', fontSize: 14 }}>
                        {searchQuery ? 'No books match your search.' : 'No books yet. Click "New Book" to start.'}
                      </div>
                    ) : filtered.map((project, index) => (
                      <Draggable key={project.id} draggableId={project.id} index={index}>
                        {(dragProvided, dragSnapshot) => (
                          <div ref={dragProvided.innerRef} {...dragProvided.draggableProps}>
                            <BookCard
                              project={project}
                              onOpen={() => navigate(`/projects/${project.id}`)}
                              dragHandleProps={dragProvided.dragHandleProps}
                              isDragging={dragSnapshot.isDragging}
                              folders={folders}
                              onMoveToFolder={(pid, fid, field) => moveProject.mutate({ projectId: pid, data: { [field]: fid } })}
                              onRemoveFromFolder={(pid, field) => moveProject.mutate({ projectId: pid, data: { [field]: '' } })}
                              onDelete={(pid) => deleteProject.mutate(pid)}
                            />
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
              {/* Shelf board */}
              <div style={{ height: 18, marginTop: 4, background: 'linear-gradient(180deg, #8b6f45 0%, #5e4a2c 100%)', borderRadius: 2, boxShadow: '0 6px 10px rgba(60,40,15,.25), inset 0 1px 0 rgba(255,240,210,.2)' }} />
            </div>
          </div>
        </DragDropContext>
      </div>

      <CreateFolderDialog open={folderDialogOpen} onOpenChange={setFolderDialogOpen} onCreate={(data) => createFolder.mutate({ ...data, parent_id: currentFolderId || '' })} />
      <NewProjectModal open={showNewProjectModal} onClose={() => setShowNewProjectModal(false)} onCreate={handleCreateProject} onRewriteCreated={(p) => { setShowNewProjectModal(false); queryClient.invalidateQueries({ queryKey: ['novel-projects'] }); navigate(`/projects/${p.id}`); }} />
      <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
    </main>
  );
}