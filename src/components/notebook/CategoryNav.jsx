import React from 'react';
import { ChevronRight, Library, ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

/**
 * Multi-level drill-down category navigator.
 *
 * View levels, in order:
 *   1. Top level: categories (or super-buckets if consolidated view is active)
 *   2. Super-bucket drill-down: shows the raw categories folded into the bucket
 *      (only present when activeSuperBucket is set and activeCategory is empty)
 *   3. Category drill-down: genres inside the chosen category
 *   4. Genre drill-down: subcategories inside the chosen genre
 *   5. Subcategory: terminal leaf — just shows the breadcrumb
 *
 * `onClearCategory` is an optional back-navigation handler used by the parent
 * to step BACK one level from the current drill-down position. When omitted,
 * it falls back to clearing the activeCategory directly.
 */
export default function CategoryNav({
  categories,
  genres,
  subcategories,
  activeCategory,
  activeGenre,
  activeSubcategory,
  activeSuperBucket,
  onSelectCategory,
  onSelectGenre,
  onSelectSubcategory,
  onClearCategory,
  onClear,
}) {
  // Back handler for stepping out of a category. If the parent supplied
  // onClearCategory, use it (handles super-bucket → bucket-list → root chain).
  // Otherwise fall back to just clearing the active category.
  const backOutOfCategory = onClearCategory || (() => onSelectCategory(''));

  if (activeSubcategory) {
    return (
      <div className="space-y-2">
        <button type="button" onClick={() => onSelectSubcategory('')} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-3 w-3" /> Back to {activeGenre || activeCategory || 'categories'}
        </button>
        <div className="rounded-xl bg-primary/10 border border-primary/30 px-3 py-2">
          <p className="text-xs font-semibold text-foreground">{activeSubcategory}</p>
          {activeGenre && <p className="text-[10px] text-muted-foreground">{activeCategory} → {activeGenre}</p>}
        </div>
      </div>
    );
  }

  if (activeGenre) {
    return (
      <div className="space-y-2">
        <button type="button" onClick={() => onSelectGenre('')} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-3 w-3" /> Back to {activeCategory || 'categories'}
        </button>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{activeGenre}</p>
        {subcategories.length > 0 ? (
          <div className="grid grid-cols-1 gap-1">
            {subcategories.map(([sub, count]) => (
              <button
                key={sub}
                type="button"
                onClick={() => onSelectSubcategory(sub)}
                className="flex items-center justify-between rounded-lg px-3 py-2 text-left hover:bg-white/60 border border-transparent hover:border-border/50 transition-colors"
              >
                <span className="text-xs font-medium text-foreground truncate">{sub}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Badge variant="secondary" className="text-[9px] py-0 px-1.5">{count}</Badge>
                  <ChevronRight className="h-3 w-3 text-muted-foreground" />
                </div>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">No series in this genre</p>
        )}
      </div>
    );
  }

  if (activeCategory) {
    // Back label depends on whether we entered via a super-bucket or directly.
    const backLabel = activeSuperBucket ? `Back to ${activeSuperBucket.label}` : 'All categories';
    return (
      <div className="space-y-2">
        <button type="button" onClick={backOutOfCategory} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-3 w-3" /> {backLabel}
        </button>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{activeCategory}</p>
        {genres.length > 0 ? (
          <div className="grid grid-cols-1 gap-1">
            {genres.map(([genre, count]) => (
              <button
                key={genre}
                type="button"
                onClick={() => onSelectGenre(genre)}
                className="flex items-center justify-between rounded-lg px-3 py-2 text-left hover:bg-white/60 border border-transparent hover:border-border/50 transition-colors"
              >
                <span className="text-xs font-medium text-foreground truncate">{genre}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Badge variant="secondary" className="text-[9px] py-0 px-1.5">{count}</Badge>
                  <ChevronRight className="h-3 w-3 text-muted-foreground" />
                </div>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">No genres in this category</p>
        )}
      </div>
    );
  }

  // Inside a super-bucket (but no specific category picked yet) — show the
  // raw categories that fold into this bucket as the drill-down layer.
  if (activeSuperBucket) {
    return (
      <div className="space-y-2">
        <button type="button" onClick={backOutOfCategory} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-3 w-3" /> All buckets
        </button>
        <div className="flex items-center gap-2">
          <span className="text-base">{activeSuperBucket.icon}</span>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{activeSuperBucket.label}</p>
        </div>
        {categories.length > 0 ? (
          <div className="grid grid-cols-1 gap-1">
            {categories.map(([cat, count]) => (
              <button
                key={cat}
                type="button"
                onClick={() => onSelectCategory(cat)}
                className="flex items-center justify-between rounded-lg px-3 py-2 text-left hover:bg-white/60 border border-transparent hover:border-border/50 transition-colors"
              >
                <span className="text-xs font-medium text-foreground truncate">{cat}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Badge variant="secondary" className="text-[9px] py-0 px-1.5">{count}</Badge>
                  <ChevronRight className="h-3 w-3 text-muted-foreground" />
                </div>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">No categories in this bucket</p>
        )}
      </div>
    );
  }

  // Top level: show categories (or super-buckets, which arrive in the
  // same [name, count] tuple shape)
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Library className="h-3.5 w-3.5 text-muted-foreground" />
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Browse by Category</p>
      </div>
      {categories.length > 0 ? (
        <div className="grid grid-cols-1 gap-1">
          {categories.map(([cat, count]) => (
            <button
              key={cat}
              type="button"
              onClick={() => onSelectCategory(cat)}
              className="flex items-center justify-between rounded-lg px-3 py-2 text-left hover:bg-white/60 border border-transparent hover:border-border/50 transition-colors"
            >
              <span className="text-xs font-medium text-foreground truncate">{cat}</span>
              <div className="flex items-center gap-1.5 shrink-0">
                <Badge variant="secondary" className="text-[9px] py-0 px-1.5">{count}</Badge>
                <ChevronRight className="h-3 w-3 text-muted-foreground" />
              </div>
            </button>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground italic">Showing all ideas below</p>
      )}
    </div>
  );
}