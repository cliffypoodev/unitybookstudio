// src/lib/eventCollision.js — SCENECOLLIDE-1
//
// Class-based event collision detection: catches a scene or beat plan that
// RE-PERFORMS an event the story already completed, even when the new text
// shares almost no vocabulary with the ledgered event.
//
// The failure this closes (measured on the REDUX draft, ch.3): the beat
// contract completed "A rival salvage team arrives, led by a ruthless
// collector…" in scene 1; a later scene re-staged the arrival as "The rival
// team did not so much arrive as they did unfold…". The existing
// PRIOR_EVENT_REPLAY gate scores bag-of-words coverage against the event TEXT
// (3 of 11 tokens matched → no hit), so any re-staging written with fresh
// vocabulary sails through. Same design lesson as ARCH-1: per-shape/word
// checks never converge — check the closed world of (entity, action-class)
// pairs instead. An arrival of the rival team either already happened or it
// did not; the wording is irrelevant.
//
// Deterministic, no LLM, nothing book-specific: entities and classes are
// derived from the ledgered event text itself.

// ── Action classes (high precision; extend deliberately, never casually) ──
// Each class carries two testers: `event` (does a LEDGERED EVENT belong to
// this class?) and `prose` (does a PROSE/BEAT sentence stage this class?).
const ACTION_CLASSES = [
  {
    name: 'ARRIVAL',
    event: /\b(?:arriv\w*|shows?\s+up|showed\s+up|pull(?:s|ed)?\s+up|roll(?:s|ed)?\s+(?:in|up)|turn(?:s|ed)?\s+up|lands?\b|landed\b)/i,
    prose: /\b(?:arriv\w*|shows?\s+up|showed\s+up|pull(?:s|ed)?\s+up|roll(?:s|ed)?\s+(?:in|up)|turn(?:s|ed)?\s+up|landed\b|touch(?:es|ed)?\s+down|came\s+into\s+view|appear(?:s|ed)?\s+(?:on|at|over)\b)/i,
    idiom: /\barriv\w*\s+at\s+(?:a|an|the)?\s*(?:conclusion|decision|answer|plan|compromise|truth|agreement|solution|idea)\b/i,
  },
  {
    name: 'DEPARTURE',
    event: /\b(?:depart\w*|leav\w+\s+(?:town|the\s+\w+)|drove\s+off|rode\s+off|flew\s+off|walk(?:s|ed)?\s+out\s+of)\b/i,
    prose: /\b(?:depart\w*|drove\s+off|rode\s+off|flew\s+off|pulled\s+out\s+of|walk(?:s|ed)?\s+out\s+of)\b/i,
    idiom: null,
  },
  {
    name: 'REVEAL',
    event: /\b(?:reveal\w*|confess\w*|admit\w*)\b/i,
    prose: /\b(?:reveal(?:s|ed)?|confess(?:es|ed)?|admit(?:s|ted)?)\b/i,
    idiom: null,
    // Characters "admit" trivial things in dialogue tags constantly ("It's
    // pretty," Zin admitted). A REVEAL collision must also share substance
    // with the ledgered revelation, not just the verb class and the name.
    needsContentOverlap: 2,
  },
];

const CONTENT_STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'that', 'this', 'those', 'these', 'his',
  'her', 'their', 'its', 'of', 'to', 'in', 'on', 'at', 'as', 'by', 'for',
  'with', 'from', 'is', 'are', 'was', 'were', 'be', 'been', 'he', 'she', 'they',
  'it', 'who', 'which', 'has', 'had', 'have', 'not', 'no',
]);

function contentTokens(text) {
  return new Set(
    String(text || '').toLowerCase().match(/[a-z'’-]{3,}/g)?.filter((w) => !CONTENT_STOPWORDS.has(w)) || []
  );
}

function contentOverlap(a, b) {
  const A = contentTokens(a);
  const B = contentTokens(b);
  let n = 0;
  for (const t of A) if (B.has(t)) n += 1;
  return n;
}

const ENTITY_STOPWORDS = new Set([
  'The', 'A', 'An', 'It', 'They', 'He', 'She', 'We', 'You', 'This', 'That',
  'When', 'While', 'After', 'Before', 'Then', 'Later', 'Suddenly', 'Finally',
]);

// Group-noun phrases count as entities ONLY when modified ("rival team",
// "salvage crew") — bare "the crew"/"the team" is almost always the
// protagonists doing ordinary scene traffic and would drown the check in
// false positives.
const GROUP_NOUN = String.raw`(?:team|crew|gang|party|posse|convoy|caravan|squad|outfit)`;

/**
 * Entities named by a ledgered event: proper names (mid-sentence capitals and
 * actor-first leads) plus modified group phrases. Returns lowercase strings
 * for group phrases and original-case strings for names.
 */
export function extractEventEntities(eventText) {
  const event = String(eventText || '');
  const entities = new Set();

  // Modified group phrases: "rival salvage team" also yields "rival team" and
  // "salvage team" — prose routinely drops one modifier ("The rival team…"),
  // and the entity match must survive that.
  // The modifier run must sit between a determiner (or start of text) and the
  // group noun — that keeps verbs out ("knows the crew" contributes nothing;
  // "A rival salvage team" contributes rival salvage team / rival team /
  // salvage team).
  for (const m of event.matchAll(new RegExp(`(?:^|\\b(?:the|a|an|their|his|her|its|our)\\s+)([a-z][a-z'’-]+(?:\\s+[a-z][a-z'’-]+)?)\\s+(${GROUP_NOUN})\\b`, 'gi'))) {
    const noun = m[2].toLowerCase();
    const modifiers = m[1].toLowerCase().split(/\s+/);
    entities.add(`${modifiers.join(' ')} ${noun}`);
    for (const modifier of modifiers) entities.add(`${modifier} ${noun}`);
  }

  // Proper names: mid-sentence capitalized tokens, plus an actor-first lead.
  for (const m of event.matchAll(/[^.!?]\s([A-Z][a-z'’-]{2,})\b/g)) {
    if (!ENTITY_STOPWORDS.has(m[1])) entities.add(m[1]);
  }
  const lead = event.match(/^([A-Z][a-z'’-]{2,})\b/);
  if (lead && !ENTITY_STOPWORDS.has(lead[1])) entities.add(lead[1]);

  return entities;
}

/** Action classes a ledgered event belongs to (usually zero or one). */
export function classifyEventAction(eventText) {
  const event = String(eventText || '');
  return ACTION_CLASSES.filter((c) => c.event.test(event)).map((c) => c.name);
}

function windowsOf(proseText) {
  return String(proseText || '')
    .replace(/\b(Dr|Mr|Mrs|Ms|Prof|Sr|Jr|St)\./g, '$1<ABBR>')
    .split(/(?<=[.!?])\s+|\n+/)
    .map((p) => p.replace(/<ABBR>/g, '.').trim())
    .filter((p) => p.length >= 20);
}

function windowMentionsEntity(window, entities) {
  const low = window.toLowerCase();
  for (const entity of entities) {
    if (entity === entity.toLowerCase()) {
      if (low.includes(entity)) return entity;           // group phrase
    } else if (new RegExp(`\\b${entity.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(window)) {
      return entity;                                      // proper name, case-sensitive
    }
  }
  return null;
}

const NON_ENACTMENT = [
  /\b(?:had|has)\s+(?:already\s+)?\w+(?:ed|en)\b/i,
  /\b(?:previously|earlier|already|before now)\b/i,
  /\b(?:since|after|when)\s+(?:the|they|he|she|it)\b/i,
  /\b(?:remember\w*|recall\w*|memor\w+)\b/i,
  /\b(?:mention\w*|referenc\w*|describ\w*)\b/i,
  /\b(?:thought (?:of|about)|reminded of|the fact that)\b/i,
  /\b(?:imagined|dreamed|planned|intended|wanted|hoped|feared|considered|expected|waited for)\b/i,
  /\b(?:might|could|would|may|perhaps|possibly|if|unless)\b/i,
];

function isNarrationReference(window) {
  return NON_ENACTMENT.some((p) => p.test(window));
}

function isInsideQuote(fullText, index) {
  let inside = false;
  let straight = false;
  for (let i = 0; i < index && i < fullText.length; i += 1) {
    const ch = fullText[i];
    if (ch === '“') inside = true;
    else if (ch === '”') inside = false;
    else if (ch === '"') straight = !straight;
  }
  return inside || straight;
}

/**
 * Prose-side collision scan: windows of `prose` that RE-STAGE a completed
 * event's (entity, action-class) pair. Returns [{ event, entity, class,
 * window }] — empty when clean.
 */
export function findProseEventCollisions(priorEvents, prose) {
  const text = String(prose || '');
  if (!text) return [];
  const findings = [];
  const wins = windowsOf(text);

  for (const raw of Array.isArray(priorEvents) ? priorEvents : []) {
    const event = String(raw || '');
    const classes = classifyEventAction(event);
    if (!classes.length) continue;
    const entities = extractEventEntities(event);
    if (!entities.size) continue;

    for (const className of classes) {
      const cls = ACTION_CLASSES.find((c) => c.name === className);
      for (const window of wins) {
        if (!cls.prose.test(window)) continue;
        if (cls.idiom && cls.idiom.test(window)) continue;
        const entity = windowMentionsEntity(window, entities);
        if (!entity) continue;
        if (isNarrationReference(window)) continue;
        if (cls.needsContentOverlap && contentOverlap(event, window) < cls.needsContentOverlap + 1) continue;
        // A character TALKING about the event is not a re-staging: the check
        // anchors on the class verb itself — if that verb sits inside a
        // quoted span, the window is dialogue about the event, not narration
        // performing it.
        const at = text.indexOf(window);
        const verbMatch = cls.prose.exec(window);
        const verbAt = at >= 0 && verbMatch ? at + verbMatch.index : at;
        if (verbAt >= 0 && isInsideQuote(text, verbAt)) continue;
        findings.push({ event, entity, class: className, window });
      }
    }
  }
  // One finding per (window, class) — two ledgered events matching the same
  // sentence is one defect, not two.
  const seen = new Set();
  return findings.filter((f) => {
    const key = `${f.class}::${f.window}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Planner-side collision scan: beats in a NEW plan whose scene_goal or
 * required_events re-stage a completed event's (entity, class) pair.
 * Returns [{ scene_number, field, event, entity, class, text }].
 */
export function findBeatEventCollisions(beats, priorEvents) {
  const prior = [];
  for (const raw of Array.isArray(priorEvents) ? priorEvents : []) {
    const event = String(raw || '');
    const classes = classifyEventAction(event);
    if (!classes.length) continue;
    const entities = extractEventEntities(event);
    if (!entities.size) continue;
    prior.push({ event, classes, entities });
  }
  if (!prior.length) return [];

  const findings = [];
  for (const beat of Array.isArray(beats) ? beats : []) {
    const fields = [
      ['scene_goal', String(beat?.scene_goal || '')],
      ['required_events', (Array.isArray(beat?.required_events) ? beat.required_events : []).join(' ; ')],
    ];
    for (const [field, textValue] of fields) {
      if (!textValue) continue;
      for (const p of prior) {
        for (const className of p.classes) {
          const cls = ACTION_CLASSES.find((c) => c.name === className);
          if (!cls.prose.test(textValue) && !cls.event.test(textValue)) continue;
          if (cls.idiom && cls.idiom.test(textValue)) continue;
          const entity = windowMentionsEntity(textValue, p.entities);
          if (!entity) continue;
          if (/\b(?:already|again|second time|once more|return\w*|back)\b/i.test(textValue)) continue; // explicit causal marker
          // SCENECOLLIDE-1C: the substance requirement applies to BEATS too.
          // Live REDUX ch.3: the legitimate beat "Reveal the rival team's
          // knowledge of the crew's true identities" was flagged against ch.2's
          // unrelated "Rodge reveals his hidden fears about losing the crew"
          // (REVEAL + shared entity, zero shared substance) and burned all four
          // planner attempts.
          if (cls.needsContentOverlap && contentOverlap(p.event, textValue) < cls.needsContentOverlap + 1) continue;
          findings.push({ scene_number: beat?.scene_number ?? null, field, event: p.event, entity, class: className, text: textValue.slice(0, 140) });
        }
      }
    }
  }
  return findings;
}

/**
 * Deterministic last-resort rewrite when planner regeneration is exhausted:
 * annotate the colliding beat text so the writer continues FROM the completed
 * state instead of re-staging it. Returns a new beats array.
 */
export function rewriteBeatCollisions(beats, findings) {
  if (!Array.isArray(beats) || !findings?.length) return beats;
  const byScene = new Map();
  for (const f of findings) {
    if (!byScene.has(f.scene_number)) byScene.set(f.scene_number, []);
    byScene.get(f.scene_number).push(f);
  }
  return beats.map((beat) => {
    const sceneFindings = byScene.get(beat?.scene_number ?? null);
    if (!sceneFindings) return beat;
    // SCENECOLLIDE-1C: idempotent — one note per (entity, class), and never
    // re-append to text that already carries it (live ch.3 got the same note
    // twice in one field).
    const seen = new Set();
    const notes = [];
    for (const f of sceneFindings) {
      const key = `${f.entity}::${f.class}`;
      if (seen.has(key)) continue;
      seen.add(key);
      notes.push(`(${f.entity} ${f.class === 'ARRIVAL' ? 'already arrived' : f.class === 'DEPARTURE' ? 'already departed' : 'already made this revelation'} in a completed scene — do NOT re-stage it; continue from the state after it)`);
    }
    const appendOnce = (text) => {
      let out = String(text || '');
      for (const note of notes) {
        if (!out.includes(note)) out = `${out} ${note}`.trim();
      }
      return out;
    };
    return {
      ...beat,
      scene_goal: appendOnce(beat.scene_goal),
      required_events: (Array.isArray(beat.required_events) ? beat.required_events : []).map((e, i) => (i === 0 ? appendOnce(e) : e)),
    };
  });
}

/**
 * SCENEDUP-1: same-chapter scene-duplication detector (the two-arrivals
 * class) — regen-lane extraDetectors entry, kind 'scene-duplicate'. Splits
 * the chapter into paragraphs and, for each paragraph, treats every earlier
 * paragraph's sentences as "prior events" for findProseEventCollisions. A
 * collision means a LATER paragraph re-stages an event an EARLIER paragraph
 * of the same chapter already performed (same entity, same action class) —
 * the SCENECOLLIDE-1C content-overlap guard is inherited from
 * findProseEventCollisions unchanged.
 *
 * @param {string} text - the whole chapter (all scenes already merged)
 * @returns {Array<{kind: 'scene-duplicate', sentence: string, reason: string}>}
 */
export function detectSameChapterSceneDuplicates(text) {
  const t = String(text || '');
  if (!t.trim()) return [];
  const paragraphs = t.split(/\n{2,}/).filter((p) => p.trim());
  const targets = [];
  for (let i = 1; i < paragraphs.length; i += 1) {
    const priorText = paragraphs.slice(0, i).join(' ');
    const priorSentences = priorText.split(/(?<=[.!?…”])\s+/).filter(Boolean);
    for (const c of findProseEventCollisions(priorSentences, paragraphs[i])) {
      const verb = c.class === 'ARRIVAL' ? 'arrived' : c.class === 'DEPARTURE' ? 'departed' : 'made this revelation';
      targets.push({
        kind: 'scene-duplicate',
        sentence: c.window,
        reason: `${c.entity} already ${verb} earlier in this chapter`,
      });
    }
  }
  return targets;
}

export const EVENT_COLLISION_VERSION = 'event-collision-v1';
