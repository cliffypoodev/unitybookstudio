/**
 * Category Consolidation
 *
 * Folds the prompt catalog's 70+ raw categories into 8 top-level super-buckets
 * for the Ideas Browse UI. This is pure client-side rollup — the underlying
 * PromptCatalog records are untouched, so the raw-view toggle can still show
 * the unconsolidated list whenever the user wants it.
 *
 * The bucket assignment is pattern-based: a raw category name is tested against
 * each super-bucket's keyword regex in priority order, and the first match wins.
 * Unmatched categories fall into "Other".
 *
 * Design notes:
 *   - Order matters. More specific buckets (e.g. "Wellness & Self-Help") are
 *     tested before broader ones (e.g. "Reference & How-To") to avoid miscategorizing
 *     "Stress Management" into Reference just because both have "guide"-like words.
 *   - Horror is tested BEFORE Speculative because supernatural horror would
 *     otherwise be caught by the sci-fi/fantasy bucket's broad "supernatural" match.
 *   - History is quite broad — it catches historical-thematic sub-topics that
 *     currently float at the top level (Rescues, Cemeteries, Graffiti, etc.)
 */

/**
 * The ordered super-bucket registry. Each entry has:
 *   - key:    stable identifier used in filter state (never shown to user)
 *   - label:  display label
 *   - icon:   single emoji for visual scanning
 *   - match:  RegExp tested against the raw category name
 */
export const SUPER_BUCKETS = [
  {
    key: 'wellness',
    label: 'Wellness & Self-Help',
    icon: '🌱',
    match: /\b(wellness|self[\s-]?help|self[\s-]?improv|mindful|meditation|stress|anxiety|mental\s*health|healing|therapy|calm|relaxation|personal\s*growth|habits?|productivity|motivation|motivational|inspiration|inspirational|happiness|well[\s-]?being|burnout)\b/i,
  },
  {
    key: 'romance-fantasy',
    label: 'Romance & Fantasy',
    icon: '💞',
    match: /\b(romance|romantic|love\s*story|billionaire|rom[\s-]?com|bride|marriage|dating|fantasy|fae|faery|faerie|dragon|magic|enchant|fairytale|fairy\s*tale|witch|wizard|elf|elven|kingdom|quest)\b/i,
  },
  {
    key: 'horror',
    label: 'Horror & Dark Fiction',
    icon: '👻',
    match: /\b(horror|ghost|haunt(ed|ing)?|supernatural|dark\s*(fiction|tale)|gothic|monster|occult|demon|vampire|werewolf|paranormal|cursed|possession|cult\s*horror|creature|terror|macabre)\b/i,
  },
  {
    key: 'mystery-thriller',
    label: 'Mystery, Thriller & Crime',
    icon: '🕵️',
    match: /\b(mystery|thriller|detective|suspense|crime|noir|heist|murder|whodunit|cozy\s*mystery|police|investigator|kidnapping|conspiracy|spy|espionage|assassin|psych(ological)?\s*thriller)\b/i,
  },
  {
    key: 'speculative',
    label: 'Sci-Fi & Speculative',
    icon: '🚀',
    match: /\b(sci[\s-]?fi|science\s*fiction|speculative|dystop|utopia|post[\s-]?apocalyp|apocalyptic|cyberpunk|steampunk|space\s*opera|alien|robot|android|time\s*travel|parallel|simulation|AI\s*fiction|futurist|techno[\s-]?thriller)\b/i,
  },
  {
    key: 'reference',
    label: 'Reference & How-To',
    icon: '📘',
    match: /\b(reference|educational|textbook|how[\s-]?to|tutorial|guide\s*book|instructional|manual|handbook|dictionary|encyclopedi|academic|study|curriculum|business|finance|marketing|career|leadership|management)\b/i,
  },
  {
    key: 'history',
    label: 'History & Culture',
    icon: '📜',
    match: /\b(history|historical|ancient|medieval|empire|war\s*(history|stories)?|revolution|rescue|rescues|legend|legends|cemetery|cemeteries|graffiti|execution|executions|superstition|superstitions|puppet|puppets|satire|secret\s*cit|culture|cultural|artistic\s*movement|suppressed|exile|exiled|obsolete\s*profession|obsolete\s*professions|enlightenment|policy\s*history|political\s*movement|political\s*problem|weaponization|folklore|myth(s|ology)?|archaeolog|became\s*legend|became\s*legends|social\s*role|rise\s*and\s*fall|forgotten|vanished|lost\s*(civilization|empire|kingdom|cit)|blamed\s*for)\b/i,
  },
];

/**
 * Super-bucket for anything that doesn't match a rule. Always present,
 * always last in display order.
 */
export const OTHER_BUCKET = {
  key: 'other',
  label: 'Other / Uncategorized',
  icon: '✨',
};

/**
 * Map a raw category string to a super-bucket key. Returns 'other' if
 * no rule matches. Safe for null / undefined / empty-string inputs.
 */
export function rawCategoryToSuperBucket(rawCategory) {
  if (!rawCategory || typeof rawCategory !== 'string') return OTHER_BUCKET.key;
  const trimmed = rawCategory.trim();
  if (!trimmed) return OTHER_BUCKET.key;
  for (const bucket of SUPER_BUCKETS) {
    if (bucket.match.test(trimmed)) return bucket.key;
  }
  return OTHER_BUCKET.key;
}

/**
 * Build the super-bucket counts for the Browse view. Returns an array
 * shaped like [{ key, label, icon, count, rawCategories: [[raw, count], ...] }]
 * sorted by count descending. Buckets with zero items are filtered out.
 *
 * Consumes the raw (category, count) list already computed by IdeasCatalogBrowser.
 */
export function buildSuperBucketList(rawCategoryCounts) {
  if (!Array.isArray(rawCategoryCounts) || rawCategoryCounts.length === 0) return [];

  // Pre-index super-buckets
  const byKey = new Map();
  for (const b of SUPER_BUCKETS) {
    byKey.set(b.key, { ...b, count: 0, rawCategories: [] });
  }
  byKey.set(OTHER_BUCKET.key, { ...OTHER_BUCKET, count: 0, rawCategories: [] });

  // Fold each raw category into its super-bucket
  for (const [rawName, rawCount] of rawCategoryCounts) {
    const key = rawCategoryToSuperBucket(rawName);
    const bucket = byKey.get(key);
    if (!bucket) continue;
    bucket.count += rawCount;
    bucket.rawCategories.push([rawName, rawCount]);
  }

  // Sort rawCategories within each bucket by count desc for natural drill-down ordering
  for (const bucket of byKey.values()) {
    bucket.rawCategories.sort((a, b) => b[1] - a[1]);
  }

  // Emit only non-empty buckets, sorted by total count desc
  return [...byKey.values()].filter((b) => b.count > 0).sort((a, b) => b.count - a.count);
}

/**
 * Given a super-bucket key, return the set of raw category names that roll
 * into it. Used when a super-bucket is selected to pre-filter the prompt list
 * via `item.category` membership.
 *
 * Returns a Set for O(1) membership testing inside filter loops.
 */
export function rawCategoriesForSuperBucket(superKey, rawCategoryCounts) {
  if (!Array.isArray(rawCategoryCounts)) return new Set();
  const s = new Set();
  for (const [rawName] of rawCategoryCounts) {
    if (rawCategoryToSuperBucket(rawName) === superKey) s.add(rawName);
  }
  return s;
}

/**
 * Look up the display metadata for a super-bucket key. Returns null if the
 * key doesn't match any registered bucket.
 */
export function lookupSuperBucket(key) {
  if (key === OTHER_BUCKET.key) return OTHER_BUCKET;
  return SUPER_BUCKETS.find((b) => b.key === key) || null;
}