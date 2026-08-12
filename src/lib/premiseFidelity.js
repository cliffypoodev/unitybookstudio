/**
 * PREMISE-FIDELITY-1 — the author's brief is a closed world.
 *
 * MEASURED on The Gilded Hour, 2026-08-04. The premise named five people, a house, a
 * strongroom, two keys and a language. The generated character sheet contained:
 *
 *   present   Nell Carrow · Edmund Wexcombe · Ned · Mrs. Aldous
 *   absent    Silas Bram                    <- hands over the key AND dies in ch.3
 *   absent    Edmund Wexcombe the younger   <- the whole point of the two brothers
 *   absent    strongroom · French · "brass winding key"
 *
 * Nothing checked. A named character the author put in the brief simply did not
 * arrive in the bible, and the first anyone knew was a human reading the outline and
 * noticing a stranger in it.
 *
 * This is the closed-world principle the gates already apply to FACTS, applied one
 * layer earlier — to the BRIEF. A fact exists in the evidence or it does not ship; an
 * entity exists in the author's premise or the bible has no business dropping it.
 *
 * Two halves, because detection alone leaves the model free to keep doing it:
 *   - buildPremiseCoverageBlock() states the entities as a requirement, up front
 *   - checkPremiseCoverage() verifies afterwards and names what went missing
 *
 * Extraction is deliberately conservative and has no NER, no model call and no
 * knowledge of any book. It keeps multi-word capitalised runs, and keeps a single
 * capitalised word ONLY when it also appears somewhere that is not the start of a
 * sentence — otherwise every sentence-opening "The" and "By" becomes a character.
 */

const PREMISE_STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'but', 'or', 'nor', 'for', 'yet', 'so',
  'in', 'on', 'at', 'by', 'to', 'from', 'with', 'without', 'into', 'onto',
  'of', 'off', 'up', 'down', 'over', 'under', 'again', 'then', 'than',
  'when', 'where', 'while', 'because', 'if', 'though', 'although', 'after',
  'before', 'during', 'until', 'since', 'this', 'that', 'these', 'those',
  'he', 'she', 'it', 'they', 'we', 'you', 'i', 'his', 'her', 'its', 'their',
  'there', 'here', 'what', 'which', 'who', 'whom', 'whose', 'how', 'why',
  'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august',
  'september', 'october', 'november', 'december',
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'chapter', 'chapters', 'book', 'part', 'volume', 'act', 'scene',
]);

const CAP_RUN = /\b[A-Z][\p{L}'’-]*(?:\.)?(?:\s+[A-Z][\p{L}'’-]*(?:\.)?)*/gu;

// Abbreviations whose trailing period does NOT end a sentence. Without this, a run
// spans the boundary and "Edmund Wexcombe. His brother" becomes the entity
// "Edmund Wexcombe. His" — measured on the live premise, first implementation.
const ABBREV = new Set([
  'mr', 'mrs', 'ms', 'miss', 'dr', 'prof', 'rev', 'fr', 'st', 'mt', 'jr', 'sr',
  'lt', 'sgt', 'capt', 'col', 'gen', 'maj', 'hon', 'gov', 'sen', 'rep',
]);
const isAbbrev = (tok) => ABBREV.has(String(tok).replace(/\.$/, '').toLowerCase());

/**
 * Split a capitalised run wherever a token ends a sentence, and drop any role word
 * sitting in front of an honorific ("Housekeeper Mrs. Aldous" -> "Mrs. Aldous").
 */
function splitRun(tokens) {
  const parts = [];
  let current = [];
  for (const tok of tokens) {
    current.push(tok);
    if (tok.endsWith('.') && !isAbbrev(tok)) { parts.push(current); current = []; }
  }
  if (current.length) parts.push(current);
  return parts.map((part) => {
    const cleaned = part.map((t, i) => (i === part.length - 1 ? t.replace(/[.,]$/, '') : t));
    const honIdx = cleaned.findIndex((t) => isAbbrev(t));
    return (honIdx > 0 ? cleaned.slice(honIdx) : cleaned).filter(Boolean);
  }).filter((part) => part.length);
}

/** True when the match at `index` opens a sentence (or the text). */
function opensSentence(text, index) {
  const before = text.slice(0, index).replace(/\s+$/, '');
  return before === '' || /[.!?:;"“”)\]]$/.test(before) || /\n$/.test(text.slice(0, index));
}

/**
 * Entities named in the author's brief. Multi-word capitalised runs always count;
 * a lone capitalised word counts only if it also appears mid-sentence somewhere.
 */
export function extractPremiseEntities(premise, options = {}) {
  const text = String(premise || '');
  if (!text.trim()) return [];
  // The caller may exclude things that are not story entities — the project title
  // above all, which appears in almost every premise and is not a character.
  const exclude = new Set((options.exclude || []).map((x) => String(x).trim()).filter(Boolean));
  const multi = new Set();
  const singleAll = new Map(); // token -> { total, midSentence }
  let m;
  CAP_RUN.lastIndex = 0;
  while ((m = CAP_RUN.exec(text)) !== null) {
    const raw = m[0].trim();
    if (!raw) continue;
    for (const tokens of splitRun(raw.split(/\s+/))) {
      // Trim a leading sentence-opening word that is a stopword ("In London, ...").
      while (tokens.length && PREMISE_STOPWORDS.has(tokens[0].replace(/[.,]/g, '').toLowerCase())) tokens.shift();
      if (!tokens.length) continue;
      const phrase = tokens.join(' ');
      if (exclude.has(phrase)) continue;
      if (tokens.length >= 2) { multi.add(phrase); continue; }
      const key = phrase.replace(/[.,]/g, '');
      if (key.length < 3 || PREMISE_STOPWORDS.has(key.toLowerCase()) || exclude.has(key)) continue;
      const rec = singleAll.get(key) || { total: 0, mid: 0 };
      rec.total += 1;
      if (!opensSentence(text, m.index)) rec.mid += 1;
      singleAll.set(key, rec);
    }
  }
  const singles = [...singleAll.entries()].filter(([, r]) => r.mid > 0).map(([k]) => k);
  // A single token already inside a kept multi-word entity is not a separate entity.
  const kept = [...multi];
  for (const s of singles) {
    if (!kept.some((p) => p.split(/\s+/).includes(s))) kept.push(s);
  }
  return kept.sort((a, b) => b.length - a.length);
}

/** The prompt block that states the brief's entities as a requirement. */
export function buildPremiseCoverageBlock(entities) {
  const list = (Array.isArray(entities) ? entities : []).filter(Boolean);
  if (!list.length) return '';
  return `
═══ AUTHOR'S BRIEF — REQUIRED ENTITIES ═══

These names, places and things come from the author's own premise. Every one of them
must appear in what you generate, spelled EXACTLY as written here. Do not rename,
merge, drop, modernise or substitute any of them, and do not invent a replacement for
one you find awkward. If the brief names a person, that person exists in this book.

REQUIRED: ${list.join(' · ')}

═══ END AUTHOR'S BRIEF ═══
`;
}

/**
 * Which of the brief's entities failed to reach the generated material.
 * Exact, case-sensitive matching: "Nolan Bram" must never satisfy "Silas Bram".
 */
export function checkPremiseCoverage(entities, generatedText) {
  const text = String(generatedText || '');
  const list = (Array.isArray(entities) ? entities : []).filter(Boolean);
  const present = [];
  const missing = [];
  for (const e of list) (text.includes(e) ? present : missing).push(e);
  return {
    total: list.length,
    present,
    missing,
    ok: missing.length === 0,
    summary: list.length
      ? `${present.length}/${list.length} brief entities present`
        + (missing.length ? ` — MISSING: ${missing.join(', ')}` : '')
      : 'no entities found in the brief',
  };
}

/** One line of telemetry, so a silent loss becomes a visible one. */
export function reportPremiseCoverage(entities, generatedText, label = 'bible') {
  const r = checkPremiseCoverage(entities, generatedText);
  if (!r.total) return r;
  if (r.ok) console.log(`[PREMISE-FIDELITY-1] ${label}: ${r.summary}`);
  else console.warn(`[PREMISE-FIDELITY-1] ${label}: ${r.summary}`);
  return r;
}
