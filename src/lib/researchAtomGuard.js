// src/lib/researchAtomGuard.js — ARCH-2
//
// The researcher layer is closed-world too. Every atom (a name/event/
// institution phrase, a year or month-year, a standalone number) the
// extractor writes into research_data must substring-match the fetched
// pages it is attributed to — otherwise it is a fabrication one level
// upstream of drafting, and every downstream closed-world check inherits it
// as "evidence". An item is kept only if ALL of its atoms are supported;
// otherwise it is dropped and logged, atom by atom.
//
// No book specifics live here. Everything is derived from the batch's own
// fetched pages and the LLM's own extraction.

import { normCW } from './closedWorldText.js';

export const RESEARCH_ATOM_GUARD_VERSION = 'research-atom-guard-v1';

export const ATOM_BUCKETS = [
  'key_figures',
  'key_events',
  'institutions',
  'timeline',
  'primary_sources',
  'competing_narratives',
  'key_documents',
];

const MONTHS = 'January|February|March|April|May|June|July|August|September|October|November|December';
const MONTH_YEAR_RX = new RegExp(`\\b(?:${MONTHS})\\s+(?:\\d{1,2},?\\s+)?(1[5-9]\\d{2}|20\\d{2})\\b`, 'g');
const YEAR_RX = /\b(1[5-9]\d{2}|20\d{2})\b/g;
// A Title Case phrase (first letter capitalized, rest lowercase) — an
// ALL-CAPS sentinel like "UNVERIFIED" never matches this, so a field the
// extractor explicitly marked unverified contributes no atom to check
// (neither passes nor fails) instead of sinking the whole item.
const PROPER_NOUN_RX = /\b[A-Z][a-z'’-]*\.?(?:[ \t]+[A-Z][a-z'’-]*\.?){0,2}/g;
const NUMBER_RX = /\b\d{2,}\b/g;

const SENTENCE_STOPWORDS = new Set([
  'The', 'A', 'An', 'In', 'On', 'At', 'By', 'For', 'With', 'From', 'To', 'Of',
  'And', 'But', 'Or', 'Nor', 'As', 'If', 'When', 'Where', 'While', 'After',
  'Before', 'During', 'Since', 'This', 'That', 'These', 'Those', 'He', 'She',
  'They', 'It', 'His', 'Her', 'Their', 'Its',
]);

function fieldsForBucket(item, bucket) {
  switch (bucket) {
    case 'key_figures': return [item?.name, item?.role, item?.dates_active, item?.documented_actions];
    case 'key_events': return [item?.event, item?.date, item?.description];
    case 'institutions': return [item?.name, item?.role, item?.period];
    case 'timeline': return [item?.date, item?.event];
    case 'primary_sources': return [item?.source_type, item?.description];
    case 'key_documents': return [item?.name, item?.date, item?.issuer, item?.verbatim_excerpt, item?.significance];
    case 'competing_narratives': return [item?.official_story, item?.evidence_counter, item?.key_evidence];
    default: return Object.values(item || {});
  }
}

/** Every name/event/institution phrase, year, month-year, and standalone number (>= 2 digits) in an item's fields. */
export function extractAtoms(item, bucket) {
  const atoms = new Set();
  const text = fieldsForBucket(item, bucket).filter((v) => typeof v === 'string' && v.trim()).join(' ');
  if (!text) return [];

  let m;
  MONTH_YEAR_RX.lastIndex = 0;
  while ((m = MONTH_YEAR_RX.exec(text)) !== null) atoms.add(m[0]);
  YEAR_RX.lastIndex = 0;
  while ((m = YEAR_RX.exec(text)) !== null) atoms.add(m[0]);
  NUMBER_RX.lastIndex = 0;
  while ((m = NUMBER_RX.exec(text)) !== null) atoms.add(m[0]);
  PROPER_NOUN_RX.lastIndex = 0;
  while ((m = PROPER_NOUN_RX.exec(text)) !== null) {
    const toks = m[0].split(/\s+/);
    while (toks.length > 1 && SENTENCE_STOPWORDS.has(toks[0])) toks.shift();
    if (toks.length === 1 && SENTENCE_STOPWORDS.has(toks[0])) continue;
    const phrase = toks.join(' ');
    if (phrase && phrase.length > 1) atoms.add(phrase);
  }
  return [...atoms];
}

function buildPageHaystack(pages) {
  const text = (Array.isArray(pages) ? pages : [])
    .map((p) => (typeof p?.content === 'string' && p.content) || (typeof p?.snippet === 'string' && p.snippet) || '')
    .filter(Boolean)
    .join(' ');
  return ' ' + normCW(text) + ' ';
}

/**
 * Verify every item's atoms against the batch's own fetched pages. An item
 * is kept only if ALL of its atoms substring-match the pages; otherwise it
 * is dropped (and every unsupported atom is logged individually). Does not
 * mutate `partial` — returns fresh arrays.
 *
 * @returns {{ kept: Object, dropped: Array<{bucket, atom, item}> }}
 */
export function verifyExtractedAtoms(partial, pages = []) {
  const hay = buildPageHaystack(pages);
  const kept = {};
  const dropped = [];
  for (const bucket of ATOM_BUCKETS) {
    const arr = Array.isArray(partial?.[bucket]) ? partial[bucket] : [];
    const keptArr = [];
    for (const item of arr) {
      if (!item || typeof item !== 'object') continue;
      const atoms = extractAtoms(item, bucket);
      const unsupported = atoms.filter((atom) => !hay.includes(normCW(atom)));
      if (unsupported.length) {
        for (const atom of unsupported) {
          console.warn(`[ARCH-2] dropped unsupported atom: ${bucket} "${atom}"`);
          dropped.push({ bucket, atom, item });
        }
      } else {
        keptArr.push(item);
      }
    }
    kept[bucket] = keptArr;
  }
  return { kept, dropped };
}
