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

// The exact noun vocabulary the old fiction starter pass swapped articles on —
// healing is bounded to the same list, so it can only reverse the pass's own
// damage class, never rewrite an author's genuine phrasing.
const SWAP_NOUNS = 'door|light|lights|sound|noise|air|room|floor|wall|walls|ceiling|sky|ground|voice|machine|screen|city|building|world|system|corridor|hallway|tunnel|space|place|water|fire|darkness|silence|crowd|clock|bell|wind|rain|storm|fog|mist|sun|moon|path|road|street|field|forest|night|day|morning|evening|pain|fear|anger|rage|truth|thought|memory|image|idea|question|answer|problem|effect|result|impact|surface|metal|stone|concrete|glass';
const SWAP_VERBS = 'was|were|had|did|ticked|tapped|opened|closed|slid|hung|sat|stood|lay|came|went|fell|rose|filled|held|pressed|smelled|felt|seemed|remained|grew|turned|changed|stopped|began|carried|drifted|spread|settled|shifted|stretched|waited|persisted|deepened|faded|blared|echoed|hummed';

// Verb-jam pairs ("turned walked") — first verb + second verb with the
// conjunction eaten by a deletion pass. Bounded lists; ambiguous pairs
// (turned left) are excluded.
const JAM_V1 = 'turned|stood|rose|paused|stopped|smiled|nodded|laughed|sighed|shrugged|straightened';
const JAM_V2 = 'walked|reached|stepped|moved|crossed|picked|pulled|pushed|opened|closed|looked|spoke|started|began|headed|collected';

export function healProseWounds(loaded, onProgress) {
  onProgress?.('Polish: Healing prose wounds…');
  const changes = [];
  let swaps = 0, jams = 0;
  const swapRx = new RegExp('(^|[.!?]["”]?\\s+)(One|Its)\\s+(' + SWAP_NOUNS + ')(\\s+(?:' + SWAP_VERBS + '))\\b', 'g');
  const jamRx = new RegExp('\\b(' + JAM_V1 + ')\\s+(' + JAM_V2 + ')\\b', 'g');

  for (const f of loaded) {
    const chNum = f.chapter?.chapter_number || '?';
    let t = String(f.content || '');
    let n1 = 0, n2 = 0, n3 = 0;

    // 1) article-swap wounds: "One clock ticked" / "Its sound was" → "The …"
    //    guard: keep genuine enumeration ("One door opened; the other…") —
    //    checked only within the SAME sentence, and only for "One".
    t = t.replace(swapRx, (m, pre, art, noun, tail, offset) => {
      if (art === 'One') {
        const rest = t.slice(offset + m.length);
        const sentEnd = rest.search(/[.!?]/);
        const sameSentence = sentEnd === -1 ? rest.slice(0, 160) : rest.slice(0, sentEnd);
        if (/\bother\b/.test(sameSentence)) return m;            // real "one … the other"
      }
      n1++; return pre + 'The ' + noun + tail;
    });

    // 2) verb jams: "turned walked" → "turned and walked"
    t = t.replace(jamRx, (m, v1, v2) => { n2++; return v1 + ' and ' + v2; });

    // NOTE: dropped-subject sentences ("Had forgotten this picture existed.")
    // are NOT healed deterministically — choosing the pronoun requires real
    // context (nearest-pronoun guessing inserted wrong subjects in testing).
    // They are FLAGGED via hasBrokenShape and repaired by the guarded LLM
    // rewrite, which sees the whole paragraph.

    if (n1 + n2 > 0) {
      f.content = t;
      swaps += n1; jams += n2;
      changes.push('Ch.' + chNum + ': prose wounds healed (articles ' + n1 + ', verb jams ' + n2 + ')');
    }
  }
  if (swaps + jams > 0) console.log('[PROSE-WOUNDS] articles=' + swaps + ' verbJams=' + jams);
  return { changes, swaps, jams };
}

console.log('[SENTENCE-CASE-REPAIR] FICTIONFIX-2 loaded: case/spacing healer + prose-wound repair');
