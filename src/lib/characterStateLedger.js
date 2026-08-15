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

// ── CHARSTATE-2: planner-declared state changes ──
// Live failure (REDUX ch.11 redraft): the beat plan itself declared "JB
// returns, explaining his decision to come back" — the writer wrote the
// return, three repair passes rewrote it, and every version phrased it
// naturally ("JB pushed through the storm door…") instead of matching the
// narrow prose returnPatterns above. The audit kept seeing "departed
// character acting", and the chapter hard-blocked ON ITS OWN RETURN SCENE.
//
// The beat contract is the app's own structured, persisted data. When the
// planner-approved plan DECLARES a return or departure, the state machine
// honors the declaration instead of regex-guessing the writer's phrasing.
// Prose stays the source of truth where it speaks; declarations fill the
// silence. Closed-world: both sides of the check are data the app produced.
const escName = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const beatReturnPatterns = (name) => {
  const n = escName(name);
  return [
    // Verb form: "JB returns", "JB comes back at last" — subject position,
    // not a possessive ("JB's voice returns" is excluded).
    new RegExp(String.raw`\b${n}\b(?!['’]s)[^.!?\n]{0,50}\b(?:returns?|comes? back|came back|rejoins?|rejoined|is back|reunites?)\b`, 'i'),
    // Noun form: "JB's return", "the return of JB" — beat goals speak in
    // nouns ("JB's return and the crew's decision to reintegrate him").
    new RegExp(String.raw`\b${n}(?:['’]s)?\s+return\b`, 'i'),
    new RegExp(String.raw`\breturn of\s+${n}\b`, 'i'),
  ];
};

const beatDeparturePatterns = (name) => {
  const n = escName(name);
  return [
    new RegExp(String.raw`\b${n}\b(?!['’]s)[^.!?\n]{0,50}\b(?:leaves?|left|quits?|departs?|walks? away from)\s+(?:the\s+)?(?:crew|group|team|ship|town)\b`, 'i'),
    new RegExp(String.raw`\b${n}(?:['’]s)?\s+departure\b(?![^.!?\n]{0,40}\b(?:referenced|explained|mentioned|discussed)\b)`, 'i'),
  ];
};

/**
 * CHARSTATE-2: extract state changes DECLARED by beat-contract text (scene
 * goals + required events). Returns { returns: [name], departures: [name] }.
 */
export function extractBeatDeclaredStateUpdates(eventStrings = [], castNames = []) {
  const text = (Array.isArray(eventStrings) ? eventStrings : [eventStrings])
    .map((s) => String(s || '')).filter(Boolean).join('\n');
  const returns = new Set();
  const departures = new Set();
  if (!text) return { returns: [], departures: [] };
  for (const name of castNames) {
    if (beatReturnPatterns(name).some((rx) => rx.test(text))) returns.add(name);
    if (beatDeparturePatterns(name).some((rx) => rx.test(text))) departures.add(name);
  }
  return { returns: [...returns], departures: [...departures] };
}

/**
 * CHARSTATE-2: pull the declared event strings off a persisted chapter
 * record's beat contract (scene_beats_json — string or parsed). Fail-safe [].
 */
export function collectChapterBeatEvents(chapterRecord) {
  try {
    let beats = chapterRecord?.scene_beats_json;
    if (typeof beats === 'string') {
      if (!beats.trim()) return [];
      beats = JSON.parse(beats);
    }
    const scenes = Array.isArray(beats) ? beats : (beats?.scenes || beats?.beats || []);
    const out = [];
    for (const scene of scenes) {
      if (scene?.scene_goal) out.push(String(scene.scene_goal));
      for (const ev of (Array.isArray(scene?.required_events) ? scene.required_events : [])) {
        if (ev) out.push(String(ev));
      }
    }
    return out;
  } catch {
    return [];
  }
}

const nameAppearsIn = (text, name) =>
  new RegExp(`\\b${escName(name)}\\b`).test(String(text || ''));

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
 * @param {Array<{chapterNumber, text, beatEvents?}>} chapters - drafted prose
 *   in order. CHARSTATE-2: when a chapter entry carries `beatEvents` (the
 *   declared event strings from its persisted beat contract), declared
 *   returns/departures fill in where the prose patterns were silent —
 *   corroborated by the character actually appearing in that chapter's text.
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
    // CHARSTATE-2: beat-declared changes fill the prose patterns' silence.
    // Prose is the source of truth where it spoke (any prose-extracted update
    // for the name in THIS chapter wins); a declaration only counts when the
    // character actually appears on the chapter's pages.
    if (Array.isArray(ch.beatEvents) && ch.beatEvents.length) {
      const declared = extractBeatDeclaredStateUpdates(ch.beatEvents, castNames);
      const proseSpoke = new Set([...updates.departures, ...updates.returns]);
      for (const name of declared.returns) {
        if (proseSpoke.has(name)) continue;
        if (!nameAppearsIn(ch.text, name)) continue;
        const entry = ensure(name);
        if (entry.partyStatus === 'departed') {
          entry.partyStatus = 'returned';
          entry.statusChapter = Number(ch.chapterNumber);
        }
      }
      for (const name of declared.departures) {
        if (proseSpoke.has(name)) continue;
        if (!nameAppearsIn(ch.text, name)) continue;
        const entry = ensure(name);
        entry.partyStatus = 'departed';
        entry.statusChapter = Number(ch.chapterNumber);
      }
    }
  }
  return state;
}

/**
 * Prompt-ready hard contract. Empty string when there is nothing to enforce —
 * no noise for a young book.
 */
export function buildCharacterStateContract(state = {}, declaredReturns = []) {
  const lines = [];
  const declaredSet = new Set(Array.isArray(declaredReturns) ? declaredReturns : []);
  for (const [name, entry] of Object.entries(state)) {
    if (entry.partyStatus === 'departed') {
      if (declaredSet.has(name)) {
        // CHARSTATE-2: this chapter's own plan stages the return — the
        // contract must demand the return be WRITTEN, not ban the character.
        lines.push(`${name} DEPARTED the crew in chapter ${entry.statusChapter}. THIS chapter's plan DECLARES ${name}'s return: write the return ON THE PAGE — arrival, reunion, and ${name}'s reason for coming back — in the scene that stages it. ${name} may not appear before that scene.`);
      } else {
        lines.push(`${name} DEPARTED the crew in chapter ${entry.statusChapter} and has NOT returned. ${name} may NOT appear with, travel with, or speak to the crew in this scene. If the story needs ${name} back, a RETURN must be written on the page first — arrival, reunion, reason.`);
      }
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
export function auditProseAgainstCharacterState(prose, state = {}, castNames = [], options = {}) {
  const text = String(prose || '');
  if (!text) return [];
  const narration = stripDialogue(text);
  const violations = [];
  // CHARSTATE-2: names whose return THIS prose's own beat contract declares.
  // The plan staging the return IS the authorization — the writer's phrasing
  // of that return is not required to match the narrow prose patterns (the
  // live ch.11 failure: four natural phrasings of a planned return, none
  // matched, and the chapter hard-blocked on its own return scene).
  const declaredReturns = new Set(Array.isArray(options.declaredReturns) ? options.declaredReturns : []);

  for (const [name, entry] of Object.entries(state)) {
    if (entry.partyStatus !== 'departed') continue;
    if (!castNames.includes(name)) continue;
    if (declaredReturns.has(name)) continue; // CHARSTATE-2
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

export const CHARACTER_STATE_VERSION = 'character-state-v2';
