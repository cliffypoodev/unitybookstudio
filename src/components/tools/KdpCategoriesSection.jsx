/* ============================================================================
 * ⚠️  DEAD CODE — DO NOT EDIT EXPECTING UI CHANGES  (WAVE9-DEADSTAMP2, Aug 2026)
 *
 * Nothing imports this file. Editing it has NO effect on the running app.
 * Superseded. The live Publishing tab (components/tools/PublishingSubPage) generates KDP categories and keywords, and as of WAVE9-KDPVALIDATE validates them via lib/kdpKeywordValidator.
 * Kept (not deleted) at the owner's request; recoverable context only.
 * ========================================================================== */

import React, { useState, useEffect } from 'react';
import { Loader2, Sparkles, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { invokeLLMWithRetry } from '@/lib/integrationRetry';
import { runWithNetworkRetry } from '@/lib/requestRetry';

function parseCategories(text) {
  const raw = typeof text === 'string' ? text : '';
  const entries = [];
  const blocks = raw.split(/\n(?=PATH:)/i);
  for (const block of blocks) {
    const pathMatch = block.match(/PATH:\s*(.+)/i);
    const typeMatch = block.match(/TYPE:\s*(.+)/i);
    const strategyMatch = block.match(/STRATEGY:\s*(.+)/i);
    if (pathMatch) {
      entries.push({
        path: pathMatch[1].trim(),
        type: typeMatch ? typeMatch[1].trim() : 'Kindle',
        strategy: strategyMatch ? strategyMatch[1].trim() : '',
      });
    }
  }
  return entries;
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <Button size="sm" variant="ghost" onClick={handleCopy} className="h-6 w-6 p-0 shrink-0">
      {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
    </Button>
  );
}

export default function KdpCategoriesSection({ project }) {
  const [categories, setCategories] = useState([]);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (project.kdp_categories) {
      try {
        const parsed = JSON.parse(project.kdp_categories);
        if (Array.isArray(parsed)) setCategories(parsed);
      } catch {
        // Try parsing as raw text
        const parsed = parseCategories(project.kdp_categories);
        if (parsed.length) setCategories(parsed);
      }
    }
  }, [project.kdp_categories]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const ctx = [
        `Title: ${project.title || 'Untitled'}`,
        `Genre: ${project.genre || 'Fiction'}`,
        project.subgenre ? `Subgenre: ${project.subgenre}` : '',
        project.target_audience ? `Target Audience: ${project.target_audience}` : '',
        project.world_md ? `World/Setting:\n${project.world_md.substring(0, 2000)}` : '',
        project.outline_md ? `Outline:\n${project.outline_md.substring(0, 3000)}` : '',
      ].filter(Boolean).join('\n');

      const prompt = `Generate Amazon KDP browse category paths for this book. Do NOT generate BISAC codes. Amazon KDP uses its own browse path system.

Amazon browse paths look like this:
- Kindle Store > Kindle eBooks > Literature & Fiction > Historical Fiction > Religious
- Kindle Store > Kindle eBooks > Romance > Historical Romance
- Books > Christian Books & Bibles > Literature & Fiction > Historical
- Books > Literature & Fiction > Genre Fiction > Historical > Thrillers

Generate 10 Amazon KDP browse paths. For each one provide:
1. The full path starting with 'Kindle Store' for ebook OR 'Books' for paperback
2. Whether it is for Kindle, Paperback, or Both
3. One sentence on why this category is strategic (traffic vs competition)

Include a mix of:
- 3-4 high-traffic competitive categories (where the big audience is)
- 3-4 mid-traffic niche categories (where ranking is easier)
- 2-3 cross-genre categories (to reach adjacent audiences)

Include BOTH Kindle and Paperback paths. They are different trees.

CRITICAL: Use ONLY real Amazon category paths. Do not invent paths. Do not use BISAC format.

Format each as:
PATH: [full browse path]
TYPE: [Kindle/Paperback/Both]
STRATEGY: [why this category]

BOOK DETAILS:
${ctx}`;

      const result = await invokeLLMWithRetry({ prompt });
      const text = typeof result === 'string' ? result : (result?.text || result?.data || '');
      const parsed = parseCategories(text);

      if (parsed.length) {
        setCategories(parsed);
        await runWithNetworkRetry(() =>
          base44.entities.NovelProject.update(project.id, { kdp_categories: JSON.stringify(parsed) })
        );
      } else {
        toast.error('Could not parse category results. Try again.');
      }
    } catch (err) {
      toast.error('Failed to generate: ' + (err.message || 'Unknown error'));
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyAll = () => {
    const text = categories.map(c => c.path).join('\n');
    navigator.clipboard.writeText(text);
    toast.success('All category paths copied');
  };

  const typeBadge = (type) => {
    const t = (type || '').toLowerCase();
    if (t.includes('kindle') && t.includes('paper')) return { label: 'Both', cls: 'bg-purple-500/15 text-purple-700' };
    if (t.includes('both')) return { label: 'Both', cls: 'bg-purple-500/15 text-purple-700' };
    if (t.includes('paper') || t.includes('print')) return { label: 'Print', cls: 'bg-blue-500/15 text-blue-700' };
    return { label: 'Kindle', cls: 'bg-amber-500/15 text-amber-700' };
  };

  return (
    <div className="rounded-2xl border border-border/70 bg-card/80 p-4 backdrop-blur-sm space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm font-medium text-foreground">Amazon KDP Categories</span>
          <span className="text-[10px] text-muted-foreground ml-2">Browse paths for KDP category selection</span>
        </div>
        <div className="flex items-center gap-1.5">
          {categories.length > 0 && (
            <Button size="sm" variant="outline" onClick={handleCopyAll} className="rounded-full gap-1 text-[10px] h-7 px-3">
              <Copy className="h-3 w-3" /> Copy All
            </Button>
          )}
          <Button size="sm" variant={categories.length ? 'ghost' : 'secondary'} onClick={handleGenerate} disabled={generating} className="rounded-full gap-1 text-[10px] h-7 px-3">
            {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            {categories.length ? 'Regenerate' : 'Generate Categories'}
          </Button>
        </div>
      </div>

      {categories.length > 0 && (
        <div className="space-y-1.5">
          {categories.map((cat, i) => {
            const badge = typeBadge(cat.type);
            return (
              <div key={i} className="flex items-start gap-2 rounded-lg border border-border/40 bg-background/60 px-3 py-2">
                <span className="text-[10px] font-bold text-muted-foreground mt-0.5 w-4 shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${badge.cls}`}>{badge.label}</span>
                    <span className="text-xs font-medium text-foreground break-all">{cat.path}</span>
                  </div>
                  {cat.strategy && (
                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-4">{cat.strategy}</p>
                  )}
                </div>
                <CopyButton text={cat.path} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}