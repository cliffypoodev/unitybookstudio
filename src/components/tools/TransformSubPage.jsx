import React, { useState, useCallback, useMemo } from 'react';
import {
  Loader2,
  Copy,
  Download,
  Clock,
  AlertTriangle,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Sparkles,
  Search,
  Wand2,
  BookOpen,
  FileText,
  Film,
  Mic2,
  Megaphone,
  GraduationCap,
  Layers3,
  ScrollText,
  PlayCircle,
  Eye,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { parseDocxFile } from '@/lib/docxParser';
import { isNonfictionProject as isNonfictionProjectAuthority } from '@/lib/projectType'; // NFCLASS-4
import {
  TRANSFORM_CATEGORIES,
  getTransformPrompt,
  getFormat,
  formatsForProjectType,
} from '@/lib/transformPrompts';
import { invokeLLMWithRetry } from '@/lib/integrationRetry';
import { pickModel, pickFallbackModel } from '@/lib/modelRouting';
import { loadManuscriptChapters } from '@/lib/manuscriptLoader';
import SourceSelector from '@/components/tools/SourceSelector';
import SavedAssetsPanel, { savePublishingAsset } from '@/components/tools/SavedAssetsPanel';
import UploadZone from '@/components/tools/UploadZone';
import { runParallelDraftPool } from '@/lib/parallelDraftPool';

const TRANSFORM_STUDIO_VERSION = 'TransformSubPage-conversion-studio-ui-v3';

console.log('[TRANSFORM-STUDIO] Loaded', TRANSFORM_STUDIO_VERSION);

function extractText(response) {
  if (typeof response === 'string') return response;
  return response?.text || response?.data || response?.content || String(response || '');
}

function countWords(text) {
  return String(text || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function normalizeOutputName(value) {
  return String(value || 'output')
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'output';
}

function assembleCombinedText(perChapterResults, workingChapters) {
  return (workingChapters || [])
    .map((ch, idx) => {
      const result = perChapterResults[idx];
      if (!result) return null;

      const block =
        result.status === 'success'
          ? result.text
          : `[TRANSFORM FAILED: ${result.error || 'Unknown error'}]`;

      return `=== ${ch.title || 'Chapter ' + (idx + 1)} ===\n\n${block}`;
    })
    .filter(Boolean)
    .join('\n\n------------------------------------------------------------\n\n');
}

function downloadTextFile(filename, text) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');

  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function getCategoryMeta(categoryId) {
  switch (categoryId) {
    case 'audio':
      return {
        icon: Mic2,
        blurb: 'Turn prose into narrated, full-cast, sound-designed, or generative-audio-ready formats.',
      };
    case 'screen':
      return {
        icon: Film,
        blurb: 'Adapt the manuscript into film, TV, stage, trailer, storyboard, or production documents.',
      };
    case 'visual':
      return {
        icon: PlayCircle,
        blurb: 'Convert story material into comic, manga, visual novel, game, or interactive formats.',
      };
    case 'publishing':
      return {
        icon: FileText,
        blurb: 'Generate KDP, Amazon, bookstore, agent, library, and sales-page assets.',
      };
    case 'marketing':
      return {
        icon: Megaphone,
        blurb: 'Build launch campaigns, ad copy, newsletters, quote packs, and promotional assets.',
      };
    case 'education':
      return {
        icon: GraduationCap,
        blurb: 'Create study guides, workbooks, quizzes, teaching materials, and reader companions.',
      };
    case 'ip':
      return {
        icon: Layers3,
        blurb: 'Expand the project into series bibles, sequel plans, spin-offs, and franchise-ready assets.',
      };
    case 'repurpose':
      return {
        icon: ScrollText,
        blurb: 'Repackage the book into summaries, articles, courses, YouTube scripts, and derivative content.',
      };
    default:
      return {
        icon: BookOpen,
        blurb: 'Transform your manuscript into a new output format.',
      };
  }
}

const FORMAT_PREVIEW_META = {
  audiobook: {
    why: 'Prepares chapters for clean narration without changing the story.',
    output: 'Narration-ready script with pronunciation notes, pauses, emphasis markers, and voice guidance.',
    bestFor: 'Audiobook production, narrator prep, ElevenLabs-style workflows, or chapter read-aloud review.',
  },
  graphicaudio: {
    why: 'Builds the immersive audio version of the chapter instead of plain narration.',
    output: 'Narrator lines, character dialogue, [SFX], [Music cue], [Atmosphere], [Performance note], and transitions.',
    bestFor: 'Graphic audiobook experiments, full-cast production prep, and Suno/generative audio workflows.',
  },
  fullcastaudio: {
    why: 'Turns prose into a performed audio drama with distinct roles and sound staging.',
    output: 'Cast list, scene ambience, narrator bridges, dialogue blocks, SFX cues, and performance directions.',
    bestFor: 'Radio play, fiction podcast, cast table-read, and dramatized audiobook planning.',
  },
  sunocuesheet: {
    why: 'Extracts the sound-world and musical pacing from the prose.',
    output: 'Bracketed segment-by-segment audio prompts for mood, tempo, music style, SFX, ambience, and voice direction.',
    bestFor: 'Suno-style generative audio clips and cinematic audiobook cue design.',
  },
  voicebible: {
    why: 'Separates the cast into distinct audio identities.',
    output: 'Narrator profile plus character voice profiles with texture, pitch, pace, emotional baseline, and sample lines.',
    bestFor: 'Full-cast narration, AI voice selection, narrator notes, and adaptation planning.',
  },
  podcastadaptation: {
    why: 'Repackages the book into episodic audio content.',
    output: 'Podcast series plan plus Episode 1 script with host/narrator flow, segments, clips, and sound design.',
    bestFor: 'Narrative podcast, limited-series concept, or nonfiction audio show planning.',
  },
  traileraudio: {
    why: 'Condenses the book into a sellable audio teaser.',
    output: 'Timed trailer script with voiceover, SFX, music arc, title card, and CTA.',
    bestFor: 'Audio ads, podcast trailers, social teasers, and book-launch promo clips.',
  },
  screenplay: {
    why: 'Converts prose into visual, shootable script form.',
    output: 'Scene headings, action lines, character blocks, dialogue, and screenplay-style pacing.',
    bestFor: 'Film adaptation tests, scene visualization, and screenwriting conversion.',
  },
  stageplay: {
    why: 'Turns the story into a live-performance structure.',
    output: 'Act/scene formatting, stage directions, lighting/sound cues, and theatrical dialogue.',
    bestFor: 'Theater adaptation, table reads, and stripped-down character drama.',
  },
  tvpilot: {
    why: 'Tests whether the story has a series engine.',
    output: 'Pilot structure with cold open, acts, tag/stinger, A/B/C plots, and ongoing hooks.',
    bestFor: 'TV adaptation planning and pitch-package development.',
  },
  movietrailer: {
    why: 'Builds a concise cinematic hook from the manuscript.',
    output: 'Timed trailer beats with visuals, voiceover, SFX, music, on-screen text, and ending card.',
    bestFor: 'Promo video creation, book trailer scripting, and launch assets.',
  },
  storyboard: {
    why: 'Turns story energy into image/video generation shots.',
    output: 'Shot-by-shot trailer storyboard with camera, lighting, objects, text overlay, VO, SFX, and generation prompts.',
    bestFor: 'AI video tools, trailer boards, and visual marketing assets.',
  },
  shotlist: {
    why: 'Makes a prose scene filmable.',
    output: 'Scene-by-scene production shot list with camera, action, sound, and visual motif notes.',
    bestFor: 'Video generation, indie production, or adaptation planning.',
  },
  directorstreatment: {
    why: 'Creates the prestige adaptation argument.',
    output: 'Visual language, tone, music, themes, key sequences, casting archetypes, comps, and adaptation risks.',
    bestFor: 'Pitching film/TV/audio direction and defining adaptation style.',
  },
  graphicnovel: {
    why: 'Turns prose into panel-based visual storytelling.',
    output: 'Pages, panels, captions, dialogue, SFX, splash pages, and color/mood notes.',
    bestFor: 'Graphic novel adaptation or artist handoff.',
  },
  comicissue: {
    why: 'Structures the chapter like a monthly comic issue.',
    output: '20–24 page comic script with panels, page turns, captions, dialogue, SFX, and final-page hook.',
    bestFor: 'Serialized comic adaptation and visual IP expansion.',
  },
  mangachapter: {
    why: 'Rebuilds the chapter with manga pacing and visual emphasis.',
    output: 'Black-and-white manga script with reaction panels, close-ups, page turns, and sparse dialogue.',
    bestFor: 'Stylized action, romance, horror, or emotional scene adaptation.',
  },
  visualnovel: {
    why: 'Turns prose into a playable dialogue/choice scene.',
    output: 'Backgrounds, music, sprites, dialogue, narration, choices, flags, and state variables.',
    bestFor: 'Visual novel prototypes and branching fiction experiments.',
  },
  interactivefiction: {
    why: 'Finds the choice architecture inside the story.',
    output: 'Branching node map with variables, choices, consequences, endings, and failure states.',
    bestFor: 'Interactive fiction, game design, and choice-based adaptation.',
  },
  gamequestline: {
    why: 'Converts story conflict into playable objectives.',
    output: 'Quest arc, NPCs, locations, tasks, complications, choice points, rewards, and narrative consequences.',
    bestFor: 'Game adaptation, RPG planning, and story-world expansion.',
  },
  querysynopsis: {
    why: 'Creates the agent-facing synopsis version of the book.',
    output: 'Professional synopsis that states the structure, stakes, and ending/argument clearly.',
    bestFor: 'Agent submissions, proposal prep, and big-picture story clarity.',
  },
  backcover: {
    why: 'Turns the manuscript into reader-facing sales copy.',
    output: '150–200 word Amazon/back-cover blurb built around hook, stakes, and reader promise.',
    bestFor: 'KDP listings, back covers, and quick marketing copy.',
  },
  kdpmetadata: {
    why: 'Builds the practical publishing package.',
    output: 'Title/subtitle ideas, descriptions, keyword slots, categories, comps, reader promise, and A+ angles.',
    bestFor: 'KDP setup, Amazon listing strategy, and metadata brainstorming.',
  },
  amazonpage: {
    why: 'Creates a complete retail product page from the manuscript.',
    output: 'Hook headline, short/full description, bullets, publisher copy, reader promise, and keyword phrases.',
    bestFor: 'Amazon listing copy and sales positioning.',
  },
  apluscontent: {
    why: 'Turns the book into visual sales modules.',
    output: 'Hero banner, promise modules, theme cards, quote modules, author block, and visual prompts.',
    bestFor: 'Amazon A+ content, web landing pages, and promo graphics.',
  },
  sellSheet: {
    why: 'Creates bookstore/library-facing sales material.',
    output: 'One-page sell sheet with pitch, metadata placeholders, selling points, target audience, comps, and ordering info.',
    bestFor: 'Library, bookstore, event, and wholesale outreach.',
  },
  pressrelease: {
    why: 'Creates a public launch announcement.',
    output: 'Professional press release with headline, lead, author quote, publishing details, and media contact placeholders.',
    bestFor: 'Local media, podcasts, newsletters, and launch announcements.',
  },
  keyquotes: {
    why: 'Finds the strongest quotable lines in the manuscript.',
    output: '15–25 verbatim pull quotes with attribution guidance.',
    bestFor: 'Quote graphics, social captions, website excerpts, and promo copy.',
  },
  sampleextract: {
    why: 'Creates a free preview that sells the full book.',
    output: 'Polished sample section with CTA placeholders and hook ending.',
    bestFor: 'Lead magnets, newsletter signups, Kindle samples, and author websites.',
  },
  social30: {
    why: 'Turns the book into a month of launch content.',
    output: 'Thirty daily post concepts with captions, visuals, short video ideas, CTAs, and hashtags.',
    bestFor: 'Launch calendar, social media planning, and promo consistency.',
  },
  booktokpack: {
    why: 'Creates short-form video material from the manuscript.',
    output: 'BookTok/Reels/Shorts scripts with hooks, overlay text, B-roll ideas, captions, and hashtags.',
    bestFor: 'Short-form video marketing and viral-style book promotion.',
  },
  newsletterlaunch: {
    why: 'Builds your author email launch sequence.',
    output: 'Announcement, behind-the-book, excerpt, launch-day, review request, and follow-up emails.',
    bestFor: 'Author newsletter, preorder campaigns, and launch week communication.',
  },
  adcopy: {
    why: 'Creates paid-ad angles and split-test copy.',
    output: 'Amazon/Facebook/BookBub-style headlines, primary text, campaign angles, and visual concepts.',
    bestFor: 'Ad testing, promo campaigns, and marketing angle discovery.',
  },
  arcreview: {
    why: 'Creates professional reviewer outreach material.',
    output: 'ARC invite emails, follow-ups, reviewer one-sheet, review prompts, and social share copy.',
    bestFor: 'ARC teams, early reviews, and launch credibility.',
  },
  bookclub: {
    why: 'Turns the book into a discussion-ready reader handout.',
    output: 'Tiered discussion questions, thematic prompts, ending/takeaway questions, and further reading.',
    bestFor: 'Book clubs, libraries, author events, and reader guides.',
  },
  studyguide: {
    why: 'Creates chapter-by-chapter learning support.',
    output: 'Learning objectives, key concepts, reflection prompts, action items, and going-deeper suggestions.',
    bestFor: 'Nonfiction companion guides, classroom use, and structured readers.',
  },
  workbook: {
    why: 'Turns passive reading into active exercises.',
    output: 'Recap, lesson, reflection exercise, practical exercise, checklist, journal prompts, and next step.',
    bestFor: 'Training books, self-help, caregiving manuals, and reader engagement.',
  },
  facilitatorguide: {
    why: 'Makes the book teachable in a live setting.',
    output: 'Session length, objectives, materials, opening activity, discussion flow, main activity, and facilitator notes.',
    bestFor: 'Workshops, staff training, book groups, and classroom sessions.',
  },
  quizpack: {
    why: 'Creates assessment material from chapter content.',
    output: 'Multiple choice, short answer, discussion questions, applied scenarios, and answer key.',
    bestFor: 'Courses, training manuals, and educational companion products.',
  },
  glossarytimeline: {
    why: 'Extracts reference structure from the manuscript.',
    output: 'Glossary, people/characters, locations, timeline, organizations/factions, and relationship map.',
    bestFor: 'Continuity, study guides, nonfiction references, and series planning.',
  },
  seriesbible: {
    why: 'Upgrades the book into franchise-grade reference material.',
    output: 'Premise, engine, world rules, timeline, cast, locations, factions, open threads, resolved threads, and future hooks.',
    bestFor: 'Sequels, continuity, series planning, and adaptation prep.',
  },
  characterbible: {
    why: 'Extracts character logic and continuity.',
    output: 'Character profiles with desire, fear, wound, secret, arc, relationships, voice, and status.',
    bestFor: 'Sequels, rewrite planning, voice consistency, and adaptation.',
  },
  worldbible: {
    why: 'Captures the rules and structure of the fictional world.',
    output: 'Reality rules, history, geography, institutions, culture, factions, continuity rules, and expansion questions.',
    bestFor: 'Fantasy, sci-fi, thriller worlds, and long-series continuity.',
  },
  sequelroadmap: {
    why: 'Identifies what the next books should do.',
    output: 'Open threads, unfinished arcs, threat escalation, Book 2 options, Book 3/4 logic, and best direction.',
    bestFor: 'Series planning and avoiding sequel reset syndrome.',
  },
  spinoffideas: {
    why: 'Finds commercially useful side stories inside the manuscript.',
    output: 'Spin-off novels, prequels, novellas, anthologies, alternate POVs, and audio specials.',
    bestFor: 'IP expansion and content pipeline planning.',
  },
  pitchdeck: {
    why: 'Turns the book into a producer-facing pitch structure.',
    output: 'Slide-by-slide adaptation pitch with logline, hook, world, characters, comps, audience, and franchise potential.',
    bestFor: 'Film/TV/audio/game adaptation pitches.',
  },
  chapsummaries: {
    why: 'Creates quick-reference summaries chapter by chapter.',
    output: 'Chapter title, one-line hook, key beats/takeaways, and forward pull/application.',
    bestFor: 'Marketing, continuity review, audiobook breaks, and reader guides.',
  },
  blogseries: {
    why: 'Turns the book into long-form web content.',
    output: 'Blog/article series derived from the manuscript with headlines, tags, body copy, and CTAs.',
    bestFor: 'SEO, newsletters, author websites, and evergreen content.',
  },
  youtubeessay: {
    why: 'Turns manuscript material into video essay content.',
    output: 'Title, thumbnail text, hook, sections, B-roll, conclusion, and CTA.',
    bestFor: 'YouTube scripts, author platform content, and nonfiction topic marketing.',
  },
  courseoutline: {
    why: 'Turns nonfiction/training content into a teachable course.',
    output: 'Course promise, modules, lessons, activities, worksheets, assessments, and next steps.',
    bestFor: 'Training, online courses, workshops, and educational product creation.',
  },
  execsummary: {
    why: 'Condenses the manuscript into a fast high-level briefing.',
    output: 'Overview, premise/thesis, key points, strengths, risks, use cases, next steps, and bullet summary.',
    bestFor: 'Agents, editors, collaborators, grant panels, internal review, and quick handoffs.',
  },
  fullcastscript: {
    why: 'Converts each chapter into a multi-voice performance script with narrator bridges.',
    output: 'Cast list, character voice assignments, narrator direction, SFX cues, and performance notes.',
    bestFor: 'Full-cast audiobook production, fiction podcast production, and dramatic reading.',
  },
  podcastepisode: {
    why: 'Splits the manuscript into episodic segments with natural cliffhanger breaks.',
    output: 'Episode plan with intro hook, segment breaks, cliffhanger endings, and outro teaser for next episode.',
    bestFor: 'Serial podcast adaptation, newsletter serialization, and Substack chapter drops.',
  },
  graphicnovelpanel: {
    why: 'Translates prose into page-by-page panel descriptions for artists.',
    output: 'Panel-by-panel script with page layout, camera angle, caption text, dialogue balloons, and color notes.',
    bestFor: 'Graphic novel production, comic artist briefs, and visual adaptation.',
  },
  blogserialpack: {
    why: 'Repackages the manuscript into SEO-optimized blog installments.',
    output: 'Blog series with SEO titles, meta descriptions, excerpt hooks, internal links, and CTA per post.',
    bestFor: 'Content marketing, author website traffic, and newsletter-to-blog funnels.',
  },
  translationprep: {
    why: 'Creates a translator-ready reference sheet for each chapter.',
    output: 'Idioms, cultural references, wordplay, proper nouns, tone notes, and untranslatable passages flagged.',
    bestFor: 'Translation project setup, foreign-rights packages, and multilingual publishing.',
  },
  readermagnet: {
    why: 'Extracts or generates a compelling free preview to use as a lead magnet.',
    output: 'Polished excerpt or standalone prequel scene with hook opening, cliffhanger ending, and CTA.',
    bestFor: 'Newsletter signup incentives, BookFunnel giveaways, and reader acquisition.',
  },
};

function getFormatMeta(format) {
  if (!format) {
    return {
      why: 'Select a transform to see what it creates.',
      output: 'The preview explains the generated deliverable before you run it.',
      bestFor: 'Choosing the right conversion path.',
    };
  }

  return FORMAT_PREVIEW_META[format.id] || {
    why: 'Useful when you want to repurpose the manuscript into another deliverable.',
    output:
      format.perChapter
        ? 'Generates chapter-by-chapter output so each section can be reviewed independently.'
        : 'Generates one combined whole-book output using the full manuscript.',
    bestFor: 'Fast structural conversion from your current manuscript.',
  };
}

function inferFeaturedFormats(visibleFormats) {
  const preferredIds = [
    'graphicaudio',
    'sunocuesheet',
    'fullcastaudio',
    'movietrailer',
    'storyboard',
    'kdpmetadata',
    'social30',
    'seriesbible',
    'characterbible',
    'execsummary',
  ];

  const byId = new Map((visibleFormats || []).map((f) => [f.id, f]));
  const chosen = preferredIds.map((id) => byId.get(id)).filter(Boolean);

  if (chosen.length >= 8) return chosen.slice(0, 8);

  const fallback = (visibleFormats || []).filter((f) => !chosen.some((c) => c.id === f.id));
  return [...chosen, ...fallback].slice(0, 8);
}

function FormatCard({ format, selected, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(format.id)}
      className={`w-full rounded-2xl border p-4 text-left transition ${
        selected
          ? 'border-primary bg-primary/5 shadow-sm'
          : 'border-border/60 bg-background/50 hover:border-primary/50 hover:bg-background'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-lg">{format.emoji}</span>
            <div className="truncate text-sm font-semibold text-foreground">{format.label}</div>
          </div>
          <p className="mt-1 line-clamp-3 text-xs leading-5 text-muted-foreground">
            {format.description || 'Convert the manuscript into this format.'}
          </p>
        </div>

        <span className="shrink-0 rounded-full border border-border/60 bg-card px-2 py-1 text-[9px] uppercase tracking-widest text-muted-foreground">
          {format.perChapter ? 'Chapter' : 'Book'}
        </span>
      </div>
    </button>
  );
}

export default function TransformSubPage({ project, chapters, busyLabel, setBusyLabel }) {
  const [source, setSource] = useState(project?.id ? 'project' : 'upload');
  const [parsed, setParsed] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [targetFormat, setTargetFormat] = useState(null);
  const [selectedFormatId, setSelectedFormatId] = useState(null);
  const [loadedChapters, setLoadedChapters] = useState(null);
  const [loadingProject, setLoadingProject] = useState(false);

  const [bookResult, setBookResult] = useState(null);
  const [chapterResults, setChapterResults] = useState({});
  const [chapterProgress, setChapterProgress] = useState({
    completed: 0,
    total: 0,
    failed: 0,
  });

  const [expandedChapters, setExpandedChapters] = useState(new Set());
  const [activeCategory, setActiveCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [assetRefreshKey, setAssetRefreshKey] = useState(0);

  const projectType = useMemo(() => {
    if (source === 'upload') return 'fiction';
    // NFCLASS-4: this used `project_type || book_type` — the OPPOSITE precedence from the
    // authority — plus a substring match on 'non', and it never consulted genre. The
    // authority answers now; this only maps its verdict onto the two-value string the
    // format catalogue expects.
    return isNonfictionProjectAuthority(project) ? 'nonfiction' : 'fiction';
  }, [source, project]);

  const visibleFormats = useMemo(() => {
    return formatsForProjectType(projectType) || [];
  }, [projectType]);

  const featuredFormats = useMemo(() => {
    return inferFeaturedFormats(visibleFormats);
  }, [visibleFormats]);

  const filteredFormats = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return visibleFormats.filter((fmt) => {
      const matchesCategory = !activeCategory || fmt.category === activeCategory;
      const haystack = [
        fmt.label,
        fmt.description,
        fmt.category,
        fmt.id,
        getFormatMeta(fmt).why,
        getFormatMeta(fmt).output,
        getFormatMeta(fmt).bestFor,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      const matchesSearch = !q || haystack.includes(q);

      return matchesCategory && matchesSearch;
    });
  }, [visibleFormats, activeCategory, searchQuery]);

  const formatsByCategory = useMemo(() => {
    const out = {};
    for (const cat of TRANSFORM_CATEGORIES) out[cat.id] = [];

    for (const fmt of filteredFormats) {
      if (!out[fmt.category]) out[fmt.category] = [];
      out[fmt.category].push(fmt);
    }

    return out;
  }, [filteredFormats]);

  const selectedFormat = useMemo(() => {
    return visibleFormats.find((f) => f.id === selectedFormatId) || null;
  }, [visibleFormats, selectedFormatId]);

  const handleFileSelect = useCallback(async (file) => {
    if (!file) return;

    setUploading(true);
    setParsed(null);
    setTargetFormat(null);
    setBookResult(null);
    setChapterResults({});
    setLoadedChapters(null);

    try {
      const result = await parseDocxFile(file);
      setParsed(result);
      toast.success('Document loaded');
    } catch (err) {
      toast.error('Failed to parse: ' + (err?.message || 'Unknown error'));
    } finally {
      setUploading(false);
    }
  }, []);

  const handleLoadProject = useCallback(async () => {
    if (!project?.id || !chapters?.length) return;

    setLoadingProject(true);
    setTargetFormat(null);
    setBookResult(null);
    setChapterResults({});

    try {
      const loaded = await loadManuscriptChapters('project', project, chapters, null);
      setLoadedChapters(loaded || []);
      toast.success('Project manuscript loaded');
    } catch (err) {
      toast.error('Failed to load project manuscript: ' + (err?.message || 'Unknown error'));
    } finally {
      setLoadingProject(false);
    }
  }, [project, chapters]);

  const workingChapters = useMemo(() => {
    if (source === 'project') return loadedChapters;

    if (parsed?.chapters) {
      return parsed.chapters.map((ch, i) => ({
        chapter_number: i + 1,
        title: ch.title || `Chapter ${i + 1}`,
        content: ch.content || ch.body || ch.text || '',
      }));
    }

    return null;
  }, [source, loadedChapters, parsed]);

  const totalWords = useMemo(() => {
    if (!workingChapters) return 0;
    return workingChapters.reduce((sum, ch) => sum + countWords(ch.content || ''), 0);
  }, [workingChapters]);

  const fullText = useMemo(() => {
    if (!workingChapters) return '';
    return workingChapters.map((ch) => ch.content || '').join('\n\n');
  }, [workingChapters]);

  const ready = !!workingChapters && workingChapters.length > 0;

  const combinedResultText = useMemo(() => {
    if (!targetFormat) return '';

    const fmt = getFormat(targetFormat);
    if (!fmt) return '';

    if (!fmt.perChapter) {
      return bookResult?.status === 'success' ? bookResult.text : '';
    }

    return assembleCombinedText(chapterResults, workingChapters || []);
  }, [targetFormat, bookResult, chapterResults, workingChapters]);

  const hasResult = Boolean(bookResult || Object.values(chapterResults).some((r) => r?.status));
  const anyFailed = Object.values(chapterResults).some((r) => r?.status === 'failed');

  const currentFormat = targetFormat ? getFormat(targetFormat) : null;
  const isPerChapter = !!currentFormat?.perChapter;
  const combinedWordCount = countWords(combinedResultText);
  const estRuntime = currentFormat && ['screenplay', 'stageplay', 'tvpilot', 'graphicaudio', 'fullcastaudio'].includes(currentFormat.id)
    ? Math.max(1, Math.round(combinedWordCount / 200))
    : null;

  const sourceSummary = useMemo(() => {
    if (!workingChapters?.length) return null;

    return {
      chapters: workingChapters.length,
      words: totalWords.toLocaleString(),
      sourceLabel:
        source === 'project'
          ? (project?.title || project?.name || 'Current project')
          : (parsed?.filename || 'Uploaded manuscript'),
    };
  }, [workingChapters, totalWords, source, project, parsed]);

  const toggleExpanded = useCallback((idx) => {
    setExpandedChapters((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);

  const resetRunState = useCallback(() => {
    setTargetFormat(null);
    setBookResult(null);
    setChapterResults({});
    setExpandedChapters(new Set());
    setChapterProgress({ completed: 0, total: 0, failed: 0 });
  }, []);

  const clearSource = useCallback(() => {
    resetRunState();
    setParsed(null);
    setLoadedChapters(null);
  }, [resetRunState]);

  const runSingleChapter = useCallback(
    async (chapter, formatId) => {
      try {
        const prompt = getTransformPrompt(formatId, chapter.content, fullText, projectType);

        const response = await invokeLLMWithRetry({
          task_type: 'transform',
          prompt,
          model: pickModel('transform'),
          fallback_model: pickFallbackModel('transform'),
        });

        const text = extractText(response);

        if (!text || !text.trim()) {
          return { status: 'failed', error: 'Empty LLM response', text: '' };
        }

        return { status: 'success', text: text.trim(), error: null };
      } catch (err) {
        return {
          status: 'failed',
          error: err?.message || 'Unknown error',
          text: '',
        };
      }
    },
    [fullText, projectType]
  );

  const handleTransform = useCallback(
    async (format) => {
      if (!ready || !format) {
        toast.error('Load a manuscript first.');
        return;
      }

      setTargetFormat(format.id);
      setSelectedFormatId(format.id);
      setBookResult(null);
      setChapterResults({});
      setExpandedChapters(new Set());

      if (!format.perChapter) {
        setBusyLabel?.(`Transforming to ${format.label}…`);

        try {
          const prompt = getTransformPrompt(format.id, null, fullText, projectType);

          const response = await invokeLLMWithRetry({
            task_type: 'transform',
            prompt,
            model: pickModel('transform'),
            fallback_model: pickFallbackModel('transform'),
          });

          const text = extractText(response);

          if (!text || !text.trim()) {
            throw new Error('Empty LLM response');
          }

          setBookResult({ status: 'success', text: text.trim() });
          toast.success(`${format.label} generated (${countWords(text).toLocaleString()} words)`);

          if (source === 'project' && project?.id) {
            savePublishingAsset({
              projectId: project.id,
              kind: 'transform_' + format.id,
              label: format.label,
              content: text.trim(),
            }).then(() => setAssetRefreshKey((k) => k + 1));
          }
        } catch (err) {
          console.error('[TRANSFORM] Book-level failed:', err);
          setBookResult({
            status: 'failed',
            error: err?.message || 'Unknown error',
          });
          toast.error('Transform failed: ' + (err?.message || 'Unknown error'));
        } finally {
          setBusyLabel?.('');
        }

        return;
      }

      const total = workingChapters.length;
      setChapterProgress({ completed: 0, total, failed: 0 });

      const initialResults = {};
      for (let i = 0; i < total; i += 1) {
        initialResults[i] = { status: 'pending' };
      }
      setChapterResults(initialResults);

      setBusyLabel?.(`Transforming ${total} chapters…`);

      let completed = 0;
      let failed = 0;
      const startTime = Date.now();

      const poolResults = await runParallelDraftPool(
        workingChapters,
        async (chapter, currentIndex, laneIndex) => {
          const result = await runSingleChapter(chapter, format.id);

          setChapterResults((prev) => ({
            ...prev,
            [currentIndex]: result,
          }));

          if (result.status === 'success') completed += 1;
          else failed += 1;

          setChapterProgress({ completed, total, failed });
          setBusyLabel?.(`Transforming chapters… ${completed + failed}/${total}`);

          // WAVE7-CHNUM: carry the chapter's real identity out of the pool so the
          // saved asset can be numbered correctly even when a chapter fails.
          return { ...result, chapterNumber: chapter?.chapter_number, title: chapter?.title };
        },
        // WAVE7-CONCURRENCY: the llama router holds one model resident;
        // parallelDraftPool documents the measured failure from >1 lane.
        { limit: 1 },
      );

      // Auto-save all successful chapter results as a combined PublishingAsset
      if (source === 'project' && project?.id) {
        // WAVE7-CHNUM: this indexed AFTER filtering, so one failed chapter
        // renumbered every chapter below it — ch.4's output was saved as
        // "## Chapter 3". Use the chapter's own number and title, matching the
        // exported text.
        const successTexts = poolResults
          .filter((r) => r?.status === 'fulfilled' && r.value?.status === 'success')
          .map((r) => {
            const num = r.value.chapterNumber ?? r.value.chapter?.chapter_number;
            const title = r.value.title || r.value.chapter?.title || '';
            const heading = num ? `## Chapter ${num}${title ? ': ' + title : ''}` : `## ${title || 'Untitled'}`;
            return `${heading}\n\n${r.value.text}`;
          });

        if (successTexts.length > 0) {
          savePublishingAsset({
            projectId: project.id,
            kind: 'transform_' + format.id,
            label: `${format.label} (${successTexts.length} chapters)`,
            content: successTexts.join('\n\n---\n\n'),
          }).then(() => setAssetRefreshKey((k) => k + 1));
        }
      }

      setBusyLabel?.('');

      const elapsedSec = Math.round((Date.now() - startTime) / 1000);

      if (failed > 0) {
        toast.warning(`${format.label}: ${completed}/${total} chapters transformed in ${elapsedSec}s. ${failed} failed.`);
      } else {
        toast.success(`${format.label}: all ${total} chapters transformed in ${elapsedSec}s`);
      }
    },
    [ready, fullText, projectType, runSingleChapter, setBusyLabel, workingChapters]
  );

  const handleRetryFailed = useCallback(async () => {
    if (!targetFormat || !workingChapters) return;

    const failedIndices = Object.entries(chapterResults)
      .filter(([, result]) => result?.status === 'failed')
      .map(([idx]) => Number(idx));

    if (!failedIndices.length) {
      toast.info('No failed chapters to retry.');
      return;
    }

    setBusyLabel?.(`Retrying ${failedIndices.length} failed chapter(s)…`);

    setChapterResults((prev) => {
      const updated = { ...prev };
      for (const idx of failedIndices) updated[idx] = { status: 'pending' };
      return updated;
    });

    let newCompleted = 0;
    let newFailed = 0;

    const retryResults = await runParallelDraftPool(
      failedIndices.map((idx) => ({ idx, chapter: workingChapters[idx] })),
      async (item) => {
        const result = await runSingleChapter(item.chapter, targetFormat);
        setChapterResults((prev) => ({ ...prev, [item.idx]: result }));

        if (result.status === 'success') newCompleted += 1;
        else newFailed += 1;

        return result;
      },
      { limit: 1 }, // WAVE7-CONCURRENCY: one-slot local server
    );

    setBusyLabel?.('');

    if (newFailed > 0) {
      toast.warning(`Retry complete: ${newCompleted} succeeded, ${newFailed} still failed.`);
    } else {
      toast.success(`All ${failedIndices.length} failed chapters recovered.`);
    }
  }, [targetFormat, workingChapters, chapterResults, runSingleChapter, setBusyLabel]);

  const handleCopy = useCallback(async () => {
    if (!combinedResultText) {
      toast.error('Nothing to copy yet');
      return;
    }

    try {
      await navigator.clipboard.writeText(combinedResultText);
      toast.success('Transformation copied');
    } catch {
      toast.error('Copy failed');
    }
  }, [combinedResultText]);

  const handleExport = useCallback(() => {
    if (!combinedResultText) {
      toast.error('Nothing to export yet');
      return;
    }

    const format = getFormat(targetFormat);
    const formatLabel = normalizeOutputName(format?.label || targetFormat || 'transform');
    const projectLabel = normalizeOutputName(project?.title || project?.name || parsed?.filename || 'manuscript');

    downloadTextFile(`${projectLabel}-${formatLabel}.txt`, combinedResultText);
    toast.success('Transformation exported');
  }, [combinedResultText, parsed?.filename, project?.name, project?.title, targetFormat]);

  const selectedMeta = getFormatMeta(selectedFormat);

  return (
    <div className="space-y-6 overflow-y-auto h-full pr-1">
      <div className="rounded-2xl border border-border/60 bg-card/80 p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <p className="notebook-kicker">Manuscript Tools</p>
            <div className="flex items-center gap-2">
              <Wand2 className="h-5 w-5 text-primary" />
              <h2 className="font-display text-2xl text-foreground">
                Manuscript Conversion Studio
              </h2>
            </div>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              Turn the manuscript into audiobooks, trailer scripts, comics, metadata packs, marketing assets,
              franchise bibles, educational material, and more.
            </p>
          </div>

          <div className="rounded-xl border border-border/60 bg-background/70 px-4 py-3 text-sm">
            <div className="font-medium text-foreground">
              Project type: <span className="capitalize">{projectType}</span>
            </div>
            <div className="text-muted-foreground">
              {visibleFormats.length} transform option(s) available
            </div>
          </div>
        </div>
      </div>

      <SourceSelector
        source={source}
        setSource={(next) => {
          setSource(next);
          clearSource();
        }}
        project={project}
      />

      {source === 'upload' && !parsed && (
        <UploadZone onFileSelect={handleFileSelect} uploading={uploading} />
      )}

      {source === 'upload' && parsed && (
        <div className="rounded-2xl border border-border/60 bg-card/80 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-foreground">
                {parsed.filename || 'Uploaded manuscript'}
              </div>
              <div className="text-xs text-muted-foreground">
                {(parsed.chapters || []).length} chapter/section(s) detected
              </div>
            </div>
            <Button variant="outline" className="rounded-full" onClick={clearSource}>
              Change File
            </Button>
          </div>
        </div>
      )}

      {source === 'project' && (
        <div className="rounded-2xl border border-border/60 bg-card/80 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-foreground">
                {project?.title || project?.name || 'Current project'}
              </div>
              <div className="text-xs text-muted-foreground">
                Load the project manuscript into the Transform studio before running a conversion.
              </div>
            </div>
            <Button
              onClick={handleLoadProject}
              disabled={loadingProject || !project?.id || !!busyLabel}
              className="rounded-full gap-2"
            >
              {loadingProject ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {loadingProject ? 'Loading…' : loadedChapters?.length ? 'Reload Project Manuscript' : 'Load Project Manuscript'}
            </Button>
          </div>
        </div>
      )}

      {sourceSummary && (
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-border/60 bg-card/80 p-4">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Source</div>
            <div className="mt-1 truncate text-sm font-medium text-foreground">{sourceSummary.sourceLabel}</div>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card/80 p-4">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Chapters</div>
            <div className="mt-1 text-sm font-medium text-foreground">{sourceSummary.chapters}</div>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card/80 p-4">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Words</div>
            <div className="mt-1 text-sm font-medium text-foreground">{sourceSummary.words}</div>
          </div>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
        <div className="space-y-6 min-w-0">
          <div className="rounded-2xl border border-border/60 bg-card/80 p-5">
            <div className="mb-4 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <h3 className="font-display text-lg text-foreground">Featured transforms</h3>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {featuredFormats.map((fmt) => (
                <FormatCard
                  key={fmt.id}
                  format={fmt}
                  selected={selectedFormatId === fmt.id}
                  onSelect={setSelectedFormatId}
                />
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 bg-card/80 p-5">
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <h3 className="font-display text-lg text-foreground">Browse all transforms</h3>

              <div className="relative w-full lg:max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search transforms..."
                  className="h-10 w-full rounded-full border border-border/60 bg-background pl-10 pr-4 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
                />
              </div>
            </div>

            <div className="mb-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setActiveCategory(null)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  activeCategory === null
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border/60 bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground'
                }`}
              >
                All ({visibleFormats.length})
              </button>

              {TRANSFORM_CATEGORIES.map((cat) => {
                const categoryCount = visibleFormats.filter((fmt) => fmt.category === cat.id).length;
                if (!categoryCount) return null;

                const meta = getCategoryMeta(cat.id);
                const Icon = meta.icon;

                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setActiveCategory(cat.id)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                      activeCategory === cat.id
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border/60 bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground'
                    }`}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <Icon className="h-3.5 w-3.5" />
                      {cat.label} ({categoryCount})
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="space-y-6">
              {TRANSFORM_CATEGORIES.map((cat) => {
                const items = formatsByCategory[cat.id] || [];
                if (!items.length) return null;

                const meta = getCategoryMeta(cat.id);
                const Icon = meta.icon;

                return (
                  <div key={cat.id} className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="rounded-xl border border-border/60 bg-background/70 p-2">
                        <Icon className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-foreground">{cat.label}</div>
                        <div className="text-xs text-muted-foreground">{cat.description || meta.blurb}</div>
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      {items.map((fmt) => (
                        <FormatCard
                          key={fmt.id}
                          format={fmt}
                          selected={selectedFormatId === fmt.id}
                          onSelect={setSelectedFormatId}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}

              {!filteredFormats.length && (
                <div className="rounded-2xl border border-dashed border-border/60 bg-background/50 p-6 text-center text-sm text-muted-foreground">
                  No transforms match that search/filter.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6 min-w-0">
          <div className="sticky top-4 rounded-2xl border border-border/60 bg-card/90 p-5 shadow-sm backdrop-blur">
            <div className="mb-4 flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              <h3 className="font-display text-lg text-foreground">Transform preview</h3>
            </div>

            {!selectedFormat ? (
              <div className="rounded-2xl border border-dashed border-border/60 bg-background/50 p-6 text-sm leading-6 text-muted-foreground">
                Select a transform to see what it creates and run the conversion.
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{selectedFormat.emoji}</span>
                    <div className="text-lg font-semibold text-foreground">{selectedFormat.label}</div>
                  </div>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {selectedFormat.description || 'Convert the manuscript into this format.'}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <div className="rounded-full border border-border/60 bg-background px-3 py-1 text-xs text-muted-foreground">
                    {selectedFormat.perChapter ? 'Chapter-by-chapter output' : 'Whole-book output'}
                  </div>
                  <div className="rounded-full border border-border/60 bg-background px-3 py-1 text-xs text-muted-foreground capitalize">
                    {projectType}
                  </div>
                </div>

                <div className="space-y-3 rounded-2xl border border-border/60 bg-background/60 p-4">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      Why use this
                    </div>
                    <div className="mt-1 text-sm leading-6 text-foreground">
                      {selectedMeta.why}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      What it generates
                    </div>
                    <div className="mt-1 text-sm leading-6 text-foreground">
                      {selectedMeta.output}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      Best for
                    </div>
                    <div className="mt-1 text-sm leading-6 text-foreground">
                      {selectedMeta.bestFor}
                    </div>
                  </div>
                </div>

                <Button
                  onClick={() => handleTransform(selectedFormat)}
                  disabled={!ready || !!busyLabel || loadingProject}
                  className="w-full rounded-full gap-2"
                >
                  {!!busyLabel ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                  {busyLabel ? busyLabel : `Run ${selectedFormat.label}`}
                </Button>

                {!ready && (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs leading-5 text-amber-700 dark:text-amber-300">
                    Load a project manuscript or upload a manuscript file before running this transform.
                  </div>
                )}

                {hasResult && targetFormat === selectedFormat.id && combinedResultText && (
                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" className="flex-1 rounded-full gap-2" onClick={handleCopy}>
                      <Copy className="h-4 w-4" />
                      Copy
                    </Button>
                    <Button variant="outline" className="flex-1 rounded-full gap-2" onClick={handleExport}>
                      <Download className="h-4 w-4" />
                      Export
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {busyLabel && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/10 px-4 py-2.5">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-sm font-medium text-primary">{busyLabel}</span>
          </div>

          {chapterProgress.total > 0 && (
            <div className="rounded-xl border border-border/50 bg-card/60 px-4 py-2">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {chapterProgress.completed + chapterProgress.failed} of {chapterProgress.total} complete
                  {chapterProgress.failed > 0 && (
                    <span className="text-red-600 dark:text-red-400"> · {chapterProgress.failed} failed</span>
                  )}
                </span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {Math.round(((chapterProgress.completed + chapterProgress.failed) / chapterProgress.total) * 100)}%
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-secondary/40">
                <div
                  className="h-full bg-primary transition-all"
                  style={{
                    width: `${((chapterProgress.completed + chapterProgress.failed) / chapterProgress.total) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {targetFormat && currentFormat && (
        <div className="rounded-2xl border border-border/60 bg-card/80 p-5">
          <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="font-display text-lg text-foreground">
                Results — {currentFormat.emoji} {currentFormat.label}
              </h3>
              <p className="text-sm text-muted-foreground">
                {combinedWordCount.toLocaleString()} output words
                {estRuntime ? (
                  <span className="ml-2 inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" /> ~{estRuntime} min runtime
                  </span>
                ) : null}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {combinedResultText && (
                <>
                  <Button variant="outline" className="rounded-full gap-2" onClick={handleCopy}>
                    <Copy className="h-4 w-4" />
                    Copy
                  </Button>
                  <Button variant="outline" className="rounded-full gap-2" onClick={handleExport}>
                    <Download className="h-4 w-4" />
                    Export
                  </Button>
                </>
              )}

              {isPerChapter && anyFailed && !busyLabel && (
                <Button
                  variant="outline"
                  className="rounded-full gap-2 border-orange-300 text-orange-700 dark:text-orange-400"
                  onClick={handleRetryFailed}
                >
                  <RefreshCw className="h-4 w-4" />
                  Retry Failed
                </Button>
              )}

              <Button variant="ghost" className="rounded-full" onClick={resetRunState}>
                Back to Formats
              </Button>
            </div>
          </div>

          {!isPerChapter && bookResult && (
            <div className="space-y-4">
              {bookResult.status === 'failed' ? (
                <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300">
                  Transform failed: {bookResult.error || 'Unknown error'}
                </div>
              ) : (
                <div className="rounded-2xl border border-border/60 bg-background p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="text-sm font-medium text-foreground">Generated output</div>
                    <div className="text-xs text-muted-foreground">
                      {countWords(bookResult.text).toLocaleString()} words
                    </div>
                  </div>
                  <pre className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap break-words font-mono text-sm leading-6 text-foreground">
                    {bookResult.text}
                  </pre>
                </div>
              )}
            </div>
          )}

          {isPerChapter && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-sm font-medium text-foreground">Progress</div>
                  <div className="text-xs text-muted-foreground">
                    {chapterProgress.completed}/{chapterProgress.total} complete
                    {chapterProgress.failed ? ` · ${chapterProgress.failed} failed` : ''}
                  </div>
                </div>

                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{
                      width: `${chapterProgress.total
                        ? ((chapterProgress.completed + chapterProgress.failed) / chapterProgress.total) * 100
                        : 0}%`,
                    }}
                  />
                </div>
              </div>

              <div className="space-y-3">
                {(workingChapters || []).map((ch, idx) => {
                  const result = chapterResults[idx];
                  const isExpanded = expandedChapters.has(idx);
                  const status = result?.status || 'queued';

                  return (
                    <div
                      key={`${ch.title}-${idx}`}
                      className={`overflow-hidden rounded-2xl border ${
                        status === 'failed'
                          ? 'border-red-300/60 bg-red-50/40 dark:bg-red-900/10'
                          : 'border-border/60 bg-background'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleExpanded(idx)}
                        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-secondary/30"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-foreground">
                            {ch.title || `Chapter ${idx + 1}`}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span>{countWords(ch.content || '').toLocaleString()} source words</span>

                            {status === 'pending' && (
                              <span className="inline-flex items-center gap-1">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                Running
                              </span>
                            )}

                            {status === 'queued' && (
                              <span>Queued</span>
                            )}

                            {status === 'success' && (
                              <span className="inline-flex items-center gap-1 text-emerald-600">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Success · {countWords(result.text).toLocaleString()} words
                              </span>
                            )}

                            {status === 'failed' && (
                              <span className="inline-flex items-center gap-1 text-red-600">
                                <XCircle className="h-3.5 w-3.5" />
                                Failed
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {status === 'failed' && <AlertTriangle className="h-4 w-4 text-red-500" />}
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="border-t border-border/60 px-4 py-4">
                          {status === 'pending' && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Transforming...
                            </div>
                          )}

                          {status === 'queued' && (
                            <div className="text-sm text-muted-foreground">
                              This chapter has not started yet.
                            </div>
                          )}

                          {status === 'failed' && (
                            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300">
                              {result?.error || 'Unknown error'}
                            </div>
                          )}

                          {status === 'success' && (
                            <pre className="max-h-[50vh] overflow-y-auto whitespace-pre-wrap break-words font-mono text-sm leading-6 text-foreground">
                              {result.text}
                            </pre>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
      {source === 'project' && project?.id && (
        <SavedAssetsPanel
          projectId={project.id}
          kinds={visibleFormats.map((f) => 'transform_' + f.id)}
          refreshKey={assetRefreshKey}
        />
      )}
    </div>
  );
}
