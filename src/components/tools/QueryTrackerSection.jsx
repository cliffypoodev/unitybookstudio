import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { runWithNetworkRetry } from '@/lib/requestRetry';

/**
 * Query Tracker — manual log of literary agent submissions.
 *
 * Data shape (persisted as JSON array in project.agent_queries):
 *   [{
 *     id:           'q_' + timestamp,
 *     agent_name:   'Jane Smith',
 *     agency:       'Writers House',
 *     query_date:   ISO date string (YYYY-MM-DD),
 *     status:       'queried' | 'responded' | 'partial_req' | 'full_req' | 'rejected' | 'offer' | 'withdrawn',
 *     response_date: ISO date string or '',
 *     notes:        free-text,
 *   }]
 *
 * No LLM calls here — this is a straight CRUD tracker. Debounced save to the
 * project record every 1.5s after the last edit.
 */

const STATUS_OPTIONS = [
  { value: 'queried', label: 'Queried', color: 'bg-blue-500/15 text-blue-700 dark:text-blue-300' },
  { value: 'responded', label: 'Responded', color: 'bg-slate-500/15 text-slate-700 dark:text-slate-300' },
  { value: 'partial_req', label: 'Partial Req.', color: 'bg-amber-500/15 text-amber-700 dark:text-amber-300' },
  { value: 'full_req', label: 'Full Req.', color: 'bg-orange-500/15 text-orange-700 dark:text-orange-300' },
  { value: 'rejected', label: 'Rejected', color: 'bg-red-500/15 text-red-700 dark:text-red-300' },
  { value: 'offer', label: 'Offer', color: 'bg-green-500/15 text-green-700 dark:text-green-400' },
  { value: 'withdrawn', label: 'Withdrawn', color: 'bg-zinc-500/15 text-muted-foreground' },
];

function newQuery() {
  return {
    id: 'q_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
    agent_name: '',
    agency: '',
    query_date: new Date().toISOString().slice(0, 10),
    status: 'queried',
    response_date: '',
    notes: '',
  };
}

/**
 * Safely parse the project.agent_queries field which may be a JSON string or
 * already-parsed array (depending on how it was stored).
 */
function parseQueries(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function QueryTrackerSection({ project }) {
  const [queries, setQueries] = useState(() => parseQueries(project?.agent_queries));
  const [saving, setSaving] = useState(false);
  const saveTimerRef = useRef(null);
  // Track whether we've hydrated from the project field — prevents a spurious
  // save on initial mount that would overwrite the server value with ours.
  const hydratedRef = useRef(false);

  // Hydrate from project whenever it changes (e.g. switching projects)
  useEffect(() => {
    setQueries(parseQueries(project?.agent_queries));
    hydratedRef.current = true;
  }, [project?.id, project?.agent_queries]);

  // Debounced save
  useEffect(() => {
    if (!hydratedRef.current) return;
    if (!project?.id) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      setSaving(true);
      try {
        await runWithNetworkRetry(() =>
          base44.entities.NovelProject.update(project.id, {
            agent_queries: JSON.stringify(queries),
          })
        );
      } catch (err) {
        console.error('[QUERY-TRACKER] Save failed:', err);
        toast.error('Failed to save query log: ' + (err?.message || 'Unknown'));
      } finally {
        setSaving(false);
      }
    }, 1500);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [queries, project?.id]);

  const addQuery = useCallback(() => {
    setQueries((prev) => [...prev, newQuery()]);
  }, []);

  const updateQuery = useCallback((id, updates) => {
    setQueries((prev) => prev.map((q) => (q.id === id ? { ...q, ...updates } : q)));
  }, []);

  const removeQuery = useCallback((id) => {
    setQueries((prev) => prev.filter((q) => q.id !== id));
  }, []);

  // Compute simple stats for the header
  const stats = {
    total: queries.length,
    pending: queries.filter((q) => q.status === 'queried').length,
    requests: queries.filter((q) => q.status === 'partial_req' || q.status === 'full_req').length,
    rejections: queries.filter((q) => q.status === 'rejected').length,
    offers: queries.filter((q) => q.status === 'offer').length,
  };

  return (
    <div className="rounded-2xl border border-border/70 bg-card/80 p-4 backdrop-blur-sm space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-lg">📊</span>
            <span className="text-sm font-semibold text-foreground">Agent Query Tracker</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Track literary agent submissions, responses, and outcomes. Saved to this project.
          </p>

          {/* Stats row */}
          {stats.total > 0 && (
            <div className="flex items-center gap-4 mt-2 text-[11px]">
              <span className="text-muted-foreground">
                <span className="font-semibold text-foreground">{stats.total}</span> total
              </span>
              {stats.pending > 0 && (
                <span className="text-muted-foreground">
                  <span className="font-semibold text-blue-600 dark:text-blue-400">{stats.pending}</span> pending
                </span>
              )}
              {stats.requests > 0 && (
                <span className="text-muted-foreground">
                  <span className="font-semibold text-amber-600 dark:text-amber-400">{stats.requests}</span> requests
                </span>
              )}
              {stats.rejections > 0 && (
                <span className="text-muted-foreground">
                  <span className="font-semibold text-red-600 dark:text-red-400">{stats.rejections}</span> rejections
                </span>
              )}
              {stats.offers > 0 && (
                <span className="text-muted-foreground">
                  <span className="font-bold text-green-700 dark:text-green-400">{stats.offers}</span> offers 🎉
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {saving && (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Saving
            </span>
          )}
          <Button onClick={addQuery} size="sm" variant="outline" className="rounded-full gap-1 text-[10px] h-7 px-3">
            <Plus className="h-3 w-3" /> Add Query
          </Button>
        </div>
      </div>

      {/* Table */}
      {queries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 bg-background/40 py-6 text-center">
          <p className="text-xs text-muted-foreground">No queries logged yet.</p>
          <Button onClick={addQuery} size="sm" variant="ghost" className="mt-2 rounded-full text-[11px]">
            <Plus className="h-3 w-3 mr-1" /> Add your first agent query
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {queries.map((query) => (
            <QueryRow
              key={query.id}
              query={query}
              onUpdate={(updates) => updateQuery(query.id, updates)}
              onRemove={() => removeQuery(query.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function QueryRow({ query, onUpdate, onRemove }) {
  const [showNotes, setShowNotes] = useState(!!query.notes);
  const statusOpt = STATUS_OPTIONS.find((s) => s.value === query.status) || STATUS_OPTIONS[0];

  return (
    <div className="rounded-xl border border-border/50 bg-background/60 p-3 space-y-2">
      <div className="grid grid-cols-12 gap-2 items-start">
        {/* Agent name */}
        <div className="col-span-12 sm:col-span-3">
          <label className="text-[9px] uppercase tracking-widest text-muted-foreground">Agent</label>
          <input
            type="text"
            value={query.agent_name}
            onChange={(e) => onUpdate({ agent_name: e.target.value })}
            placeholder="Jane Smith"
            className="w-full text-xs bg-transparent border-b border-border/50 py-1 focus:outline-none focus:border-primary/60"
          />
        </div>

        {/* Agency */}
        <div className="col-span-12 sm:col-span-3">
          <label className="text-[9px] uppercase tracking-widest text-muted-foreground">Agency</label>
          <input
            type="text"
            value={query.agency}
            onChange={(e) => onUpdate({ agency: e.target.value })}
            placeholder="Writers House"
            className="w-full text-xs bg-transparent border-b border-border/50 py-1 focus:outline-none focus:border-primary/60"
          />
        </div>

        {/* Query date */}
        <div className="col-span-6 sm:col-span-2">
          <label className="text-[9px] uppercase tracking-widest text-muted-foreground">Queried</label>
          <input
            type="date"
            value={query.query_date || ''}
            onChange={(e) => onUpdate({ query_date: e.target.value })}
            className="w-full text-xs bg-transparent border-b border-border/50 py-1 focus:outline-none focus:border-primary/60"
          />
        </div>

        {/* Response date */}
        <div className="col-span-6 sm:col-span-2">
          <label className="text-[9px] uppercase tracking-widest text-muted-foreground">Responded</label>
          <input
            type="date"
            value={query.response_date || ''}
            onChange={(e) => onUpdate({ response_date: e.target.value })}
            className="w-full text-xs bg-transparent border-b border-border/50 py-1 focus:outline-none focus:border-primary/60"
          />
        </div>

        {/* Status + remove */}
        <div className="col-span-12 sm:col-span-2 flex items-end justify-end gap-1">
          <div className="flex-1">
            <label className="text-[9px] uppercase tracking-widest text-muted-foreground">Status</label>
            <select
              value={query.status}
              onChange={(e) => {
                const next = e.target.value;
                // Auto-fill response_date if user transitions from 'queried' to anything else and no date set
                if (next !== 'queried' && !query.response_date) {
                  onUpdate({ status: next, response_date: new Date().toISOString().slice(0, 10) });
                } else {
                  onUpdate({ status: next });
                }
              }}
              className={`w-full text-[10px] font-semibold rounded-full px-2 py-1 border-none ${statusOpt.color} focus:outline-none focus:ring-1 focus:ring-primary/40`}
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={onRemove}
            className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600"
            title="Remove this query"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Notes toggle */}
      {!showNotes ? (
        <button
          onClick={() => setShowNotes(true)}
          className="text-[10px] text-muted-foreground hover:text-foreground"
        >
          + Add notes
        </button>
      ) : (
        <textarea
          value={query.notes || ''}
          onChange={(e) => onUpdate({ notes: e.target.value })}
          placeholder="Notes — response details, next steps, revision requests…"
          rows={2}
          className="w-full text-xs bg-transparent border-b border-border/40 py-1 focus:outline-none focus:border-primary/60 resize-y min-h-[40px]"
        />
      )}
    </div>
  );
}