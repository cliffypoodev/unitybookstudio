// src/lib/characterStateLedger.js — CHARSTATE-1
//
// The character STATE machine. The story bible says what a character IS;
// nothing said what state they are IN — and the difference is exactly the
// class of defect the 71/100 external review called the bottleneck:
//
// - REDUX ch.9 gave JB a full departure arc ("He was gone.", the crew mourns,
//   Zorblax computes a 4.2% return chance) and ch.10 opened with JB fidgeting
//   at a counter — no return, no reunion. Every scene generator saw
//   "JB = main cast" and resurrected him.
// - REDUX ch.3 (redraft) staged Nolan's self-introduction twice: the beat
//   contract never carried the name, so scene 2 had no fact to collide with.
//   Introductions are PROSE facts; the state must be read from the prose that
//   shipped, not the beats that were planned.
//
// This module derives per-character state deterministically from drafted
// prose, in chapter order:
//   partyStatus:  'present' | 'departed' | 'returned'
//   introduced:   character has performed a named self-introduction
// and provides: a prompt-ready hard contract, and a prose audit that fails a
// scene which contradicts the state (a departed character acting with the
// crew; a second named self-introduction).
//
// Deterministic. No LLM. Nothing book-specific — names come from the
// project's own cast and the prose itself. Fail-open: no cast, no checks.

const NAME = String.raw`[A-Z][A-Za-z'’-]{1,}(?:\s+[A-Z][A-Za-z'’-]{1,})?`;

// ── Self-introduction extraction (prose facts, not beat facts) ──
const INTRO_PATTERNS = [
  new RegExp(String.raw`["“]\s*(?:I(?:'|’)m|I am|The name(?:'|’)s|My name is|Name(?:'|’)s|Call me)\s+(${NAME})`, 'g'),
  new RegExp(String.raw`introduced (?:him|her|them)sel(?:f|ves) as\s+["“]?(${NAME})`, 'g'),
];

// ── Departure extraction ──
// Tight, narration-only shapes. "left the room" is scene traffic; leaving the
// CREW/GROUP/TOWN/SHIP, walking away for good, or the terminal "X was gone."
// are story-state changes.
const departurePatterns = (name) => {
  const n = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return [
    new RegExp(String.raw`\b${n}\b[^.!?]{0,60}\b(?:left|leaves|leaving|quit)\s+the\s+(?:crew|group|team|ship|town)\b`, 'i'),
    new RegExp(String.raw`\b${n}\s+(?:walked|walks)\s+away\b(?![^.!?]{0,40}\b(?:from the (?:table|counter|window|console|engine)))`, 'i'),
    new RegExp(String.raw`\bwatched\s+${n}\s+(?:go|leave|walk away|disappear)\b`, 'i'),
    new RegExp(String.raw`\b${n}\s+was\s+gone\.`, 'i'),
    new RegExp(String.raw`\b(?:He|She|They)\s+was\s+gone\.[^A-Za-z]{0,10}$`, 'm'), // terminal paragraph closer — attributed below
  ];
};

const returnPatterns = (name) => {
  const n = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return [
    // The NAME must be the subject — "JB came back" is a return; "JB's voice
    // came back" (live ch.10, over a windstorm) is not.
    new RegExp(String.raw`\b${n}\b(?!['’]s)\s+(?:finally\s+|had\s+|has\s+)?(?:came back|come back|was back|is back|returned|returns|rejoined|rejoins)\b`, 'i'),
    new RegExp(String.raw`\b(?:welcomed|hugged)\s+${n}\s+back\b`, 'i'),
  ];
};

function stripDialogue(prose) {
  // State changes must be narrated, not merely spoken about ("He's gone" in
  // dialogue is a character's claim; narration is the story's fact).
  return String(prose || '')
    .replace(/“[^”]*”/g, ' ')
    .replace(/"[^"\n]*"/g, ' ');
}

/**
 * Extract state updates one scene/chapter of prose implies.
 * Returns { introductions: [name], departures: [name], returns: [name] }.
 * Only names present in `castNames` are tracked for party status; any name is
 * tracked for introductions (new characters introduce themselves too).
 */
export function extractCharacterStateUpdates(prose, castNames = []) {
  const text = String(prose || '');
  const narration = stripDialogue(text);
  const introductions = new Set();
  const departures = new Set();
  const returns = new Set();

  const INTRO_STOPWORDS = new Set(['Not', 'So', 'Sure', 'Sorry', 'Fine', 'Okay', 'Just', 'Here', 'The', 'Serious', 'Done', 'Ready', 'Good', 'Right', 'Afraid', 'Sick', 'Tired', 'Telling', 'Trying', 'Going', 'Coming', 'Leaving', 'Staying']);
  for (const rx of INTRO_PATTERNS) {
    rx.lastIndex = 0;
    for (const m of text.matchAll(rx)) {
      const name = m[1].trim();
      if (!INTRO_STOPWORDS.has(name.split(/\s+/)[0])) introductions.add(name);
    }
  }

  for (const name of castNames) {
    const departed = departurePatterns(name).slice(0, 4).some((rx) => rx.test(narration));
    const returned = returnPatterns(name).some((rx) => rx.test(narration));
    // Attribute the bare terminal "He/She was gone." to `name` only when the
    // same paragraph names them and nobody else in the cast.
    let terminalGone = false;
    if (!departed) {
      for (const para of narration.split(/\n{2,}/)) {
        if (!/\b(?:He|She|They) was gone\./.test(para)) continue;
        const named = castNames.filter((c) => new RegExp(`\\b${c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(para));
        if (named.length === 1 && named[0] === name) { terminalGone = true; break; }
      }
    }
    if ((departed || terminalGone) && !returned) departures.add(name);
    if (returned) returns.add(name);
  }

  return {
    introductions: [...introductions],
    departures: [...departures],
    returns: [...returns],
  };
}

/**
 * Fold chapter prose (in chapter order) into a state map:
 * { [name]: { introduced: chapterNumber|null, partyStatus, statusChapter } }.
 *
 * @param {Array<{chapterNumber, text}>} chapters - drafted prose in order
 * @param {string[]} castNames
 */
export function buildCharacterState(chapters = [], castNames = []) {
  const state = {};
  const ensure = (name) => {
    if (!state[name]) state[name] = { introduced: null, partyStatus: 'present', statusChapter: null };
    return state[name];
  };
  for (const name of castNames) ensure(name);

  const ordered = [...chapters]
    .filter((c) => Number(c?.chapterNumber) > 0 && String(c?.text || '').length > 200)
    .sort((a, b) => Number(a.chapterNumber) - Number(b.chapterNumber));

  for (const ch of ordered) {
    const updates = extractCharacterStateUpdates(ch.text, castNames);
    for (const name of updates.introductions) {
      const entry = ensure(name);
      if (entry.introduced === null) entry.introduced = Number(ch.chapterNumber);
    }
    for (const name of updates.departures) {
      const entry = ensure(name);
      entry.partyStatus = 'departed';
      entry.statusChapter = Number(ch.chapterNumber);
    }
    for (const name of updates.returns) {
      const entry = ensure(name);
      entry.partyStatus = 'returned';
      entry.statusChapter = Number(ch.chapterNumber);
    }
  }
  return state;
}

/**
 * Prompt-ready hard contract. Empty string when there is nothing to enforce —
 * no noise for a young book.
 */
export function buildCharacterStateContract(state = {}) {
  const lines = [];
  for (const [name, entry] of Object.entries(state)) {
    if (entry.partyStatus === 'departed') {
      lines.push(`${name} DEPARTED the crew in chapter ${entry.statusChapter} and has NOT returned. ${name} may NOT appear with, travel with, or speak to the crew in this scene. If the story needs ${name} back, a RETURN must be written on the page first — arrival, reunion, reason.`);
    }
    if (entry.introduced !== null) {
      lines.push(`${name} already introduced themselves by name (chapter ${entry.introduced}). Never write another first meeting or self-introduction for ${name}.`);
    }
  }
  if (!lines.length) return '';
  return `CHARACTER STATE (hard story facts — violating any of these is a continuity error):\n- ${lines.join('\n- ')}`;
}

/**
 * Audit a scene's prose against the state. Returns violations:
 * [{ code, name, message, evidence }].
 *
 * DEPARTED_CHARACTER_ACTIVE — a departed character performs narrated actions
 *   without a return earlier in the SAME prose.
 * DUPLICATE_INTRODUCTION — a named self-introduction for a character the
 *   ledger already has introduced.
 */
export function auditProseAgainstCharacterState(prose, state = {}, castNames = []) {
  const text = String(prose || '');
  if (!text) return [];
  const narration = stripDialogue(text);
  const violations = [];

  for (const [name, entry] of Object.entries(state)) {
    if (entry.partyStatus !== 'departed') continue;
    if (!castNames.includes(name)) continue;
    const n = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // A return written in THIS prose legalizes later appearances.
    const returnedHere = returnPatterns(name).some((rx) => rx.test(narration));
    if (returnedHere) continue;
    // Narrated action: name followed by a verb-ish continuation in narration.
    const acting = narration.match(new RegExp(`\\b${n}\\b\\s+(?:was|were|is|had|stood|sat|walked|ran|grabbed|held|said|laughed|nodded|fidgeted|leaned|looked|turned|smiled|grinned|shrugged|worked|climbed|reached|moved|stepped|pointed|whispered|shouted|helped|watched|waited|followed|joined)[a-z]*\\b[^.!?]{0,80}`, 'i'));
    if (acting) {
      violations.push({
        code: 'DEPARTED_CHARACTER_ACTIVE',
        name,
        message: `${name} departed the crew in chapter ${entry.statusChapter} and appears here acting with no return written. Either write ${name}'s return (arrival + reunion + reason) BEFORE this, or remove ${name} from the scene.`,
        evidence: acting[0].slice(0, 120),
      });
    }
  }

  const updates = extractCharacterStateUpdates(text, castNames);
  for (const name of updates.introductions) {
    const entry = state[name];
    if (entry && entry.introduced !== null) {
      violations.push({
        code: 'DUPLICATE_INTRODUCTION',
        name,
        message: `${name} already introduced themselves in chapter ${entry.introduced}; this scene stages ANOTHER self-introduction. Characters who know each other never re-meet — write the scene as a continuation.`,
        evidence: `self-introduction of ${name}`,
      });
    }
  }

  return violations;
}

export const CHARACTER_STATE_VERSION = 'character-state-v1';
