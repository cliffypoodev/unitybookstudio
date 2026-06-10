import React from 'react';
import { Type, Square, Circle, Minus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function EditorToolbar({ onAddText, onAddShape, onDelete, hasSelection }) {
  return (
    <div className="flex items-center gap-1.5 border-b border-border/50 bg-card/60 px-3 py-1.5">
      <Button onClick={onAddText} size="sm" variant="ghost" className="h-7 gap-1.5 rounded-lg px-2.5 text-xs">
        <Type className="h-3.5 w-3.5" /> Add Text
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="ghost" className="h-7 gap-1.5 rounded-lg px-2.5 text-xs">
            <Square className="h-3.5 w-3.5" /> Shape
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={() => onAddShape('rect')}>
            <Square className="mr-2 h-3.5 w-3.5" /> Rectangle
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onAddShape('circle')}>
            <Circle className="mr-2 h-3.5 w-3.5" /> Circle
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onAddShape('line')}>
            <Minus className="mr-2 h-3.5 w-3.5" /> Line
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="mx-2 h-4 w-px bg-border/50" />

      <Button
        onClick={onDelete}
        size="sm"
        variant="ghost"
        disabled={!hasSelection}
        className="h-7 gap-1.5 rounded-lg px-2.5 text-xs text-destructive hover:text-destructive"
      >
        <Trash2 className="h-3.5 w-3.5" /> Delete
      </Button>
    </div>
  );
}