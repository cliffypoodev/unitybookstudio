/* ============================================================================
 * ⚠️  DEAD CODE — DO NOT EDIT EXPECTING UI CHANGES  (WAVE5-DEADSTAMP, Aug 2026)
 *
 * Nothing imports this file. Editing it has NO effect on the running app —
 * past AI sessions repeatedly wasted hours "fixing" components like this one.
 * Live implementation: the live Ideas UI is IdeasCatalogBrowser + IdeasChatbot.
 * Kept (not deleted) at the owner's request; recoverable context only.
 * ========================================================================== */
import React, { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Search, Shuffle, Loader2, SlidersHorizontal, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { invokeLLMWithRetry } from '@/lib/integrationRetry';
import PromptCard from '@/components/notebook/PromptCard';

const PAGE_SIZE = 20;

const SORT_OPTIONS = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'az', label: 'A → Z' },
  { value: 'za', label: 'Z → A' },
  { value: 'newest', label: 'Newest' },
  { value: 'longest', label: 'Longest' },
  { value: 'shortest', label: 'Shortest' },
];

export default function IdeasTab({ bookType, onSelectPrompt }) {
  const [search, setSearch] = useState('');
  const [filterGenre, setFilterGenre] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterTag, setFilterTag] = useState('');
  const [sortBy, setSortBy] = useState('relevance');
  const [typeFilter, setTypeFilter] = useState(bookType || 'fiction');
  const [page, setPage] = useState(0);
  const [mashupBusy, setMashupBusy] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const { data: allPrompts = [], isLoading } = useQuery({
    queryKey: ['prompt-catalog'],
    queryFn: () => base44.entities.PromptCatalog.list('-created_date', 500),
  });

  // Derived data
  const filtered = useMemo(() => {
    let items = allPrompts;

    // Type filter
    if (typeFilter) {
      items = items.filter((p) => !p.book_type || p.book_type === typeFilter);
    }

    // Genre filter
    if (filterGenre) {
      items = items.filter((p) => p.genre === filterGenre);
    }

    // Category filter
    if (filterCategory) {
      items = items.filter((p) => p.category === filterCategory);
    }

    // Tag filter
    if (filterTag) {
      items = items.filter((p) => (p.tags || []).includes(filterTag));
    }

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter((p) =>
        (p.title || '').toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q) ||
        (p.content || '').toLowerCase().includes(q) ||
        (p.tags || []).some((t) => t.toLowerCase().includes(q))
      );
    }

    // Sort
    switch (sortBy) {
      case 'az': items = [...items].sort((a, b) => (a.title || '').localeCompare(b.title || '')); break;
      case 'za': items = [...items].sort((a, b) => (b.title || '').localeCompare(a.title || '')); break;
      case 'newest': items = [...items].sort((a, b) => (b.created_date || '').localeCompare(a.created_date || '')); break;
      case 'longest': items = [...items].sort((a, b) => (b.word_count || 0) - (a.word_count || 0)); break;
      case 'shortest': items = [...items].sort((a, b) => (a.word_count || 0) - (b.word_count || 0)); break;
      default: break; // relevance = default order
    }

    return items;
  }, [allPrompts, typeFilter, filterGenre, filterCategory, filterTag, search, sortBy]);

  // Genres & categories from filtered data
  const genres = useMemo(() => {
    const counts = {};
    allPrompts
      .filter((p) => !p.book_type || p.book_type === typeFilter)
      .forEach((p) => { if (p.genre) counts[p.genre] = (counts[p.genre] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [allPrompts, typeFilter]);

  const categories = useMemo(() => {
    const counts = {};
    allPrompts
      .filter((p) => !p.book_type || p.book_type === typeFilter)
      .forEach((p) => { if (p.category) counts[p.category] = (counts[p.category] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [allPrompts, typeFilter]);

  const allTags = useMemo(() => {
    const counts = {};
    filtered.forEach((p) => (p.tags || []).forEach((t) => { counts[t] = (counts[t] || 0) + 1; }));
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 30);
  }, [filtered]);

  const paged = useMemo(() => filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), [filtered, page]);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const handleTagClick = useCallback((tag) => {
    setFilterTag((prev) => (prev === tag ? '' : tag));
    setPage(0);
  }, []);

  const clearFilters = () => {
    setSearch('');
    setFilterGenre('');
    setFilterCategory('');
    setFilterTag('');
    setSortBy('relevance');
    setPage(0);
  };

  const hasActiveFilters = search || filterGenre || filterCategory || filterTag;

  const handleMashup = async () => {
    if (allPrompts.length < 2) return;
    setMashupBusy(true);
    try {
      const shuffled = [...allPrompts]
        .filter((p) => !p.book_type || p.book_type === typeFilter)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3);
      const snippets = shuffled.map((p) => `"${p.title}": ${p.description || p.content?.slice(0, 200)}`).join('\n');
      const result = await invokeLLMWithRetry({
        prompt: `You are a creative book concept generator. Given these ${typeFilter} book ideas as inspiration, create ONE completely new, original book premise that creatively mashes up elements from all of them. Return ONLY the premise (2-4 sentences), no titles or labels.\n\nInspiration:\n${snippets}`,
      });
      const text = typeof result === 'string' ? result : result?.data || result?.text || '';
      if (text.trim()) {
        onSelectPrompt({ title: 'AI Mashup', content: text.trim(), genre: '', book_type: typeFilter });
      }
    } finally {
      setMashupBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <p className="notebook-kicker">Prompt Catalog</p>
        <h2 className="font-display text-4xl text-[var(--notebook-ink)]">Ideas</h2>
        <p className="mt-2 max-w-2xl text-sm leading-7 text-[var(--notebook-muted)]">
          Browse the prompt library for inspiration, or let AI mash up ideas for you.
        </p>
      </div>

      {/* Type toggle + search + sort */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-full border border-border/70 bg-white/50 p-0.5">
          {['fiction', 'nonfiction'].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => { setTypeFilter(t); setFilterGenre(''); setFilterCategory(''); setPage(0); }}
              className={`rounded-full px-4 py-1.5 text-xs font-medium capitalize transition-colors ${typeFilter === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            placeholder="Search prompts…"
            className="rounded-full pl-9"
          />
        </div>

        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[140px] rounded-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>

        <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)} className="rounded-full gap-1.5">
          <SlidersHorizontal className="h-3.5 w-3.5" /> Filters
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={handleMashup}
          disabled={mashupBusy || allPrompts.length < 2}
          className="rounded-full gap-1.5"
        >
          {mashupBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Shuffle className="h-3.5 w-3.5" />}
          Need Inspiration?
        </Button>
      </div>

      {/* Filters panel */}
      {showFilters && (
        <div className="flex flex-wrap items-center gap-3 rounded-[1.25rem] border border-border/70 bg-white/40 p-4">
          {genres.length > 0 && (
            <Select value={filterGenre || '_all'} onValueChange={(v) => { setFilterGenre(v === '_all' ? '' : v); setPage(0); }}>
              <SelectTrigger className="w-[180px] rounded-full">
                <SelectValue placeholder="All genres" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">All genres</SelectItem>
                {genres.map(([g, c]) => <SelectItem key={g} value={g}>{g} ({c})</SelectItem>)}
              </SelectContent>
            </Select>
          )}

          {categories.length > 0 && (
            <Select value={filterCategory || '_all'} onValueChange={(v) => { setFilterCategory(v === '_all' ? '' : v); setPage(0); }}>
              <SelectTrigger className="w-[180px] rounded-full">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">All categories</SelectItem>
                {categories.map(([c, n]) => <SelectItem key={c} value={c}>{c} ({n})</SelectItem>)}
              </SelectContent>
            </Select>
          )}

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="rounded-full gap-1 text-muted-foreground">
              <X className="h-3 w-3" /> Clear all
            </Button>
          )}
        </div>
      )}

      {/* Tag cloud */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {allTags.map(([tag, count]) => (
            <button
              key={tag}
              type="button"
              onClick={() => handleTagClick(tag)}
              className={`rounded-full px-2.5 py-1 text-[11px] transition-colors ${
                filterTag === tag
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-accent/40 text-accent-foreground hover:bg-accent/70'
              }`}
            >
              {tag} <span className="opacity-60">({count})</span>
            </button>
          ))}
        </div>
      )}

      {/* Results */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : paged.length === 0 ? (
        <div className="rounded-[1.75rem] border border-dashed border-border/70 bg-white/30 p-12 text-center">
          <p className="text-sm text-muted-foreground">
            {allPrompts.length === 0
              ? 'No prompts in the catalog yet. Add some from the dashboard to get started.'
              : 'No prompts match your filters.'}
          </p>
          {hasActiveFilters && (
            <Button variant="link" onClick={clearFilters} className="mt-2">Clear filters</Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {paged.map((prompt) => (
            <PromptCard
              key={prompt.id}
              prompt={prompt}
              onSelect={onSelectPrompt}
              onTagClick={handleTagClick}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage(page - 1)}
            className="rounded-full"
          >
            Previous
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {page + 1} of {totalPages} · {filtered.length} prompts
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages - 1}
            onClick={() => setPage(page + 1)}
            className="rounded-full"
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}