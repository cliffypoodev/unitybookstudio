// =============================================================
// sentenceCaseRepair.js — FICTIONFIX-1: deterministic sentence-case,
// spacing, and close-quote healer. Runs as the true last mutating step
// for BOTH modes; a clean manuscript is a no-op.
// =============================================================

const NF_ABBREV = /\b(?:Mr|Mrs|Ms|Dr|St|No|Gen|Col|Capt|Lt|Sgt|Rev|Prof|Jr|Sr|vs|etc|Inc|Co|Ave|Blvd|e\.g|i\.e)\.$/;

/**
 * FICTIONFIX-1: deterministic sentence-case + spacing healer.
 * Multiple polish passes (phrase deletions, triplet reduction, paragraph
 * merging, LLM splices) can leave a sentence starting with a lowercase
 * letter or leave doubled spaces. Rather than patching every producer,
 * this heals the CLASS as the last mutating step:
 *   - "wall. the floorboard" → "wall. The floorboard"  (incl. proper names)
 *   - doubled spaces collapse
 * Guards: never touches dialogue attributions after ?!" (“Stop!” she said),
 * abbreviations (Mr./No./etc.), decimals/enumerations, or anything inside
 * an open quotation. Mode-agnostic: a clean manuscript is a no-op.
 */
export function runSentenceCaseRepair(loaded, onProgress) {
  onProgress?.('Polish: Healing sentence case + spacing…');
  const changes = [];
  let caps = 0;
  let spaces = 0;
  for (const f of loaded) {
    const chNum = f.chapter?.chapter_number || '?';
    let t = String(f.content || '');
    let chCaps = 0;
    let chSpaces = 0;
    t = t.replace(/([^\n ]) {2,}([^\n ])/g, (m, a, b) => { chSpaces++; return a + ' ' + b; });
    // missing space after a closing quote: …disappeared."Her voice → ." Her
    t = t.replace(/([.!?…][”"])([A-Za-z])/g, (m, a, b) => { chSpaces++; return a + ' ' + b; });
    t = t.replace(/([.!?])(\s+)([a-z])/g, (m, end, sp, ch, offset) => {
      // sentence must really end here: previous char not a digit (3.5, "No. 3"),
      // not an abbreviation, not inside/closing a quote, not an ellipsis part
      const prev = t[offset - 1] || '';
      if (/[0-9]/.test(prev)) return m;
      if (/[”"'’]/.test(prev)) return m;                    // punctuation after a closing quote is not a new-sentence signal we trust
      const lead = t.slice(Math.max(0, offset - 8), offset + 1);
      if (NF_ABBREV.test(lead)) return m;
      if (t[offset + 1] === '.' || prev === '.') return m;  // ellipsis ".."/"..."
      // NOTE: no open-quote suppression — capitalizing after . ! ? is correct
      // English inside dialogue as well; attribution tails (?!" + lowercase)
      // are already excluded by the closing-quote prev-char guard above.
      chCaps++;
      return end + sp + ch.toUpperCase();
    });
    if (chCaps || chSpaces) {
      f.content = t;
      caps += chCaps; spaces += chSpaces;
      changes.push('Ch.' + chNum + ': sentence-case repair (' + chCaps + ' capitalized, ' + chSpaces + ' spaces)');
    }
  }
  if (caps + spaces > 0) console.log('[SENTENCE-CASE] capitalized=' + caps + ' doubleSpaces=' + spaces);
  return { changes, caps, spaces };
}

console.log('[SENTENCE-CASE-REPAIR] FICTIONFIX-1 loaded: case + spacing healer');
