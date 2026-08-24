// src/lib/chapterStateContract.js — STATECONTRACT-1
//
// One closed-world state contract per chapter. The pieces already existed —
// pronoun canon, role canon, the character state machine, the event ledger,
// the style budget — but were assembled as separate prompt lines with no
// resolved-arc protection and no same-chapter scene map. This module
// composes all of it into ONE block the planner and every scene prompt can
// share, so "what is already true" is answered once, not five times.
//
// Fail-open per section: a section that cannot be built (missing data,
// malformed foundation field) contributes nothing rather than throwing.

import { parseCanonCast } from './canonRoles.js';
import { parseDeclaredPronouns, buildPronounCanon, harvestCastNames } from './pronounLock.js';
import { buildCharacterState } from './characterStateLedger.js';
import { buildPriorChapterEventLedger } from './eventLedger.js';
import { buildBookStyleLedger, buildStyleBudgetPromptBlock } from './aiSlopReduction.js';

// anthologyEngine.js imports the `@/` alias transitively (unrelated to
// isAnthologyProject itself), which breaks bare-Node battery resolution for
// any module that imports it. Same check, kept local so this module — and
// its battery — stay relative-imports-only. Keep in sync with
// isAnthologyProject in anthologyEngine.js.
function isAnthologyProject(project) {
  if (!project) return false;
  if (project.project_type === 'anthology') return true;
  if (project.anthology_theme && String(project.anthology_theme).trim().length > 0) return true;
  return false;
}

export const CHAPTER_STATE_CONTRACT_VERSION = 'chapter-state-contract-v1';

// ARCSTATE-1: data-declared resolved arcs. No phrase list lives in code —
// authors write these lines directly into canon_md / characters_md:
//   RESOLVED ARC: Zin's grief — she stops blaming herself (ch 12); forbidden: "still blames herself"; "her fault"
const RESOLVED_ARC_RX = /^\s*RESOLVED ARC:\s*([^—-]+?)\s*[—-]\s*(.+?)\s*\(ch\s*(\d+)\)\s*(?:;\s*forbidden:\s*(.+))?\s*$/gim;

/**
 * Parse `RESOLVED ARC: <Name> — <label> (ch <N>)[; forbidden: "phrase"; "phrase"]`
 * lines out of a foundation field. Returns [{ name, label, chapter, forbidden }].
 */
export function parseResolvedArcs(text) {
  const arcs = [];
  const t = String(text || '');
  RESOLVED_ARC_RX.lastIndex = 0;
  for (const m of t.matchAll(RESOLVED_ARC_RX)) {
    const name = m[1].trim();
    const label = m[2].trim();
    const chapter = Number(m[3]);
    const forbidden = [...String(m[4] || '').matchAll(/"([^"]+)"/g)].map((fm) => fm[1]);
    if (name && label && Number.isFinite(chapter)) arcs.push({ name, label, chapter, forbidden });
  }
  return arcs;
}

function pronounLabel(canon, name, variable) {
  if (Array.isArray(variable) && variable.includes(name)) return 'variable';
  const set = canon?.[name];
  if (set === 'he') return 'he/him';
  if (set === 'she') return 'she/her';
  if (set === 'they') return 'they/them';
  return 'unresolved';
}

/**
 * Compose the full closed-world contract for one chapter.
 *
 * @param {object} opts
 * @param {object} opts.project
 * @param {object} opts.chapter - the chapter being drafted ({ chapter_number })
 * @param {Array<{chapterNumber, text, beatEvents?}>} [opts.resolvedPriorProse] - PROSEFEED-1 shape
 * @param {Array} [opts.normalizedScenes] - this chapter's scene specs
 * @param {Array} [opts.allProjectChapters] - raw chapter records (for the event ledger)
 * @param {string[]} [opts.cast] - pre-harvested cast names; harvested from the sheet + prior prose if omitted
 * @returns {{ block: string, facts: object, telemetry: object }}
 */
export function buildChapterStateContract({
  project = null,
  chapter = null,
  resolvedPriorProse = [],
  normalizedScenes = [],
  allProjectChapters = [],
  cast = [],
} = {}) {
  const telemetry = { cast: 0, departed: 0, events: 0, resolvedArcs: 0, scenes: 0 };
  const facts = { cast: [], departed: [], resolvedArcs: [], events: [] };
  const sections = [];

  const isAnthology = (() => { try { return isAnthologyProject(project); } catch { return false; } })();
  const chapterNumber = Number(chapter?.chapter_number) || 0;
  const priorEntries = Array.isArray(resolvedPriorProse) ? resolvedPriorProse : [];
  const priorTexts = priorEntries.map((entry) => entry?.text || '');

  const castNames = Array.isArray(cast) && cast.length
    ? cast
    : harvestCastNames(project?.characters_md, priorTexts);

  // 1. CAST — name · pronouns · role · status · introduced
  try {
    if (castNames.length) {
      const canonEntries = parseCanonCast(project?.characters_md);
      const pronounCanon = buildPronounCanon(project, priorTexts, castNames);
      let state = {};
      if (!isAnthology && chapterNumber > 1 && priorTexts.some((t) => t.length > 200)) {
        state = buildCharacterState(priorEntries, castNames);
      }
      // CHARSTATE-2: a return THIS chapter's own beat plan declares flips a
      // departed character's status — the contract must demand the return be
      // written, not ban the character who is about to come back.
      const chapterBeatStrings = (Array.isArray(normalizedScenes) ? normalizedScenes : []).flatMap((scene) => [
        String(scene?.scene_goal || ''),
        ...(Array.isArray(scene?.required_events) ? scene.required_events.map((ev) => String(ev || '')) : []),
      ]).filter(Boolean);

      const lines = [];
      for (const name of castNames) {
        const canonEntry = canonEntries.find((e) => e.name === name || e.aliases?.has(name));
        const pronouns = pronounLabel(pronounCanon.canon, name, pronounCanon.variable);
        const role = canonEntry?.role || '';
        const entry = state[name];
        // 'dead' has no detector yet anywhere in this codebase — the status
        // vocabulary reserves the value; nothing sets it today.
        let status = entry ? (entry.partyStatus === 'departed' ? 'departed' : 'present') : 'unknown';
        if (status === 'departed' && chapterDeclares(chapterBeatStrings, name)) status = 'present';
        const introduced = entry?.introduced ? 'yes' : 'no';
        facts.cast.push({ name, pronouns, role, status, introduced });
        if (status === 'departed') facts.departed.push(name);
        lines.push(`- ${name} · ${pronouns}${role ? ' · ' + role : ''} · ${status} · introduced: ${introduced}`);
      }
      if (lines.length) sections.push(`CAST:\n${lines.join('\n')}`);
      telemetry.cast = castNames.length;
      telemetry.departed = facts.departed.length;
    }
  } catch (castErr) { console.warn('[STATECONTRACT] CAST section failed (non-fatal):', castErr?.message || castErr); }

  // 2. EVENTS DONE — do not repeat
  try {
    if (!isAnthology && chapterNumber > 1) {
      const ledger = buildPriorChapterEventLedger(allProjectChapters, chapterNumber, { maxChars: 5000 });
      facts.events = ledger.events;
      telemetry.events = ledger.events.length;
      if (ledger.events.length) {
        sections.push(`EVENTS ALREADY HAPPENED (do not repeat, re-stage, or re-introduce):\n${ledger.events.map((e) => `- ${e}`).join('\n')}`);
      }
    }
  } catch (eventErr) { console.warn('[STATECONTRACT] EVENTS section failed (non-fatal):', eventErr?.message || eventErr); }

  // 3. RESOLVED ARCS — data-declared, never a phrase list in code
  try {
    if (!isAnthology) {
      const arcs = [...parseResolvedArcs(project?.canon_md), ...parseResolvedArcs(project?.characters_md)];
      facts.resolvedArcs = arcs;
      telemetry.resolvedArcs = arcs.length;
      if (arcs.length) {
        sections.push(`RESOLVED ARCS (do not reopen):\n${arcs.map((a) => `- ${a.name} — ${a.label} (resolved ch.${a.chapter})`).join('\n')}`);
      }
    }
  } catch (arcErr) { console.warn('[STATECONTRACT] RESOLVED ARCS section failed (non-fatal):', arcErr?.message || arcErr); }

  // 4. SCENE MAP — this chapter's own scenes, in order
  try {
    if (Array.isArray(normalizedScenes) && normalizedScenes.length) {
      const lines = normalizedScenes.map((s, i) => {
        const events = Array.isArray(s?.required_events) ? s.required_events.filter(Boolean).join('; ') : '';
        const entryExit = [s?.entry_state, s?.exit_state].filter(Boolean).join(' -> ');
        return `- Scene ${i + 1}: ${s?.scene_goal || '(no stated goal)'}${events ? ` [events: ${events}]` : ''}${entryExit ? ` [state: ${entryExit}]` : ''}`;
      });
      sections.push(`SCENE MAP:\n${lines.join('\n')}`);
      telemetry.scenes = normalizedScenes.length;
    }
  } catch (mapErr) { console.warn('[STATECONTRACT] SCENE MAP section failed (non-fatal):', mapErr?.message || mapErr); }

  // 5. STYLE BANS — exhausted constructions + simile budget
  try {
    if (!isAnthology && priorTexts.length) {
      const styleBlock = buildStyleBudgetPromptBlock(buildBookStyleLedger(priorTexts));
      if (styleBlock) sections.push(styleBlock);
    }
  } catch (styleErr) { console.warn('[STATECONTRACT] STYLE BANS section failed (non-fatal):', styleErr?.message || styleErr); }

  const block = sections.length
    ? `=== CHAPTER STATE CONTRACT (closed world — obey exactly) ===\n${sections.join('\n\n')}\n=== END STATE CONTRACT ===`
    : '';

  console.log(`[STATECONTRACT] Ch.${chapterNumber}: cast ${telemetry.cast}, departed ${telemetry.departed}, events ${telemetry.events}, resolved arcs ${telemetry.resolvedArcs}, scenes ${telemetry.scenes}`);

  return { block, facts, telemetry };
}

function chapterDeclares(beatStrings, name) {
  if (!name || !Array.isArray(beatStrings) || !beatStrings.length) return false;
  const rx = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b.{0,40}\\b(?:return|returns|returned|back|comes back|rejoin|rejoins)\\b`, 'i');
  return beatStrings.some((s) => rx.test(s));
}
