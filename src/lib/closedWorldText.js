// src/lib/closedWorldText.js — shared closed-world text normalization.
//
// NFANTH-CW-1 / BIBLEGUARD-NAMES-1 / REGENLANE-2 all need the same answer to
// "is this atom in the evidence" that sceneWriter.js's closedWorldCheck
// already implements. Single-sourced here so normalization/matching rules
// never drift between the writer, the bible guard, and the regenerate lane.
//
// No book specifics live here. Everything is derived from project data.

export const CLOSED_WORLD_TEXT_VERSION = 'closed-world-text-v1';

export function normCW(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[‘’']/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const MONTHS = 'january february march april may june july august september october november december';

export const CLOSED_WORLD_STOPWORDS = new Set(
  ('the this that these those his her their its it in on at by for no yet but and a an or nor when where while so as if to from with of not never ' +
    MONTHS +
    ' monday tuesday wednesday thursday friday saturday sunday'
  ).split(' ')
);

const TITLE_PREFIX_RX = /^(major general|brigadier general|general|colonel|major|captain|lieutenant|reverend|president|governor|mr|mrs|ms|dr|aunt|the|a|an)\s+/;

/**
 * Build the padded, normalized evidence corpus for a project: research_data +
 * research_md + seed_concept. Padded with a leading/trailing space so a
 * plain `.includes(' token ')` substring check never false-matches inside a
 * longer word.
 */
export function buildEvidenceCorpus(project) {
  return ' ' + normCW([project?.research_data, project?.research_md, project?.seed_concept].filter(Boolean).join(' ')) + ' ';
}

/**
 * Given an evidence corpus (from buildEvidenceCorpus, or any padded normCW
 * string), return an `inEV(raw)` predicate: is this raw phrase supported by
 * the evidence? Strips a leading title/article, passes stopwords and empty
 * strings automatically, and falls back to a singular/plural match.
 */
export function createInEV(evidenceCorpus) {
  const EV = String(evidenceCorpus || '');
  return function inEV(raw) {
    let n = normCW(raw).replace(TITLE_PREFIX_RX, '');
    if (!n || CLOSED_WORLD_STOPWORDS.has(n)) return true;
    if (EV.includes(' ' + n + ' ') || EV.includes(n)) return true;
    const alt = n.endsWith('s') ? n.slice(0, -1) : n + 's';
    return EV.includes(' ' + alt + ' ') || EV.includes(alt);
  };
}

// A sentence-initial capitalized function word is never itself a proper
// noun (GATEFIX-28) — stripped from the front of a phrase before it is
// treated as a name candidate.
const SENTENCE_INITIAL_STOPWORDS = new Set([
  'The', 'A', 'An', 'In', 'On', 'At', 'By', 'For', 'With', 'From', 'To', 'Of',
  'And', 'But', 'Or', 'Nor', 'As', 'If', 'When', 'Where', 'While', 'After',
  'Before', 'During', 'Since', 'This', 'That', 'These', 'Those', 'He', 'She',
  'They', 'It', 'His', 'Her', 'Their', 'Its',
]);

// A 1-3 capitalized-token phrase, with an optional trailing period per
// token so a title abbreviation ("Dr.", "Gen.") joins the compound instead
// of splitting off as its own token. Restricted to space/tab between
// tokens (not newlines) so a phrase never spans a paragraph break.
const PROPER_NOUN_PHRASE_RX = /\b[A-Z][a-zA-Z'’-]*\.?(?:[ \t]+[A-Z][a-zA-Z'’-]*\.?){0,2}/g;

/**
 * Every 1-3 capitalized-token phrase in `text`, with sentence-initial
 * function words stripped from the front of each match. Returns the raw
 * (un-normalized) phrases, in order, including duplicates.
 */
export function extractProperNounPhrases(text) {
  const out = [];
  const s = String(text || '');
  let m;
  PROPER_NOUN_PHRASE_RX.lastIndex = 0;
  while ((m = PROPER_NOUN_PHRASE_RX.exec(s)) !== null) {
    const toks = m[0].split(/\s+/);
    while (toks.length > 1 && SENTENCE_INITIAL_STOPWORDS.has(toks[0])) toks.shift();
    if (toks.length === 1 && SENTENCE_INITIAL_STOPWORDS.has(toks[0])) continue;
    const phrase = toks.join(' ');
    if (phrase) out.push(phrase);
  }
  return out;
}
