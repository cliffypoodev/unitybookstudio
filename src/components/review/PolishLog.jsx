/* ============================================================================
 * ⚠️  DEAD CODE — DO NOT EDIT EXPECTING UI CHANGES  (WAVE5-DEADSTAMP, Aug 2026)
 *
 * Nothing imports this file. Editing it has NO effect on the running app —
 * past AI sessions repeatedly wasted hours "fixing" components like this one.
 * Live implementation: the live review UI is ManuscriptDashboard + ReviewChapterList.
 * Kept (not deleted) at the owner's request; recoverable context only.
 * ========================================================================== */
import React, { useRef, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PolishLog({ lines, onClear }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines.length]);

  if (!lines.length) return null;

  return (
    <div className="rounded-[1.25rem] border border-purple-300/50 bg-purple-50/60 dark:bg-purple-950/30 dark:border-purple-700/40 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-purple-200/60 dark:border-purple-800/40">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
          <span className="text-[10px] font-semibold uppercase tracking-widest text-purple-700 dark:text-purple-300">Polish Log</span>
          <span className="text-[10px] text-purple-500 dark:text-purple-400">{lines.length} entries</span>
        </div>
        {onClear && (
          <Button variant="ghost" size="icon" className="h-6 w-6 text-purple-500 hover:text-purple-700" onClick={onClear}>
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
      <ScrollArea className="max-h-72 px-4 py-2">
        <div className="space-y-0.5 font-mono text-[11px] leading-5">
          {lines.map((line, i) => {
            const isWarning = line.startsWith('⚠️') || line.includes('HIGH FREQUENCY');
            const isError = line.startsWith('❌');
            const isSuccess = line.includes('SAVED') || line.includes('removed') || line.includes('replaced') || line.startsWith('✅');
            const isHeader = line.startsWith('───') || line.startsWith('Manuscript Polish');
            const color = isError
              ? 'text-red-600 dark:text-red-400'
              : isWarning
              ? 'text-amber-700 dark:text-amber-400'
              : isSuccess
              ? 'text-green-700 dark:text-green-400'
              : isHeader
              ? 'text-purple-700 dark:text-purple-300 font-semibold'
              : 'text-purple-900/80 dark:text-purple-200/80';
            return <p key={i} className={color}>{line}</p>;
          })}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>
    </div>
  );
}