import React from 'react';
import {
  AlignHorizontalJustifyStart,
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyEnd,
  AlignVerticalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignHorizontalSpaceAround,
  AlignVerticalSpaceAround,
} from 'lucide-react';

/**
 * Alignment Toolbar — six align + two distribute buttons.
 *
 * Behavior:
 *   - With 1 object selected: aligns to canvas
 *   - With 2+ selected: aligns to each other
 *   - Distribute requires 3+
 *   - Buttons grey out when disabled
 */
export default function AlignmentToolbar({ selectionCount, onAlign, onDistribute }) {
  const enabled = selectionCount > 0;
  const canDistribute = selectionCount >= 3;

  const Btn = ({ onClick, disabled, title, children }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`flex h-7 w-7 items-center justify-center rounded transition-colors ${
        disabled
          ? 'cursor-not-allowed opacity-30'
          : 'bg-background border border-border hover:bg-muted'
      }`}
    >
      {children}
    </button>
  );

  return (
    <div className="flex items-center gap-1">
      <Btn onClick={() => onAlign('left')} disabled={!enabled} title="Align Left">
        <AlignHorizontalJustifyStart className="h-3.5 w-3.5" />
      </Btn>
      <Btn onClick={() => onAlign('centerH')} disabled={!enabled} title="Align Horizontal Center">
        <AlignHorizontalJustifyCenter className="h-3.5 w-3.5" />
      </Btn>
      <Btn onClick={() => onAlign('right')} disabled={!enabled} title="Align Right">
        <AlignHorizontalJustifyEnd className="h-3.5 w-3.5" />
      </Btn>

      <div className="mx-0.5 h-4 w-px bg-border/60" />

      <Btn onClick={() => onAlign('top')} disabled={!enabled} title="Align Top">
        <AlignVerticalJustifyStart className="h-3.5 w-3.5" />
      </Btn>
      <Btn onClick={() => onAlign('centerV')} disabled={!enabled} title="Align Vertical Center">
        <AlignVerticalJustifyCenter className="h-3.5 w-3.5" />
      </Btn>
      <Btn onClick={() => onAlign('bottom')} disabled={!enabled} title="Align Bottom">
        <AlignVerticalJustifyEnd className="h-3.5 w-3.5" />
      </Btn>

      <div className="mx-0.5 h-4 w-px bg-border/60" />

      <Btn onClick={() => onDistribute('h')} disabled={!canDistribute} title="Distribute Horizontally (3+ objects)">
        <AlignHorizontalSpaceAround className="h-3.5 w-3.5" />
      </Btn>
      <Btn onClick={() => onDistribute('v')} disabled={!canDistribute} title="Distribute Vertically (3+ objects)">
        <AlignVerticalSpaceAround className="h-3.5 w-3.5" />
      </Btn>
    </div>
  );
}