import React, { useState, useEffect } from 'react';
import { Save, Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function SaveIndicator({ onSave, isSaving, lastSaved, label = 'Save', className = '' }) {
  const [showCheck, setShowCheck] = useState(false);

  useEffect(() => {
    if (!lastSaved) return;
    setShowCheck(true);
    const t = setTimeout(() => setShowCheck(false), 4000);
    return () => clearTimeout(t);
  }, [lastSaved]);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Button onClick={onSave} disabled={isSaving} size="sm" className="rounded-full px-4">
        {isSaving ? (
          <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Saving…</>
        ) : showCheck ? (
          <><Check className="mr-1.5 h-3.5 w-3.5 text-green-600" /> Saved</>
        ) : (
          <><Save className="mr-1.5 h-3.5 w-3.5" /> {label}</>
        )}
      </Button>
      {lastSaved && !showCheck && !isSaving && (
        <span className="text-[10px] text-muted-foreground">Auto-saved</span>
      )}
    </div>
  );
}