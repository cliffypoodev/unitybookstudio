// EVENTLEDGER-1 — the persisted cross-chapter event ledger.
//
// Root cause (proven on the 2026-08-14 Lipstick & Lug Nuts draft): the beat
// planner's cross-chapter memory (NARRATIVE-CONNECT-3) is built from chapter
// SUMMARIES, but the events a chapter actually executed live in its persisted
// scene-beat contract (`scene_beats_json.required_events`). Ch.1's summary said
// "crash-land, disguises, guilt" while its beat contract also executed the
// entire Thompson general-store meeting — so the planner re-introduced
// Mr. Thompson in Ch.2 in good faith, and the writer faithfully drafted the
// same first-meeting twice. The writer-side gate has the same blindness: its
// PRIOR_EVENT_REPLAY check reads a runtime ledger that is born empty at the
// start of every chapter run.
//
// This module is the deterministic fix for both sides. No LLM calls: the
// events were already extracted once, at beat-generation time, and persisted.
// We simply read them back.

const BEAT_CONTAINER_KEYS = ['beats', 'scenes', 'sections'];
const HONORIFIC = String.raw`(?:Mr|Mrs|Ms|Dr|Prof|Rev|Sgt|Capt)\.?\s+`;
const EVENT_OPENER_STOPWORDS = new Set([
  'The', 'A', 'An', 'It', 'They', 'He', 'She', 'We', 'You', 'Everyone', 'Someone',
  'At', 'In', 'On', 'By', 'As', 'After', 'Before', 'When', 'While', 'During', 'Then',
  'This', 'That', 'These', 'Those', 'Each', 'Both', 'All', 'One', 'Two', 'Three',
  'Meanwhile', 'Later', 'Finally', 'Suddenly', 'Inside', 'Outside', 'Near', 'Their',
]);

function parseBeats(sceneBeatsJson) {
  if (!sceneBeatsJson) return [];
  let parsed = sceneBeatsJson;
  if (typeof parsed === 'string') {
    try { parsed = JSON.parse(parsed); } catch { return []; }
  }
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === 'object') {
    for (const key of BEAT_CONTAINER_KEYS) {
      if (Array.isArray(parsed[key])) return parsed[key];
    }
  }
  return [];
}

/**
 * All executed events recorded in one chapter's persisted beat contract.
 * Returns [{ chapter_number, scene_id, event }]. Chapters with no usable
 * contract yield [].
 */
export function extractChapterEvents(chapter) {
  const chapterNumber = Number(chapter?.chapter_number);
  const out = [];
  for (const beat of parseBeats(chapter?.scene_beats_json)) {
    const events = Array.isArray(beat?.required_events) ? beat.required_events : [];
    for (const raw of events) {
      const event = String(raw || '').trim();
      if (event.length < 8) continue;
      out.push({
        chapter_number: chapterNumber,
        scene_id: String(beat?.scene_id || '').trim(),
        event,
      });
    }
  }
  return out;
}

/**
 * The DO-NOT-REPEAT contract for chapter `currentChapterNumber`, built from
 * every earlier chapter's persisted beat contract.
 *
 * Returns { events, byChapter, text }:
 *   events    — flat ordered array of event strings from chapters < current
 *   byChapter — [{ chapter_number, events: [...] }] in chapter order
 *   text      — a prompt-ready block, oldest chapters elided first when the
 *               block exceeds maxChars (a silent cap would read as coverage,
 *               so the elision is stated in the block itself)
 */
export function buildPriorChapterEventLedger(chapters, currentChapterNumber, options = {}) {
  const maxChars = Number(options.maxChars) > 0 ? Number(options.maxChars) : 6000;
  const current = Number(currentChapterNumber);
  const prior = (Array.isArray(chapters) ? chapters : [])
    .filter((chapter) => Number(chapter?.chapter_number) > 0 && Number(chapter?.chapter_number) < current)
    .sort((a, b) => Number(a.chapter_number) - Number(b.chapter_number));

  const byChapter = [];
  for (const chapter of prior) {
    const events = extractChapterEvents(chapter).map((entry) => entry.event);
    if (events.length) byChapter.push({ chapter_number: Number(chapter.chapter_number), events });
  }

  const events = byChapter.flatMap((entry) => entry.events);
  if (!events.length) return { events: [], byChapter: [], text: '' };

  const header = 'EVENT LEDGER — EVENTS ALREADY EXECUTED IN EARLIER CHAPTERS (completed story facts; do NOT re-plan, re-stage, re-enact, or re-introduce any of them — advance PAST them):';
  const lineFor = (entry) => `Ch.${entry.chapter_number}: ${entry.events.join('; ')}`;

  let kept = byChapter.slice();
  let elided = 0;
  const render = () => {
    const elisionLine = elided > 0
      ? `(Events of the first ${elided} chapter(s) elided for length — they are still completed and still may not be repeated.)`
      : '';
    return [header, elisionLine, ...kept.map(lineFor)].filter(Boolean).join('\n');
  };

  let text = render();
  while (text.length > maxChars && kept.length > 1) {
    kept = kept.slice(1);
    elided += 1;
    text = render();
  }

  return { events, byChapter, text, elidedChapterCount: elided };
}

/** Proper-noun-ish names appearing inside prior ledger events. */
export function namesInEvents(events) {
  const names = new Set();
  for (const raw of Array.isArray(events) ? events : []) {
    const event = String(raw || '');
    // Honorific-prefixed names anywhere ("Mr. Thompson", "Dr. Vale").
    for (const match of event.matchAll(new RegExp(`${HONORIFIC}([A-Z][A-Za-z'’-]+)`, 'g'))) {
      names.add(match[1]);
    }
    // Bare capitalized tokens NOT at the start of the string or a sentence —
    // start-of-sentence capitals are usually ordinary words, mid-sentence
    // capitals in a beat contract are names.
    for (const match of event.matchAll(/[^.!?]\s([A-Z][a-z'’-]{2,})\b/g)) {
      names.add(match[1]);
    }
    // Beat-contract events are terse actor-first sentences ("Vessa bargains for
    // a coil"), so the FIRST token is usually the acting character — admit it
    // unless it is an ordinary sentence opener.
    const lead = event.match(/^([A-Z][a-z'’-]{2,})\b/);
    if (lead && !EVENT_OPENER_STOPWORDS.has(lead[1])) {
      names.add(lead[1]);
    }
  }
  return names;
}

const INTRODUCE_VERB = String.raw`(?:introduc\w*|meets?\b[^.;]{0,40}?\bfor the first time|first (?:meeting|encounter|meets?) (?:with )?)`;

/**
 * Scenes in a NEW beat plan that "introduce" a character the ledger says an
 * earlier chapter already brought on stage. Returns [{ scene_number, name,
 * field }] — empty when the plan is clean.
 */
export function findReintroductions(beats, priorEvents) {
  const known = namesInEvents(priorEvents);
  if (!known.size) return [];
  const findings = [];
  const list = Array.isArray(beats) ? beats : parseBeats(beats);
  for (const beat of list) {
    const fields = [
      ['scene_goal', String(beat?.scene_goal || '')],
      ['required_events', (Array.isArray(beat?.required_events) ? beat.required_events : []).join(' ; ')],
    ];
    for (const [field, textValue] of fields) {
      for (const name of known) {
        const pattern = new RegExp(`\\b${INTRODUCE_VERB}[^;!?]{0,60}?\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        if (pattern.test(textValue)) {
          findings.push({ scene_number: beat?.scene_number ?? null, name, field });
        }
      }
    }
  }
  return findings;
}

/**
 * Deterministic last-resort repair when regeneration attempts are exhausted:
 * rewrite "introduce X" phrasing into continuation phrasing so the writer is
 * never instructed to stage a second first-meeting. Mutates nothing; returns a
 * new beats array.
 */
export function rewriteReintroductions(beats, findings) {
  if (!Array.isArray(beats) || !findings?.length) return beats;
  const byScene = new Map();
  for (const finding of findings) {
    if (!byScene.has(finding.scene_number)) byScene.set(finding.scene_number, []);
    byScene.get(finding.scene_number).push(finding);
  }
  return beats.map((beat) => {
    const sceneFindings = byScene.get(beat?.scene_number ?? null);
    if (!sceneFindings) return beat;
    const fix = (textValue) => {
      let out = String(textValue || '');
      for (const finding of sceneFindings) {
        const escaped = finding.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        out = out.replace(
          new RegExp(`\\b${INTRODUCE_VERB}([^;!?]{0,60}?\\b${escaped}\\b)`, 'ig'),
          'Continue with$1 (already introduced in an earlier chapter — no first meeting)'
        );
      }
      return out;
    };
    return {
      ...beat,
      scene_goal: fix(beat.scene_goal),
      required_events: (Array.isArray(beat.required_events) ? beat.required_events : []).map(fix),
    };
  });
}

export const EVENT_LEDGER_VERSION = 'event-ledger-v1';
