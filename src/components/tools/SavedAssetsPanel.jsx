import React, { useState, useEffect, useCallback } from 'react';
import { Copy, Check, Trash2, ChevronDown, ChevronRight, Archive } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';

/* ═══════════════════════════════════════════════════════════════════════════
 * HELPER — save a PublishingAsset
 * ═════════════════════════════════════════════════════════════════════════ */

export async function savePublishingAsset({ projectId, kind, label, content }) {
  try {
    const record = await base44.entities.PublishingAsset.create({
      project_id: projectId || '__global__',
      kind: kind || 'other',
      label: label || 'Untitled',
      content: typeof content === 'string' ? content : JSON.stringify(content, null, 2),
      created_date: new Date().toISOString(),
    });
    console.log('[ASSETS] Saved PublishingAsset:', record.id, kind, label);
    return record;
  } catch (err) {
    console.error('[ASSETS] Save failed:', err);
    return null;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * PANEL COMPONENT
 * ═════════════════════════════════════════════════════════════════════════ */

export default function SavedAssetsPanel({ projectId, kinds, refreshKey }) {
  const [assets, setAssets] = useState([]);
  const [open, setOpen] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  const loadAssets = useCallback(async () => {
    try {
      const all = await base44.entities.PublishingAsset.filter(
        { project_id: projectId || '__global__' },
        '-created_date'
      );
      const filtered = kinds?.length
        ? all.filter((a) => kinds.includes(a.kind))
        : all;
      setAssets(filtered);
    } catch (err) {
      console.error('[ASSETS] Load failed:', err);
    }
  }, [projectId, kinds]);

  useEffect(() => { loadAssets(); }, [loadAssets, refreshKey]);

  const handleCopy = (asset) => {
    navigator.clipboard.writeText(asset.content || '').then(() => {
      setCopiedId(asset.id);
      setTimeout(() => setCopiedId(null), 1200);
      toast.success('Copied to clipboard');
    });
  };

  const handleDelete = async (asset) => {
    try {
      await base44.entities.PublishingAsset.delete(asset.id);
      setAssets((prev) => prev.filter((a) => a.id !== asset.id));
      toast.success('Asset deleted');
    } catch {
      toast.error('Delete failed');
    }
  };

  if (assets.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border/60 bg-card/80">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          <Archive className="h-4 w-4 text-primary/70" />
          <span className="text-sm font-semibold text-foreground">
            Saved Assets
          </span>
          <span className="text-[10px] text-muted-foreground">
            {assets.length} item{assets.length !== 1 ? 's' : ''}
          </span>
        </div>
      </button>

      {open && (
        <div className="max-h-[380px] overflow-y-auto border-t border-border/40 px-4 pb-3 pt-2 space-y-2">
          {assets.map((asset) => (
            <div
              key={asset.id}
              className="rounded-xl border border-border/40 bg-background/60 px-3 py-2"
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                    {asset.kind}
                  </span>
                  <span className="text-xs font-medium text-foreground truncate">
                    {asset.label}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-[10px] text-muted-foreground hidden sm:inline">
                    {new Date(asset.created_date).toLocaleDateString()}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(asset)}
                    className="rounded-full p-1 hover:bg-secondary/60"
                    title="Copy"
                  >
                    {copiedId === asset.id ? (
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(asset)}
                    className="rounded-full p-1 hover:bg-red-100 dark:hover:bg-red-900/30"
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-red-500" />
                  </button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2 leading-5">
                {(asset.content || '').slice(0, 200)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
