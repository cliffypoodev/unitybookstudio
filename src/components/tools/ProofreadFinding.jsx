/* ============================================================================
 * ⚠️  DEAD CODE — DO NOT EDIT EXPECTING UI CHANGES  (WAVE9-DEADSTAMP2, Aug 2026)
 *
 * Nothing imports this file. Editing it has NO effect on the running app.
 * Belongs to components/tools/ProjectPolishView, which is itself already stamped dead. The live fiction polish is lib/manuscriptPolishRunner via ProjectStudio.
 * Kept (not deleted) at the owner's request; recoverable context only.
 * ========================================================================== */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Check, Pencil, X } from 'lucide-react';

const CAT_STYLES = {
  critical: { bg: 'bg-red-50 dark:bg-red-950/30', border: 'border-red-200 dark:border-red-800', badge: 'destructive' },
  prose: { bg: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'border-emerald-200 dark:border-emerald-800', badge: 'default' },
  structure: { bg: 'bg-blue-50 dark:bg-blue-950/30', border: 'border-blue-200 dark:border-blue-800', badge: 'secondary' },
  minor: { bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-200 dark:border-amber-800', badge: 'outline' },
};

export default function ProofreadFinding({ finding, onAccept, onEdit, onSkip }) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(finding.suggested_rewrite || '');
  const style = CAT_STYLES[finding.category] || CAT_STYLES.minor;

  const isResolved = finding.status === 'accepted' || finding.status === 'skipped';

  return (
    <div className={`rounded-xl border p-4 space-y-3 transition-opacity ${style.border} ${
      finding.status === 'accepted' ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300' :
      finding.status === 'skipped' ? 'opacity-50 bg-muted/30' : 'bg-card/80'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Badge variant={style.badge} className="text-[10px] uppercase">{finding.category}</Badge>
          <span className="text-sm font-semibold text-foreground">{finding.type}</span>
        </div>
        <span className="text-xs text-muted-foreground">Ch. {finding.chapter} · Severity {finding.severity}/5</span>
      </div>

      {/* Description */}
      <p className="text-sm text-muted-foreground leading-relaxed">{finding.description}</p>

      {/* Original text */}
      <div>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Original</p>
        <div className="rounded-lg border border-red-200/60 dark:border-red-800/40 bg-red-50/50 dark:bg-red-950/20 p-3 text-sm font-serif leading-relaxed text-foreground">
          {finding.original_text}
        </div>
      </div>

      {/* Suggested / editing */}
      <div>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Suggested Rewrite</p>
        {editing ? (
          <div className="space-y-2">
            <Textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="min-h-[100px] font-serif text-sm leading-relaxed"
            />
            <div className="flex gap-2">
              <Button size="sm" className="rounded-full gap-1" onClick={() => {
                onEdit(finding, editText);
                setEditing(false);
              }}>
                <Check className="h-3 w-3" /> Apply
              </Button>
              <Button size="sm" variant="ghost" className="rounded-full" onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-emerald-200/60 dark:border-emerald-800/40 bg-emerald-50/50 dark:bg-emerald-950/20 p-3 text-sm font-serif leading-relaxed text-foreground">
            {finding.suggested_rewrite}
          </div>
        )}
      </div>

      {/* Actions */}
      {finding.status === 'pending' && !editing && (
        <div className="flex gap-2 pt-1">
          <Button size="sm" className="rounded-full gap-1" onClick={() => onAccept(finding)}>
            <Check className="h-3 w-3" /> Accept
          </Button>
          <Button size="sm" variant="outline" className="rounded-full gap-1" onClick={() => { setEditText(finding.suggested_rewrite); setEditing(true); }}>
            <Pencil className="h-3 w-3" /> Edit
          </Button>
          <Button size="sm" variant="ghost" className="rounded-full gap-1 text-muted-foreground" onClick={() => onSkip(finding)}>
            <X className="h-3 w-3" /> Skip
          </Button>
        </div>
      )}

      {finding.status === 'accepted' && (
        <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">✅ Change accepted</p>
      )}
      {finding.status === 'skipped' && (
        <p className="text-sm text-muted-foreground">Skipped</p>
      )}
    </div>
  );
}