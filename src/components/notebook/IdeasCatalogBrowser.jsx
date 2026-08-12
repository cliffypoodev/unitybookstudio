import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  BookOpen,
  Check,
  Copy,
  FileText,
  Filter,
  Grid3X3,
  Heart,
  ImagePlus,
  Layers,
  Library,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  Sparkles,
  Star,
  Trash2,
  Wand2,
  X,
} from 'lucide-react';

import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { invokeLLMWithRetry } from '@/lib/integrationRetry';
import { importAnthologyCatalog } from '@/lib/anthologyCatalog';
import { toast } from 'sonner'; // TOASTMOUNT-1: unify on sonner (react-hot-toast had no mounted Toaster)

const PAGE_SIZE = 24;

const TYPE_FILTERS = [
  { value: 'fiction', label: 'Fiction', icon: '📘' },
  { value: 'nonfiction', label: 'Nonfiction', icon: '📕' },
  { value: 'anthology', label: 'Anthology', icon: '📚' },
  { value: 'children', label: 'Children', icon: '🧸' },
  { value: 'erotica', label: 'Erotica', icon: '🌶️' },
];

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'az', label: 'A → Z' },
  { value: 'za', label: 'Z → A' },
  { value: 'longest', label: 'Most Detailed' },
  { value: 'shortest', label: 'Shortest' },
];

const QUICK_SHELVES = [
  { id: 'all', label: 'All Ideas', icon: Library },
  { id: 'favorites', label: 'Favorites', icon: Star },
  { id: 'recent', label: 'Recently Added', icon: RefreshCw },
  { id: 'anthology', label: 'Anthology Sparks', icon: Layers },
  { id: 'series', label: 'Series Potential', icon: BookOpen },
  { id: 'short', label: 'Short Story Ideas', icon: FileText },
];

const CONTENT_LANES = [
  { value: 'fiction', label: 'Fiction', description: 'Invented story concepts, novels, stories, series, worlds, characters.' },
  { value: 'nonfiction', label: 'Nonfiction', description: 'Argument, information, history, training, research, essays, manuals.' },
  { value: 'erotica', label: 'Erotica', description: 'Adult romantic / erotic fiction concepts and series ideas.' },
];

const FORMAT_OPTIONS_BY_LANE = {
  fiction: [
    { value: 'novel', label: 'Novel' },
    { value: 'short_story', label: 'Short Story' },
    { value: 'anthology', label: 'Anthology / Story Collection' },
    { value: 'series', label: 'Series' },
    { value: 'character', label: 'Character' },
    { value: 'setting', label: 'Setting / World' },
    { value: 'twist', label: 'Twist / Reveal' },
    { value: 'opening_scene', label: 'Opening Scene' },
  ],
  nonfiction: [
    { value: 'standalone_book', label: 'Standalone Book' },
    { value: 'anthology', label: 'Anthology / Essay Collection' },
    { value: 'series', label: 'Series' },
    { value: 'training_manual', label: 'Training Manual / Guide' },
    { value: 'course_curriculum', label: 'Course / Curriculum' },
    { value: 'case_study_collection', label: 'Case Study Collection' },
    { value: 'reference_book', label: 'Reference Book' },
    { value: 'workbook', label: 'Workbook / Guided Journal' },
  ],
  erotica: [
    { value: 'novel', label: 'Novel' },
    { value: 'novella', label: 'Novella' },
    { value: 'short_story', label: 'Short Story' },
    { value: 'anthology', label: 'Anthology / Collection' },
    { value: 'series', label: 'Series' },
    { value: 'character_dynamic', label: 'Character / Couple Dynamic' },
    { value: 'setting_scenario', label: 'Setting / Scenario' },
  ],
};

const SUBTYPE_OPTIONS_BY_LANE = {
  fiction: [
    'Thriller',
    'Mystery',
    'Horror',
    'Science Fiction',
    'Fantasy',
    'Romance',
    'Historical Fiction',
    'Literary Fiction',
    'Speculative Fiction',
    'Noir',
    'Comedy',
    'Faith-Based',
    'Children',
    'Middle Grade',
    'Young Adult',
    'Other',
  ],
  nonfiction: [
    'Investigative',
    'Exposé',
    'History',
    'Biography / Profile',
    'Memoir',
    'Self-Help',
    'Business',
    'Leadership',
    'Training / Instructional',
    'Academic / Scholarly',
    'Reference',
    'Cultural Criticism',
    'True Crime',
    'Health / Wellness',
    'Caregiving / Human Services',
    'Religion / Theology',
    'Politics / Society',
    'Science / Technology',
    'Personal Development',
    'Workbook / Guided Journal',
    'Essay Collection',
    'Other',
  ],
  erotica: [
    'Contemporary Erotic Romance',
    'Dark Romance',
    'Erotic Thriller',
    'Paranormal Erotica',
    'Fantasy Erotica',
    'Sci-Fi Erotica',
    'Historical Erotica',
    'Romantic Suspense',
    'LGBTQ+ Erotica',
    'Billionaire / Power Dynamic',
    'Small Town',
    'Forbidden Romance',
    'Second Chance',
    'Enemies to Lovers',
    'Anthology Theme',
    'Other',
  ],
};

const TONE_OPTIONS_BY_LANE = {
  fiction: [
    'Dark',
    'Funny',
    'Cinematic',
    'Emotional',
    'Weird',
    'Commercial',
    'Prestige',
    'Gritty',
    'Clean',
    'Bleak',
    'Hopeful',
    'Satirical',
    'Romantic',
    'Suspenseful',
    'Literary',
  ],
  nonfiction: [
    'Investigative',
    'Authoritative',
    'Accessible',
    'Academic',
    'Practical',
    'Provocative',
    'Cinematic',
    'Human',
    'Critical',
    'Plainspoken',
    'Training-Focused',
    'Inspirational',
    'Journalistic',
    'Scholarly',
    'Urgent',
  ],
  erotica: [
    'Sensual',
    'Romantic',
    'Dark',
    'Suspenseful',
    'Playful',
    'Cinematic',
    'Emotional',
    'High-Heat',
    'Slow Burn',
    'Forbidden',
    'Gritty',
    'Elegant',
    'Dangerous',
  ],
};

const ORIGINALITY_OPTIONS = [
  { value: 'safe_commercial', label: 'Safe Commercial' },
  { value: 'fresh_marketable', label: 'Fresh but Marketable' },
  { value: 'weird_risky', label: 'Weird and Risky' },
  { value: 'unhinged', label: 'Completely Unhinged' },
];

function getIdeaText(idea) {
  return idea?.content || idea?.description || idea?.prompt || '';
}

function getIdeaDescription(idea) {
  return idea?.description || idea?.content || idea?.prompt || '';
}

function shortText(text, max = 190) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return clean.slice(0, max).trim() + '…';
}

function wordCount(text) {
  return String(text || '').split(/\s+/).filter(Boolean).length;
}

function prettyDate(value) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return '';
  }
}

function uniqueCount(items, key) {
  const counts = {};
  items.forEach((item) => {
    const value = item?.[key];
    if (!value) return;
    counts[value] = (counts[value] || 0) + 1;
  });
  return Object.entries(counts).sort((a, b) => b[1] - a[1]);
}

function stripFences(text) {
  return String(text || '')
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();
}

function extractText(response) {
  if (typeof response === 'string') return response;
  return response?.text || response?.data || response?.content || String(response || '');
}

function normalizeIdeaForEdit(idea, fallbackType = 'fiction') {
  const tags = Array.isArray(idea?.tags)
    ? idea.tags
    : String(idea?.tags || '')
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

  return {
    id: idea?.id || '',
    title: idea?.title || '',
    description: idea?.description || '',
    content: idea?.content || idea?.description || '',
    book_type: idea?.book_type || fallbackType || 'fiction',
    genre: idea?.genre || '',
    category: idea?.category || '',
    subcategory: idea?.subcategory || '',
    tags,
    word_count: idea?.word_count || wordCount(idea?.content || idea?.description || ''),
    created_date: idea?.created_date || '',
    updated_date: idea?.updated_date || '',
    is_favorite: !!idea?.is_favorite,
    status: idea?.status || 'idea',
  };
}

function buildIdeaPayload(draft) {
  const content = draft.content || draft.description || '';

  return {
    title: draft.title?.trim() || 'Untitled Idea',
    description: draft.description?.trim() || shortText(content, 240),
    content,
    book_type: draft.book_type || 'fiction',
    genre: draft.genre || '',
    category: draft.category || draft.genre || '',
    subcategory: draft.subcategory || '',
    tags: Array.isArray(draft.tags) ? draft.tags.filter(Boolean) : [],
    word_count: wordCount(content),
    is_favorite: !!draft.is_favorite,
    status: draft.status || 'idea',
  };
}

function parseGeneratedIdeas(responseText) {
  const raw = stripFences(extractText(responseText));

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : parsed?.ideas || [];
  } catch {
    const firstBracket = raw.indexOf('[');
    const lastBracket = raw.lastIndexOf(']');

    if (firstBracket >= 0 && lastBracket > firstBracket) {
      const sliced = raw.slice(firstBracket, lastBracket + 1);
      const parsed = JSON.parse(sliced);
      return Array.isArray(parsed) ? parsed : parsed?.ideas || [];
    }

    throw new Error('Idea Lab returned non-JSON output.');
  }
}

function getDefaultFormatForLane(contentLane) {
  if (contentLane === 'nonfiction') return 'standalone_book';
  if (contentLane === 'erotica') return 'novel';
  return 'novel';
}

function getDefaultToneForLane(contentLane) {
  if (contentLane === 'nonfiction') return 'Investigative';
  if (contentLane === 'erotica') return 'Sensual';
  return 'Cinematic';
}

function getBookTypeForGeneratedIdea(form) {
  if (form.contentLane === 'nonfiction') return 'nonfiction';
  if (form.contentLane === 'erotica') return 'erotica';
  if (form.projectFormat === 'anthology') return 'anthology';
  return form.bookType || 'fiction';
}

function getCategoryForGeneratedIdea(form) {
  if (form.contentLane === 'fiction') {
    if (form.projectFormat === 'anthology') return 'Fiction Anthology';
    if (form.projectFormat === 'series') return 'Fiction Series';
    if (form.projectFormat === 'short_story') return 'Short Story';
    if (form.projectFormat === 'character') return 'Character';
    if (form.projectFormat === 'setting') return 'Setting / World';
    if (form.projectFormat === 'twist') return 'Twist / Reveal';
    if (form.projectFormat === 'opening_scene') return 'Opening Scene';
    return form.subtype || 'Fiction';
  }

  if (form.contentLane === 'nonfiction') {
    if (form.projectFormat === 'anthology') return 'Nonfiction Anthology';
    if (form.projectFormat === 'training_manual') return 'Training Manual';
    if (form.projectFormat === 'course_curriculum') return 'Course / Curriculum';
    if (form.projectFormat === 'case_study_collection') return 'Case Study Collection';
    if (form.projectFormat === 'reference_book') return 'Reference Book';
    if (form.projectFormat === 'workbook') return 'Workbook';
    if (form.projectFormat === 'series') return 'Nonfiction Series';
    return form.subtype || 'Nonfiction';
  }

  if (form.contentLane === 'erotica') {
    if (form.projectFormat === 'anthology') return 'Erotica Anthology';
    if (form.projectFormat === 'series') return 'Erotica Series';
    if (form.projectFormat === 'novella') return 'Erotica Novella';
    if (form.projectFormat === 'short_story') return 'Erotic Short Story';
    return form.subtype || 'Erotica';
  }

  return 'Idea Lab';
}

function getFormatLabel(form) {
  const options = FORMAT_OPTIONS_BY_LANE[form.contentLane] || [];
  return options.find((option) => option.value === form.projectFormat)?.label || form.projectFormat;
}

function getExtraGeneratedTags(form) {
  const tags = ['ai-generated', 'idea-lab', form.contentLane, form.projectFormat, form.originality];

  if (form.contentLane === 'fiction' && form.projectFormat === 'anthology') {
    tags.push('fiction-anthology', 'story-collection');
  }

  if (form.contentLane === 'nonfiction' && form.projectFormat === 'anthology') {
    tags.push('nonfiction-anthology', 'essay-collection');
  }

  if (form.contentLane === 'erotica') {
    tags.push('adult-fiction', 'erotica-concept');
  }

  if (form.subtype) {
    tags.push(String(form.subtype).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
  }

  return tags.filter(Boolean);
}

function normalizeGeneratedIdea(item, form) {
  const title = String(item?.title || '').trim();
  const logline = String(item?.logline || item?.description || '').trim();
  const fullIdea = String(item?.fullIdea || item?.full_idea || item?.content || '').trim();

  const modelTags = Array.isArray(item?.tags) ? item.tags : [];
  const cleanTags = Array.from(new Set([...modelTags, ...getExtraGeneratedTags(form)].filter(Boolean)));

  const sections = [
    item?.hook ? `HOOK:\n${item.hook}` : '',
    item?.umbrellaConcept || item?.umbrella_concept
      ? `UMBRELLA CONCEPT:\n${item.umbrellaConcept || item.umbrella_concept}`
      : '',
    item?.pieceTypes || item?.piece_types || item?.storyTypes || item?.story_types
      ? `STORY / PIECE TYPES:\n${item.pieceTypes || item.piece_types || item.storyTypes || item.story_types}`
      : '',
    item?.thesis ? `THESIS:\n${item.thesis}` : '',
    item?.readerPromise || item?.reader_promise
      ? `READER PROMISE:\n${item.readerPromise || item.reader_promise}`
      : '',
    item?.audience ? `AUDIENCE:\n${item.audience}` : '',
    item?.protagonist ? `PROTAGONIST / CENTRAL HUMAN ANGLE:\n${item.protagonist}` : '',
    item?.centralRelationship || item?.central_relationship
      ? `CENTRAL RELATIONSHIP / DYNAMIC:\n${item.centralRelationship || item.central_relationship}`
      : '',
    item?.conflict ? `CONFLICT / PRESSURE:\n${item.conflict}` : '',
    item?.setting ? `SETTING / SUBJECT FIELD:\n${item.setting}` : '',
    item?.storyEngine || item?.story_engine || item?.collectionEngine || item?.collection_engine
      ? `ENGINE:\n${item.storyEngine || item.story_engine || item.collectionEngine || item.collection_engine}`
      : '',
    item?.twistPotential || item?.twist_potential
      ? `TWIST / REVERSAL / PRESSURE POINT:\n${item.twistPotential || item.twist_potential}`
      : '',
    item?.seriesPotential || item?.series_potential
      ? `SERIES / ANTHOLOGY POTENTIAL:\n${item.seriesPotential || item.series_potential}`
      : '',
    item?.whyItGrabs || item?.why_it_grabs
      ? `WHY IT GRABS:\n${item.whyItGrabs || item.why_it_grabs}`
      : '',
    item?.whatMakesItDifferent || item?.what_makes_it_different
      ? `WHAT MAKES IT DIFFERENT:\n${item.whatMakesItDifferent || item.what_makes_it_different}`
      : '',
    item?.developmentNotes || item?.development_notes
      ? `DEVELOPMENT NOTES:\n${item.developmentNotes || item.development_notes}`
      : '',
  ].filter(Boolean);

  const content =
    fullIdea ||
    [
      title ? `TITLE:\n${title}` : '',
      logline ? `LOGLINE:\n${logline}` : '',
      ...sections,
    ]
      .filter(Boolean)
      .join('\n\n');

  return normalizeIdeaForEdit(
    {
      title: title || 'Untitled Idea Lab Concept',
      description: logline || shortText(content, 240),
      content,
      book_type: getBookTypeForGeneratedIdea(form),
      genre: String(item?.genre || form.subtype || '').trim(),
      category: String(item?.category || item?.marketLane || item?.market_lane || getCategoryForGeneratedIdea(form)).trim(),
      subcategory: String(item?.format || getFormatLabel(form)).trim(),
      tags: cleanTags,
      status: 'idea',
    },
    form.bookType || 'fiction'
  );
}

export default function IdeasCatalogBrowser({ bookType, selectedPrompt, onSelectPrompt, onUsePrompt }) {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState(bookType || 'fiction');
  const [shelfFilter, setShelfFilter] = useState('all');
  const [filterGenre, setFilterGenre] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterTag, setFilterTag] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [page, setPage] = useState(0);

  const [selectedIdea, setSelectedIdea] = useState(null);
  const [modalMode, setModalMode] = useState('view');

  const [labOpen, setLabOpen] = useState(false);
  const [importingCatalog, setImportingCatalog] = useState(false);
  const [importProgress, setImportProgress] = useState('');

  const { data: allPrompts = [], isLoading } = useQuery({
    queryKey: ['prompt-catalog'],
    queryFn: () => base44.entities.PromptCatalog.list('-created_date', 2500),
  });

  const countsByType = useMemo(() => {
    const counts = {};
    allPrompts.forEach((idea) => {
      const type = idea.book_type || 'fiction';
      counts[type] = (counts[type] || 0) + 1;
    });
    return counts;
  }, [allPrompts]);

  const anthologyCount = countsByType.anthology || 0;
  const childrenCount = countsByType.children || 0;

  const baseTypeItems = useMemo(() => {
    return allPrompts.filter((p) => {
      if (!typeFilter) return true;
      return !p.book_type || p.book_type === typeFilter;
    });
  }, [allPrompts, typeFilter]);

  const genres = useMemo(() => uniqueCount(baseTypeItems, 'genre'), [baseTypeItems]);
  const categories = useMemo(() => uniqueCount(baseTypeItems, 'category'), [baseTypeItems]);

  const allTags = useMemo(() => {
    const counts = {};
    baseTypeItems.forEach((p) => {
      (p.tags || []).forEach((tag) => {
        counts[tag] = (counts[tag] || 0) + 1;
      });
    });

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 28);
  }, [baseTypeItems]);

  const filtered = useMemo(() => {
    let items = [...baseTypeItems];

    if (shelfFilter === 'favorites') {
      items = items.filter((p) => p.is_favorite || (p.tags || []).includes('favorite'));
    }

    if (shelfFilter === 'recent') {
      items = [...items]
        .sort((a, b) => String(b.created_date || '').localeCompare(String(a.created_date || '')))
        .slice(0, 80);
    }

    if (shelfFilter === 'anthology') {
      items = items.filter((p) => {
        const hay = `${p.book_type || ''} ${p.genre || ''} ${p.category || ''} ${(p.tags || []).join(' ')}`.toLowerCase();
        return hay.includes('anthology') || hay.includes('collection') || hay.includes('short');
      });
    }

    if (shelfFilter === 'series') {
      items = items.filter((p) => {
        const hay = `${p.title || ''} ${p.description || ''} ${p.content || ''} ${(p.tags || []).join(' ')}`.toLowerCase();
        return hay.includes('series') || hay.includes('saga') || hay.includes('book 1') || hay.includes('franchise');
      });
    }

    if (shelfFilter === 'short') {
      items = items.filter((p) => {
        const hay = `${p.book_type || ''} ${p.genre || ''} ${p.category || ''} ${(p.tags || []).join(' ')} ${p.description || ''}`.toLowerCase();
        return hay.includes('short') || hay.includes('story') || hay.includes('anthology');
      });
    }

    if (filterGenre) items = items.filter((p) => p.genre === filterGenre);
    if (filterCategory) items = items.filter((p) => p.category === filterCategory);
    if (filterTag) items = items.filter((p) => (p.tags || []).includes(filterTag));

    if (search.trim()) {
      const q = search.toLowerCase();

      items = items.filter((p) => {
        return (
          (p.title || '').toLowerCase().includes(q) ||
          (p.description || '').toLowerCase().includes(q) ||
          (p.content || '').toLowerCase().includes(q) ||
          (p.genre || '').toLowerCase().includes(q) ||
          (p.category || '').toLowerCase().includes(q) ||
          (p.subcategory || '').toLowerCase().includes(q) ||
          (p.tags || []).some((t) => t.toLowerCase().includes(q))
        );
      });
    }

    switch (sortBy) {
      case 'az':
        items.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
        break;
      case 'za':
        items.sort((a, b) => (b.title || '').localeCompare(a.title || ''));
        break;
      case 'longest':
        items.sort((a, b) => wordCount(getIdeaText(b)) - wordCount(getIdeaText(a)));
        break;
      case 'shortest':
        items.sort((a, b) => wordCount(getIdeaText(a)) - wordCount(getIdeaText(b)));
        break;
      case 'newest':
      default:
        items.sort((a, b) => String(b.created_date || '').localeCompare(String(a.created_date || '')));
        break;
    }

    return items;
  }, [baseTypeItems, shelfFilter, filterGenre, filterCategory, filterTag, search, sortBy]);

  const paged = useMemo(() => {
    return filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  }, [filtered, page]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  const hasActiveFilters =
    !!search || !!filterGenre || !!filterCategory || !!filterTag || shelfFilter !== 'all';

  const clearFilters = () => {
    setSearch('');
    setFilterGenre('');
    setFilterCategory('');
    setFilterTag('');
    setShelfFilter('all');
    setSortBy('newest');
    setPage(0);
  };

  const openIdea = (idea, mode = 'view') => {
    const clean = normalizeIdeaForEdit(idea, typeFilter);
    setSelectedIdea(clean);
    setModalMode(mode);
    if (onSelectPrompt) onSelectPrompt(idea);
  };

  const closeModal = () => {
    setSelectedIdea(null);
    setModalMode('view');
  };

  const refreshCatalog = () => {
    queryClient.invalidateQueries(['prompt-catalog']);
  };

  const handleImportCatalog = async () => {
    setImportingCatalog(true);
    setImportProgress('Starting import…');

    try {
      const result = await importAnthologyCatalog(base44, setImportProgress);
      toast.success(`Imported ${result.created} ideas (${result.skipped} already existed)`);
      refreshCatalog();
    } catch (err) {
      toast.error('Import failed: ' + (err?.message || 'unknown'));
    } finally {
      setImportingCatalog(false);
      setImportProgress('');
    }
  };

  const handleSaveIdea = async (draft) => {
    const payload = buildIdeaPayload(draft);

    try {
      if (draft.id) {
        await base44.entities.PromptCatalog.update(draft.id, payload);
        toast.success('Idea updated');
      } else {
        const created = await base44.entities.PromptCatalog.create(payload);
        toast.success('Idea saved to catalog');
        setSelectedIdea(normalizeIdeaForEdit(created || payload, typeFilter));
      }

      refreshCatalog();
      setModalMode('view');
    } catch (err) {
      toast.error('Save failed: ' + (err?.message || 'unknown error'));
    }
  };

  const handleSaveGeneratedIdea = async (idea) => {
    const payload = buildIdeaPayload(idea);

    try {
      const created = await base44.entities.PromptCatalog.create(payload);
      toast.success('Saved to catalog');
      refreshCatalog();
      return created || payload;
    } catch (err) {
      toast.error('Save failed: ' + (err?.message || 'unknown error'));
      return null;
    }
  };

  const handleDuplicateIdea = async (draft) => {
    const payload = buildIdeaPayload({
      ...draft,
      title: `${draft.title || 'Untitled Idea'} — Variation`,
    });

    try {
      const created = await base44.entities.PromptCatalog.create(payload);
      toast.success('Idea duplicated');
      refreshCatalog();
      setSelectedIdea(normalizeIdeaForEdit(created || payload, typeFilter));
      setModalMode('edit');
    } catch (err) {
      toast.error('Duplicate failed: ' + (err?.message || 'unknown error'));
    }
  };

  const handleDeleteIdea = async (draft) => {
    if (!draft?.id) {
      closeModal();
      return;
    }

    const ok = window.confirm(`Delete "${draft.title || 'this idea'}" from the catalog?`);
    if (!ok) return;

    try {
      await base44.entities.PromptCatalog.delete(draft.id);
      toast.success('Idea deleted');
      refreshCatalog();
      closeModal();
    } catch (err) {
      toast.error('Delete failed: ' + (err?.message || 'unknown error'));
    }
  };

  const handleToggleFavorite = async (idea) => {
    const draft = normalizeIdeaForEdit(idea, typeFilter);
    const next = {
      ...draft,
      is_favorite: !draft.is_favorite,
    };

    try {
      if (draft.id) {
        await base44.entities.PromptCatalog.update(draft.id, buildIdeaPayload(next));
        refreshCatalog();
        if (selectedIdea?.id === draft.id) setSelectedIdea(next);
      }
    } catch {
      toast.error('Favorite update failed');
    }
  };

  const handleUseIdea = (idea) => {
    const payload = {
      ...idea,
      content: idea.content || idea.description || '',
      description: idea.description || shortText(idea.content, 240),
    };

    if (onUsePrompt) onUsePrompt(payload);
    toast.success('Idea sent forward');
  };

  const handleCopyIdea = async (idea) => {
    const text = [
      idea.title,
      idea.genre ? `Genre: ${idea.genre}` : '',
      idea.book_type ? `Type: ${idea.book_type}` : '',
      '',
      idea.description || '',
      '',
      idea.content || '',
    ]
      .filter((line) => line !== null && line !== undefined)
      .join('\n');

    await navigator.clipboard.writeText(text);
    toast.success('Idea copied');
  };

  const handleCreateBlank = () => {
    const blank = normalizeIdeaForEdit(
      {
        title: '',
        description: '',
        content: '',
        book_type: typeFilter,
        genre: filterGenre || '',
        category: filterCategory || '',
        tags: [],
      },
      typeFilter
    );

    setSelectedIdea(blank);
    setModalMode('edit');
  };

  const handleOpenGeneratedIdea = (idea) => {
    setSelectedIdea(normalizeIdeaForEdit(idea, typeFilter));
    setModalMode('edit');
    setLabOpen(false);
  };

  return (
    <div className="h-full min-h-0 space-y-4 overflow-y-auto pr-1">
      <div className="overflow-hidden rounded-3xl border border-border/70 bg-gradient-to-br from-card via-card/95 to-muted/60 p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="notebook-kicker">Idea Catalog</p>
            <h2 className="font-display text-3xl text-[var(--notebook-ink)]">
              Creative IP Vault
            </h2>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">
              Browse, filter, open, edit, duplicate, and develop story ideas without losing the spark.
              Click any card to read the full idea and work with it.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={handleCreateBlank}
              size="sm"
              variant="outline"
              className="rounded-full gap-1.5 text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              New Idea
            </Button>

            <Button
              onClick={() => setLabOpen(true)}
              size="sm"
              className="rounded-full gap-1.5 text-xs"
            >
              <Wand2 className="h-3.5 w-3.5" />
              Inspiration Lab
            </Button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <StatCard label="Total Ideas" value={allPrompts.length} icon={Library} />
          <StatCard label="Showing" value={filtered.length} icon={Grid3X3} />
          <StatCard label="Genres" value={genres.length} icon={Layers} />
          <StatCard label="Favorites" value={allPrompts.filter((p) => p.is_favorite).length} icon={Star} />
        </div>
      </div>

      <div className="grid min-h-0 gap-4 lg:grid-cols-[250px_minmax(0,1fr)]">
        <aside className="space-y-3 rounded-3xl border border-border/70 bg-card/80 p-3 shadow-sm lg:sticky lg:top-2 lg:self-start">
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              Book Type
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {TYPE_FILTERS.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => {
                    setTypeFilter(type.value);
                    setShelfFilter('all');
                    setFilterGenre('');
                    setFilterCategory('');
                    setFilterTag('');
                    setPage(0);
                  }}
                  className={`rounded-2xl border px-2 py-2 text-left text-xs transition ${
                    typeFilter === type.value
                      ? 'border-primary/40 bg-primary/10 text-foreground'
                      : 'border-border/50 bg-background/50 text-muted-foreground hover:bg-muted/60'
                  }`}
                >
                  <div className="text-base">{type.icon}</div>
                  <div className="font-semibold">{type.label}</div>
                  <div className="text-[10px] opacity-70">{countsByType[type.value] || 0}</div>
                </button>
              ))}
            </div>

            {(anthologyCount === 0 || childrenCount === 0) && (
              <Button
                size="sm"
                variant="outline"
                className="mt-2 h-8 w-full rounded-full gap-1 text-[10px]"
                disabled={importingCatalog}
                onClick={handleImportCatalog}
              >
                {importingCatalog ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {importProgress.substring(0, 32)}
                  </>
                ) : (
                  <>
                    <ImagePlus className="h-3 w-3" />
                    Import Ideas
                  </>
                )}
              </Button>
            )}
          </div>

          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              Shelves
            </p>
            <div className="space-y-1">
              {QUICK_SHELVES.map((shelf) => {
                const Icon = shelf.icon;
                const active = shelfFilter === shelf.id;

                return (
                  <button
                    key={shelf.id}
                    type="button"
                    onClick={() => {
                      setShelfFilter(shelf.id);
                      setPage(0);
                    }}
                    className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs transition ${
                      active
                        ? 'bg-primary/10 text-foreground'
                        : 'text-muted-foreground hover:bg-muted/60'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span className="font-medium">{shelf.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              Categories
            </p>
            <div className="max-h-[270px] space-y-1 overflow-y-auto pr-1">
              {categories.slice(0, 40).map(([cat, count]) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    setFilterCategory((prev) => (prev === cat ? '' : cat));
                    setPage(0);
                  }}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-1.5 text-left text-xs transition ${
                    filterCategory === cat
                      ? 'bg-primary/10 text-foreground'
                      : 'text-muted-foreground hover:bg-muted/60'
                  }`}
                >
                  <span className="truncate">{cat}</span>
                  <span className="ml-2 text-[10px] opacity-70">{count}</span>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <main className="min-w-0 space-y-3">
          <div className="rounded-3xl border border-border/70 bg-card/80 p-3 shadow-sm">
            <div className="flex flex-wrap gap-2">
              <div className="relative min-w-[240px] flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(0);
                  }}
                  placeholder="Search titles, premises, tags, genres…"
                  className="rounded-full pl-9"
                />
              </div>

              <Select
                value={filterGenre || '_all'}
                onValueChange={(value) => {
                  setFilterGenre(value === '_all' ? '' : value);
                  setPage(0);
                }}
              >
                <SelectTrigger className="h-10 w-[160px] rounded-full text-xs">
                  <SelectValue placeholder="Genre" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">All genres</SelectItem>
                  {genres.map(([genre, count]) => (
                    <SelectItem key={genre} value={genre}>
                      {genre} ({count})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="h-10 w-[150px] rounded-full text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="h-10 rounded-full gap-1 text-xs text-muted-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                  Clear
                </Button>
              )}
            </div>

            {allTags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {allTags.map(([tag, count]) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      setFilterTag((prev) => (prev === tag ? '' : tag));
                      setPage(0);
                    }}
                    className={`rounded-full px-2 py-1 text-[10px] transition ${
                      filterTag === tag
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-accent/40 text-accent-foreground hover:bg-accent/70'
                    }`}
                  >
                    {tag} ({count})
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Filter className="h-3.5 w-3.5" />
              <span>
                Showing <strong className="text-foreground">{filtered.length}</strong> ideas
              </span>
            </div>

            {totalPages > 1 && (
              <div className="text-[10px] text-muted-foreground">
                Page {page + 1} / {totalPages}
              </div>
            )}
          </div>

          {isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : paged.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border/70 bg-card/60 p-10 text-center">
              <Archive className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">No ideas found.</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Clear filters, import the catalog, or use Inspiration Lab to create a new spark.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {paged.map((idea) => (
                <IdeaCard
                  key={idea.id}
                  idea={idea}
                  selected={selectedPrompt?.id === idea.id}
                  onOpen={() => openIdea(idea, 'view')}
                  onEdit={() => openIdea(idea, 'edit')}
                  onUse={() => handleUseIdea(normalizeIdeaForEdit(idea, typeFilter))}
                  onFavorite={() => handleToggleFavorite(idea)}
                  onTag={(tag) => {
                    setFilterTag(tag);
                    setPage(0);
                  }}
                />
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="rounded-full text-xs"
              >
                Prev
              </Button>

              <span className="text-[10px] text-muted-foreground">
                {page + 1} / {totalPages}
              </span>

              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                className="rounded-full text-xs"
              >
                Next
              </Button>
            </div>
          )}
        </main>
      </div>

      {selectedIdea && (
        <IdeaDetailModal
          idea={selectedIdea}
          mode={modalMode}
          setMode={setModalMode}
          onClose={closeModal}
          onChange={setSelectedIdea}
          onSave={handleSaveIdea}
          onDuplicate={handleDuplicateIdea}
          onDelete={handleDeleteIdea}
          onUse={handleUseIdea}
          onCopy={handleCopyIdea}
        />
      )}

      {labOpen && (
        <IdeaLabModal
          onClose={() => setLabOpen(false)}
          typeFilter={typeFilter}
          filterGenre={filterGenre}
          visibleIdeas={filtered}
          allIdeas={baseTypeItems}
          onSaveGenerated={handleSaveGeneratedIdea}
          onUseGenerated={handleUseIdea}
          onOpenGenerated={handleOpenGeneratedIdea}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, icon: Icon }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/55 p-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {label}
        </span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="mt-1 text-2xl font-bold text-foreground">{value}</div>
    </div>
  );
}

function IdeaCard({ idea, selected, onOpen, onEdit, onUse, onFavorite, onTag }) {
  const text = getIdeaDescription(idea);
  const tags = idea.tags || [];

  return (
    <article
      className={`group flex min-h-[220px] flex-col rounded-3xl border bg-card/85 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
        selected ? 'border-primary/40 ring-2 ring-primary/15' : 'border-border/70'
      }`}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
          <div className="mb-1 flex flex-wrap gap-1">
            {idea.book_type && (
              <Badge variant="secondary" className="rounded-full text-[9px] capitalize">
                {idea.book_type}
              </Badge>
            )}
            {idea.genre && (
              <Badge variant="outline" className="rounded-full text-[9px]">
                {idea.genre}
              </Badge>
            )}
          </div>

          <h3 className="line-clamp-2 text-base font-bold leading-tight text-foreground">
            {idea.title || 'Untitled Idea'}
          </h3>
        </button>

        <button
          type="button"
          onClick={onFavorite}
          className={`rounded-full p-1.5 transition ${
            idea.is_favorite
              ? 'bg-amber-500/15 text-amber-600'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
          title="Favorite"
        >
          <Heart className={`h-3.5 w-3.5 ${idea.is_favorite ? 'fill-current' : ''}`} />
        </button>
      </div>

      <button type="button" onClick={onOpen} className="flex-1 text-left">
        <p className="line-clamp-5 text-xs leading-5 text-muted-foreground">
          {shortText(text, 390) || 'No description yet. Click to open and develop this idea.'}
        </p>
      </button>

      <div className="mt-3 flex flex-wrap gap-1">
        {tags.slice(0, 4).map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => onTag(tag)}
            className="rounded-full bg-accent/35 px-2 py-0.5 text-[9px] text-accent-foreground hover:bg-accent/70"
          >
            {tag}
          </button>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-3">
        <span className="text-[10px] text-muted-foreground">
          {wordCount(getIdeaText(idea))} words
          {idea.created_date ? ` · ${prettyDate(idea.created_date)}` : ''}
        </span>

        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={onEdit} className="h-7 rounded-full px-2 text-[10px]">
            <Pencil className="mr-1 h-3 w-3" />
            Edit
          </Button>
          <Button size="sm" onClick={onUse} className="h-7 rounded-full px-2 text-[10px]">
            Use
          </Button>
        </div>
      </div>
    </article>
  );
}

function IdeaLabModal({
  onClose,
  typeFilter,
  filterGenre,
  visibleIdeas,
  allIdeas,
  onSaveGenerated,
  onUseGenerated,
  onOpenGenerated,
}) {
  const initialLane =
    typeFilter === 'nonfiction' ? 'nonfiction' : typeFilter === 'erotica' ? 'erotica' : 'fiction';

  const [form, setForm] = useState({
    contentLane: initialLane,
    projectFormat: getDefaultFormatForLane(initialLane),
    subtype: filterGenre || '',
    tone: getDefaultToneForLane(initialLane),
    originality: 'fresh_marketable',
    count: 6,
    seed: '',
    bookType: typeFilter || initialLane,
  });

  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState([]);
  const [savedIds, setSavedIds] = useState({});
  const [copiedIndex, setCopiedIndex] = useState(null);

  const currentFormatOptions = FORMAT_OPTIONS_BY_LANE[form.contentLane] || FORMAT_OPTIONS_BY_LANE.fiction;
  const currentSubtypeOptions = SUBTYPE_OPTIONS_BY_LANE[form.contentLane] || SUBTYPE_OPTIONS_BY_LANE.fiction;
  const currentToneOptions = TONE_OPTIONS_BY_LANE[form.contentLane] || TONE_OPTIONS_BY_LANE.fiction;

  const update = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  const handleLaneChange = (contentLane) => {
    update({
      contentLane,
      projectFormat: getDefaultFormatForLane(contentLane),
      subtype: '',
      tone: getDefaultToneForLane(contentLane),
      bookType: contentLane,
    });
    setResults([]);
    setSavedIds({});
  };

  const inspirationPool = useMemo(() => {
    const pool = visibleIdeas?.length >= 3 ? visibleIdeas : allIdeas || [];
    return [...pool].slice(0, 16);
  }, [visibleIdeas, allIdeas]);

  const buildInspirationFragments = () => {
    if (!inspirationPool.length) return 'No existing catalog fragments available. Generate from user direction only.';

    const shuffled = [...inspirationPool].sort(() => Math.random() - 0.5).slice(0, 7);

    return shuffled
      .map((p, index) => {
        return `CATALOG FRAGMENT ${index + 1}
TITLE: ${p.title || 'Untitled'}
TYPE: ${p.book_type || 'unknown'}
GENRE: ${p.genre || p.category || 'unknown'}
TAGS: ${(p.tags || []).join(', ') || 'none'}
PREMISE:
${String(getIdeaDescription(p)).slice(0, 650)}`;
      })
      .join('\n\n---\n\n');
  };

  const buildLaneInstruction = () => {
    if (form.contentLane === 'fiction') {
      return `FICTION LANE:
- Generate invented story concepts only.
- Do not generate nonfiction essay collections, manuals, academic books, or training books.
- Use protagonist, conflict, setting, genre pressure, story engine, escalation, and emotional stakes.
- If format is Anthology / Story Collection, generate a FICTION collection with fictional stories connected by theme, image, setting, mood, premise, or recurring moral pressure.`;
    }

    if (form.contentLane === 'nonfiction') {
      return `NONFICTION LANE:
- Generate nonfiction concepts only.
- Do not create fictional protagonists, fictional plots, or fictional short stories.
- Use thesis, reader promise, subject boundary, audience, chapter/piece engine, evidence style, and practical/commercial positioning.
- If format is Anthology / Essay Collection, create a curated nonfiction collection: essays, investigations, case studies, profiles, histories, interviews, meditations, lessons, or training pieces.
- Avoid fake citations, fake experts, fake credentials, and unsupported claims.`;
    }

    return `EROTICA LANE:
- Generate adult fiction concepts only, centered on consenting adults.
- Keep output as publishing-safe concept development, not graphic scene content.
- Do not include minors, coercion, exploitation, incest, non-consent, sexual violence, or illegal sexual content.
- Focus on premise, romantic/sexual tension, adult character dynamics, emotional stakes, setting, trope, conflict, and series/anthology potential.
- If format is Anthology / Collection, create an adult story collection with a clear theme, trope pattern, or emotional/romantic throughline.`;
  };

  const buildFormatInstruction = () => {
    const lane = form.contentLane;
    const format = form.projectFormat;

    if (lane === 'fiction') {
      const map = {
        novel: 'Create full novel concepts with protagonist, conflict, escalation, market hook, and ending pressure.',
        short_story: 'Create compact short story concepts built around a sharp image, turn, emotional wound, or twist ending.',
        anthology: 'Create fiction anthology / story collection concepts with a unifying theme and multiple story-type possibilities.',
        series: 'Create series concepts with a repeatable engine, long-term escalation, book-to-book promise, and franchise potential.',
        character: 'Create character-centered concepts with a vivid person, want, wound, contradiction, and story pressure.',
        setting: 'Create setting/world concepts with rules, texture, social pressure, danger, and multiple story possibilities.',
        twist: 'Create twist/reveal concepts that could power a larger plot, not just a gimmick.',
        opening_scene: 'Create opening-scene concepts that immediately establish voice, image, tension, and a story question.',
      };
      return map[format] || map.novel;
    }

    if (lane === 'nonfiction') {
      const map = {
        standalone_book: 'Create standalone nonfiction book concepts with thesis, reader promise, audience, chapter engine, and market lane.',
        anthology: 'Create nonfiction anthology / essay collection concepts with a thesis umbrella and a clear structure for included pieces.',
        series: 'Create nonfiction series concepts with multiple book volumes, repeatable promise, and clear reader/audience value.',
        training_manual: 'Create practical training manual / guide concepts with modules, learning outcomes, compliance/use-case clarity, and applied exercises.',
        course_curriculum: 'Create course/curriculum concepts with lessons, sequence, outcomes, worksheets, and teachable progression.',
        case_study_collection: 'Create case study collection concepts with cases, analysis framework, lessons learned, and audience takeaway.',
        reference_book: 'Create reference book concepts with structure, categories, definitions, examples, and lookup value.',
        workbook: 'Create workbook / guided journal concepts with prompts, exercises, reflection structure, and transformation path.',
      };
      return map[format] || map.standalone_book;
    }

    const map = {
      novel: 'Create adult erotic novel concepts with adult character dynamics, romantic/sexual tension, conflict, emotional stakes, and a marketable hook.',
      novella: 'Create compact adult novella concepts with a tight trope, fast tension, strong couple dynamic, and clean commercial pitch.',
      short_story: 'Create adult erotic short story concepts centered on a vivid setup, emotional charge, and satisfying turn.',
      anthology: 'Create adult erotica anthology / collection concepts with a unifying trope, setting, theme, or relationship pattern.',
      series: 'Create adult erotic series concepts with a repeatable premise, recurring world, escalating relationship/conflict engine, and multiple-book potential.',
      character_dynamic: 'Create adult character/couple dynamic concepts with tension, contradiction, boundaries, desire, and emotional stakes.',
      setting_scenario: 'Create adult setting/scenario concepts with atmosphere, trope pressure, power dynamics between consenting adults, and story potential.',
    };
    return map[form.projectFormat] || map.novel;
  };

  const handleGenerate = async () => {
    setBusy(true);
    setResults([]);

    try {
      const originalityInstruction = {
        safe_commercial:
          'Keep the ideas broadly commercial and easy to pitch, but still specific and non-generic.',
        fresh_marketable:
          'Make the ideas fresh, marketable, and noticeably less obvious than standard genre pitches.',
        weird_risky:
          'Make the ideas stranger, riskier, more memorable, and more conceptually charged while remaining usable.',
        unhinged:
          'Push the ideas into bold, wild, high-concept territory. They can be outrageous, funny, disturbing, surreal, or provocative, but they must still have a usable publishing engine.',
      }[form.originality];

      const response = await invokeLLMWithRetry({
        max_tokens: 4800,
        temperature: 1.05,
        prompt: `You are a ruthless professional story-development editor, nonfiction acquisitions strategist, and publishing-minded creative director.

Your job is to generate truly useful, original catalog-ready ideas for a writing app.

DO NOT produce generic AI slop.
DO NOT use vague premises like "must uncover the truth" unless the truth is specific, strange, and concrete.
DO NOT rely on clichés like "chosen one", "secret past", "ancient evil", "unlikely hero", "dark secrets", or "world will never be the same" without a fresh mechanism.
DO NOT summarize existing catalog fragments. Use them only as loose inspiration.
DO NOT merely combine fragments mechanically.
DO NOT output markdown. DO NOT output commentary outside JSON.

GENERATION SETTINGS:
Content lane: ${form.contentLane}
Project format: ${getFormatLabel(form)}
Subtype / market lane: ${form.subtype || 'open subtype'}
Tone: ${form.tone}
Originality level: ${form.originality}
Originality instruction: ${originalityInstruction}
Number of ideas required: ${form.count}

LANE RULES:
${buildLaneInstruction()}

FORMAT RULES:
${buildFormatInstruction()}

USER SEED / DIRECTION:
${form.seed || 'No specific seed. Generate from catalog DNA and selected settings.'}

EXISTING CATALOG FRAGMENTS FOR LOOSE INSPIRATION:
${buildInspirationFragments()}

QUALITY BAR:
Every idea must include:
- A title that feels usable, not placeholder
- A concrete hook
- A central human angle, protagonist, couple dynamic, thesis angle, or collection identity
- A setting, subject area, world pressure, relationship pressure, or organizing framework
- A story engine, collection engine, argument engine, or teaching engine
- A twist, reversal, pressure point, contradiction, argument, or thematic charge
- Why the idea grabs
- What makes it different
- Development notes that tell the writer how to expand it

FICTION REQUIREMENTS:
- Use fictional story mechanics.
- Include protagonist/central character when relevant.
- Include story pressure and concrete stakes.
- For fiction anthologies, include the umbrella theme and kinds of fictional stories inside.

NONFICTION REQUIREMENTS:
- Use nonfiction positioning.
- Include thesis, reader promise, subject boundary, and structure.
- For training/manual/curriculum concepts, include learning outcomes, modules, and practical use.
- For academic/scholarly concepts, keep it serious, evidence-minded, and organized.
- Avoid fake citations, fake credentials, and invented source claims.

EROTICA REQUIREMENTS:
- Adult consenting characters only.
- Keep concepts publishing-safe and non-graphic.
- Focus on trope, emotional stakes, relationship dynamic, tension, setting, conflict, and marketable adult-romance positioning.
- Exclude minors, coercion, exploitation, incest, non-consent, sexual violence, or illegal sexual content.

Return ONLY a valid JSON array. No markdown. No commentary. No backticks.

Schema:
[
  {
    "title": "Killer title",
    "genre": "Subtype or genre",
    "format": "Format label",
    "logline": "One sentence hook.",
    "hook": "The specific grab.",
    "umbrellaConcept": "For anthology/collection ideas, the unifying concept.",
    "pieceTypes": "For anthology/nonfiction/training ideas, the types of stories, essays, cases, lessons, modules, or pieces included.",
    "thesis": "For nonfiction ideas, the central argument or organizing claim.",
    "readerPromise": "For nonfiction ideas, what the reader gets.",
    "audience": "Target reader or market.",
    "protagonist": "Specific protagonist, central human angle, or main character/couple if applicable.",
    "centralRelationship": "For romance/erotica/adult fiction, the core adult relationship or dynamic if applicable.",
    "conflict": "Central conflict, pressure, question, contradiction, or argument.",
    "setting": "Distinctive setting, subject field, world, or pressure system.",
    "storyEngine": "They must [objective] before [deadline/threat] or else [consequence], OR the collection/book explores [topic] through [recurring structure].",
    "twistPotential": "Specific twist/reversal/pressure point.",
    "seriesPotential": "Series/anthology potential or why it is standalone.",
    "whyItGrabs": "Why a reader would care.",
    "whatMakesItDifferent": "What keeps it from being generic.",
    "developmentNotes": "How to expand this into a real project.",
    "tags": ["tag1", "tag2", "tag3"]
  }
]`,
      });

      const parsed = parseGeneratedIdeas(response)
        .map((item) => normalizeGeneratedIdea(item, form))
        .filter((item) => item.title)
        .slice(0, Number(form.count) || 6);

      if (!parsed.length) {
        throw new Error('No usable ideas returned.');
      }

      setResults(parsed);
      toast.success(`Generated ${parsed.length} ideas`);
    } catch (err) {
      console.error('[IDEA-LAB] Generate failed:', err);
      toast.error('Idea Lab failed: ' + (err?.message || 'unknown error'));
    } finally {
      setBusy(false);
    }
  };

  const handleSave = async (idea, index) => {
    const saved = await onSaveGenerated(idea);
    if (saved) {
      setSavedIds((prev) => ({ ...prev, [index]: true }));
    }
  };

  const handleCopy = async (idea, index) => {
    const text = [
      idea.title,
      idea.genre ? `Genre: ${idea.genre}` : '',
      idea.book_type ? `Type: ${idea.book_type}` : '',
      '',
      idea.description || '',
      '',
      idea.content || '',
    ].join('\n');

    await navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    toast.success('Idea copied');
    setTimeout(() => setCopiedIndex(null), 1800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-border bg-background shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-border/60 bg-card/80 px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <Wand2 className="h-5 w-5 text-primary" />
              <h3 className="font-display text-2xl text-foreground">Inspiration Lab</h3>
            </div>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">
              Build ideas by choosing the lane first, then the format, then the market subtype.
              This keeps fiction, nonfiction, and erotica concepts cleanly separated.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className="grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
            <aside className="space-y-4 rounded-3xl border border-border/60 bg-card/60 p-4">
              <div>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  Step 1 — Content Lane
                </p>

                <div className="grid grid-cols-1 gap-2">
                  {CONTENT_LANES.map((lane) => {
                    const active = form.contentLane === lane.value;

                    return (
                      <button
                        key={lane.value}
                        type="button"
                        onClick={() => handleLaneChange(lane.value)}
                        className={`rounded-2xl border px-3 py-2 text-left transition ${
                          active
                            ? 'border-primary/45 bg-primary/10 text-foreground'
                            : 'border-border/60 bg-background/55 text-muted-foreground hover:bg-muted/60'
                        }`}
                      >
                        <div className="text-xs font-bold">{lane.label}</div>
                        <div className="mt-0.5 text-[10px] leading-4 opacity-80">{lane.description}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  Step 2 — Format
                </p>

                <Field label="Project Format">
                  <Select value={form.projectFormat} onValueChange={(value) => update({ projectFormat: value })}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {currentFormatOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <div className="space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  Step 3 — Market Lane
                </p>

                <Field label={form.contentLane === 'nonfiction' ? 'Nonfiction Type' : form.contentLane === 'erotica' ? 'Erotica Subtype' : 'Genre / Subtype'}>
                  <Select
                    value={form.subtype || '_open'}
                    onValueChange={(value) => update({ subtype: value === '_open' ? '' : value })}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Open subtype" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_open">Open subtype</SelectItem>
                      {currentSubtypeOptions.map((subtype) => (
                        <SelectItem key={subtype} value={subtype}>
                          {subtype}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Tone">
                  <Select value={form.tone} onValueChange={(value) => update({ tone: value })}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {currentToneOptions.map((tone) => (
                        <SelectItem key={tone} value={tone}>
                          {tone}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Originality Level">
                  <Select value={form.originality} onValueChange={(value) => update({ originality: value })}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ORIGINALITY_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="How Many">
                  <Select value={String(form.count)} onValueChange={(value) => update({ count: Number(value) })}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3">3 ideas</SelectItem>
                      <SelectItem value="6">6 ideas</SelectItem>
                      <SelectItem value="10">10 ideas</SelectItem>
                      <SelectItem value="12">12 ideas</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Seed / Direction">
                  <Textarea
                    value={form.seed}
                    onChange={(e) => update({ seed: e.target.value })}
                    placeholder="Optional: hostile design nonfiction exposé, fiction anthology about haunted rest stops, adult romantic suspense series, training manual for caregivers..."
                    className="min-h-[110px] text-xs leading-5"
                  />
                </Field>

                <Button
                  onClick={handleGenerate}
                  disabled={busy}
                  className="w-full rounded-full gap-1.5 text-xs"
                >
                  {busy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  {busy ? 'Generating ideas…' : 'Generate Ideas'}
                </Button>
              </div>

              <div className="rounded-2xl border border-border/60 bg-background/60 p-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                  Catalog DNA
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  The lab can pull loose inspiration from the current filtered catalog, but it is instructed not to simply remix or copy existing ideas.
                </p>
                <p className="mt-2 text-[10px] text-muted-foreground">
                  Inspiration pool: <strong className="text-foreground">{inspirationPool.length}</strong> ideas
                </p>
              </div>
            </aside>

            <main className="min-w-0">
              {results.length === 0 ? (
                <div className="flex min-h-[520px] items-center justify-center rounded-3xl border border-dashed border-border/70 bg-card/45 p-10 text-center">
                  <div>
                    <Wand2 className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                    <p className="text-base font-semibold text-foreground">No generated ideas yet.</p>
                    <p className="mt-1 max-w-md text-xs leading-5 text-muted-foreground">
                      Choose lane, format, subtype, tone, and originality. The results will appear here as saveable idea cards.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {results.map((idea, index) => (
                    <div
                      key={`${idea.title}-${index}`}
                      className="rounded-3xl border border-border/70 bg-card/80 p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex flex-wrap gap-1">
                            {idea.book_type && (
                              <Badge variant="secondary" className="rounded-full text-[9px] capitalize">
                                {idea.book_type}
                              </Badge>
                            )}
                            {idea.genre && (
                              <Badge variant="outline" className="rounded-full text-[9px]">
                                {idea.genre}
                              </Badge>
                            )}
                            {idea.subcategory && (
                              <Badge variant="outline" className="rounded-full text-[9px]">
                                {idea.subcategory}
                              </Badge>
                            )}
                          </div>

                          <h4 className="text-lg font-bold leading-tight text-foreground">
                            {idea.title}
                          </h4>

                          <p className="mt-1 text-xs leading-5 text-muted-foreground">
                            {idea.description}
                          </p>
                        </div>

                        <div className="flex shrink-0 flex-col gap-1">
                          <Button
                            size="sm"
                            onClick={() => handleSave(idea, index)}
                            disabled={!!savedIds[index]}
                            className="h-8 rounded-full gap-1 text-[10px]"
                          >
                            {savedIds[index] ? (
                              <>
                                <Check className="h-3 w-3" />
                                Saved
                              </>
                            ) : (
                              <>
                                <Save className="h-3 w-3" />
                                Save
                              </>
                            )}
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onOpenGenerated(idea)}
                            className="h-8 rounded-full gap-1 text-[10px]"
                          >
                            <Pencil className="h-3 w-3" />
                            Edit
                          </Button>
                        </div>
                      </div>

                      <div className="mt-3 rounded-2xl bg-background/55 p-3">
                        <pre className="whitespace-pre-wrap font-sans text-xs leading-5 text-foreground">
                          {idea.content}
                        </pre>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-3">
                        <div className="flex flex-wrap gap-1">
                          {(idea.tags || []).slice(0, 6).map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full bg-accent/35 px-2 py-0.5 text-[9px] text-accent-foreground"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>

                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleCopy(idea, index)}
                            className="h-7 rounded-full gap-1 text-[10px]"
                          >
                            {copiedIndex === index ? (
                              <Check className="h-3 w-3" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                            Copy
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onUseGenerated(idea)}
                            className="h-7 rounded-full gap-1 text-[10px]"
                          >
                            <Check className="h-3 w-3" />
                            Use
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}

function IdeaDetailModal({
  idea,
  mode,
  setMode,
  onClose,
  onChange,
  onSave,
  onDuplicate,
  onDelete,
  onUse,
  onCopy,
}) {
  const editing = mode === 'edit';

  const update = (patch) => {
    onChange({
      ...idea,
      ...patch,
    });
  };

  const tagText = (idea.tags || []).join(', ');

  const updateTags = (value) => {
    update({
      tags: value
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-border bg-background shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-border/60 bg-card/80 px-5 py-4">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap gap-1.5">
              {idea.book_type && (
                <Badge variant="secondary" className="rounded-full text-[10px] capitalize">
                  {idea.book_type}
                </Badge>
              )}
              {idea.genre && (
                <Badge variant="outline" className="rounded-full text-[10px]">
                  {idea.genre}
                </Badge>
              )}
              {idea.category && idea.category !== idea.genre && (
                <Badge variant="outline" className="rounded-full text-[10px]">
                  {idea.category}
                </Badge>
              )}
            </div>

            {editing ? (
              <Input
                value={idea.title}
                onChange={(e) => update({ title: e.target.value })}
                placeholder="Idea title"
                className="h-11 text-lg font-bold"
              />
            ) : (
              <h3 className="font-display text-2xl leading-tight text-foreground">
                {idea.title || 'Untitled Idea'}
              </h3>
            )}

            <p className="mt-1 text-[10px] text-muted-foreground">
              {wordCount(getIdeaText(idea))} words
              {idea.created_date ? ` · Created ${prettyDate(idea.created_date)}` : ''}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_270px]">
            <main className="space-y-4">
              <section className="rounded-2xl border border-border/60 bg-card/55 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-muted-foreground" />
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                    Short Pitch
                  </p>
                </div>

                {editing ? (
                  <Textarea
                    value={idea.description}
                    onChange={(e) => update({ description: e.target.value })}
                    placeholder="Short pitch / card preview"
                    className="min-h-[90px] text-sm leading-6"
                  />
                ) : (
                  <p className="whitespace-pre-wrap text-sm leading-7 text-foreground">
                    {idea.description || 'No short pitch yet.'}
                  </p>
                )}
              </section>

              <section className="rounded-2xl border border-border/60 bg-card/55 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                    Full Idea
                  </p>
                </div>

                {editing ? (
                  <Textarea
                    value={idea.content}
                    onChange={(e) => update({ content: e.target.value })}
                    placeholder="Full idea, premise, story engine, notes, scenes, twists..."
                    className="min-h-[300px] text-sm leading-7"
                  />
                ) : (
                  <div className="max-w-none whitespace-pre-wrap rounded-xl bg-background/55 p-4 text-sm leading-7 text-foreground">
                    {idea.content || idea.description || 'No full idea text yet.'}
                  </div>
                )}
              </section>
            </main>

            <aside className="space-y-3">
              <div className="rounded-2xl border border-border/60 bg-card/55 p-4">
                <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  Metadata
                </p>

                <div className="space-y-3">
                  <Field label="Type">
                    {editing ? (
                      <Select value={idea.book_type || 'fiction'} onValueChange={(v) => update({ book_type: v })}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fiction">Fiction</SelectItem>
                          <SelectItem value="nonfiction">Nonfiction</SelectItem>
                          <SelectItem value="anthology">Anthology</SelectItem>
                          <SelectItem value="children">Children</SelectItem>
                          <SelectItem value="erotica">Erotica</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="text-xs capitalize text-foreground">{idea.book_type || 'fiction'}</p>
                    )}
                  </Field>

                  <Field label="Genre">
                    {editing ? (
                      <Input value={idea.genre} onChange={(e) => update({ genre: e.target.value })} className="h-8 text-xs" />
                    ) : (
                      <p className="text-xs text-foreground">{idea.genre || '—'}</p>
                    )}
                  </Field>

                  <Field label="Category">
                    {editing ? (
                      <Input value={idea.category} onChange={(e) => update({ category: e.target.value })} className="h-8 text-xs" />
                    ) : (
                      <p className="text-xs text-foreground">{idea.category || '—'}</p>
                    )}
                  </Field>

                  <Field label="Subcategory / Series">
                    {editing ? (
                      <Input value={idea.subcategory} onChange={(e) => update({ subcategory: e.target.value })} className="h-8 text-xs" />
                    ) : (
                      <p className="text-xs text-foreground">{idea.subcategory || '—'}</p>
                    )}
                  </Field>

                  <Field label="Tags">
                    {editing ? (
                      <Input value={tagText} onChange={(e) => updateTags(e.target.value)} className="h-8 text-xs" placeholder="tag, tag, tag" />
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {(idea.tags || []).length ? (
                          idea.tags.map((tag) => (
                            <span key={tag} className="rounded-full bg-accent/35 px-2 py-0.5 text-[10px]">
                              {tag}
                            </span>
                          ))
                        ) : (
                          <p className="text-xs text-muted-foreground">—</p>
                        )}
                      </div>
                    )}
                  </Field>
                </div>
              </div>

              <div className="rounded-2xl border border-border/60 bg-card/55 p-4">
                <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  Actions
                </p>

                <div className="grid gap-2">
                  {editing ? (
                    <Button onClick={() => onSave(idea)} size="sm" className="rounded-full gap-1 text-xs">
                      <Save className="h-3.5 w-3.5" />
                      Save Changes
                    </Button>
                  ) : (
                    <Button onClick={() => setMode('edit')} size="sm" className="rounded-full gap-1 text-xs">
                      <Pencil className="h-3.5 w-3.5" />
                      Edit Idea
                    </Button>
                  )}

                  <Button onClick={() => onUse(idea)} size="sm" variant="outline" className="rounded-full gap-1 text-xs">
                    <Check className="h-3.5 w-3.5" />
                    Use This Idea
                  </Button>

                  <Button onClick={() => onCopy(idea)} size="sm" variant="outline" className="rounded-full gap-1 text-xs">
                    <Copy className="h-3.5 w-3.5" />
                    Copy
                  </Button>

                  <Button onClick={() => onDuplicate(idea)} size="sm" variant="outline" className="rounded-full gap-1 text-xs">
                    <Plus className="h-3.5 w-3.5" />
                    Duplicate
                  </Button>

                  <Button
                    onClick={() => onDelete(idea)}
                    size="sm"
                    variant="ghost"
                    className="rounded-full gap-1 text-xs text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </Button>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}