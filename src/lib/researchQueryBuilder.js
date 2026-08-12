// src/lib/researchQueryBuilder.js — RESEARCHQUALITY-1
// Pure, testable research query builder. Focus-term queries (named people,
// companies, places from the brief) run FIRST — they carry the real search
// signal. Generic subject queries fill in only when the brief has few proper
// nouns. The total is CAPPED: the old build fired 14-35 queries in a burst,
// the searxng engines suspended, and the high-signal queries returned keyword
// noise. Book specifics live in the caller's data (title/topic), never here.

// First-word stoplist for focus-term candidates. Includes months/weekdays and
// leading prepositions so date fragments ("On January") and sentence openers
// never become search terms.
const STOP = new Set([
  'the','this','that','these','those','and','but','some','many','most','when','while','after','before',
  'during','although','however','their','there','they','his','her','our','your','its','it','is','was',
  'were','chapter','chapters','book','volume','part','section',
  'on','in','at','by','from','into','over','under','for','with','as','to','of','a','an','or','if','then',
  'than','so','no','not','he','she','we','you','i',
  'january','february','march','april','may','june','july','august','september','october','november','december',
  'monday','tuesday','wednesday','thursday','friday','saturday','sunday',
]);

export const MAX_RESEARCH_QUERIES = 10;
export const MAX_FOCUS_TERMS = 5;

export function deriveSearchSubject(title, topic) {
  const rawTitle = (title || '').trim();
  const firstLine = ((topic || '').split('\n').find((l) => l.trim().length > 0) || topic || '').trim();
  let subject = (rawTitle || firstLine)
    .replace(/^(author|book title|title)\s*[:\-]?\s*/i, '')
    .replace(/[*_#>]/g, '')
    .replace(/["“”']/g, '')
    .split(/[:\-—]/)[0]
    .trim()
    .slice(0, 80);
  if (!subject) subject = firstLine.slice(0, 80);
  return subject;
}

export function extractFocusTerms(topic, subject, max = MAX_FOCUS_TERMS) {
  const candidates = Array.from(
    new Set(
      ((topic || '').match(/\b[A-Z][a-zA-Z'.]+(?:\s+[A-Z][a-zA-Z'.]+){0,3}\b/g) || [])
        // The matcher's dot (kept for initials like "W.") also absorbs sentence
        // boundaries: "Hugh W. Ogden. The" — truncate at a period that ends a
        // 2+-letter word (a sentence end, never an initial), then drop any
        // trailing period.
        .map((s) => s.trim().replace(/([a-zA-Z]{2})\.\s[\s\S]*$/, '$1').replace(/\.+$/, '').trim())
        .filter((s) => {
          const first = s.split(/\s+/)[0].toLowerCase();
          return s.length >= 4 && !STOP.has(first) && s.toLowerCase() !== (subject || '').toLowerCase();
        })
    )
  );
  // Multi-word proper-noun phrases (people, companies, places) outrank single
  // capitalized words: "Purity Distilling" beats "Boston" as a search term.
  const multi = candidates.filter((s) => /\s/.test(s));
  const single = candidates.filter((s) => !/\s/.test(s));
  return [...multi, ...single].slice(0, max);
}

export function buildResearchQueries({ title, topic, nfStructureMode }) {
  const subject = deriveSearchSubject(title, topic);
  const focusTerms = extractFocusTerms(topic, subject, MAX_FOCUS_TERMS);
  const queries = [];
  for (const t of focusTerms) {
    queries.push(`${subject} ${t}`);
    queries.push(`${t} primary sources records testimony`);
  }
  if (nfStructureMode === 'investigative' || nfStructureMode === 'narrative') {
    queries.push(`${subject} oral history interview transcript`);
    queries.push(`${subject} archival collection primary documents`);
    queries.push(`${subject} eyewitness testimony accounts`);
    queries.push(`${subject} history`);
  } else {
    queries.push(`${subject} history`);
    queries.push(`${subject} primary sources documents`);
    queries.push(`${subject} eyewitness testimony accounts`);
    queries.push(`${subject} timeline dates events`);
  }
  const deduped = Array.from(new Set(queries));
  return { subject, focusTerms, queries: deduped.slice(0, MAX_RESEARCH_QUERIES) };
}

// RESEARCHFETCH-1 — rank search hits for the deep-content FETCH phase by RELEVANCE
// to the book's subject + focus terms. The old fetch phase used a blind
// archive-first slice: every loc.gov / Chronicling-America URL sorted ahead of
// every open-web URL, so keyword-noise newspapers (unrelated 1891 D.C. and 1920s
// Idaho papers) filled all 24 fetch slots and starved the genuinely on-topic
// sources (root cause of the empty "Molasses File" brief). Relevance is the
// primary sort key; archive-ness is only a tiebreak among equally-relevant hits,
// which preserves the "primary sources survive" intent without letting irrelevant
// archive pages crowd out the real ones. Falls back to input order when nothing
// scores (no regression). Book-agnostic: tokens come from the caller's
// subject/focusTerms data, never hardcoded.
export const ARCHIVE_HOST_RE = /loc\.gov|archives\.gov|gutenberg\.org|hathitrust\.org|chroniclingamerica/i;
export const DEFAULT_FETCH_LIMIT = 24;

export function relevanceTokens(subject, focusTerms) {
  const raw = [subject || '', ...(focusTerms || [])].join(' ').toLowerCase();
  return Array.from(new Set((raw.match(/[a-z]{4,}/g) || []).filter((t) => !STOP.has(t))));
}

export function scoreHit(hit, tokens) {
  const hay = ((hit && hit.title || '') + ' ' + (hit && hit.snippet || '') + ' ' + (hit && hit.url || '')).toLowerCase();
  let s = 0;
  // Word-boundary match, not substring: the subject token "file" (from a title
  // like "The Molasses File") must NOT match "Filer" in an unrelated newspaper.
  // Tokens are [a-z]{4,} only, so they are regex-safe.
  for (const t of tokens) if (new RegExp('\\b' + t + '\\b').test(hay)) s += 1;
  return s;
}

export function rankFetchCandidates({ hits, subject, focusTerms, limit = DEFAULT_FETCH_LIMIT }) {
  const tokens = relevanceTokens(subject, focusTerms);
  const scored = (hits || []).map((h, i) => ({
    h,
    i,
    score: scoreHit(h, tokens),
    archive: ARCHIVE_HOST_RE.test((h && h.url) || ''),
  }));
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;      // relevance first
    if (a.archive !== b.archive) return a.archive ? -1 : 1; // archive tiebreak
    return a.i - b.i;                                        // stable order
  });
  return scored.slice(0, limit).map((s) => s.h);
}
