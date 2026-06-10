import React from 'react';
import { Folder, User, BookOpen, ChevronRight, MoreHorizontal, Pencil, Trash2, Palette } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

const FOLDER_COLORS = [
  'bg-amber-500/20 text-amber-700 border-amber-300/50',
  'bg-blue-500/20 text-blue-700 border-blue-300/50',
  'bg-emerald-500/20 text-emerald-700 border-emerald-300/50',
  'bg-purple-500/20 text-purple-700 border-purple-300/50',
  'bg-rose-500/20 text-rose-700 border-rose-300/50',
  'bg-cyan-500/20 text-cyan-700 border-cyan-300/50',
  'bg-orange-500/20 text-orange-700 border-orange-300/50',
];

function getColorClass(color) {
  const idx = FOLDER_COLORS.findIndex((c) => c.includes(color));
  return idx >= 0 ? FOLDER_COLORS[idx] : FOLDER_COLORS[0];
}

const TYPE_CONFIG = {
  custom: {
    icon: Folder,
    height: 140,
    iconSize: 28,
    iconBoxSize: 56,
    titleSize: 16,
    showDescription: true,
    style: 'prominent',
  },
  series: {
    icon: BookOpen,
    height: 140,
    iconSize: 24,
    iconBoxSize: 48,
    titleSize: 15,
    showDescription: true,
    style: 'prominent',
  },
  author: {
    icon: User,
    height: 80,
    iconSize: 16,
    iconBoxSize: 32,
    titleSize: 13,
    showDescription: false,
    style: 'compact',
  },
};

export default function FolderCard({ folder, projectCount, isOver, onClick, onRename, onDelete, onColorChange }) {
  const config = TYPE_CONFIG[folder.folder_type] || TYPE_CONFIG.custom;
  const Icon = config.icon;
  const colorClass = getColorClass(folder.color || 'amber');
  const isProminent = config.style === 'prominent';

  return (
    <div
      onClick={onClick}
      style={{ minHeight: config.height }}
      className={`group relative flex cursor-pointer flex-col rounded-xl border shadow-sm backdrop-blur-sm transition hover:shadow-lg ${
        isOver ? 'ring-2 ring-primary/50 border-primary/50 scale-[1.02]' : 'border-border/70'
      } ${isProminent ? 'bg-card/90 p-5' : 'bg-card/70 p-3'}`}
    >
      <div className="flex items-start justify-between">
        <div className={`flex items-center justify-center rounded-lg border ${colorClass}`}
          style={{ width: config.iconBoxSize, height: config.iconBoxSize }}>
          <Icon size={config.iconSize} />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" onClick={(e) => e.stopPropagation()} className="rounded-full p-1 opacity-0 transition hover:bg-muted group-hover:opacity-100">
              <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={onRename}><Pencil className="mr-2 h-3.5 w-3.5" /> Rename</DropdownMenuItem>
            <DropdownMenuItem onClick={onColorChange}><Palette className="mr-2 h-3.5 w-3.5" /> Change Color</DropdownMenuItem>
            <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-3.5 w-3.5" /> Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className={`flex items-center gap-2 ${isProminent ? 'mt-4' : 'mt-2'}`}>
        <p className="font-display font-semibold leading-tight text-foreground truncate" style={{ fontSize: config.titleSize }}>
          {folder.name}
        </p>
        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
      </div>

      <div className={`flex items-center gap-2 text-muted-foreground ${isProminent ? 'mt-2 text-xs' : 'mt-1 text-[11px]'}`}>
        <span className="capitalize">{folder.folder_type}</span>
        <span>·</span>
        <span>{projectCount} {projectCount === 1 ? 'project' : 'projects'}</span>
      </div>

      {isProminent && config.showDescription && folder.description && (
        <p className="mt-2 text-[11px] text-muted-foreground/70 line-clamp-2">{folder.description}</p>
      )}
    </div>
  );
}

export { FOLDER_COLORS };