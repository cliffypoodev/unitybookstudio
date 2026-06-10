import React, { useState, useEffect } from 'react';
import { RefreshCcw, Sparkles, BookOpen, Copyright, FlaskConical, Loader2 } from 'lucide-react';
import { runFictionResearch } from '@/lib/fictionResearch';
import { AI_FAVORITE_NAMES, getUsedCharacterNames, checkForBannedNames } from '@/lib/nameRegistry';
import { isNonfictionProject } from '@/lib/manuscriptStats';
import MarkdownPanel from '@/components/novel/MarkdownPanel';
import { Button } from '@/components/ui/button';
import ResearchSection from '@/components/notebook/ResearchSection';
import SaveIndicator from '@/components/notebook/SaveIndicator';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import StoryBibleReport from '@/components/notebook/StoryBibleReport';
import FictionResearchPanel from '@/components/notebook/FictionResearchPanel';
import { projectHasResearch } from '@/lib/researchStorage';

const LEFT_DOCS = [
  { key: 'world_md', label: 'World' },
  { key: 'characters_md', label: 'Characters' },
  { key: 'outline_md', label: 'Outline' },
  { key: 'research_md', label: 'Research' },
];

const RIGHT_DOCS = [
  { key: 'canon_md', label: 'Canon' },
  { key: 'voice_md', label: 'Voice' },
  { key: 'mystery_md', label: 'Mystery' },
  { key: 'twists_md', label: 'Twists' },
];

export default function FoundationTab({
  side,
  project,
  chapters,
  activeDoc,
  onExpand,
  onActiveDocChange,
  docDrafts,
  onDocChange,
  onSave,
  onGenerate,
  isSaving,
  busyLabel,
  lastSaved,
  researchData,
  onResearch,
  onReResearch,
  onResearchChange,
  onGenerateCopyright,
  onGenerateBibliography,
  onRefreshAll,
}) {
  const docs = side === 'left' ? LEFT_DOCS : RIGHT_DOCS;
  const tabValue = docs.some((doc) => doc.key === activeDoc) ? activeDoc : docs[0].key;

  // Auto-detect banned names in characters_md
  const [localNameWarnings, setLocalNameWarnings] = useState([]);
  const charsMd = docDrafts?.characters_md || '';
  const projectId = project?.id;
  useEffect(() => {
    if (side !== 'left' || !charsMd) { setLocalNameWarnings([]); return; }
    let cancelled = false;
    getUsedCharacterNames(projectId).then(usedNames => {
      if (cancelled) return;
      const allBanned = [...new Set([...AI_FAVORITE_NAMES, ...usedNames])];
      setLocalNameWarnings(checkForBannedNames(charsMd, allBanned));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [charsMd, projectId, side]);
  const nameWarnings = side === 'left' ? localNameWarnings : [];

  if (side === 'left') {
    return (
      <div className="space-y-6">
        <div>
          <p className="notebook-kicker">Tab 3</p>
          <h2 className="font-display text-4xl text-[var(--notebook-ink)]">Foundation</h2>
          <p className="mt-3 max-w-xl text-sm leading-7 text-[var(--notebook-muted)]">Generate and edit the core project documents here. The fallback chapter-plan generation stays preserved underneath.</p>
        </div>

        {/* Name uniqueness warning */}
        {nameWarnings?.filter(w => w && w.length > 2).length > 0 && (
          <div className="rounded-xl border border-yellow-400/60 bg-yellow-50/80 dark:bg-yellow-950/20 px-4 py-3 text-sm text-yellow-800 dark:text-yellow-300">
            ⚠️ Characters use names found in other projects or AI defaults: <strong>{nameWarnings.filter(w => w && w.length > 2).join(', ')}</strong>. Consider changing them to keep your books distinct.
          </div>
        )}

        {/* Primary action: Build Story Bible */}
        {onExpand && (
          <div className="rounded-[1.5rem] border border-primary/30 bg-primary/5 p-5 text-center space-y-2">
            <Button
              onClick={onExpand}
              disabled={!!busyLabel}
              className="w-full rounded-full min-h-12 text-base gap-2"
            >
              {busyLabel ? (
                <span className="flex items-center gap-2 text-xs">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  <span className="truncate">{busyLabel}</span>
                </span>
              ) : (
                <><Sparkles className="h-4 w-4" /> Build Story Bible</>
              )}
            </Button>
            <p className="text-[10px] text-muted-foreground">AI analyzes your Setup and generates the full story bible, outline, and chapter plan.</p>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-3">
          <Button onClick={onGenerate} className="rounded-full">
            <RefreshCcw className="mr-2 h-4 w-4" /> Regenerate
          </Button>
          <SaveIndicator onSave={onSave} isSaving={isSaving} lastSaved={lastSaved} label="Save" className="sm:col-span-2 [&_button]:w-full" />
        </div>

        {project.book_type === 'nonfiction' && (
          <ResearchSection
            researchData={researchData}
            onResearch={onResearch}
            onReResearch={onReResearch}
            onResearchChange={onResearchChange}
            busyLabel={busyLabel}
          />
        )}

        {/* Fiction Plausibility Research */}
        {project.book_type !== 'nonfiction' && (
          <FictionResearchPanel project={project} busyLabel={busyLabel} onResearchComplete={onRefreshAll} onResearchMdChange={(md) => onDocChange && onDocChange('research_md', md)} />
        )}

        <div className="rounded-[1.5rem] border border-border/70 bg-white/45 p-5">
          <p className="text-xs uppercase tracking-[0.28em] text-[var(--notebook-muted)]">Foundation score</p>
          <div className="mt-4 flex items-center gap-4">
            <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-primary/20 text-2xl font-semibold text-[var(--notebook-ink)]">
              {(project.foundation_score || 0).toFixed(1)}
            </div>
            <p className="text-sm leading-7 text-[var(--notebook-muted)]">{busyLabel || project.current_focus || 'Generate the foundation documents to populate this notebook.'}</p>
          </div>
        </div>

        <Tabs value={tabValue} onValueChange={onActiveDocChange} className="space-y-4">
          <TabsList className="h-auto w-full flex-wrap justify-start gap-2 rounded-2xl bg-background/70 p-2">
            {docs.map((doc) => (
              <TabsTrigger key={doc.key} value={doc.key} className="rounded-full px-4 py-2">{doc.label}</TabsTrigger>
            ))}
          </TabsList>
          {docs.map((doc) => (
            <TabsContent key={doc.key} value={doc.key} className="space-y-3">
              <Label htmlFor={doc.key}>{doc.label}</Label>
              <Textarea
                id={doc.key}
                value={docDrafts[doc.key] || ''}
                onChange={(event) => onDocChange(doc.key, event.target.value)}
                className="min-h-[26rem] rounded-[1.5rem] bg-background/80 p-5"
              />
            </TabsContent>
          ))}
        </Tabs>

        {/* Front & Back Matter */}
        <div className="rounded-[1.5rem] border border-border/70 bg-white/45 p-5 space-y-3">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-[var(--notebook-muted)]">Front & Back Matter</p>
            <p className="mt-1 text-sm leading-6 text-[var(--notebook-muted)]">
              Generate the professional pages that frame your manuscript.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={onGenerateCopyright} disabled={!!busyLabel} variant="outline" className="rounded-full gap-2">
              <Copyright className="h-3.5 w-3.5" /> Copyright Page
            </Button>
            <Button onClick={onGenerateBibliography} disabled={!!busyLabel} variant="outline" className="rounded-full gap-2">
              <BookOpen className="h-3.5 w-3.5" /> {isNonfictionProject(project) ? 'Bibliography' : 'Resources'}
            </Button>
            <StoryBibleReport project={project} chapters={chapters} disabled={!!busyLabel} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="notebook-kicker">Core documents</p>
          <h3 className="font-display text-3xl text-[var(--notebook-ink)]">Canon, voice & mystery</h3>
          <p className="mt-3 text-sm leading-7 text-[var(--notebook-muted)]">Edit the remaining foundation docs and save them back to the project entity.</p>
        </div>
        <SaveIndicator onSave={onSave} isSaving={isSaving} lastSaved={lastSaved} label="Save Foundation" />
      </div>

      <Tabs value={tabValue} onValueChange={onActiveDocChange} className="space-y-4">
        <TabsList className="h-auto w-full flex-wrap justify-start gap-2 rounded-2xl bg-background/70 p-2">
          {docs.map((doc) => (
            <TabsTrigger key={doc.key} value={doc.key} className="rounded-full px-4 py-2">{doc.label}</TabsTrigger>
          ))}
        </TabsList>
        {docs.map((doc) => (
          <TabsContent key={doc.key} value={doc.key} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={doc.key}>{doc.label}</Label>
              <Textarea
                id={doc.key}
                value={docDrafts[doc.key] || ''}
                onChange={(event) => onDocChange(doc.key, event.target.value)}
                className="min-h-[14rem] rounded-[1.5rem] bg-background/80 p-5"
              />
            </div>
            <div className="space-y-2">
              <Label>Preview</Label>
              <MarkdownPanel content={docDrafts[doc.key]} emptyLabel={`No ${doc.label.toLowerCase()} content yet.`} />
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}