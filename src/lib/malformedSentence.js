// MALFORMEDSENT-1 — deterministic detector for the malformed-sentence shapes the
// pipeline's own mutating passes produced (root-cause trace 2026-08-15):
//   dropped subject   "Were a ragtag collection…", "Looked at Rodge.", "Was wearing…"
//   agreement         "Zin were ridiculous.", "Nolan were empty."
//   bare-verb frag     "A strange sense of relief wash over her."
//   name-echo          "JB looked at JB."
//
// This is DETECTION only — an export-gate WARNING and a hook for a future
// block-and-regenerate lane. It never mutates prose: mutating repairs are what
// created the mess. A sentence it flags is one the pipeline should REGENERATE or
// a human should fix, not one a regex should edit.

const SENSATION_VERBS = ['wash', 'lighten', 'prickle', 'tighten', 'settle', 'flood', 'creep', 'rise', 'spread', 'surge', 'curl', 'twist', 'sink', 'bloom', 'crawl', 'slide', 'ripple', 'swell', 'drain', 'loosen', 'ease', 'churn', 'flutter', 'thrum', 'throb', 'flicker', 'hammer', 'pound', 'lodge', 'seep', 'trickle', 'squeeze', 'clench', 'unclench', 'relax', 'coil', 'knot', 'stir', 'melt', 'fade'];
// "A strange sense of relief wash over her." — an A/An/The noun phrase whose verb
// is a bare sensation verb with no copula ("was/felt/seemed") in front of it.
const BARE_VERB_RX = new RegExp(`^(?:A|An|The)\\s+[^.!?\\n]{2,70}?(?<!\\b(?:was|were|is|are|be|been|being|felt|feels|seemed|seems|looked|looks|became|grew|got|had|has|have)\\s)\\s(?:${SENSATION_VERBS.join('|')})(?:\\s+(?:over|in|at|through|down|up|into|across|along|inside|behind|beneath|under|around|out|away|off|from|to|against|between)\\b|[,.!?…]|$)`);
// A sentence that OPENS with a bare past-tense verb + lowercase word — English
// sentences open with a subject, so this is a dropped subject, not prose.
const DROPPED_OPENERS = ['Was', 'Were', 'Had', 'Looked', 'Felt', 'Seemed', 'Stood', 'Sat', 'Turned', 'Nodded', 'Reached', 'Leaned', 'Glanced', 'Stared', 'Stepped', 'Walked', 'Moved', 'Pulled', 'Pushed', 'Grabbed', 'Wiped', 'Watched', 'Studied', 'Whispered', 'Muttered', 'Kept', 'Held', 'Gripped', 'Pointed', 'Tapped'];
const DROPPED_OPENER_RX = new RegExp(`^(?:${DROPPED_OPENERS.join('|')})\\s+[a-z]`);
const ECHO_VERBS = 'looked|stared|glanced|nodded|turned|smiled|gestured|pointed|gazed';

function escapeRx(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

// Sentence splitter — abbreviation-aware, matches the app's other passes.
function splitSentences(text) {
  return String(text || '')
    .replace(/\b(Dr|Mr|Mrs|Ms|Prof|Sr|Jr|St)\./g, '$1<ABBR>')
    .split(/(?<=[.!?])\s+|\n+/)
    .map((p) => p.replace(/<ABBR>/g, '.').trim())
    .filter(Boolean);
}

/**
 * Malformed sentences in one text. Returns [{ kind, sentence }] where kind is
 * 'agreement' | 'dropped-subject' | 'bare-verb' | 'name-echo'. `castNames`
 * powers the agreement and name-echo checks (the singular-subject list).
 */
export function scanMalformedSentences(text, castNames = []) {
  const names = (Array.isArray(castNames) ? castNames : []).filter(Boolean);
  const nameAlt = names.map(escapeRx).join('|');
  const findings = [];
  const seen = new Set();
  const push = (kind, s) => {
    const clean = s.replace(/\s+/g, ' ').trim().slice(0, 160);
    const key = kind + '::' + clean;
    if (seen.has(key)) return;
    seen.add(key);
    findings.push({ kind, sentence: clean });
  };
  for (const raw of splitSentences(text)) {
    const s = raw.trim();
    if (!s) continue;
    const bare = s.replace(/^[“"'‘’\s]+/, '');

    // 1. agreement: a SINGULAR subject before "were"/"weren't" (not "They were",
    //    not a compound "Sadie and Lark were").
    if (nameAlt) {
      const m = s.match(new RegExp(`(^|[.!?“”"'’\\s])((?:${nameAlt})|He|She|It)\\s+(?:were|weren['’]t)\\b`));
      if (m) {
        const before = s.slice(0, m.index + m[1].length).trim();
        if (!/\b(?:and|&|,|nor|or|both|either|neither)\s*$/i.test(before)) push('agreement', s);
      }
    }

    // 2. dropped-subject opener (skip questions — "Was that clever?" is inverted,
    //    not subjectless).
    if (DROPPED_OPENER_RX.test(bare) && !bare.endsWith('?')) push('dropped-subject', s);

    // 3. bare-verb sensation fragment.
    if (BARE_VERB_RX.test(bare)) push('bare-verb', s);

    // 4. name-echo: "<Name> <look-verb> at <same Name>".
    if (nameAlt) {
      const e = s.match(new RegExp(`\\b(${nameAlt})\\s+(?:${ECHO_VERBS})\\s+(?:at|to|toward|towards|back at)\\s+(${nameAlt})\\b`, 'i'));
      if (e && e[1] === e[2]) push('name-echo', s);
    }
  }
  return findings;
}

export const MALFORMEDSENT_VERSION = 'malformed-sentence-v1';

// GATEPROMOTE-1: MALFORMEDSENT-1 stays a warning at export until two
// consecutive books export with "[MALFORMEDSENT] Gate scan: 0" — flip this
// to true only then, and record the books in that commit's message.
export const MALFORMEDSENT_HARD_BLOCK = false;
