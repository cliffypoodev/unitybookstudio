import React, { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Search, Shuffle, Loader2, X, List, Grid3X3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { invokeLLMWithRetry } from '@/lib/integrationRetry';
import CategoryNav from '@/components/notebook/CategoryNav';

const PAGE_SIZE = 20;

const SORT_OPTIONS = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'az', label: 'A → Z' },
  { value: 'za', label: 'Z → A' },
  { value: 'newest', label: 'Newest' },
  { value: 'longest', label: 'Longest' },
  { value: 'shortest', label: 'Shortest' },
];

export default function IdeasBrowser({ bookType, selectedPrompt, onSelectPrompt, onUsePrompt }) {
  const [search, setSearch] = useState('');
  const [filterGenre, setFilterGenre] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterSubcategory, setFilterSubcategory] = useState('');
  const [filterTag, setFilterTag] = useState('');
  const [browseMode, setBrowseMode] = useState('browse'); // 'browse' or 'search'
  const [sortBy, setSortBy] = useState('relevance');
  const [typeFilter, setTypeFilter] = useState(bookType || 'fiction');
  const [page, setPage] = useState(0);
  const [mashupBusy, setMashupBusy] = useState(false);

  const { data: allPrompts = [], isLoading } = useQuery({
    queryKey: ['prompt-catalog'],
    queryFn: () => base44.entities.PromptCatalog.list('-created_date', 2000),
  });

  const filtered = useMemo(() => {
    let items = allPrompts;
    if (typeFilter) items = items.filter((p) => !p.book_type || p.book_type === typeFilter);
    if (filterGenre) items = items.filter((p) => p.genre === filterGenre);
    if (filterCategory) items = items.filter((p) => p.category === filterCategory);
    if (filterSubcategory) items = items.filter((p) => p.subcategory === filterSubcategory);
    if (filterTag) items = items.filter((p) => (p.tags || []).includes(filterTag));
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter((p) =>
        (p.title || '').toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q) ||
        (p.content || '').toLowerCase().includes(q) ||
        (p.tags || []).some((t) => t.toLowerCase().includes(q))
      );
    }
    switch (sortBy) {
      case 'az': items = [...items].sort((a, b) => (a.title || '').localeCompare(b.title || '')); break;
      case 'za': items = [...items].sort((a, b) => (b.title || '').localeCompare(a.title || '')); break;
      case 'newest': items = [...items].sort((a, b) => (b.created_date || '').localeCompare(a.created_date || '')); break;
      case 'longest': items = [...items].sort((a, b) => (b.word_count || 0) - (a.word_count || 0)); break;
      case 'shortest': items = [...items].sort((a, b) => (a.word_count || 0) - (b.word_count || 0)); break;
      default: break;
    }
    return items;
  }, [allPrompts, typeFilter, filterGenre, filterCategory, filterSubcategory, filterTag, search, sortBy]);

  const genres = useMemo(() => {
    const counts = {};
    allPrompts.filter((p) => !p.book_type || p.book_type === typeFilter)
      .forEach((p) => { if (p.genre) counts[p.genre] = (counts[p.genre] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [allPrompts, typeFilter]);

  const categories = useMemo(() => {
    const counts = {};
    allPrompts.filter((p) => !p.book_type || p.book_type === typeFilter)
      .forEach((p) => { if (p.category) counts[p.category] = (counts[p.category] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [allPrompts, typeFilter]);

  const allTags = useMemo(() => {
    const counts = {};
    filtered.forEach((p) => (p.tags || []).forEach((t) => { counts[t] = (counts[t] || 0) + 1; }));
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 20);
  }, [filtered]);

  const paged = useMemo(() => filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), [filtered, page]);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const subcategories = useMemo(() => {
    const counts = {};
    let items = allPrompts.filter((p) => !p.book_type || p.book_type === typeFilter);
    if (filterCategory) items = items.filter((p) => p.category === filterCategory);
    if (filterGenre) items = items.filter((p) => p.genre === filterGenre);
    items.forEach((p) => { if (p.subcategory) counts[p.subcategory] = (counts[p.subcategory] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0]));
  }, [allPrompts, typeFilter, filterCategory, filterGenre]);

  const hasActiveFilters = search || filterGenre || filterCategory || filterSubcategory || filterTag;

  const clearFilters = () => { setSearch(''); setFilterGenre(''); setFilterCategory(''); setFilterSubcategory(''); setFilterTag(''); setSortBy('relevance'); setPage(0); };

  const handleTagClick = useCallback((tag) => { setFilterTag((prev) => (prev === tag ? '' : tag)); setPage(0); }, []);

  const handleMashup = async () => {
    if (allPrompts.length < 2) return;
    setMashupBusy(true);
    try {
      const shuffled = [...allPrompts].filter((p) => !p.book_type || p.book_type === typeFilter).sort(() => Math.random() - 0.5).slice(0, 3);
      const snippets = shuffled.map((p) => `"${p.title}": ${p.description || p.content?.slice(0, 200)}`).join('\n');
      const result = await invokeLLMWithRetry({
        prompt: `You are a creative book concept generator. Given these ${typeFilter} book ideas as inspiration, create ONE completely new, original book premise that creatively mashes up elements from all of them. Return ONLY the premise (2-4 sentences), no titles or labels.\n\nInspiration:\n${snippets}`,
      });
      const text = typeof result === 'string' ? result : result?.data || result?.text || '';
      if (text.trim()) onUsePrompt({ title: 'AI Mashup', content: text.trim(), genre: '', book_type: typeFilter });
    } finally { setMashupBusy(false); }
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="notebook-kicker">Prompt Catalog</p>
        <h2 className="font-display text-3xl text-[var(--notebook-ink)]">Ideas</h2>
      </div>

      {/* Type toggle + mode toggle */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex rounded-full border border-border/70 bg-white/50 p-0.5 w-fit">
          {['fiction', 'nonfiction'].map((t) => (
            <button key={t} type="button" onClick={() => { setTypeFilter(t); setFilterGenre(''); setFilterCategory(''); setFilterSubcategory(''); setPage(0); }}
              className={`rounded-full px-4 py-1.5 text-xs font-medium capitalize transition-colors ${typeFilter === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >{t}</button>
          ))}
        </div>
        <div className="flex rounded-full border border-border/70 bg-white/50 p-0.5">
          <button type="button" onClick={() => setBrowseMode('browse')}
            className={`rounded-full p-1.5 transition-colors ${browseMode === 'browse' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            title="Browse categories"
          ><Grid3X3 className="h-3.5 w-3.5" /></button>
          <button type="button" onClick={() => setBrowseMode('search')}
            className={`rounded-full p-1.5 transition-colors ${browseMode === 'search' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            title="Search & filter"
          ><List className="h-3.5 w-3.5" /></button>
        </div>
      </div>

      {/* Category browse mode */}
      {browseMode === 'browse' && !hasActiveFilters && (
        <CategoryNav
          categories={categories}
          genres={genres}
          subcategories={subcategories}
          activeCategory={filterCategory}
          activeGenre={filterGenre}
          activeSubcategory={filterSubcategory}
          onSelectCategory={(c) => { setFilterCategory(c); setFilterGenre(''); setFilterSubcategory(''); setPage(0); }}
          onSelectGenre={(g) => { setFilterGenre(g); setFilterSubcategory(''); setPage(0); }}
          onSelectSubcategory={(s) => { setFilterSubcategory(s); setPage(0); }}
          onClear={clearFilters}
        />
      )}

      {/* Search — always visible in search mode, or when browsing with active filters */}
      {(browseMode === 'search' || hasActiveFilters) && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} placeholder="Search prompts…" className="rounded-full pl-9" />
        </div>
      )}

      {/* Sort + filters */}
      {(browseMode === 'search' || hasActiveFilters) && (
        <div className="flex flex-wrap gap-2">
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[130px] rounded-full text-xs h-8"><SelectValue /></SelectTrigger>
            <SelectContent>{SORT_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
          {genres.length > 0 && (
            <Select value={filterGenre || '_all'} onValueChange={(v) => { setFilterGenre(v === '_all' ? '' : v); setFilterSubcategory(''); setPage(0); }}>
              <SelectTrigger className="w-[150px] rounded-full text-xs h-8"><SelectValue placeholder="Genre" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">All genres</SelectItem>
                {genres.map(([g, c]) => <SelectItem key={g} value={g}>{g} ({c})</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          {categories.length > 0 && (
            <Select value={filterCategory || '_all'} onValueChange={(v) => { setFilterCategory(v === '_all' ? '' : v); setFilterSubcategory(''); setPage(0); }}>
              <SelectTrigger className="w-[150px] rounded-full text-xs h-8"><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">All categories</SelectItem>
                {categories.map(([c, n]) => <SelectItem key={c} value={c}>{c} ({n})</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          {subcategories.length > 0 && (filterGenre || filterCategory) && (
            <Select value={filterSubcategory || '_all'} onValueChange={(v) => { setFilterSubcategory(v === '_all' ? '' : v); setPage(0); }}>
              <SelectTrigger className="w-[170px] rounded-full text-xs h-8"><SelectValue placeholder="Series" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">All series</SelectItem>
                {subcategories.map(([s, n]) => <SelectItem key={s} value={s}>{s} ({n})</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="rounded-full gap-1 text-muted-foreground h-8 text-xs">
              <X className="h-3 w-3" /> Clear
            </Button>
          )}
        </div>
      )}

      {/* Mashup button */}
      <Button variant="outline" size="sm" onClick={handleMashup} disabled={mashupBusy || allPrompts.length < 2} className="rounded-full gap-1.5 w-full">
        {mashupBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Shuffle className="h-3.5 w-3.5" />}
        Need Inspiration?
      </Button>

      {/* Tag cloud */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {allTags.map(([tag, count]) => (
            <button key={tag} type="button" onClick={() => handleTagClick(tag)}
              className={`rounded-full px-2 py-0.5 text-[10px] transition-colors ${filterTag === tag ? 'bg-primary text-primary-foreground' : 'bg-accent/40 text-accent-foreground hover:bg-accent/70'}`}
            >{tag} ({count})</button>
          ))}
        </div>
      )}

      {/* Results count */}
      {hasActiveFilters && filtered.length > 0 && (
        <p className="text-[10px] text-muted-foreground">{filtered.length} ideas found</p>
      )}

      {/* Prompt list — show when searching, filtering, or in search mode */}
      {(browseMode === 'search' || hasActiveFilters) && (isLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : paged.length === 0 ? (
        <div className="rounded-[1.25rem] border border-dashed border-border/70 bg-white/30 p-8 text-center text-sm text-muted-foreground">
          {allPrompts.length === 0 ? 'No prompts in the catalog yet.' : 'No prompts match your filters.'}
        </div>
      ) : (
        <div className="space-y-1.5">
          {paged.map((prompt) => (
            <button
              key={prompt.id}
              type="button"
              onClick={() => onSelectPrompt(prompt)}
              className={`w-full text-left rounded-xl px-3 py-2.5 transition-colors ${
                selectedPrompt?.id === prompt.id
                  ? 'bg-primary/10 border border-primary/30'
                  : 'hover:bg-white/60 border border-transparent'
              }`}
            >
              <p className="font-medium text-sm leading-tight text-foreground truncate">{prompt.title}</p>
              {prompt.description && <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{prompt.description}</p>}
              <div className="mt-1 flex flex-wrap gap-1">
                {prompt.genre && <Badge variant="outline" className="text-[9px] py-0">{prompt.genre}</Badge>}
                {(prompt.tags || []).slice(0, 2).map((t) => (
                  <span key={t} className="rounded-full bg-accent/30 px-1.5 py-0 text-[9px] text-accent-foreground">{t}</span>
                ))}
              </div>
            </button>
          ))}
        </div>
      ))}

      {/* Pagination */}
      {(browseMode === 'search' || hasActiveFilters) && totalPages > 1 && (
        <div className="flex items-center justify-between pt-1">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)} className="rounded-full text-xs h-7">Prev</Button>
          <span className="text-[10px] text-muted-foreground">{page + 1}/{totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)} className="rounded-full text-xs h-7">Next</Button>
        </div>
      )}
    </div>
  );
}