import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  Loader2,
  FileText,
  Download,
  Sparkles,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  BookOpen,
  AlertCircle,
  UserRound,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { invokeLLMWithRetry } from '@/lib/integrationRetry';
import { pickModel, pickFallbackModel } from '@/lib/modelRouting';
import { chapterHasContent } from '@/lib/chapterStorage';
import { isBodyChapter } from '@/lib/bibliographyGenerator';
import { parseDocxFile } from '@/lib/docxParser';
import { runWithNetworkRetry } from '@/lib/requestRetry';
import SourceSelector from '@/components/tools/SourceSelector';
import UploadZone from '@/components/tools/UploadZone';
import QueryTrackerSection from '@/components/tools/QueryTrackerSection';
import {
  PUB_SECTIONS,
  FIELD_MAP,
  buildProjectContext,
  postProcessOutput,
  getPubItem,
  getItemsForSection,
} from '@/lib/publishingPrompts';

/* =============================================================================
 * UTILITY HELPERS
 * ========================================================================== */

function safeJsonParse(raw, fallback) {
  if (!raw) return fallback;
  if (typeof raw === 'object') return raw;

  try {
    const parsed = JSON.parse(raw);
    return parsed == null ? fallback : parsed;
  } catch {
    return fallback;
  }
}

function countWords(text) {
  if (!text) return 0;
  return text.split(/\s+/).filter(Boolean).length;
}

function extractText(response) {
  if (typeof response === 'string') return response;
  return response?.text || response?.data || response?.content || String(response || '');
}

function stripFences(text) {
  return String(text || '')
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();
}

function detectPublishingProjectType(project, isNF) {
  const raw = [
    project?.project_type,
    project?.book_type,
    project?.format,
    project?.manuscript_type,
    project?.structure_type,
    project?.genre,
    project?.subgenre,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const anthologySignals = [
    'anthology',
    'short story collection',
    'story collection',
    'collection',
    'collected stories',
    'stories',
    'short stories',
    'essay collection',
    'essays',
  ];

  const isAnthology = anthologySignals.some((signal) => raw.includes(signal));

  if (isAnthology) return 'anthology';
  if (isNF) return 'nonfiction';
  return 'fiction';
}

/* =============================================================================
 * PERSISTENCE DISPATCHER
 * ========================================================================== */

function buildUpdatePatch(itemId, value, currentPackageData) {
  const mapping = FIELD_MAP[itemId];

  if (!mapping) {
    console.warn('[PUBLISHING] No FIELD_MAP entry for', itemId);
    return null;
  }

  if (mapping.field === 'publishing_package') {
    const packageOnly = {};

    for (const [id, mapInfo] of Object.entries(FIELD_MAP)) {
      if (mapInfo.field !== 'publishing_package') continue;

      const key = mapInfo.key;
      if (currentPackageData && currentPackageData[id] != null) {
        packageOnly[key] = currentPackageData[id];
      }
    }

    packageOnly[mapping.key] = value;
    return { publishing_package: JSON.stringify(packageOnly) };
  }

  const serialized = typeof value === 'string' ? value : JSON.stringify(value);
  return { [mapping.field]: serialized };
}

/* =============================================================================
 * MAIN COMPONENT
 * ========================================================================== */

export default function PublishingSubPage({ project, chapters, setBusyLabel }) {
  const [source, setSource] = useState(project?.id ? 'project' : 'upload');
  const [parsed, setParsed] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [packageData, setPackageData] = useState({});
  const [generating, setGenerating] = useState({});
  const [saving, setSaving] = useState({});
  const [expandedSections, setExpandedSections] = useState(() => {
    const out = {};
    for (const sec of PUB_SECTIONS) out[sec.id] = true;
    return out;
  });

  const saveTimersRef = useRef({});
  const hydratedRef = useRef(false);

  const isNF = useMemo(() => {
    if (source === 'upload') return false;

    const pt = (project?.project_type || project?.book_type || 'fiction').toLowerCase();
    return pt.includes('non') || pt === 'nonfiction';
  }, [source, project]);

  useEffect(() => {
    if (source !== 'project' || !project) {
      setPackageData({});
      hydratedRef.current = true;
      return;
    }

    const pkg = safeJsonParse(project.publishing_package, {});

    if (project.amazon_description) pkg.amazon_desc = project.amazon_description;

    if (project.kdp_categories) {
      pkg.kdp_categories = safeJsonParse(project.kdp_categories, null);
    }

    if (project.launch_checklist) {
      pkg.launch_checklist = safeJsonParse(project.launch_checklist, []);
    }

    pkg.isbn_ebook = project.isbn_ebook || '';
    pkg.isbn_paperback = project.isbn_paperback || '';
    pkg.isbn_hardcover = project.isbn_hardcover || '';

    setPackageData(pkg);
    hydratedRef.current = true;
  }, [
    project?.id,
    project?.publishing_package,
    project?.amazon_description,
    project?.kdp_categories,
    project?.launch_checklist,
    project?.isbn_ebook,
    project?.isbn_paperback,
    project?.isbn_hardcover,
    source,
    project,
  ]);

  const saveItem = useCallback(
    (itemId, value) => {
      if (!hydratedRef.current) return;
      if (source !== 'project' || !project?.id) return;

      if (saveTimersRef.current[itemId]) {
        clearTimeout(saveTimersRef.current[itemId]);
      }

      saveTimersRef.current[itemId] = setTimeout(async () => {
        let currentPackage = {};

        setPackageData((cur) => {
          currentPackage = cur;
          return cur;
        });

        const patch = buildUpdatePatch(itemId, value, currentPackage);
        if (!patch) return;

        setSaving((s) => ({ ...s, [itemId]: true }));

        try {
          await runWithNetworkRetry(() =>
            base44.entities.NovelProject.update(project.id, patch)
          );

          if (itemId === 'amazon_desc') {
            await runWithNetworkRetry(() =>
              base44.entities.NovelProject.update(project.id, { amazon_description: value })
            ).catch(() => {});
          }
        } catch (err) {
          console.error(`[PUBLISHING] Save failed for ${itemId}:`, err);
          toast.error(
            `Failed to save ${itemId.replace(/_/g, ' ')}: ${err?.message || 'Unknown error'}`
          );
        } finally {
          setSaving((s) => {
            const next = { ...s };
            delete next[itemId];
            return next;
          });
        }
      }, 1500);
    },
    [source, project]
  );

  const updateItem = useCallback(
    (itemId, value) => {
      setPackageData((prev) => ({ ...prev, [itemId]: value }));
      saveItem(itemId, value);
    },
    [saveItem]
  );

  const handleFileSelect = useCallback(async (file) => {
    if (!file) return;

    setUploading(true);

    try {
      setParsed(await parseDocxFile(file));
    } catch (err) {
      toast.error('Parse failed: ' + (err?.message || 'Unknown'));
    } finally {
      setUploading(false);
    }
  }, []);

  const context = useMemo(() => {
    if (source === 'project' && project) {
      const bodyChapters = (chapters || []).filter(
        (c) => chapterHasContent(c) && isBodyChapter(c)
      );
      return buildProjectContext(project, bodyChapters, 'project');
    }

    if (source === 'upload' && parsed) {
      const fullText =
        parsed.fullText || (parsed.chapters || []).map((c) => c.content).join('\n');
      const sample = fullText.substring(0, 5000);

      return buildProjectContext(
        null,
        [],
        'upload',
        `Manuscript (${parsed.totalWords?.toLocaleString() || '?'} words, ${
          parsed.chapterCount || '?'
        } chapters):\n\n${sample}`
      );
    }

    return '';
  }, [source, project, chapters, parsed]);

  const ready = source === 'project' ? !!project?.id : !!parsed;

  const generateItem = useCallback(
    async (itemId) => {
      const item = getPubItem(itemId);
      if (!item || !ready) return;

      setGenerating((g) => ({ ...g, [itemId]: true }));

      try {
        const prompt = item.buildPrompt(context, isNF);
        const opts = {
          prompt,
          model: pickModel('publishing'),
          fallback_model: pickFallbackModel('publishing'),
          temperature: 0.7,
        };

        if (item.outputKind === 'json' && item.schema) {
          opts.response_json_schema = item.schema;
        }

        opts.task_type = 'publishing';
        const raw = await invokeLLMWithRetry(opts);

        let value;
        if (item.outputKind === 'json') {
          if (typeof raw === 'string') {
            value = JSON.parse(stripFences(raw));
          } else {
            value = raw;
          }
        } else {
          value = extractText(raw);
          value = postProcessOutput(itemId, value);
        }

        updateItem(itemId, value);
        toast.success(`${item.label} generated`);
      } catch (err) {
        console.error(`[PUBLISHING] Generation failed for ${itemId}:`, err);
        toast.error(`Failed to generate ${item.label}: ${err?.message || 'Unknown error'}`);
      } finally {
        setGenerating((g) => {
          const next = { ...g };
          delete next[itemId];
          return next;
        });
      }
    },
    [context, isNF, ready, updateItem]
  );

  const exportAll = useCallback(() => {
    const lines = [];
    const title = source === 'project' ? project?.title || 'Untitled' : 'Uploaded Manuscript';

    lines.push(`# Publishing Package — ${title}`);
    lines.push('');
    lines.push(`Generated ${new Date().toLocaleDateString()}`);
    lines.push('');

    for (const section of PUB_SECTIONS) {
      const items = getItemsForSection(section.id).filter((it) => packageData[it.id]);
      if (items.length === 0) continue;

      lines.push('');
      lines.push(`## ${section.emoji} ${section.label}`);
      lines.push('');

      for (const item of items) {
        const value = packageData[item.id];
        if (!value) continue;

        lines.push(`### ${item.label}`);
        lines.push('');

        if (typeof value === 'string') {
          lines.push(value);
        } else if (item.id === 'kdp_categories') {
          const cats = value.categories || value;
          for (let i = 0; i < cats.length; i += 1) {
            const c = cats[i];
            lines.push(`${i + 1}. **${c.type}**: ${c.path}`);
            if (c.strategy) lines.push(`   _${c.strategy}_`);
          }
        } else if (item.id === 'kdp_keywords') {
          const kws = value.keywords || value;
          for (let i = 0; i < kws.length; i += 1) {
            const k = kws[i];
            lines.push(`${i + 1}. **${k.keyword}** (${k.keyword.length} chars)`);
            if (k.strategy) lines.push(`   _${k.strategy}_`);
          }
        } else if (item.id === 'title_brainstorm') {
          const titleOptions = value.titles || value;
          for (const t of titleOptions) {
            lines.push(`- **${t.title}**${t.subtitle ? `: ${t.subtitle}` : ''} _(${t.style})_`);
            if (t.reasoning) lines.push(`  ${t.reasoning}`);
          }
        } else if (item.id === 'social_kit') {
          for (const platform of ['twitter', 'instagram', 'tiktok']) {
            const posts = value[platform] || [];
            if (posts.length === 0) continue;

            lines.push(`#### ${platform.charAt(0).toUpperCase() + platform.slice(1)}`);

            for (const p of posts) {
              lines.push(`**${p.type}**: ${p.text || p.caption || p.hook || ''}`);
              if (p.script) lines.push(p.script);
              if (p.hashtags) lines.push(`_Tags: ${p.hashtags}_`);
            }
          }
        } else {
          lines.push('```json');
          lines.push(JSON.stringify(value, null, 2));
          lines.push('```');
        }

        lines.push('');
      }
    }

    if (packageData.isbn_ebook || packageData.isbn_paperback || packageData.isbn_hardcover) {
      lines.push('');
      lines.push('## 📕 ISBN Registry');
      lines.push('');

      if (packageData.isbn_ebook) lines.push(`- **Ebook**: ${packageData.isbn_ebook}`);
      if (packageData.isbn_paperback) lines.push(`- **Paperback**: ${packageData.isbn_paperback}`);
      if (packageData.isbn_hardcover) lines.push(`- **Hardcover**: ${packageData.isbn_hardcover}`);
    }

    if (lines.length <= 4) {
      toast.info('Nothing to export yet — generate some items first.');
      return;
    }

    const content = lines.join('\n');
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');

    a.href = url;
    a.download = (title || 'publishing-package').replace(/[^a-zA-Z0-9]/g, '-') + '.md';

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(() => URL.revokeObjectURL(url), 5000);
    toast.success('Export ready');
  }, [packageData, project, source]);

  const title = source === 'project' ? project?.title || 'Untitled' : 'Uploaded Manuscript';
  const genre = source === 'project' ? project?.genre || 'General' : 'General';

  const toggleSection = (id) => {
    setExpandedSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const sectionCounts = useMemo(() => {
    const out = {};

    for (const sec of PUB_SECTIONS) {
      const items = getItemsForSection(sec.id);

      const generated = items.filter((it) => {
        const v = packageData[it.id];
        if (!v) return false;
        if (typeof v === 'string') return v.trim().length > 0;
        if (Array.isArray(v)) return v.length > 0;
        if (typeof v === 'object') return Object.keys(v).length > 0;
        return false;
      });

      out[sec.id] = { done: generated.length, total: items.length };
    }

    return out;
  }, [packageData]);

  const totalGenerated = Object.values(sectionCounts).reduce((s, c) => s + c.done, 0);

  return (
    <div className="space-y-4 overflow-y-auto h-full pr-1">
      <div>
        <p className="notebook-kicker">Publishing Prep</p>
        <h2 className="font-display text-2xl text-foreground">Publishing Package</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Everything you need to submit to agents, publish on KDP, launch, and track your
          submissions.
          {isNF && (
            <span className="ml-1 text-primary/80">
              Nonfiction mode — prompts tuned for argument-forward content.
            </span>
          )}
        </p>
      </div>

      <SourceSelector
        source={source}
        setSource={(s) => {
          setSource(s);
          setParsed(null);
        }}
        project={project}
      />

      {source === 'upload' && !parsed && (
        <UploadZone onFileSelect={handleFileSelect} uploading={uploading} />
      )}

      {source === 'upload' && parsed && (
        <div className="flex items-center justify-between rounded-xl border border-border/50 bg-card/80 p-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">
              {parsed.totalWords?.toLocaleString()} words · {parsed.chapterCount} chapters
            </span>
            <span className="text-[10px] text-muted-foreground ml-2">
              (upload mode — nothing is saved; use Current Project to persist results)
            </span>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setParsed(null)}
            className="rounded-full text-xs"
          >
            Change File
          </Button>
        </div>
      )}

      {ready && (
        <>
          <TitleGenerator
            project={project}
            chapters={chapters}
            source={source}
            parsed={parsed}
            isNF={isNF}
          />

          <PenNameGenerator
            project={project}
            chapters={chapters}
            source={source}
            parsed={parsed}
            isNF={isNF}
          />

          <div className="flex items-center justify-between flex-wrap gap-2 rounded-2xl border border-border/70 bg-card/80 p-3">
            <div>
              <p className="text-sm font-medium text-foreground">
                {title} <span className="text-muted-foreground text-xs">· {genre}</span>
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {totalGenerated} items generated · {source === 'upload' && 'not saved — '}
                <span className={source === 'upload' ? 'text-amber-600' : 'text-muted-foreground'}>
                  {source === 'upload'
                    ? 'upload mode is ephemeral'
                    : 'saves to this project automatically'}
                </span>
              </p>
            </div>

            {totalGenerated > 0 && (
              <Button
                onClick={exportAll}
                variant="outline"
                size="sm"
                className="rounded-full gap-1.5 text-xs"
              >
                <Download className="h-3.5 w-3.5" /> Export All (.md)
              </Button>
            )}
          </div>

          {PUB_SECTIONS.map((section) => (
            <SectionGroup
              key={section.id}
              section={section}
              expanded={expandedSections[section.id]}
              onToggle={() => toggleSection(section.id)}
              counts={sectionCounts[section.id]}
            >
              {getItemsForSection(section.id).map((item) => (
                <PubItemCard
                  key={item.id}
                  item={item}
                  value={packageData[item.id]}
                  onUpdate={(v) => updateItem(item.id, v)}
                  onGenerate={() => generateItem(item.id)}
                  isGenerating={!!generating[item.id]}
                  isSaving={!!saving[item.id]}
                  isUploadMode={source === 'upload'}
                />
              ))}

              {section.id === 'kdp' && source === 'project' && (
                <IsbnFields
                  ebook={packageData.isbn_ebook || ''}
                  paperback={packageData.isbn_paperback || ''}
                  hardcover={packageData.isbn_hardcover || ''}
                  onChange={(field, value) => updateItem(field, value)}
                  saving={saving}
                />
              )}

              {section.id === 'series' && source === 'project' && (
                <QueryTrackerSection project={project} />
              )}
            </SectionGroup>
          ))}
        </>
      )}
    </div>
  );
}

/* =============================================================================
 * SHARED SAMPLE BUILDER
 * ========================================================================== */

function buildManuscriptSample({ source, project, chapters, parsed }) {
  let sampleText = '';

  if (source === 'project' && chapters?.length) {
    const body = chapters
      .filter((ch) => chapterHasContent(ch) && isBodyChapter(ch))
      .sort((a, b) => (a.chapter_number || 0) - (b.chapter_number || 0));

    const picks = [
      body[0],
      body[Math.floor(body.length * 0.25)],
      body[Math.floor(body.length * 0.5)],
      body[Math.floor(body.length * 0.75)],
      body[body.length - 1],
    ].filter(Boolean);

    for (const ch of picks) {
      const content = ch.content || ch.body || ch.content_md || ch.text || '';
      const label = `CHAPTER ${ch.chapter_number || ''}${ch.title ? ` — ${ch.title}` : ''}`;
      sampleText += `${label}\n${String(content).substring(0, 1800)}\n\n---\n\n`;
    }
  } else if (parsed?.chapters?.length) {
    const picks = [
      parsed.chapters[0],
      parsed.chapters[Math.floor(parsed.chapters.length * 0.25)],
      parsed.chapters[Math.floor(parsed.chapters.length * 0.5)],
      parsed.chapters[Math.floor(parsed.chapters.length * 0.75)],
      parsed.chapters[parsed.chapters.length - 1],
    ].filter(Boolean);

    for (const ch of picks) {
      const label = ch.title ? `CHAPTER — ${ch.title}` : 'CHAPTER SAMPLE';
      sampleText += `${label}\n${String(ch.body || ch.content || '').substring(0, 1800)}\n\n---\n\n`;
    }
  }

  const projectContext =
    source === 'project' && project
      ? [
          `Current/working title: ${project.title || project.title_working || 'Not set'}`,
          `Project type from setup tab: ${
            project.project_type ||
            project.book_type ||
            project.manuscript_type ||
            project.structure_type ||
            'Not set'
          }`,
          `Genre: ${project.genre || 'Unknown'}`,
          `Subgenre: ${project.subgenre || 'Unknown'}`,
          `Premise: ${project.seed_concept || project.description || project.tagline || 'Not set'}`,
          `Tone: ${project.tone || project.tone_style || project.author_voice || 'Not set'}`,
          `Audience: ${project.target_audience || 'Not set'}`,
          `Series info: ${project.series_name || project.series_title || 'Not set'}`,
        ].join('\n')
      : '';

  return {
    projectContext,
    sampleText: String(sampleText || '').substring(0, 9000),
  };
}

function buildAnthologySample({ source, chapters, parsed }) {
  let sampleText = '';

  if (source === 'project' && chapters?.length) {
    const body = chapters
      .filter((ch) => chapterHasContent(ch) && isBodyChapter(ch))
      .sort((a, b) => (a.chapter_number || 0) - (b.chapter_number || 0));

    const maxStories = Math.min(body.length, 14);

    for (let i = 0; i < maxStories; i += 1) {
      const ch = body[i];
      const content = ch.content || ch.body || ch.content_md || ch.text || '';
      const label = `STORY ${i + 1}${ch.title ? ` — ${ch.title}` : ''}`;

      sampleText += `${label}\n`;
      sampleText += String(content).substring(0, 850);
      sampleText += `\n\n---\n\n`;
    }

    return sampleText;
  }

  if (parsed?.chapters?.length) {
    const maxStories = Math.min(parsed.chapters.length, 14);

    for (let i = 0; i < maxStories; i += 1) {
      const ch = parsed.chapters[i];
      const content = ch.body || ch.content || '';
      const label = `STORY ${i + 1}${ch.title ? ` — ${ch.title}` : ''}`;

      sampleText += `${label}\n`;
      sampleText += String(content).substring(0, 850);
      sampleText += `\n\n---\n\n`;
    }

    return sampleText;
  }

  return '';
}

/* =============================================================================
 * BOOK TITLE GENERATOR — v2 premium title doctor
 * ========================================================================== */

const TITLE_BAN_PATTERNS = [
  /^whispers? of/i,
  /^shadows? of/i,
  /^echoes? of/i,
  /^secrets? of/i,
  /^the last\b/i,
  /^beyond the\b/i,
  /^chronicles of/i,
  /^a journey/i,
  /^unveiling\b/i,
  /^in the realm of/i,
  /^threads of/i,
  /^veil of/i,
  /^the hidden\b/i,
  /^the forgotten\b/i,
  /^rise of/i,
  /^legacy of/i,
  /^dance of/i,
  /^song of/i,
  /^heart of/i,
  /^soul of/i,
  /^beneath the\b/i,
  /^where the\b/i,
  /^when the\b/i,
];

const TITLE_WEAK_WORDS = new Set([
  'awakening',
  'reckoning',
  'redemption',
  'resilience',
  'legacy',
  'transformation',
  'journey',
  'secrets',
  'shadows',
  'echoes',
  'whispers',
  'truth',
  'hidden',
  'forgotten',
  'destiny',
  'chronicles',
]);

const TITLE_LANES = [
  'Commercial shelf-grabber',
  'Prestige / literary',
  'Dark / provocative / high-concept',
  'Clean poster-ready',
  'Series-friendly',
  'Wild-card risk title',
];

function titleCaseLite(value = '') {
  const small = new Set(['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'from', 'in', 'into', 'nor', 'of', 'on', 'or', 'the', 'to', 'with']);

  return String(value || '')
    .trim()
    .split(/\s+/)
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (index > 0 && small.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

function titleWordCount(title = '') {
  return String(title || '').trim().split(/\s+/).filter(Boolean).length;
}

function scoreTitleCandidate(item = {}, detectedType = 'fiction') {
  const title = String(item.title || '').trim();
  const subtitle = String(item.subtitle || '').trim();
  const lower = title.toLowerCase();
  const words = titleWordCount(title);
  const flags = [];
  let score = 78;

  if (!title) return { score: 0, flags: ['empty title'] };

  if (words <= 4) score += 8;
  if (words === 1) score += 2;
  if (words > 6) {
    score -= 12;
    flags.push('long main title');
  }

  if (/[,:;!?]/.test(title)) {
    score -= 5;
    flags.push('punctuation-heavy title');
  }

  if (TITLE_BAN_PATTERNS.some((pattern) => pattern.test(title))) {
    score -= 25;
    flags.push('generic AI-title pattern');
  }

  const weakHits = lower
    .split(/[^a-z]+/)
    .filter((word) => TITLE_WEAK_WORDS.has(word));

  if (weakHits.length) {
    score -= weakHits.length * 8;
    flags.push(`weak/generic word: ${weakHits.slice(0, 2).join(', ')}`);
  }

  if (/^(the|a|an)\s+\w+\s+(of|in|from|beneath|beyond)\s+/i.test(title)) {
    score -= 8;
    flags.push('template-like phrasing');
  }

  if (detectedType === 'nonfiction') {
    if (!subtitle) {
      score -= 10;
      flags.push('nonfiction needs a clarifying subtitle');
    }

    if (subtitle && subtitle.length < 28) {
      score -= 4;
      flags.push('subtitle may be too thin for nonfiction');
    }
  }

  if (detectedType === 'anthology' && /^the\s+[a-z]+$/i.test(title)) {
    score -= 7;
    flags.push('may sound like one-story title, not collection umbrella');
  }

  if (/[A-Z][a-z]+\s+[A-Z][a-z]+/.test(title) && detectedType !== 'nonfiction') {
    score -= 3;
    flags.push('proper-name title may be less marketable');
  }

  if (/\b(dead|blood|mercy|needle|absence|broadcast|ledger|index|machine|floor|summit|shadow|grave|witness|hostile|design)\b/i.test(title)) {
    score += 5;
  }

  score = Math.max(1, Math.min(99, score));

  return { score, flags };
}

function dedupeTitleCandidates(items = []) {
  const seen = new Set();
  const out = [];

  for (const item of items) {
    const key = String(item?.title || '').trim().toLowerCase().replace(/^the\s+/, '');
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }

  return out;
}

function parseTitleJsonPayload(responseText) {
  const raw = stripFences(extractText(responseText));

  try {
    const parsedJson = JSON.parse(raw);
    return Array.isArray(parsedJson) ? parsedJson : parsedJson?.titles || [];
  } catch {
    const firstBracket = raw.indexOf('[');
    const lastBracket = raw.lastIndexOf(']');

    if (firstBracket >= 0 && lastBracket > firstBracket) {
      const sliced = raw.slice(firstBracket, lastBracket + 1);
      const parsedJson = JSON.parse(sliced);
      return Array.isArray(parsedJson) ? parsedJson : parsedJson?.titles || [];
    }

    throw new Error('The title engine returned non-JSON output.');
  }
}

function buildLocalFallbackTitles({ detectedType, project, isNF }) {
  const baseTitle = String(project?.title || project?.title_working || '').trim();
  const genre = String(project?.genre || project?.subgenre || '').toLowerCase();
  const seed = String(project?.seed_concept || project?.description || project?.tagline || '').toLowerCase();

  const fictionBank = [
    ['False Mercy', 'A novel of lies, loyalty, and the cost of surviving the truth'],
    ['The Mercy Defect', 'A novel'],
    ['Bad Weather Inside', 'A novel'],
    ['The Room That Lied', 'A novel'],
    ['Grief Index', 'A novel'],
    ['The Quiet Damage', 'A novel'],
    ['No Safe Room', 'A novel'],
    ['The Last Honest Thing', 'A novel'],
    ['Soft Teeth', 'A novel'],
    ['The Wrong Door Opens', 'A novel'],
    ['Everything Keeps Breathing', 'A novel'],
    ['The Beautiful Problem', 'A novel'],
    ['After the Signal', 'A novel'],
    ['A House Full of Static', 'A novel'],
    ['The Shape of the Lie', 'A novel'],
    ['What Came Through', 'A novel'],
  ];

  const nonfictionBank = [
    ['Hostile Design', 'How ordinary spaces quietly control who gets to stay, rest, gather, and belong'],
    ['The Permission Machine', 'How institutions turn human need into paperwork, delay, and obedience'],
    ['Public Things', 'How benches, clocks, doors, and rules teach us who a city is really for'],
    ['The Quiet Lock', 'What official records leave out when institutions protect themselves'],
    ['Designed to Move You', 'How public space became a system of behavioral control'],
    ['The Record Has Teeth', 'How archives, omissions, and official language shape what we are allowed to know'],
    ['No Place to Sit', 'The hidden architecture of exclusion in modern public life'],
    ['The Managed Body', 'How systems discipline people through design, policy, and silence'],
    ['Paper Mercy', 'How bureaucracies turn care into compliance'],
    ['The Door Was Locked', 'A history of institutional silence, public memory, and the facts left unresolved'],
    ['Until Further Notice', 'How emergency powers become ordinary government'],
    ['The City Wants You Moving', 'How hostile architecture reshaped public life'],
    ['The Built Command', 'How design became a language of control'],
    ['The Omission Ledger', 'What official stories hide, flatten, and forget'],
    ['A System of Small Cruelties', 'How rules, rooms, and routines shape human behavior'],
    ['The Administrative Silence', 'How institutions write around the truth'],
  ];

  const anthologyBank = [
    ['Rooms That Remember', 'Stories'],
    ['Every Door Is Hungry', 'Collected Stories'],
    ['The Wrong Things We Kept', 'Stories'],
    ['Soft Monsters', 'A Story Collection'],
    ['Instructions for Bad Weather', 'Stories'],
    ['People Leave Things Behind', 'Collected Stories'],
    ['The Shape of Small Disasters', 'Stories'],
    ['Mouths Full of Static', 'Stories'],
    ['All the Rooms Are Watching', 'Stories'],
    ['Unnatural Amenities', 'A Story Collection'],
    ['The House Always Wins', 'Stories'],
    ['Little Systems of Ruin', 'Collected Stories'],
    ['The Last Room on the Left', 'Stories'],
    ['Objects in a Bad Light', 'Stories'],
    ['A Manual for Strange Damage', 'Stories'],
    ['The Things That Followed Us Home', 'Stories'],
  ];

  const bank = detectedType === 'anthology' ? anthologyBank : isNF || detectedType === 'nonfiction' ? nonfictionBank : fictionBank;

  return bank.map(([title, subtitle], index) => ({
    title: baseTitle && index === 0 && baseTitle.length > 3 ? baseTitle : title,
    subtitle,
    category: TITLE_LANES[index % TITLE_LANES.length],
    rationale:
      detectedType === 'anthology'
        ? 'Built as an umbrella title rather than a single-story label, with room for multiple tones and plots.'
        : isNF
          ? 'Built as a trade nonfiction title/subtitle pair with a clear argument, stakes, and shelf signal.'
          : 'Built for cover impact, genre signal, and stronger memorability than a generic plot summary.',
  }));
}

function TitleGenerator({ project, chapters, source, parsed, isNF }) {
  const [generating, setGenerating] = useState(false);
  const [titles, setTitles] = useState([]);
  const [copied, setCopied] = useState(null);
  const [lastModel, setLastModel] = useState('');
  const [lastRunNote, setLastRunNote] = useState('');

  const detectedType = detectPublishingProjectType(project, isNF);

  const normalizeTitleResult = (item, index) => {
    const title = titleCaseLite(String(item?.title || '').trim());
    const subtitle = String(item?.subtitle || '').trim();
    const rationale = String(item?.rationale || item?.why || item?.reasoning || '').trim();
    const category = String(item?.category || item?.lane || '').trim();
    const rawStyle = String(item?.style || '').trim();
    const { score, flags } = scoreTitleCandidate({ title, subtitle }, detectedType);

    return {
      title,
      subtitle,
      rationale,
      category: category || rawStyle || TITLE_LANES[index % TITLE_LANES.length],
      score,
      flags,
    };
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setTitles([]);
    setLastRunNote('');

    try {
      const isAnthology = detectedType === 'anthology';

      let projectContext = '';
      let sampleText = '';

      if (isAnthology) {
        sampleText = buildAnthologySample({ source, chapters, parsed });

        projectContext =
          source === 'project' && project
            ? [
                `Current/working title: ${project.title || project.title_working || 'Not set'}`,
                `Project type from setup tab: ${
                  project.project_type ||
                  project.book_type ||
                  project.manuscript_type ||
                  project.structure_type ||
                  'Anthology / collection inferred'
                }`,
                `Genre: ${project.genre || 'Unknown'}`,
                `Subgenre: ${project.subgenre || 'Unknown'}`,
                `Premise / collection concept: ${
                  project.seed_concept || project.description || project.tagline || 'Not set'
                }`,
                `Tone: ${project.tone || project.tone_style || project.author_voice || 'Not set'}`,
                `Audience: ${project.target_audience || 'Not set'}`,
                `Series info: ${project.series_name || project.series_title || 'Not set'}`,
              ].join('\n')
            : 'Uploaded anthology or story collection.';
      } else {
        const built = buildManuscriptSample({ source, project, chapters, parsed });
        projectContext = built.projectContext;
        sampleText = built.sampleText;
      }

      const projectModeRules = isAnthology
        ? `ANTHOLOGY / STORY COLLECTION TITLE RULES:
- This project is an anthology or story collection. Title the whole collection, not a single story.
- The main title must capture the umbrella: recurring image, recurring wound, shared mood, moral pattern, setting pattern, genre promise, or emotional aftertaste.
- Do not title the book after one character, one location, one chapter event, or one plot twist unless that element clearly represents the whole collection.
- Good anthology titles imply plurality, recurrence, pattern, or a curated set of dangerous/strange/emotional situations.
- Subtitle may use Stories, Collected Stories, A Story Collection, Tales, Dispatches, Cases, Reports, or a sharper genre-specific equivalent.
- At least 10 options must clearly feel like collection titles.`
        : isNF
          ? `NONFICTION TITLE RULES:
- Main title should feel like trade nonfiction, not an academic paper, SEO blog, or bland self-help workbook.
- Main title can be metaphorical, accusatory, ironic, ominous, thesis-driven, or object-driven.
- Subtitle must clarify the subject, stakes, argument, and reader payoff.
- The best nonfiction pair creates a hook/title plus an explanatory subtitle.
- Avoid "A Guide to" unless the project is truly a practical guide.
- Avoid generic virtue words like resilience, transformation, healing, purpose, mindset, success.`
          : `FICTION TITLE RULES:
- Main title should sound like a real novel with cover impact.
- Subtitle should be optional; use it only for series identity, genre signal, or useful positioning.
- Do not explain the plot in the subtitle.
- Avoid "A Novel" unless the title genuinely needs the category signal.
- Favor contradiction, menace, emotional voltage, strange objects, loaded places, or unforgettable phrases.`;

      const response = await invokeLLMWithRetry({
        task_type: 'prose',
        model: pickModel('creative'),
        fallback_model: pickFallbackModel('creative'),
        temperature: 1.18,
        max_tokens: 5200,
        prompt: `You are a ruthless senior acquisitions editor, title doctor, bookstore buyer, and cover-positioning strategist.

Your job is NOT to generate pretty title-ish phrases. Your job is to produce marketable titles that could survive a real publishing meeting.

PROJECT TYPE: ${detectedType.toUpperCase()}

${projectModeRules}

PROJECT CONTEXT:
${projectContext || 'No project metadata available.'}

TITLE QUALITY STANDARD:
- Generate titles with real shelf power: specific, memorable, strange enough to remember, easy enough to say.
- Avoid bland AI phrases, obvious summaries, and empty abstractions.
- Prefer concrete nouns, loaded objects, institutional phrases, contradictions, threats, locations, sensory hooks, moral pressure, and images from the manuscript.
- The best titles usually have friction: beautiful + ugly, bureaucratic + intimate, sacred + profane, ordinary + impossible, innocent + dangerous.
- Main titles should usually be 1–4 words. Longer is allowed only if the rhythm is excellent.
- At least 8 options must be bold enough to make someone click or pick up the book.
- At least 6 options must be conceptually different from every other option.
- At least 5 options must NOT directly name the obvious subject, villain, setting, event, or plot mechanism.
- At least 4 options must be cover-design-friendly: short, visual, and typographically strong.
- At least 3 options must feel risky or provocative.

HARD BAN LIST:
Do not use or closely imitate these lazy patterns:
Whispers of, Shadows of, Echoes of, Secrets of, The Last, Beyond the, Chronicles of, A Journey Through, Unveiling, In the Realm of, Threads of, Veil of, The Hidden, The Forgotten, Rise of, Legacy of, Dance of, Song of, Heart of, Soul of, Where the, When the, Beneath the.

Also avoid generic one-word titles:
Awakening, Reckoning, Redemption, Resilience, Legacy, Transformation, Destiny, Truth, Secrets, Shadows, Echoes.

OUTPUT LANES:
Generate exactly 24 options so the app can rank and filter them.
1-4 = Commercial shelf-grabbers
5-8 = Prestige / literary
9-12 = Dark / provocative / high-concept
13-16 = Clean poster-ready
17-20 = Series-friendly / franchise-capable
21-24 = Wild-card risk titles

For every option return:
- title: main title only
- subtitle: subtitle or series line; use empty string only if stronger alone
- category: one of the lanes above
- rationale: one sharp sentence explaining the hook, market fit, and manuscript fit

Return ONLY a valid JSON array. No markdown. No backticks. No commentary.

MANUSCRIPT / STORY SAMPLES:
${String(sampleText || '').substring(0, 10000)}`,
      });

      const parsedTitles = dedupeTitleCandidates(parseTitleJsonPayload(response).map(normalizeTitleResult))
        .sort((a, b) => b.score - a.score)
        .slice(0, 16);

      if (!parsedTitles.length) {
        throw new Error('No usable title suggestions returned.');
      }

      const strongCount = parsedTitles.filter((item) => item.score >= 82).length;

      setTitles(parsedTitles);
      setLastModel(pickModel('creative'));
      setLastRunNote(
        strongCount >= 8
          ? `${strongCount} strong candidates survived the bland-title filter.`
          : `${strongCount} strong candidates survived; weaker items are flagged so you can avoid them.`
      );
    } catch (err) {
      console.error('[TITLE-GEN] Error:', err);

      const fallback = buildLocalFallbackTitles({ detectedType, project, isNF })
        .map(normalizeTitleResult)
        .sort((a, b) => b.score - a.score)
        .slice(0, 16);

      setTitles(fallback);
      setLastModel('local-title-doctor-fallback');
      setLastRunNote('LLM generation failed or returned malformed output; local premium fallback titles were used.');
      toast.warning('Title engine used local fallback: ' + (err?.message || 'unknown error'));
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = (title, subtitle, idx) => {
    const text = subtitle ? `${title}: ${subtitle}` : title;
    navigator.clipboard.writeText(text);
    setCopied(idx);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="rounded-2xl border border-border/70 bg-card/80 p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-amber-600" /> Book Title Generator
          </h3>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Premium title doctor: ranks titles, flags bland AI patterns, and generates stronger
            title/subtitle pairs from manuscript DNA and market positioning.
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">
            Detected setup type:{' '}
            <span className="font-semibold text-foreground">
              {detectedType === 'anthology'
                ? 'Anthology / Story Collection'
                : detectedType === 'nonfiction'
                  ? 'Nonfiction'
                  : 'Fiction'}
            </span>
            {lastModel && <span className="ml-2">· Engine: {lastModel}</span>}
          </p>
        </div>

        <Button
          onClick={handleGenerate}
          disabled={generating}
          size="sm"
          className="rounded-full gap-1.5 text-xs"
        >
          {generating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          {generating
            ? detectedType === 'anthology'
              ? 'Finding umbrella titles…'
              : 'Title doctoring…'
            : titles.length > 0
              ? 'Regenerate Stronger Titles'
              : detectedType === 'anthology'
                ? 'Generate Anthology Titles'
                : 'Generate Premium Titles'}
        </Button>
      </div>

      {lastRunNote && (
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-[10px] text-emerald-800 dark:text-emerald-200">
          {lastRunNote}
        </div>
      )}

      {detectedType === 'anthology' && (
        <div className="rounded-xl border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-[10px] text-violet-800 dark:text-violet-200">
          Anthology mode is active. The generator will look for the umbrella theme across the
          sampled stories instead of titling the book after one individual story.
        </div>
      )}

      {titles.length > 0 && (
        <div className="space-y-2">
          {titles.map((t, i) => (
            <div
              key={`${t.title}-${i}`}
              className="flex items-start justify-between gap-2 rounded-xl border border-border/40 bg-background/60 px-3 py-2.5 hover:bg-secondary/30 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="mb-1 flex flex-wrap items-center gap-1.5">
                  {t.category && (
                    <div className="text-[9px] font-bold uppercase tracking-[0.16em] text-amber-600/80">
                      {t.category}
                    </div>
                  )}
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${
                      t.score >= 88
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                        : t.score >= 78
                          ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                          : 'bg-red-500/15 text-red-700 dark:text-red-300'
                    }`}
                  >
                    {t.score}/100
                  </span>
                </div>

                <div className="text-base font-semibold text-foreground leading-tight">
                  {t.title}
                </div>

                {t.subtitle && (
                  <div className="mt-0.5 text-xs text-muted-foreground italic leading-snug">
                    {t.subtitle}
                  </div>
                )}

                {t.rationale && (
                  <div className="text-[10px] text-muted-foreground mt-1 leading-snug">
                    {t.rationale}
                  </div>
                )}

                {t.flags?.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {t.flags.slice(0, 3).map((flag, flagIndex) => (
                      <span
                        key={flagIndex}
                        className="rounded-full bg-red-500/10 px-1.5 py-0.5 text-[9px] text-red-700 dark:text-red-300"
                      >
                        {flag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={() => handleCopy(t.title, t.subtitle, i)}
                className="shrink-0 p-1.5 rounded-lg hover:bg-secondary/60 transition-colors"
                title="Copy title + subtitle"
              >
                {copied === i ? (
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* =============================================================================
 * PEN NAME GENERATOR
 * ========================================================================== */

function PenNameGenerator({ project, chapters, source, parsed, isNF }) {
  const [generating, setGenerating] = useState(false);
  const [names, setNames] = useState([]);
  const [copied, setCopied] = useState(null);

  const parsePenPayload = (responseText) => {
    const raw = stripFences(extractText(responseText));

    try {
      const parsedJson = JSON.parse(raw);
      return Array.isArray(parsedJson) ? parsedJson : parsedJson?.names || [];
    } catch {
      const firstBracket = raw.indexOf('[');
      const lastBracket = raw.lastIndexOf(']');

      if (firstBracket >= 0 && lastBracket > firstBracket) {
        const sliced = raw.slice(firstBracket, lastBracket + 1);
        const parsedJson = JSON.parse(sliced);
        return Array.isArray(parsedJson) ? parsedJson : parsedJson?.names || [];
      }

      throw new Error('The pen name engine returned non-JSON output.');
    }
  };

  const normalizePenResult = (item, index) => ({
    name: String(item?.name || '').trim(),
    initialsVariant: String(item?.initialsVariant || item?.initials_variant || '').trim(),
    category: String(item?.category || item?.lane || `Option ${index + 1}`).trim(),
    persona: String(item?.persona || '').trim(),
    authorBio: String(item?.authorBio || item?.author_bio || '').trim(),
    bestFor: String(item?.bestFor || item?.best_for || '').trim(),
    riskNotes: String(item?.riskNotes || item?.risk_notes || '').trim(),
    availabilityChecks: Array.isArray(item?.availabilityChecks || item?.availability_checks)
      ? item.availabilityChecks || item.availability_checks
      : [],
  });

  const handleGenerate = async () => {
    setGenerating(true);
    setNames([]);

    try {
      const { projectContext, sampleText } = buildManuscriptSample({
        source,
        project,
        chapters,
        parsed,
      });

      const modeRules = isNF
        ? `NONFICTION PEN NAME RULES:
- Names should sound credible, intelligent, and shelf-ready for serious nonfiction.
- Avoid names that sound like fake gurus, internet marketers, or over-polished consultants.
- Persona should support authority without pretending to hold credentials not provided.
- Bio must be tasteful, general, and safe to customize.`
        : `FICTION PEN NAME RULES:
- Names should sound memorable on a novel cover without feeling cartoonish.
- Genre fit matters: thriller, romance, horror, sci-fi, literary, cozy, fantasy, and historical names should feel different.
- Persona should help shape cover branding, author website tone, and reader expectation.
- Avoid names that sound too obviously generated.`;

      const response = await invokeLLMWithRetry({
        task_type: 'publishing',
        model: pickModel('creative'),
        fallback_model: pickFallbackModel('creative'),
        temperature: 1.08,
        max_tokens: 4200,
        prompt: `You are a senior publishing brand strategist creating author pen names and author personas.

Critical truth:
You cannot actually verify live publication history, Amazon listings, Goodreads pages, domains, social handles, trademark records, or ISBN records. Therefore, your job is to generate realistic LOW-COLLISION pen names that are unlikely to be famous, overused, or already strongly associated with a known author — and to provide the exact availability checks the user should perform before using one.

Goal:
Generate author pen names that feel real, memorable, commercially usable, and genre-aware. They should NOT feel like fantasy NPCs, romance bots, fake influencer names, generic AI names, or obvious celebrity mashups.

${modeRules}

PROJECT CONTEXT:
${projectContext || 'No project metadata available.'}

MANUSCRIPT SAMPLE:
${sampleText}

QUALITY BAR:
- Generate exactly 16 pen name options.
- Names must feel like real humans who could plausibly publish books.
- Names should be unique enough to search well, but not bizarre.
- Favor uncommon surname/first-name pairings, subtle rhythm, and cover-friendly sound.
- Avoid names that are too famous-sounding, too cute, too symbolic, or too on-the-nose.
- Avoid initials-only names unless they genuinely improve market fit.
- Avoid names that resemble famous authors, actors, politicians, musicians, influencers, or known public figures.
- Avoid painfully generic names like John Smith, Sarah Miller, Emily Stone, Jack Morgan, Alex Carter, Rebecca Blake, James Hunter, etc.
- Avoid overused thriller/romance pen-name clichés: Blake, Steele, Knight, Wilder, Storm, Hunter, Chase, Raven, Wolf, Blackwood, Sterling, Ash, Cross, unless used in a genuinely fresh way.
- Avoid names that imply protected identities, credentials, or backgrounds not provided.
- Avoid making claims about ethnicity, nationality, religion, military service, medical credentials, legal credentials, or lived experience.
- Persona should be brand flavor, not fake biography.

OUTPUT LANES:
1-4 = commercial mainstream / broadly marketable
5-8 = darker / thriller / horror / noir / speculative
9-12 = literary / prestige / intelligent nonfiction
13-16 = clean, memorable, series-friendly brand names

For each option:
- name: full pen name
- initialsVariant: an optional initials-based cover version, or empty string
- category: one of the four lanes above
- persona: 1 sentence describing the brand/persona feel
- authorBio: 1 short, tasteful author bio line that does NOT make unverifiable credential claims
- bestFor: what kind of books this name best fits
- riskNotes: short note about why it may or may not be safe/usable
- availabilityChecks: 4 exact search checks the user should run

Return ONLY a valid JSON array. No markdown. No commentary. No backticks.`,
      });

      const parsedNames = parsePenPayload(response)
        .map(normalizePenResult)
        .filter((item) => item.name)
        .slice(0, 16);

      if (!parsedNames.length) {
        throw new Error('No usable pen names returned.');
      }

      setNames(parsedNames);
    } catch (err) {
      console.error('[PEN-NAME-GEN] Error:', err);
      toast.error('Pen name generation failed: ' + (err?.message || 'unknown error'));
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = (item, idx) => {
    const lines = [
      item.name,
      item.initialsVariant ? `Cover variant: ${item.initialsVariant}` : '',
      item.persona ? `Persona: ${item.persona}` : '',
      item.authorBio ? `Bio: ${item.authorBio}` : '',
      item.bestFor ? `Best for: ${item.bestFor}` : '',
      item.riskNotes ? `Risk notes: ${item.riskNotes}` : '',
    ].filter(Boolean);

    navigator.clipboard.writeText(lines.join('\n'));
    setCopied(idx);
    toast.success('Pen name copied');
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="rounded-2xl border border-border/70 bg-card/80 p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <UserRound className="h-4 w-4 text-violet-600" /> Pen Name Generator
          </h3>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Creates realistic, genre-aware author personas and low-collision pen names.
            Availability still needs live manual checking.
          </p>
        </div>

        <Button
          onClick={handleGenerate}
          disabled={generating}
          size="sm"
          className="rounded-full gap-1.5 text-xs"
        >
          {generating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          {generating ? 'Branding names…' : names.length > 0 ? 'Regenerate' : 'Generate Pen Names'}
        </Button>
      </div>

      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[10px] text-amber-800 dark:text-amber-200">
        No generator can prove a pen name is unused without live checks. Treat these as strong
        candidates, then verify Amazon, Goodreads, Google exact-match results, domains, and social
        handles before publishing.
      </div>

      {names.length > 0 && (
        <div className="space-y-2">
          {names.map((item, i) => (
            <div
              key={`${item.name}-${i}`}
              className="rounded-xl border border-border/40 bg-background/60 px-3 py-2.5 hover:bg-secondary/30 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  {item.category && (
                    <div className="mb-1 text-[9px] font-bold uppercase tracking-[0.16em] text-violet-600/80">
                      {item.category}
                    </div>
                  )}

                  <div className="text-base font-semibold text-foreground leading-tight">
                    {item.name}
                  </div>

                  {item.initialsVariant && (
                    <div className="mt-0.5 text-xs text-muted-foreground italic leading-snug">
                      Cover variant: {item.initialsVariant}
                    </div>
                  )}

                  {item.persona && (
                    <div className="text-[10px] text-muted-foreground mt-1 leading-snug">
                      <strong>Persona:</strong> {item.persona}
                    </div>
                  )}

                  {item.authorBio && (
                    <div className="text-[10px] text-muted-foreground mt-1 leading-snug">
                      <strong>Bio:</strong> {item.authorBio}
                    </div>
                  )}

                  {item.bestFor && (
                    <div className="text-[10px] text-muted-foreground mt-1 leading-snug">
                      <strong>Best for:</strong> {item.bestFor}
                    </div>
                  )}

                  {item.riskNotes && (
                    <div className="text-[10px] text-amber-700 dark:text-amber-300 mt-1 leading-snug">
                      <strong>Risk:</strong> {item.riskNotes}
                    </div>
                  )}

                  {item.availabilityChecks?.length > 0 && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-[10px] font-semibold text-muted-foreground hover:text-foreground">
                        Availability checks
                      </summary>
                      <ul className="mt-1 ml-4 list-disc space-y-0.5 text-[10px] text-muted-foreground">
                        {item.availabilityChecks.map((check, checkIndex) => (
                          <li key={checkIndex}>{check}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>

                <button
                  onClick={() => handleCopy(item, i)}
                  className="shrink-0 p-1.5 rounded-lg hover:bg-secondary/60 transition-colors"
                  title="Copy pen name package"
                >
                  {copied === i ? (
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* =============================================================================
 * SECTION GROUP
 * ========================================================================== */

function SectionGroup({ section, expanded, onToggle, counts, children }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card/80 backdrop-blur-sm overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/30 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
          <span className="text-xl">{section.emoji}</span>
          <div className="text-left min-w-0">
            <h3 className="font-display text-base text-foreground">{section.label}</h3>
            <p className="text-[11px] text-muted-foreground truncate">{section.description}</p>
          </div>
        </div>
        {counts && counts.total > 0 && (
          <span className="text-[10px] text-muted-foreground font-mono whitespace-nowrap ml-2">
            {counts.done}/{counts.total}
          </span>
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-2 border-t border-border/30 pt-3">{children}</div>
      )}
    </div>
  );
}

/* =============================================================================
 * PUB ITEM CARD
 * ========================================================================== */

function PubItemCard({ item, value, onUpdate, onGenerate, isGenerating, isSaving, isUploadMode }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const hasValue = !!(
    value &&
    ((typeof value === 'string' && value.trim()) ||
      (Array.isArray(value) && value.length > 0) ||
      (typeof value === 'object' && Object.keys(value).length > 0))
  );

  const handleCopy = () => {
    let textToCopy = '';

    if (typeof value === 'string') {
      textToCopy = value;
    } else if (value) {
      textToCopy = JSON.stringify(value, null, 2);
    }

    if (!textToCopy) return;

    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl border border-border/50 bg-background/60 p-3">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-base shrink-0">{item.emoji}</span>
            <span className="text-sm font-medium text-foreground">{item.label}</span>
            {isSaving && (
              <span className="flex items-center gap-1 text-[9px] text-muted-foreground">
                <Loader2 className="h-2.5 w-2.5 animate-spin" /> saving
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">{item.description}</p>
        </div>

        <div className="flex items-center gap-1.5">
          {hasValue && (
            <>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setExpanded((e) => !e)}
                className="h-7 w-7 p-0"
                title={expanded ? 'Collapse' : 'Expand'}
              >
                {expanded ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={handleCopy}
                className="rounded-full gap-1 text-[10px] h-7 px-3"
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </>
          )}

          <Button
            size="sm"
            variant={hasValue ? 'ghost' : 'secondary'}
            onClick={onGenerate}
            disabled={isGenerating}
            className="rounded-full gap-1 text-[10px] h-7 px-3"
          >
            {isGenerating ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Sparkles className="h-3 w-3" />
            )}
            {hasValue ? 'Regenerate' : 'Generate'}
          </Button>
        </div>
      </div>

      {hasValue && (
        <div className="mt-3 border-t border-border/30 pt-3">
          <ItemEditor item={item} value={value} onUpdate={onUpdate} expanded={expanded} />
        </div>
      )}

      {isUploadMode && !hasValue && (
        <p className="mt-2 text-[10px] text-amber-600 dark:text-amber-500 flex items-start gap-1">
          <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" /> Upload mode: this result
          won't be saved.
        </p>
      )}
    </div>
  );
}

/* =============================================================================
 * ITEM EDITOR
 * ========================================================================== */

function ItemEditor({ item, value, onUpdate, expanded }) {
  if (item.outputKind === 'html') {
    return (
      <HtmlEditor value={value || ''} onUpdate={onUpdate} target={item.target} expanded={expanded} />
    );
  }

  if (item.outputKind === 'json') {
    if (item.id === 'kdp_keywords') return <KeywordsEditor value={value} onUpdate={onUpdate} />;
    if (item.id === 'kdp_categories') return <CategoriesEditor value={value} onUpdate={onUpdate} />;
    if (item.id === 'title_brainstorm') {
      return <TitleBrainstormEditor value={value} onUpdate={onUpdate} />;
    }
    if (item.id === 'social_kit') return <SocialKitEditor value={value} onUpdate={onUpdate} />;
    if (item.id === 'launch_checklist') {
      return <ChecklistEditor value={value} onUpdate={onUpdate} />;
    }

    return (
      <textarea
        value={JSON.stringify(value, null, 2)}
        onChange={(e) => {
          try {
            onUpdate(JSON.parse(e.target.value));
          } catch {
            // wait for valid JSON
          }
        }}
        className="w-full rounded-lg border border-border/40 bg-background/50 p-3 text-xs font-mono resize-y min-h-[120px]"
      />
    );
  }

  return <TextEditor value={value || ''} onUpdate={onUpdate} target={item.target} expanded={expanded} />;
}

/* =============================================================================
 * TEXT EDITOR
 * ========================================================================== */

function TextEditor({ value, onUpdate, target, expanded }) {
  const words = countWords(value);
  const chars = (value || '').length;
  const targetHit = targetMet(target, words, chars);

  return (
    <div className="space-y-1.5">
      <textarea
        value={value}
        onChange={(e) => onUpdate(e.target.value)}
        className={`w-full rounded-lg border border-border/40 bg-white/50 dark:bg-muted/30 p-3 text-sm leading-7 text-foreground resize-y focus:outline-none focus:ring-1 focus:ring-primary/40 transition-all ${
          expanded ? 'min-h-[400px]' : 'min-h-[120px]'
        }`}
      />
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>
          {words.toLocaleString()} words · {chars.toLocaleString()} chars
        </span>
        {target && (
          <span
            className={`font-medium ${
              targetHit === true
                ? 'text-green-600 dark:text-green-500'
                : targetHit === false
                  ? 'text-amber-600 dark:text-amber-500'
                  : 'text-muted-foreground'
            }`}
          >
            {formatTarget(target)}
          </span>
        )}
      </div>
    </div>
  );
}

function targetMet(target, words, chars) {
  if (!target) return null;

  const value = target.kind === 'chars' ? chars : words;
  const min = target.min || 0;
  const max = target.max || Infinity;

  if (value < min) return false;
  if (value > max) return false;

  return true;
}

function formatTarget(target) {
  const label = target.kind === 'chars' ? 'chars' : 'words';
  if (target.min && target.max) return `target: ${target.min}–${target.max} ${label}`;
  if (target.max) return `max: ${target.max} ${label}`;
  if (target.min) return `min: ${target.min} ${label}`;
  return '';
}

/* =============================================================================
 * HTML EDITOR
 * ========================================================================== */

function HtmlEditor({ value, onUpdate, target, expanded }) {
  const [showRaw, setShowRaw] = useState(false);
  const chars = (value || '').length;
  const overLimit = target && target.max && chars > target.max;
  const targetHit = target && target.max && chars <= target.max && chars > target.max - 800;

  return (
    <div className="space-y-2">
      <div
        className={`w-full rounded-lg border border-border/40 bg-white/50 dark:bg-muted/30 p-4 text-sm leading-7 text-foreground overflow-y-auto ${
          expanded ? 'max-h-[600px]' : 'max-h-[220px]'
        }`}
        dangerouslySetInnerHTML={{ __html: value }}
      />
      <div className="flex items-center justify-between">
        <span
          className={`text-[10px] ${
            overLimit
              ? 'text-red-600 font-semibold'
              : targetHit
                ? 'text-green-600'
                : 'text-muted-foreground'
          }`}
        >
          {chars.toLocaleString()} characters
          {target && target.max && ` / ${target.max.toLocaleString()} max (KDP limit)`}
          {overLimit && ' — OVER LIMIT, must shorten'}
        </span>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setShowRaw((r) => !r)}
          className="text-[10px] h-6 px-2"
        >
          {showRaw ? 'Hide' : 'Edit'} raw HTML
        </Button>
      </div>

      {showRaw && (
        <textarea
          value={value}
          onChange={(e) => onUpdate(e.target.value)}
          className="w-full rounded-lg border border-border/40 bg-white/50 dark:bg-muted/30 p-3 text-xs font-mono leading-6 resize-y min-h-[200px]"
        />
      )}
    </div>
  );
}

/* =============================================================================
 * KEYWORDS EDITOR
 * ========================================================================== */

function KeywordsEditor({ value, onUpdate }) {
  const keywords = value?.keywords || (Array.isArray(value) ? value : []);

  const updateKeyword = (index, field, newValue) => {
    const next = [...keywords];
    next[index] = { ...next[index], [field]: newValue };
    onUpdate({ keywords: next });
  };

  return (
    <div className="space-y-2">
      {keywords.map((kw, i) => {
        const len = (kw.keyword || '').length;
        const over = len > 50;
        const pct = Math.min(100, (len / 50) * 100);

        return (
          <div key={i} className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-muted-foreground w-5 shrink-0">
                #{i + 1}
              </span>
              <input
                type="text"
                value={kw.keyword || ''}
                onChange={(e) => updateKeyword(i, 'keyword', e.target.value)}
                className={`flex-1 text-xs bg-transparent border-b ${
                  over ? 'border-red-500' : 'border-border/50'
                } py-1 focus:outline-none focus:border-primary/60`}
              />
              <span
                className={`text-[10px] font-mono shrink-0 ${
                  over
                    ? 'text-red-600 font-bold'
                    : len > 42
                      ? 'text-amber-600'
                      : 'text-muted-foreground'
                }`}
              >
                {len}/50
              </span>
            </div>
            <div className="h-0.5 bg-secondary/40 rounded-full overflow-hidden ml-7 mr-14">
              <div
                className={`h-full transition-all ${
                  over ? 'bg-red-500' : len > 42 ? 'bg-amber-500' : 'bg-green-500'
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
            {kw.strategy && (
              <p className="text-[10px] italic text-muted-foreground ml-7">{kw.strategy}</p>
            )}
          </div>
        );
      })}

      {keywords.some((k) => (k.keyword || '').length > 50) && (
        <div className="rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-300/60 p-2 mt-2">
          <p className="text-[10px] text-red-700 dark:text-red-400 flex items-start gap-1">
            <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
            One or more keywords exceed Amazon's 50-character limit. Amazon will reject these
            when you paste them into KDP.
          </p>
        </div>
      )}
    </div>
  );
}

/* =============================================================================
 * CATEGORIES EDITOR
 * ========================================================================== */

function CategoriesEditor({ value, onUpdate }) {
  const categories = value?.categories || (Array.isArray(value) ? value : []);

  const copyAll = () => {
    const text = categories.map((c) => c.path).join('\n');
    navigator.clipboard.writeText(text);
    toast.success('All category paths copied');
  };

  const typeBadge = (type) => {
    const t = (type || '').toLowerCase();

    if (t.includes('both')) {
      return {
        label: 'Both',
        cls: 'bg-purple-500/15 text-purple-700 dark:text-purple-300',
      };
    }

    if (t.includes('paper') || t.includes('print')) {
      return {
        label: 'Print',
        cls: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
      };
    }

    return {
      label: 'Kindle',
      cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
    };
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <Button
          size="sm"
          variant="outline"
          onClick={copyAll}
          className="rounded-full gap-1 text-[10px] h-6 px-2"
        >
          <Copy className="h-3 w-3" /> Copy all paths
        </Button>
      </div>

      {categories.map((cat, i) => {
        const badge = typeBadge(cat.type);

        return (
          <div
            key={i}
            className="flex items-start gap-2 rounded-lg border border-border/40 bg-background/60 px-3 py-2"
          >
            <span className="text-[10px] font-bold text-muted-foreground mt-0.5 w-4 shrink-0">
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${badge.cls}`}
                >
                  {badge.label}
                </span>
                <span className="text-xs font-medium text-foreground break-all">
                  {cat.path}
                </span>
              </div>
              {cat.strategy && (
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-4">
                  {cat.strategy}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* =============================================================================
 * TITLE BRAINSTORM EDITOR
 * ========================================================================== */

function TitleBrainstormEditor({ value, onUpdate }) {
  const titles = value?.titles || (Array.isArray(value) ? value : []);

  return (
    <div className="space-y-2">
      {titles.map((t, i) => (
        <div key={i} className="rounded-lg border border-border/40 bg-background/60 p-3">
          <div className="flex items-start gap-2">
            <span className="text-[10px] font-bold text-muted-foreground mt-0.5 w-4 shrink-0">
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-display text-foreground">
                <strong>{t.title}</strong>
                {t.subtitle && <span className="text-muted-foreground">: {t.subtitle}</span>}
              </p>
              {t.style && (
                <span className="inline-block mt-1 text-[9px] uppercase tracking-widest text-muted-foreground font-semibold bg-secondary/40 px-1.5 py-0.5 rounded-full">
                  {t.style}
                </span>
              )}
              {t.reasoning && (
                <p className="text-[11px] italic text-muted-foreground mt-1 leading-4">
                  {t.reasoning}
                </p>
              )}
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                navigator.clipboard.writeText(t.title + (t.subtitle ? `: ${t.subtitle}` : ''));
                toast.success('Title copied');
              }}
              className="h-6 w-6 p-0 shrink-0"
              title="Copy this title"
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* =============================================================================
 * SOCIAL KIT EDITOR
 * ========================================================================== */

function SocialKitEditor({ value, onUpdate }) {
  const [platform, setPlatform] = useState('twitter');
  const twitter = value?.twitter || [];
  const instagram = value?.instagram || [];
  const tiktok = value?.tiktok || [];

  return (
    <div className="space-y-3">
      <div className="flex gap-1">
        <button
          onClick={() => setPlatform('twitter')}
          className={`text-[11px] font-semibold px-3 py-1 rounded-full transition-colors ${
            platform === 'twitter'
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary/50 text-muted-foreground hover:text-foreground'
          }`}
        >
          Twitter/X ({twitter.length})
        </button>
        <button
          onClick={() => setPlatform('instagram')}
          className={`text-[11px] font-semibold px-3 py-1 rounded-full transition-colors ${
            platform === 'instagram'
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary/50 text-muted-foreground hover:text-foreground'
          }`}
        >
          Instagram ({instagram.length})
        </button>
        <button
          onClick={() => setPlatform('tiktok')}
          className={`text-[11px] font-semibold px-3 py-1 rounded-full transition-colors ${
            platform === 'tiktok'
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary/50 text-muted-foreground hover:text-foreground'
          }`}
        >
          TikTok ({tiktok.length})
        </button>
      </div>

      {platform === 'twitter' && (
        <div className="space-y-2">
          {twitter.map((p, i) => (
            <div key={i} className="rounded-lg border border-border/40 bg-background/60 p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] uppercase tracking-widest font-semibold text-muted-foreground">
                  {p.type}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {(p.text || '').length}/280 chars
                </span>
              </div>
              <p className="text-xs text-foreground whitespace-pre-wrap">{p.text}</p>
            </div>
          ))}
        </div>
      )}

      {platform === 'instagram' && (
        <div className="space-y-2">
          {instagram.map((p, i) => (
            <div key={i} className="rounded-lg border border-border/40 bg-background/60 p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] uppercase tracking-widest font-semibold text-muted-foreground">
                  {p.type}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {(p.caption || '').length} chars
                </span>
              </div>
              <p className="text-xs text-foreground whitespace-pre-wrap">{p.caption}</p>
              {p.hashtags && (
                <p className="text-[10px] italic text-muted-foreground mt-1">{p.hashtags}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {platform === 'tiktok' && (
        <div className="space-y-2">
          {tiktok.map((p, i) => (
            <div key={i} className="rounded-lg border border-border/40 bg-background/60 p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] uppercase tracking-widest font-semibold text-muted-foreground">
                  {p.type}
                </span>
              </div>
              <p className="text-xs font-semibold text-foreground">
                Hook: <span className="font-normal">{p.hook}</span>
              </p>
              {p.script && (
                <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">
                  {p.script}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* =============================================================================
 * LAUNCH CHECKLIST EDITOR
 * ========================================================================== */

function ChecklistEditor({ value, onUpdate }) {
  const rawItems = value?.checklist || (Array.isArray(value) ? value : []);
  const items = rawItems.map((it, i) => ({
    id: it.id || `ci_${i}`,
    phase: it.phase || 'pre-launch',
    label: it.label || '',
    details: it.details || '',
    done: !!it.done,
  }));

  const toggle = (index) => {
    const next = items.map((it, i) => (i === index ? { ...it, done: !it.done } : it));
    onUpdate(next);
  };

  const phases = [
    { id: 'pre-launch', label: 'Pre-Launch' },
    { id: 'launch-week', label: 'Launch Week' },
    { id: 'launch-day', label: 'Launch Day' },
    { id: 'post-launch', label: 'Post-Launch' },
  ];

  return (
    <div className="space-y-3">
      {phases.map((phase) => {
        const phaseItems = items
          .map((it, idx) => ({ ...it, _idx: idx }))
          .filter((it) => it.phase === phase.id);

        if (phaseItems.length === 0) return null;

        const done = phaseItems.filter((it) => it.done).length;

        return (
          <div key={phase.id} className="space-y-1">
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">
                {phase.label}
              </p>
              <span className="text-[10px] text-muted-foreground font-mono">
                {done}/{phaseItems.length}
              </span>
            </div>

            {phaseItems.map((it) => (
              <label
                key={it.id}
                className="flex items-start gap-2 rounded-lg border border-border/30 bg-background/50 px-3 py-2 cursor-pointer hover:bg-secondary/20 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={it.done}
                  onChange={() => toggle(it._idx)}
                  className="mt-0.5 h-3.5 w-3.5 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className={`text-xs ${it.done ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                    {it.label}
                  </p>
                  {it.details && (
                    <p className="text-[10px] italic text-muted-foreground mt-0.5">
                      {it.details}
                    </p>
                  )}
                </div>
              </label>
            ))}
          </div>
        );
      })}
    </div>
  );
}

/* =============================================================================
 * ISBN FIELDS
 * ========================================================================== */

function IsbnFields({ ebook, paperback, hardcover, onChange, saving }) {
  return (
    <div className="rounded-xl border border-border/50 bg-background/60 p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-base">📕</span>
        <span className="text-sm font-medium text-foreground">ISBN Registry</span>
        <span className="text-[11px] text-muted-foreground">
          Enter manually — KDP assigns when you publish
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {[
          { field: 'isbn_ebook', label: 'Ebook ISBN', value: ebook },
          { field: 'isbn_paperback', label: 'Paperback ISBN', value: paperback },
          { field: 'isbn_hardcover', label: 'Hardcover ISBN', value: hardcover },
        ].map((f) => (
          <div key={f.field}>
            <div className="flex items-center justify-between">
              <label className="text-[9px] uppercase tracking-widest text-muted-foreground">
                {f.label}
              </label>
              {saving[f.field] && (
                <Loader2 className="h-2.5 w-2.5 animate-spin text-muted-foreground" />
              )}
            </div>
            <input
              type="text"
              value={f.value}
              onChange={(e) => onChange(f.field, e.target.value)}
              placeholder="978-0-000-00000-0"
              className="w-full text-xs font-mono bg-transparent border-b border-border/50 py-1 focus:outline-none focus:border-primary/60"
            />
          </div>
        ))}
      </div>
    </div>
  );
}