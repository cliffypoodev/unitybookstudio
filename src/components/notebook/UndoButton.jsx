import React from 'react';
import { Undo2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function UndoButton({ snapshot, onUndo, isUndoing }) {
  if (!snapshot) return null;

  return (
    <Button
      variant="outline"
      size="sm"
      className="rounded-full gap-2 bg-white/60"
      onClick={onUndo}
      disabled={isUndoing}
    >
      {isUndoing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Undo2 className="h-3.5 w-3.5" />}
      Undo {snapshot.label}
    </Button>
  );
}