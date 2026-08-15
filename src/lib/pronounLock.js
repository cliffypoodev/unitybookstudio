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
  // PRONOUNVAR-1: a genderfluid character whose presentation (and pronouns)
  // change BY SCENE is declared "context-variable" / "variable" / "fluid" /
  // "pronouns vary". Such a character is exempt from the single-set canon and
  // from the unresolved warning; instead a WITHIN-SCENE consistency check
  // applies (one set per scene, no mixing inside a scene).
  // Connector [\s:=*_-]* absorbs markdown emphasis and label punctuation
  // between the word "Pronouns" and its value ("**Pronouns:** context-variable").
  const PRONOUN_VARIABLE = /\bpronoun[s]?[\s:=*_-]*(?:context-?variable|variable|fluid|varies|vary)\b|\bcontext-?variable\b|\bgender[\s-]?fluid\b|\b(?:she\s*\/\s*he|he\s*\/\s*she|any\s+pronouns)\b/i;

  let currentName = null;
  for (const line of lines) {
    if (isHeader(line)) currentName = headerName(line);
    const varMatch = PRONOUN_VARIABLE.test(line);
    if (varMatch && currentName && !declared[currentName]) {
      declared[currentName] = 'variable';
      continue;
    } else if (varMatch && !currentName) {
      const name = headerName(line);
      if (name && !declared[name]) { declared[name] = 'variable'; continue; }
    }
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
  // PRONOUNVAR-1: context-variable characters are pulled OUT of the fixed
  // canon (a single-set contradiction check would fire on every scene where
  // their presentation legitimately changes) and OUT of the unresolved
  // warning (their mixed usage is the point, not a defect). They ride in a
  // `variable` list and are governed by the within-scene drift check instead.
  const variable = [];
  const declaredFixed = {};
  for (const [name, set] of Object.entries(declared)) {
    if (set === 'variable') variable.push(name);
    else declaredFixed[name] = set;
  }
  const canon = { ...inferred.canon, ...declaredFixed };
  for (const name of variable) delete canon[name];
  const unresolved = [];
  for (const name of names) {
    if (canon[name] || variable.includes(name)) continue;
    const t = inferred.tallies[name] || { he: 0, she: 0 };
    if (t.he + t.she >= (Number(options.minSamples) > 0 ? Number(options.minSamples) : 5)) {
      unresolved.push({ name, ...t });
    }
  }
  return { canon, unresolved, variable, tallies: inferred.tallies, declared };
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

// ── PRONOUNVAR-1: context-variable pronoun handling ──
// A scene is the text between "* * *" markers (or the whole chapter when there
// are none). Within ONE scene, a context-variable character presents as ONE
// gender: mixing he and she for them inside a single scene is the drift the
// external audit flagged ("Lark ... he/his throughout that scene" elsewhere
// she/her). Between scenes, a change is intentional and legal.
const SCENE_BREAK_RX = /(\n\s*\*\s*\*\s*\*\s*\n)/;
function splitScenes(text) {
  // Non-capturing view for tallies.
  return String(text || '').split(SCENE_BREAK_RX).filter((_, i) => i % 2 === 0);
}
// Capturing split: [scene0, sep0, scene1, sep1, …] so a heal can rejoin with
// the ORIGINAL separators byte-for-byte (the book uses "\n\n* * *\n\n").
function splitScenesWithSeps(text) {
  return String(text || '').split(SCENE_BREAK_RX);
}

/**
 * Attribute each sentence in a scene to a cast subject, in reading order:
 * - a sentence naming exactly ONE cast member sets the current subject and is
 *   attributed to it (pronouns counted after the name);
 * - a pronoun-initial sentence naming NO cast member is attributed to the
 *   current subject ("Lark adjusted the wig. His hands were steady.");
 * - a sentence naming TWO+ cast members clears the subject (ambiguous).
 * Returns { sentences: [{ text, subject, from }], tally: {name:{he,she}} }
 * where `from` is the char index in the sentence at which counting begins
 * (after the name, or 0 for a bound pronoun-initial sentence).
 */
function attributeScene(sceneText, allNames) {
  const out = [];
  const tally = {};
  let current = null;
  for (const sentence of sentences(sceneText)) {
    const present = allNames.filter((n) => sentence.includes(n));
    if (present.length === 1) {
      current = present[0];
      const from = sentence.indexOf(current) + current.length;
      out.push({ text: sentence, subject: current, from });
    } else if (present.length === 0 && current && /^(?:He|She|His|Her|Him|They|Their|Them)\b/.test(sentence)) {
      out.push({ text: sentence, subject: current, from: 0 });
    } else {
      if (present.length >= 2) current = null;
      continue;
    }
    const last = out[out.length - 1];
    const c = countSets(sentence.slice(last.from));
    tally[last.subject] = tally[last.subject] || { he: 0, she: 0 };
    tally[last.subject].he += c.he;
    tally[last.subject].she += c.she;
  }
  return { sentences: out, tally };
}

/**
 * Per-scene gendered tally for a context-variable character. Uses ordered
 * attribution so a bound pronoun-initial sentence counts toward the character.
 * Returns { he, she, majority, mixed }.
 */
function sceneGenderTallies(sceneText, name, allNames) {
  const t = attributeScene(sceneText, allNames).tally[name] || { he: 0, she: 0 };
  const he = t.he;
  const she = t.she;
  const majority = he === she ? null : (he > she ? 'he' : 'she');
  return { he, she, majority, mixed: he > 0 && she > 0 };
}

/**
 * Within-scene pronoun drift for context-variable characters. Returns
 * [{ name, sceneIndex, he, she, excerpt }] — one per scene that mixes he and
 * she for that character. Cross-scene variation is never reported.
 */
export function scanContextVariablePronounDrift(text, variableNames = [], allNames = []) {
  const findings = [];
  const names = Array.isArray(allNames) && allNames.length ? allNames : variableNames;
  const scenes = splitScenes(text);
  for (const name of variableNames) {
    scenes.forEach((scene, sceneIndex) => {
      const t = sceneGenderTallies(scene, name, names);
      if (!t.mixed) return;
      const sole = soleNameSentences(scene, name, names);
      const excerpt = (sole[0]?.sentence || '').slice(0, 140);
      findings.push({ name, sceneIndex, he: t.he, she: t.she, excerpt });
    });
  }
  return findings;
}

/**
 * Heal within-scene pronoun drift for a context-variable character: in each
 * scene, flip the MINORITY gendered pronouns to the scene's majority — but
 * ONLY inside that character's sole-name sentences, so a pronoun that refers
 * to someone else is never touched. A scene with no majority (a tie) is left
 * alone. Returns { text, healed: [{ sceneIndex, from, to, count }] }.
 */
function flipPronounsAfter(sentence, from, minority) {
  const head = sentence.slice(0, from);
  let tail = sentence.slice(from);
  let count = 0;
  if (minority === 'she') {
    // she→he. "her <word>" is possessive → "his"; bare "her" is object → "him".
    tail = tail
      .replace(/\bshe\b/g, () => { count++; return 'he'; })
      .replace(/\bShe\b/g, () => { count++; return 'He'; })
      .replace(/\bher\b(?=\s+[’'A-Za-z])/g, () => { count++; return 'his'; })
      .replace(/\bher\b/g, () => { count++; return 'him'; })
      .replace(/\bHer\b(?=\s+[’'A-Za-z])/g, () => { count++; return 'His'; })
      .replace(/\bHer\b/g, () => { count++; return 'Him'; })
      .replace(/\bhers\b/g, () => { count++; return 'his'; })
      .replace(/\bherself\b/g, () => { count++; return 'himself'; });
  } else {
    // he→she.
    tail = tail
      .replace(/\bhe\b/g, () => { count++; return 'she'; })
      .replace(/\bHe\b/g, () => { count++; return 'She'; })
      .replace(/\bhis\b/g, () => { count++; return 'her'; })
      .replace(/\bHis\b/g, () => { count++; return 'Her'; })
      .replace(/\bhim\b/g, () => { count++; return 'her'; })
      .replace(/\bHim\b/g, () => { count++; return 'Her'; })
      .replace(/\bhimself\b/g, () => { count++; return 'herself'; });
  }
  return { sentence: head + tail, count };
}

export function healContextVariablePronounScenes(text, name, allNames = []) {
  const parts = splitScenesWithSeps(String(text || '')); // [scene, sep, scene, sep, …]
  const healed = [];
  let sceneIndex = -1;
  for (let i = 0; i < parts.length; i += 2) {
    sceneIndex += 1;
    const scene = parts[i];
    const attr = attributeScene(scene, allNames);
    const t = attr.tally[name] || { he: 0, she: 0 };
    if (!(t.he > 0 && t.she > 0)) continue; // not mixed
    const majority = t.he > t.she ? 'he' : (t.she > t.he ? 'she' : null);
    if (!majority) continue; // tie: leave alone
    const minority = majority === 'he' ? 'she' : 'he';
    let count = 0;
    let out = scene;
    // Flip minority pronouns to the majority, only in sentences attributed to
    // THIS character — sole-name sentences and bound pronoun-initial follow-ons.
    for (const s of attr.sentences.filter((x) => x.subject === name)) {
      const { sentence: fixed, count: n } = flipPronounsAfter(s.text, s.from, minority);
      if (n > 0 && fixed !== s.text) {
        const at = out.indexOf(s.text);
        if (at >= 0) { out = out.slice(0, at) + fixed + out.slice(at + s.text.length); count += n; }
      }
    }
    if (count > 0) { parts[i] = out; healed.push({ sceneIndex, from: minority, to: majority, count }); }
  }
  return { text: parts.join(''), healed };
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

export const PRONOUN_LOCK_VERSION = 'pronoun-lock-v2'; // PRONOUNVAR-1
