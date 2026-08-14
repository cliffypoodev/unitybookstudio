// PRONOUNLOCK-1 — canonical character pronouns, declared or inferred, enforced
// at draft time and reported at export time.
//
// The defect (2026-08-14 live draft): one character took he/his ×28, she/her
// ×45, and they/their ×44 across a single 82k-word novel — the book never
// settled, and nothing in the pipeline knew a character HAS a pronoun set.
//
// Design constraints, learned from this codebase's gate history:
// - Canon comes from an EXPLICIT declaration in the character sheet when one
//   exists ("Lark (they/them)"); otherwise it is INFERRED from dominant early
//   usage. A character with no declaration and no dominant usage stays
//   UNRESOLVED and is never enforced — fail open, surface it as a warning.
// - Inference decides only between he/him and she/her. They/them canon must be
//   declared: plural "they" (the crew, the townsfolk) pollutes counting beyond
//   repair, so inferring singular-they would manufacture false canon.
// - Scanning counts a pronoun only when it appears AFTER the character's name
//   inside a sentence naming EXACTLY ONE known character — two-name sentences
//   ("Lark handed it to Zin; she smiled") are unattributable and skipped.
// - Enforcement is PREVENTIVE (a hard prompt contract for the writer) and
//   VISIBLE (export-gate warnings). There is no destructive auto-rewrite:
//   disguise plots make automated pronoun "fixes" wrong exactly when the
//   prose is at its most deliberate.

const SETS = {
  he: ['he', 'him', 'his', 'himself'],
  she: ['she', 'her', 'hers', 'herself'],
  they: ['they', 'them', 'their', 'theirs', 'themself', 'themselves'],
};
const SET_LABEL = { he: 'he/him', she: 'she/her', they: 'they/them' };
const WORD_TO_SET = {};
for (const [set, words] of Object.entries(SETS)) {
  for (const word of words) WORD_TO_SET[word] = set;
}
const PRONOUN_WORD = /\b(he|him|his|himself|she|her|hers|herself|they|them|their|theirs|themself|themselves)\b/gi;

function normalizeSetLabel(raw) {
  const first = String(raw || '').toLowerCase().split('/')[0].trim();
  if (first === 'he') return 'he';
  if (first === 'she') return 'she';
  if (first === 'they') return 'they';
  return null;
}

/**
 * Explicit "Name (she/her)"-style declarations in a character sheet.
 * Sheets are entry-structured: a header line names the character, and the
 * pronoun set may sit on the header itself or anywhere in that entry's block.
 * Naive same-line matching grabs label words ("Role: ... Pronouns: she/her"),
 * so parse per ENTRY: header name + first pronoun set in the block.
 */
export function parseDeclaredPronouns(charactersMd) {
  const declared = {};
  const lines = String(charactersMd || '').split('\n');
  const isHeader = (line) => /^\s{0,3}(?:#{1,4}\s|(?:\*\*)?\d+\.\s)/.test(line);
  const headerName = (line) => {
    for (const match of line.matchAll(/\b([A-Z][a-z'’-]{2,})\b/g)) {
      if (!NAME_STOPWORDS.has(match[1])) return match[1];
    }
    return null;
  };
  const PRONOUN_SET = /\b(she\s*\/\s*her|he\s*\/\s*him|they\s*\/\s*them)\b/i;

  let currentName = null;
  for (const line of lines) {
    if (isHeader(line)) currentName = headerName(line);
    const match = line.match(PRONOUN_SET);
    if (match && currentName && !declared[currentName]) {
      const set = normalizeSetLabel(match[1]);
      if (set) declared[currentName] = set;
    } else if (match && !currentName) {
      // Loose one-liner outside any entry: "Lark (they/them)".
      const name = headerName(line);
      if (name && !declared[name]) {
        const set = normalizeSetLabel(match[1]);
        if (set) declared[name] = set;
      }
    }
  }
  return declared;
}

function sentences(text) {
  return String(text || '')
    .replace(/\b(Dr|Mr|Mrs|Ms|Prof|Sr|Jr|St)\./g, '$1<ABBR>')
    .split(/(?<=[.!?])\s+|\n+/)
    .map((part) => part.replace(/<ABBR>/g, '.').trim())
    .filter(Boolean);
}

function soleNameSentences(text, name, allNames) {
  const others = allNames.filter((other) => other !== name);
  const out = [];
  for (const sentence of sentences(text)) {
    const at = sentence.indexOf(name);
    if (at === -1) continue;
    if (others.some((other) => sentence.includes(other))) continue;
    out.push({ sentence, tail: sentence.slice(at + name.length) });
  }
  return out;
}

function countSets(tail) {
  const counts = { he: 0, she: 0, they: 0 };
  for (const match of tail.matchAll(PRONOUN_WORD)) {
    counts[WORD_TO_SET[match[1].toLowerCase()]] += 1;
  }
  return counts;
}

/**
 * Dominant gendered usage per name across texts. Only he vs she compete; a
 * name wins canon when it has >= minSamples gendered hits and the winner holds
 * >= dominance of them. Everything else is unresolved.
 */
export function inferPronounsFromProse(texts, names, options = {}) {
  const minSamples = Number(options.minSamples) > 0 ? Number(options.minSamples) : 5;
  const dominance = Number(options.dominance) > 0 ? Number(options.dominance) : 0.7;
  const canon = {};
  const tallies = {};
  for (const name of names) tallies[name] = { he: 0, she: 0, they: 0 };
  for (const text of Array.isArray(texts) ? texts : [texts]) {
    for (const name of names) {
      for (const { tail } of soleNameSentences(text, name, names)) {
        const counts = countSets(tail);
        tallies[name].he += counts.he;
        tallies[name].she += counts.she;
        tallies[name].they += counts.they;
      }
    }
  }
  for (const name of names) {
    const { he, she } = tallies[name];
    const gendered = he + she;
    if (gendered < minSamples) continue;
    const winner = he >= she ? 'he' : 'she';
    const share = Math.max(he, she) / gendered;
    if (share >= dominance) canon[name] = winner;
  }
  return { canon, tallies };
}

/**
 * The canon map for one project: declarations override inference. Returns
 * { canon: {Name: 'he'|'she'|'they'}, unresolved: [names with heavy mixed
 * usage and no declaration], tallies }.
 */
export function buildPronounCanon(project, chapterTexts, names, options = {}) {
  const declared = parseDeclaredPronouns(project?.characters_md);
  const inferred = inferPronounsFromProse(chapterTexts, names, options);
  const canon = { ...inferred.canon, ...declared };
  const unresolved = [];
  for (const name of names) {
    if (canon[name]) continue;
    const t = inferred.tallies[name] || { he: 0, she: 0 };
    if (t.he + t.she >= (Number(options.minSamples) > 0 ? Number(options.minSamples) : 5)) {
      unresolved.push({ name, ...t });
    }
  }
  return { canon, unresolved, tallies: inferred.tallies, declared };
}

/**
 * Sentences where a canonical character takes a pronoun outside their set.
 * they-canon flags gendered pronouns; gendered canon flags only the OPPOSITE
 * gendered set (plural they is always legitimate prose).
 */
export function scanPronounViolations(text, canon, allNames) {
  const findings = [];
  const names = Array.isArray(allNames) && allNames.length ? allNames : Object.keys(canon || {});
  const allSentences = sentences(text);
  for (const [name, expected] of Object.entries(canon || {})) {
    const others = names.filter((other) => other !== name);
    for (let s = 0; s < allSentences.length; s += 1) {
      const sentence = allSentences[s];
      const at = sentence.indexOf(name);
      if (at === -1) continue;
      if (others.some((other) => sentence.includes(other))) continue;
      let tail = sentence.slice(at + name.length);
      // Drift usually lands in the NEXT sentence ("Lark stood. His hands..."):
      // extend the window when that sentence is pronoun-initial and names no
      // other cast member — the pronoun is then bound to this character.
      const next = allSentences[s + 1] || '';
      if (/^(?:He|She|They|His|Her|Their)\b/.test(next) && !names.some((other) => next.includes(other))) {
        tail += ` ${next}`;
      }
      const counts = countSets(tail);
      let bad = 0;
      if (expected === 'he') bad = counts.she;
      else if (expected === 'she') bad = counts.he;
      else bad = counts.he + counts.she;
      if (bad > 0) {
        findings.push({ name, expected: SET_LABEL[expected], excerpt: sentence.slice(0, 140) });
      }
    }
  }
  return findings;
}

/** Prompt-ready canon lines for the writer's narrative state contract. */
export function buildPronounCanonLines(canon) {
  const entries = Object.entries(canon || {});
  if (!entries.length) return '';
  return entries.map(([name, set]) => `${name}: ${SET_LABEL[set]}`).join('; ');
}

/**
 * Cast names for one book, from two sources that fail in opposite directions:
 * - Character-sheet ENTRY HEADERS (numbered/bold/heading lines only — body
 *   lines of a structured sheet are label soup: "Wound", "Want", "Tell").
 * - PROSE prominence across drafted chapters: capitalized tokens used often
 *   whose lowercase form never appears (the NAMEREG-1 trick), which finds the
 *   cast even when the sheet is unparseable.
 */
export function harvestCastNames(charactersMd, proseTexts = [], options = {}) {
  const max = Number(options.max) > 0 ? Number(options.max) : 24;
  const proseMin = Number(options.proseMin) > 0 ? Number(options.proseMin) : 12;
  const names = new Set();

  // Source 1: sheet entry headers.
  for (const line of String(charactersMd || '').split('\n')) {
    if (!/^\s{0,3}(?:#{1,4}\s|(?:\*\*)?\d+\.\s|\*\*[A-Z])/.test(line)) continue;
    for (const match of line.matchAll(/\b([A-Z][a-z'’-]{2,})\b/g)) {
      if (!NAME_STOPWORDS.has(match[1])) names.add(match[1]);
    }
    for (const match of line.matchAll(/['‘"]([A-Z][a-z'’-]+)['’"]/g)) {
      if (!NAME_STOPWORDS.has(match[1])) names.add(match[1]);
    }
  }

  // Source 2: prose prominence, highest counts first (a cap must never evict
  // a main character in favor of an incidental one).
  const texts = (Array.isArray(proseTexts) ? proseTexts : [proseTexts]).map((text) => String(text || ''));
  if (texts.length) {
    const corpus = texts.join('\n');
    const counts = new Map();
    for (const match of corpus.matchAll(/\b([A-Z][A-Za-z'’-]{1,})\b/g)) {
      const word = match[1].replace(/[’']s$/, ''); // JB’s -> JB
      if (word.length < 2 || NAME_STOPWORDS.has(word)) continue;
      counts.set(word, (counts.get(word) || 0) + 1);
    }
    const candidates = [...counts.entries()]
      .filter(([, count]) => count >= proseMin)
      .sort((a, b) => b[1] - a[1]);
    for (const [word] of candidates) {
      if (names.size >= max) break;
      // A real name's lowercase form does not occur as an ordinary word in the
      // ORIGINAL (case-preserved) corpus.
      if (new RegExp(`\\b${word.toLowerCase()}\\b`).test(corpus)) continue;
      names.add(word);
    }
  }

  return [...names].slice(0, max);
}

const NAME_STOPWORDS = new Set([
  'The', 'And', 'But', 'She', 'Her', 'His', 'He', 'They', 'Their', 'Them', 'It', 'Its', 'When', 'While',
  'After', 'Before', 'With', 'From', 'Into', 'That', 'This', 'These', 'Those', 'What', 'Then', 'There',
  'Who', 'Why', 'How', 'Not', 'Now', 'Once', 'Chapter', 'Character', 'Characters', 'Protagonist',
  'Antagonist', 'Major', 'Minor', 'Supporting', 'Role', 'Age', 'Appearance', 'Background', 'Personality',
  'Arc', 'Goals', 'Fears', 'Voice', 'Notes', 'Physical', 'Description', 'Relationships', 'History',
  'Secrets', 'Structural', 'Behavioral', 'Relational', 'Sensory', 'Milestones', 'Wound', 'Want', 'Need',
  'Engineer', 'Navigator', 'Pilot', 'Captain', 'Doctor', 'Nurse', 'Sheriff', 'Mayor', 'Owner', 'Keeper',
  'Leader', 'Mechanic', 'Villain', 'Hero', 'Mentor', 'Rival', 'Comic', 'Relief', 'Interest', 'Companion',
  'Sidekick', 'Pronouns', 'Pronoun',
  'I’m', 'I’ll', 'I’ve', 'I’d', "I'm", "I'll", "I've", "I'd", 'Im', 'Ill', 'Ive',
  'Lie', 'Tell', 'Mask', 'Humor', 'Style', 'Key', 'Dynamic', 'Sense', 'Object', 'Body', 'Space', 'Point',
  'Grace', 'Identity', 'Sacrifice', 'Moment', 'Breaking', 'Attachment', 'Coping', 'Mechanism', 'Social',
  'Signature', 'Comfort', 'Dialogue', 'Fingerprint', 'Believes', 'Constantly', 'Uses', 'Feels', 'Mrs',
  'Mr', 'Dr', 'Ms',
]);

export const PRONOUN_LOCK_VERSION = 'pronoun-lock-v1';
