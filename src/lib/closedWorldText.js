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

// REGENLANE-2: a standalone copy of sceneWriter.js's splitSentencesSafe (kept
// in sync deliberately, not re-exported) so closedWorldCheck below can run
// without pulling in sceneWriter.js's @/-aliased dependencies — several
// existing acceptance batteries (draftgate3e/3f, evidence1/2,
// nfclass3-provenance1, repeat1) locate this function's SOURCE TEXT inside
// sceneWriter.js by anchor, so moving it out of that file broke seven
// unrelated batteries. Duplication here is the deliberate, lower-risk
// tradeoff; the algorithm must stay identical if sceneWriter.js's copy ever
// changes.
export function splitSentencesSafe(text) {
  const PROT = '';
  const ABBR = /(?<!)\b(D\.\s?C|U\.\s?S|Gen|Maj|Brig|Col|Capt|Lt|Sgt|Gov|Sec|Dr|Mr|Mrs|Ms|St|Mt|Jr|Sr|No|vs|etc|a\.m|p\.m)\.(?=\s|$)/gi;
  // GATEFIX-22: protect dotted domain names (archives.gov, loc.gov, blogs.loc.gov) so a
  // mid-domain split can never strand a "gov." stump after a sentence strip.
  let work = String(text || '').replace(/\b((?:[a-z0-9-]+\.)+(?:gov|com|org|net|edu|io))\b/gi, (m) => m.split('.').join(PROT));
  work = work.replace(ABBR, (m) => m.replace('.', PROT));
  // Single-letter initials followed by a capitalized word: "William S. Pease"
  work = work.replace(/\b([A-Z])\.(?=\s+[A-Z])/g, '$1' + PROT);
  // DRAFTGATE-3F: consecutive initials with NO space ("J.P. Morgan", "U.S.A.").
  // The space-requiring rule above missed them, so the tokenizer split
  // MID-NAME and the closed-world strip removed only the tail — shipping
  // stumps like "…in the basement of the J." (measured in a live export).
  // Protected, the whole sentence stays one part and strips remove it whole.
  work = work.replace(/\b([A-Z])\.(?=[A-Z]\b|[A-Z]\.)/g, '$1' + PROT);
  // DRAFTGATE-3F: legal-citation "v." ("Dorr, trustee, v. United States…") —
  // a lowercase single-letter abbreviation, never a sentence terminator.
  work = work.replace(/\b(v)\.(?=\s)/g, '$1' + PROT);
  // DRAFTGATE-3A: protect decimals ("2.3 million", "3.5%"), decimal-dotted
  // enumerations, and any digit.digit shape — an unprotected decimal made the
  // period a sentence terminator that neither match alternative could consume,
  // and match() DROPS unmatched spans. Measured live: every "2.3 million"
  // sentence in a shipped book lost its head through this splitter.
  work = work.replace(/(\d)\.(?=\d)/g, '$1' + PROT);
  // DRAFTGATE-3E: partition by construction. String.match DROPS spans that fit
  // no alternative — measured live: raw scene text with markdown emphasis after
  // terminal punctuation ("…looked wrong.**") refused ~22 times in one chapter
  // run, and every refusal downgraded dedupe, the closed-world strip, and the
  // 3D re-breaker to no-ops, shipping fabrications and mega-paragraphs.
  // Instead of enumerating breaker shapes, iterate the terminator matches and
  // emit every inter-match gap as its own part: parts.join('') === work on
  // EVERY input, by construction. Untokenizable spans survive as single parts,
  // which every consumer already treats as sentence units.
  const SENT_RE = /[^.!?]*[.!?]+["'”’)\]]*(?:\s+|$)/g;
  const parts = [];
  let last = 0;
  let mt;
  while ((mt = SENT_RE.exec(work)) !== null) {
    if (mt.index > last) parts.push(work.slice(last, mt.index));
    parts.push(mt[0]);
    last = mt.index + mt[0].length;
    if (mt[0].length === 0) SENT_RE.lastIndex++; // unreachable ([.!?]+ needs a char) — loop safety only
  }
  if (last < work.length) parts.push(work.slice(last));
  if (parts.length === 0) parts.push(work);
  // DRAFTGATE-3A LOSSLESS INVARIANT — retained as a dead-man's switch: the
  // partition makes loss impossible; if this ever fires, the tokenizer regressed.
  if (parts.join('') !== work) {
    console.error('[DRAFTGATE-3A] splitSentencesSafe would have LOST text (' + (work.length - parts.join('').length) + ' chars) — returning input unsplit. Fix the tokenizer, never ship the loss.');
    return [String(text || '')];
  }
  return parts.map((s) => s.split(PROT).join('.'));
}

// ARCH-1B / REGENLANE-2: CLOSED-WORLD CHECK (nonfiction). Every proper-noun
// phrase, month-year date, year, and significant number in the prose must
// exist in the project's evidence (research_data + research_md +
// seed_concept). One principle replaces the per-shape regex arms race: a
// fact is in the evidence or it does not ship. Atoms inside verified quotes
// pass automatically (a verbatim quote is a substring of the evidence by
// definition). Violations reuse the existing strip machinery ({ snippet } =
// the offending sentence). A standalone copy of sceneWriter.js's
// closedWorldCheck (kept in sync deliberately, not re-exported) — the same
// anchor-coupled-battery reason as splitSentencesSafe above — so the
// regenerate lane's NF verifier (regenerateLane.js, directly battery-
// imported) can call it without pulling in sceneWriter.js's @/-aliased
// dependencies. Rebuilt here from CLOSED_WORLD_STOPWORDS/createInEV/
// buildEvidenceCorpus instead of re-declaring its own EV/inEV, so at least
// the normalization rule is single-sourced even though the check's control
// flow is duplicated.
export function closedWorldCheck(prose, project) {
  try {
    if (!prose || !project) return [];
    const EV = buildEvidenceCorpus(project);
    if (EV.trim().length < 200) {
      console.warn(`[CLOSED-WORLD] evidence corpus is ${EV.trim().length} chars (<200) — skipping the check. This chapter was NOT closed-world verified.`);
      return [];
    }
    const inEV = createInEV(EV);
    const sentences = splitSentencesSafe(prose);
    const out = [];
    const MRE = new RegExp('\\b(' + MONTHS.split(' ').join('|') + ')\\s+(?:\\d{1,2},?\\s+)?(1[6-9]\\d\\d|20\\d\\d)\\b', 'gi');
    for (const s of sentences) {
      const bad = [];
      const pre = /(?:[A-Z][\w.'’-]*)(?:\s+(?:of|the|and|No\.|[A-Z][\w.'’-]*))*/g;
      let m;
      while (!bad.length && (m = pre.exec(s)) !== null) {
        let ph = m[0].trim();
        const isSentInitial = m.index === 0 || /[.!?”"]\s*$/.test(s.slice(0, m.index));
        if (isSentInitial) {
          // GATEFIX-28: a sentence-initial capitalized function word ("When", "But",
          // "For", "If", "While", "In", ...) glues onto the proper noun that follows.
          // Drop leading stopword tokens before checking the phrase against evidence.
          const toks = ph.split(/\s+/);
          while (toks.length && CLOSED_WORLD_STOPWORDS.has(normCW(toks[0]))) toks.shift();
          ph = toks.join(' ');
          if (!ph) continue;
        }
        const words = ph.split(/\s+/).filter((w) => !/^(of|the|and)$/i.test(w));
        if (words.length === 1 && (isSentInitial || CLOSED_WORLD_STOPWORDS.has(normCW(words[0])))) continue;
        if (!inEV(ph)) {
          // EVIDENCE-2: a compound phrase is innocent when every content segment is
          // independently in evidence. The old path split only on "and", so a phrase
          // like a descriptor + researched name + "of" + researched unit failed as a
          // unit and the sentence was flagged — false positives that drive pointless
          // repair cycles and can strip researched people from prose. Compounds now
          // split on connectives, and leading descriptor tokens that the evidence
          // itself contains as ordinary words are stripped before the retest (the
          // closed world doubles as the descriptor lexicon — nothing hardcoded).
          // A phrase with any genuinely-unresearched content segment still flags,
          // and a wholly-unresearched phrase flags exactly as before.
          const segs = ph.split(/\s+(?:and|of|at|in|on|for|the)\s+/i).filter(Boolean);
          const segOk = (seg) => {
            if (inEV(seg)) return true;
            const toks = normCW(seg).split(' ').filter(Boolean);
            while (toks.length > 1 && EV.includes(' ' + toks[0] + ' ')) toks.shift();
            return toks.length > 0 && inEV(toks.join(' '));
          };
          if (!segs.length || !segs.every(segOk)) bad.push(ph);
        }
      }
      MRE.lastIndex = 0;
      while (!bad.length && (m = MRE.exec(s)) !== null) { if (!inEV(m[0])) bad.push(m[0]); }
      const YRE = /\b(1[6-9]\d\d|20\d\d)s?\b/g;
      let ym;
      while (!bad.length && (ym = YRE.exec(s)) !== null) { if (!inEV(ym[1])) bad.push(ym[1]); }
      const NRE = /\b\d{1,3}(?:,\d{3})+\b|\b\d{3,}\b/g;
      let nm;
      while (!bad.length && (nm = NRE.exec(s)) !== null) { if (!/^(1[6-9]\d\d|20\d\d)$/.test(nm[0]) && !inEV(nm[0])) bad.push(nm[0]); }
      if (bad.length) {
        console.warn('[CLOSED-WORLD] atom not in evidence:', bad[0], '— sentence flagged.');
        // REGENLANE-2: `atom` (not present on sceneWriter.js's original copy)
        // lets a caller diff violations by WHAT was unsupported rather than
        // by the sentence's exact wording — the regenerate lane's candidate
        // sentence is never byte-identical to the original by construction,
        // so a snippet-only diff would treat every pre-existing violation as
        // "new" on every single rewrite.
        out.push({ type: 'closed-world', snippet: s.trim(), atom: normCW(bad[0]) });
      }
    }
    return out;
  } catch (e) {
    // ARCH-1 backstop: an empty return is indistinguishable from 'no fabrication found',
    // so an internal error here reads as a clean chapter. It still returns [] rather than
    // blocking the draft, but it can no longer be silent about it.
    console.error('[CLOSED-WORLD] check threw and found nothing as a result — this chapter was NOT closed-world verified:', e);
    return [];
  }
}
