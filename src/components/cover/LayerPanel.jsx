import React, { useState, useRef } from 'react';
import { Eye, EyeOff, Type, Square, Image as ImageIcon, Circle, Minus, Trash2, GripVertical } from 'lucide-react';

/**
 * Layer Panel
 *
 * Lists all objects on the canvas (reversed so top-most appears first).
 *
 * FEATURES:
 *   - Click a row to select that layer on canvas
 *   - Eye toggle shows/hides a layer
 *   - Drag and drop to reorder — NEW in this version (replaces up/down arrows)
 *   - Multi-select checkboxes for bulk delete
 *   - Background layer is shown faded and can't be moved/deleted
 *
 * The parent passes `objects` as a snapshot of the canvas, and callbacks
 * for each operation. We don't own the canvas — the parent does.
 */

const ICON_MAP = {
  textbox: Type,
  'i-text': Type,
  rect: Square,
  circle: Circle,
  line: Minus,
  image: ImageIcon,
};

export default function LayerPanel({
  objects,
  activeId,
  onSelect,
  onReorder,          // (fromIndex, toIndex) — both in REVERSED order
  onToggleVisibility,
  onBulkDelete,
}) {
  const [selected, setSelected] = useState(new Set());
  const [draggingId, setDraggingId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const reversed = [...objects].reverse();

  const toggleCheck = (id, e) => {
    e.stopPropagation();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleBulkDelete = () => {
    if (selected.size === 0) return;
    onBulkDelete([...selected]);
    setSelected(new Set());
  };

  // Drag-and-drop handlers. Index arithmetic is in the REVERSED list so
  // "drop above" means higher in z-order. The parent translates back.
  const handleDragStart = (e, id) => {
    setDraggingId(id);
    e.dataTransfer.effectAllowed = 'move';
    // Firefox requires data to be set
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDragOver = (e, id) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (id !== dragOverId) setDragOverId(id);
  };

  const handleDrop = (e, toId) => {
    e.preventDefault();
    if (!draggingId || draggingId === toId) {
      setDraggingId(null);
      setDragOverId(null);
      return;
    }
    const fromIdx = reversed.findIndex((o) => o.id === draggingId);
    const toIdx = reversed.findIndex((o) => o.id === toId);
    if (fromIdx >= 0 && toIdx >= 0) {
      onReorder?.(fromIdx, toIdx);
    }
    setDraggingId(null);
    setDragOverId(null);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverId(null);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Layers</p>
        {selected.size > 0 && (
          <button
            onClick={handleBulkDelete}
            className="flex items-center gap-1 rounded-md bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive transition-colors hover:bg-destructive/20"
          >
            <Trash2 className="h-2.5 w-2.5" /> {selected.size}
          </button>
        )}
      </div>
      <p className="text-[9px] italic text-muted-foreground">Drag to reorder · Click to select</p>
      <div className="space-y-0.5">
        {reversed.map((obj) => {
          const Icon = ICON_MAP[obj.type] || Square;
          const isActive = obj.id === activeId;
          const isBg = obj.id === 'background';
          const isChecked = selected.has(obj.id);
          const isDragging = draggingId === obj.id;
          const isDragOver = dragOverId === obj.id && !isDragging;

          return (
            <div
              key={obj.id}
              draggable={!isBg}
              onDragStart={(e) => handleDragStart(e, obj.id)}
              onDragOver={(e) => handleDragOver(e, obj.id)}
              onDrop={(e) => handleDrop(e, obj.id)}
              onDragEnd={handleDragEnd}
              onClick={() => onSelect(obj.id)}
              className={`flex cursor-pointer items-center gap-1 rounded-lg px-1.5 py-1.5 text-xs transition-colors ${
                isActive ? 'bg-primary/10 text-foreground' : 'text-muted-foreground hover:bg-muted/50'
              } ${isBg ? 'opacity-60' : ''} ${isDragging ? 'opacity-40' : ''} ${isDragOver ? 'outline outline-2 outline-primary/60' : ''}`}
            >
              {!isBg && (
                <GripVertical className="h-3 w-3 shrink-0 text-muted-foreground/50 cursor-grab active:cursor-grabbing" />
              )}
              {!isBg && (
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={(e) => toggleCheck(obj.id, e)}
                  onClick={(e) => e.stopPropagation()}
                  className="h-3 w-3 shrink-0 rounded accent-destructive"
                />
              )}
              <Icon className="h-3 w-3 shrink-0" />
              <span className="min-w-0 flex-1 truncate">{obj.name}</span>
              {!isBg && (
                <button
                  onClick={(e) => { e.stopPropagation(); onToggleVisibility(obj.id); }}
                  className="rounded p-0.5 hover:bg-muted shrink-0"
                  title={obj.visible ? 'Hide' : 'Show'}
                >
                  {obj.visible ? <Eye className="h-2.5 w-2.5" /> : <EyeOff className="h-2.5 w-2.5" />}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}