// src/lib/storyEntityOwnership.js — NFANTH-CW-1
//
// A nonfiction anthology's closed world is PER STORY, not whole-project.
// Case A's facts are not valid evidence for Case C. This module derives,
// deterministically, which proper nouns / years / month-year dates each
// story (= chapter) "owns" from its own title + beat_summary + scene goals,
// and fences research paragraphs that belong to a sibling story out of a
// given chapter's research text.
//
// No book specifics live here. Everything is derived from project data.

import { normCW, CLOSED_WORLD_STOPWORDS } from './closedWorldText.js';

export const STORY_ENTITY_OWNERSHIP_VERSION = 'story-entity-ownership-v1';

function collectStrings(node, out) {
  if (typeof node === 'string') { out.push(node); return; }
  if (Array.isArray(node)) { node.forEach((n) => collectStrings(n, out)); return; }
  if (node && typeof node === 'object') Object.values(node).forEach((v) => collectStrings(v, out));
}

function parseBeatsText(chapter) {
  const raw = chapter?.scene_beats_json;
  if (!raw) return '';
  let j = raw;
  if (typeof raw === 'string') {
    try { j = JSON.parse(raw); } catch { return ''; }
  }
  const beats = Array.isArray(j) ? j : (j?.beats || j?.scenes || j?.sections || []);
  const strings = [];
  collectStrings(beats, strings);
  return strings.join(' ');
}

const MONTHS = 'January|February|March|April|May|June|July|August|September|October|November|December';
const MONTH_YEAR_RX = new RegExp(`\\b(?:${MONTHS})\\s+(?:\\d{1,2},?\\s+)?(1[5-9]\\d{2}|20\\d{2})\\b`, 'g');
const YEAR_RX = /\b(1[5-9]\d{2}|20\d{2})\b/g;
// Trailing `\.?` on each token lets a title abbreviation ("Dr.", "Gen.")
// join the compound instead of splitting off as its own noisy single-token
// entity — deliberately no trailing `\b` (a literal period is non-word, so a
// boundary assertion right after it would never match).
const PROPER_NOUN_RX = /\b[A-Z][a-zA-Z'’-]*\.?(?:[ \t]+[A-Z][a-zA-Z'’-]*\.?){0,2}/g;

// Sentence-initial capitalized function words are never entities on their
// own — a phrase that starts with one has the leading token stripped before
// being tested against the evidence, matching sceneWriter.js's closed-world
// discipline (GATEFIX-28).
const SENTENCE_STOPWORDS = new Set([
  'The', 'A', 'An', 'In', 'On', 'At', 'By', 'For', 'With', 'From', 'To', 'Of',
  'And', 'But', 'Or', 'Nor', 'As', 'If', 'When', 'Where', 'While', 'After',
  'Before', 'During', 'Since', 'This', 'That', 'These', 'Those', 'He', 'She',
  'They', 'It', 'His', 'Her', 'Their', 'Its', 'Story',
]);

/**
 * Every proper-noun phrase (1-3 capitalized tokens), year, and month-year
 * date in `text`, normalized (normCW). Used both to build story ownership
 * and to scan a research paragraph for which entities it mentions.
 */
export function extractEntities(text) {
  const out = new Set();
  const s = String(text || '');
  let m;
  MONTH_YEAR_RX.lastIndex = 0;
  while ((m = MONTH_YEAR_RX.exec(s)) !== null) out.add(normCW(m[0]));
  YEAR_RX.lastIndex = 0;
  while ((m = YEAR_RX.exec(s)) !== null) out.add(m[1]);
  PROPER_NOUN_RX.lastIndex = 0;
  while ((m = PROPER_NOUN_RX.exec(s)) !== null) {
    const toks = m[0].split(/\s+/);
    while (toks.length > 1 && SENTENCE_STOPWORDS.has(toks[0])) toks.shift();
    if (toks.length === 1 && SENTENCE_STOPWORDS.has(toks[0])) continue;
    const norm = normCW(toks.join(' '));
    if (norm && norm.length > 2 && !CLOSED_WORLD_STOPWORDS.has(norm)) out.add(norm);
  }
  return out;
}

/**
 * @returns {{ byStory: Object<number, Set<string>>, byEntity: Object<string, Set<number>> }}
 */
export function buildStoryEntityOwnership(project, chapters) {
  const byStory = {};
  const byEntity = {};
  for (const ch of (Array.isArray(chapters) ? chapters : [])) {
    const num = Number(ch?.chapter_number);
    if (!Number.isFinite(num)) continue;
    const text = [ch?.title, ch?.beat_summary, parseBeatsText(ch)].filter(Boolean).join('\n\n');
    const entities = extractEntities(text);
    byStory[num] = entities;
    for (const e of entities) {
      if (!byEntity[e]) byEntity[e] = new Set();
      byEntity[e].add(num);
    }
  }
  return { byStory, byEntity };
}

/**
 * Replace any research paragraph that mentions >=1 entity owned by OTHER
 * stories and NONE owned by story `chapterNumber` with a fence marker. An
 * entity owned by >=2 stories is shared — never foreign.
 *
 * @returns {{ text, fenced: Array<{paragraph, entities}> }}
 */
export function fenceForeignEntities(researchText, ownership, chapterNumber) {
  const text = String(researchText || '');
  if (!text) return { text, fenced: [] };
  const n = Number(chapterNumber);
  const byEntity = ownership?.byEntity || {};
  const paragraphs = text.split(/\n{2,}/);
  const fenced = [];
  const outParas = paragraphs.map((para) => {
    if (!para.trim()) return para;
    const paraEntities = extractEntities(para);
    let hasOwn = false;
    const foreign = [];
    let foreignOwner = null;
    for (const e of paraEntities) {
      const owners = byEntity[e];
      if (!owners || owners.size === 0) continue;
      if (owners.has(n)) { hasOwn = true; continue; }
      if (owners.size >= 2) continue; // shared entity — never foreign
      foreign.push(e);
      if (foreignOwner === null) foreignOwner = [...owners][0];
    }
    if (!hasOwn && foreign.length > 0) {
      fenced.push({ paragraph: para, entities: foreign });
      return `[evidence belonging to Story ${foreignOwner} — not available to this story]`;
    }
    return para;
  });
  if (fenced.length) {
    console.log(`[NFANTH-CW] ch${n}: fenced ${fenced.length} paragraph(s) (${fenced.flatMap((f) => f.entities).slice(0, 10).join(', ')})`);
  } else {
    console.log(`[NFANTH-CW] ch${n}: fenced 0 paragraph(s)`);
  }
  return { text: outParas.join('\n\n'), fenced };
}

// A per-project-id cache of the most recently computed ownership. Populated
// by getProjectResearchText (which has the full chapter list) and read by
// buildSourceAudit (which, at its second call site, does not) so the
// haystack it assembles from project-level fields (research_md, sources_md,
// ...) gets the same per-story fence without threading a `chapters` list
// through every prompt-builder signature. Fail-open: a cache miss (e.g. the
// cache has not been warmed yet) simply skips fencing there — the primary
// research text is already fenced upstream by the time this matters.
const ownershipCache = new Map();

export function cacheStoryEntityOwnership(projectId, ownership) {
  if (projectId) ownershipCache.set(projectId, ownership);
}

export function getCachedStoryEntityOwnership(projectId) {
  return projectId ? (ownershipCache.get(projectId) || null) : null;
}
