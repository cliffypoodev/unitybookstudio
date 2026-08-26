// src/lib/nameGate.js — NAMEGATE-1 (carried finding 35b)
//
// A drafted or polished fiction chapter can introduce a person the story
// bible never established, and nothing catches it: a naive "every proper
// noun must be in the bible" test is far too strict for fiction (Nebula,
// Andromeda, Kevlar, a ship's name — none of them people, all of them
// flagged). Finding 35b is the live case this narrows to: Arc D's redraft
// of a chapter invented "Halvard", a Tier-1 banned name that was never in any
// bible field, and the only trace was an unrelated pronoun-lock warning.
//
// NAMEGATE-1's answer is PERSON-SIGNAL, not proper-noun: a name only
// counts as a claimed character when the prose treats it like one (a
// dialogue tag, a body-part possessive, an honorific, a person-shaped
// verb) — never a bare capitalized token. Fiction only; nonfiction already
// has its own closed-world check (the bibliography/research evidence).

import { normCW, createInEV, CLOSED_WORLD_STOPWORDS } from './closedWorldText.js';
import { NAME_STOPWORDS } from './pronounLock.js';
import { isFictionProject } from './projectType.js';

export const NAME_GATE_VERSION = 'name-gate-v1';

// GATEPROMOTE-1 pattern (same as MALFORMEDSENT_HARD_BLOCK / NF_BIBLIOGRAPHY_HARD_BLOCK):
// detection ships now; hard-blocking export on an unknown person is a
// follow-up decision, not this arc's.
export const NAMEGATE_HARD_BLOCK = false;

export const PERSON_VERBS = [
  'said', 'asked', 'replied', 'answered', 'nodded', 'looked', 'turned', 'smiled', 'laughed', 'shrugged',
  'whispered', 'muttered', 'grinned', 'sighed', 'stepped', 'leaned', 'frowned', 'glanced', 'snapped',
  'called', 'shouted', 'paused', 'stared', 'blinked', 'swallowed', 'winced', 'hesitated', 'added',
  'continued', 'murmured', 'growled', 'breathed', 'watched', 'moved', 'crossed', 'pulled', 'pushed',
  'reached', 'walked', 'stood', 'sat', 'came', 'comes', 'went',
];

export const PERSON_PARTS = [
  'hand', 'hands', 'face', 'eyes', 'voice', 'jaw', 'shoulder', 'shoulders', 'mouth', 'chest', 'head',
  'arm', 'arms', 'fingers', 'lips', 'brow', 'gaze', 'expression', 'throat', 'knuckles', 'smile', 'grin',
];

const HONORIFICS = ['Mr', 'Mrs', 'Ms', 'Miss', 'Dr', 'Captain', 'Sergeant', 'Officer', 'Professor'];

const NAME_RX_SRC = "[A-Z][a-z]+";

// Four independent person signals. Each captures the candidate name in
// group 1 so the scanner can attribute a hit regardless of which shape
// matched.
const SIGNALS = [
  { kind: 'name-verb', rx: new RegExp(`\\b(${NAME_RX_SRC})\\s+(?:${PERSON_VERBS.join('|')})\\b`, 'g') },
  { kind: 'verb-name', rx: new RegExp(`\\b(?:said|asked|whispered|muttered|replied|called|shouted|murmured)\\s+(${NAME_RX_SRC})\\b`, 'g') },
  { kind: 'possessive-part', rx: new RegExp(`\\b(${NAME_RX_SRC})['’]s\\s+(?:${PERSON_PARTS.join('|')})\\b`, 'g') },
  { kind: 'honorific', rx: new RegExp(`\\b(?:${HONORIFICS.join('|')})\\.?\\s+(${NAME_RX_SRC})\\b`, 'g') },
];

/**
 * Build the padded, normalized evidence corpus for a FICTION project: title,
 * seed_concept, every `project[k]` ending in `_md` (characters_md, world_md,
 * canon_md, outline_md, voice_md, mystery_md, twists_md, research_md, ...),
 * and canon_characters. Keys are discovered, never hard-coded, so a new
 * `_md` field is picked up automatically.
 *
 * NAMEGATE-1B (finding 54): the `chapters` parameter is accepted for API
 * stability but deliberately NOT folded in, and every call site now passes
 * `chapters: []`. Chapter `title` / `beat_summary` / `summary` /
 * `scene_beats_json` are OUTLINE OUTPUT — generated downstream of the bible,
 * not part of it — and folding them into evidence made the gate blind to
 * the exact failure it exists to catch: live, the outline stage invented
 * "Halvard" straight into two chapters' own `scene_beats_json`, and because
 * that text counted as "evidence," findUnknownPersons treated the
 * fabricated name as established and never flagged it. Evidence is the
 * BIBLE only — what the author declared before any chapter existed.
 */
export function buildFictionEvidence(project, { chapters = [] } = {}) {
  void chapters; // intentionally unused — see NAMEGATE-1B note above
  const parts = [];
  if (project?.title) parts.push(String(project.title));
  if (project?.seed_concept) parts.push(String(project.seed_concept));
  for (const key of Object.keys(project || {})) {
    if (!key.endsWith('_md')) continue;
    const val = project[key];
    if (typeof val === 'string' && val) parts.push(val);
  }
  if (project?.canon_characters) {
    parts.push(typeof project.canon_characters === 'string' ? project.canon_characters : JSON.stringify(project.canon_characters));
  }
  return ' ' + normCW(parts.filter(Boolean).join(' ')) + ' ';
}

/** Whole-word occurrences of `name` in `text` — NAMEGATE-1B's "mentions" count. */
function wholeWordMentions(text, name) {
  const rx = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
  return (String(text || '').match(rx) || []).length;
}

/**
 * Scan `text` for every candidate name carrying >= 1 person signal.
 * Internal — shared by findUnknownPersons and makeUnknownPersonDetector so
 * the sentence-level detail the lane needs (a real, findable sentence to
 * anchor the regen target on) and the summary shape the battery/export gate
 * need come from one pass, never two independently-drifting scans.
 */
// Signals are matched against the WHOLE PARAGRAPH, never a pre-split
// "sentence" — a naive sentence splitter breaks on "Mr." itself (splits
// right after the abbreviation period), which would silently blind the
// honorific signal to the exact "Mr. Henderson" shape it exists to catch.
// "Sentence-initial" for the precision-rule exemption is therefore a
// paragraph-local heuristic (paragraph-initial, or immediately after a
// [.!?] + space run) rather than a real sentence boundary — the same
// imprecision splitSentencesForDedupe already tolerates elsewhere in this
// codebase, and it only ever affects which borderline names get exempted,
// never whether a real signal is matched in the first place.
const SENTENCE_BOUNDARY_BEFORE_RX = /[.!?]["'”’]*\s+$/;

function scanCandidateNames(text) {
  const paragraphs = String(text || '').split(/\n\s*\n/);
  const byName = new Map();

  paragraphs.forEach((paragraph, paragraphIndex) => {
    for (const { kind, rx } of SIGNALS) {
      rx.lastIndex = 0;
      let m;
      while ((m = rx.exec(paragraph))) {
        const name = m[1];
        const before = paragraph.slice(0, m.index).replace(/^[“"'‘’]+/, '');
        const isSentenceInitial = before.trim() === '' || SENTENCE_BOUNDARY_BEFORE_RX.test(before);
        if (!byName.has(name)) {
          byName.set(name, { count: 0, signals: new Set(), allSentenceInitial: true, firstParagraphIndex: paragraphIndex, firstSentence: paragraph });
        }
        const rec = byName.get(name);
        rec.count += 1;
        rec.signals.add(kind);
        if (!isSentenceInitial) rec.allSentenceInitial = false;
      }
    }
  });

  return byName;
}

/**
 * Find every name in `prose` that reads as a claimed PERSON (>= 1 person
 * signal) and is not accounted for by the bible/research evidence or the
 * cast list. Excluded: NAME_STOPWORDS, CLOSED_WORLD_STOPWORDS, any cast
 * name (case-insensitive), anything `inEV` accepts — and, for precision, a
 * name whose every occurrence is sentence-initial AND which carries only a
 * single signal kind ("Really looked at him" — an ordinary sentence-initial
 * adverb next to a person-verb, not a person). This is also the exact
 * boundary for a place name with a verb-like follow: "Abilene came into
 * view" alone (sentence-initial, one signal: name-verb) is NOT flagged even
 * when Abilene is not in the bible; "Abilene's shoulder tensed" elsewhere in
 * the same text adds a second, non-sentence-initial signal
 * (possessive-part) and the name IS flagged — a place does not have a
 * shoulder, so that second occurrence is the real tell.
 *
 * NAMEGATE-1B (finding 55): `count` is signal HITS, not raw mentions of the
 * name — a name can appear far more often than it carries a person signal
 * (live: Ch.13 "Henderson," 33 whole-word mentions, only 21 with a signal
 * nearby). `mentions` is added alongside `count` for exactly that reason;
 * `count` is kept, unchanged, for callers already reading it as "signal
 * hits" (the lane's rescan/defect-remains path does not care about mentions).
 *
 * @returns {Array<{name, count, mentions, signals: string[], paragraphIndex}>}
 */
export function findUnknownPersons(prose, { evidence, cast = [] } = {}) {
  const text = String(prose || '');
  if (!text.trim()) return [];
  const inEV = createInEV(evidence);
  const castNorm = new Set((Array.isArray(cast) ? cast : []).filter(Boolean).map((n) => normCW(n)));

  const byName = scanCandidateNames(text);
  const results = [];
  for (const [name, rec] of byName.entries()) {
    if (NAME_STOPWORDS.has(name)) continue;
    const n = normCW(name);
    if (!n || CLOSED_WORLD_STOPWORDS.has(n)) continue;
    if (castNorm.has(n)) continue;
    if (inEV(name)) continue;
    if (rec.allSentenceInitial && rec.signals.size === 1) continue;
    results.push({ name, count: rec.count, mentions: wholeWordMentions(text, name), signals: [...rec.signals], paragraphIndex: rec.firstParagraphIndex });
  }
  return results.sort((a, b) => a.paragraphIndex - b.paragraphIndex);
}

/**
 * A lane detector `(text) => [{ kind: 'unknown-person', sentence, reason }]`
 * — one target per unknown name, anchored on the first sentence that
 * carried a person signal for that name, `mustNotContain: [name]` so
 * defect-remains (regenerateLane.js) rejects any rewrite that still
 * contains the name. Built once per call: evidence is computed a single
 * time, not per chapter/paragraph. Fiction only — a nonfiction project gets
 * a no-op detector so every call site can add this unconditionally, the
 * same way the runner's other extraDetectors are added without a mode
 * string test.
 */
export function makeUnknownPersonDetector({ project, cast = [], chapters = [] } = {}) {
  if (!isFictionProject(project)) return () => [];
  const evidence = buildFictionEvidence(project, { chapters });
  return (text) => {
    const byName = scanCandidateNames(text);
    const castNorm = new Set((Array.isArray(cast) ? cast : []).filter(Boolean).map((n) => normCW(n)));
    const inEV = createInEV(evidence);
    const out = [];
    for (const [name, rec] of byName.entries()) {
      if (NAME_STOPWORDS.has(name)) continue;
      const n = normCW(name);
      if (!n || CLOSED_WORLD_STOPWORDS.has(n)) continue;
      if (castNorm.has(n)) continue;
      if (inEV(name)) continue;
      if (rec.allSentenceInitial && rec.signals.size === 1) continue;
      out.push({
        kind: 'unknown-person',
        sentence: rec.firstSentence,
        reason: `unknown-person:${name}`,
        mustNotContain: [name],
      });
    }
    return out;
  };
}
