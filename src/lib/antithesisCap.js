// =============================================================
// antithesisCap.js — ARCH2-4b-c: deterministic not-X-but-Y density cap.
// Book-agnostic; pure text transform; no LLM.
// =============================================================

// Words that make the X-side unsafe to invert (verb-y / clausal shapes).
const UNSAFE_INNER = /\b(?:do|does|did|don't|doesn't|didn't|have|has|had|will|would|shall|should|can|could|may|might|must|to|that|which|who|when|where|because|if|as|it|he|she|they|we|you)\b/i;
const COPULA = /\b(was|were|is|are|remained|seemed|felt|proved|stood)\s+$/i;

/**
 * ARCH2-4b-c: deterministic antithesis ("not X but Y") reduction.
 * The AI tell is density, not existence — the first `keepPerChapter`
 * occurrences in each chapter are left alone. Later occurrences with a SAFE
 * shape are inverted in place:  "<copula> not X but Y"  →  "<copula> Y, not X"
 * Safe shape = copula directly before "not", X and Y each 1–4 words, neither
 * side contains verbs/clause markers, no internal punctuation. Everything
 * else is left untouched and counted as remaining.
 */
export function runAntithesisCap(loaded, onProgress, { keepPerChapter = 2 } = {}) {
  onProgress?.('Polish: Reducing not-X-but-Y constructions…');
  const changes = [];
  let fixed = 0;
  let remaining = 0;

  const RX = /\bnot\s+((?:[\w’'-]+\s+){0,5}[\w’'-]+)(,?\s+but\s+(?:rather\s+)?)((?:[\w’'-]+\s+){0,5}[\w’'-]+)(?=[,.;:!?])/g;

  for (const f of loaded) {
    const chNum = f.chapter?.chapter_number || '?';
    let seen = 0;
    let chFixed = 0;
    f.content = String(f.content || '').replace(RX, (m, x, mid, y, offset) => {
      seen++;
      if (seen <= keepPerChapter) return m;
      // exclusions: not only/just/merely (other passes own these) + shapes
      // whose inversion reads wrong (solely/also correlatives)
      if (/^(?:only|just|merely|simply|yet|even|all|every|solely|entirely|wholly|purely)\b/i.test(x)) { remaining++; return m; }
      if (/^(?:also|even|only|likewise)\b/i.test(y)) { remaining++; return m; }
      // Y must be a standalone phrase: no leading preposition (ellipted "a
      // matter OF..." shapes read wrong when inverted)
      if (/^(?:of|in|on|by|for|from|with|at|to)\b/i.test(y)) { remaining++; return m; }
      // when the construction ends at a comma, the continuation must be an
      // appositive/clause (determiner, pronoun, participle, relative) — if it
      // continues Y's own noun phrase ("a recent, raw reality"), skip
      const termCh = f.content[offset + m.length];
      if (termCh === ',') {
        const cont = f.content.slice(offset + m.length + 1).trimStart();
        if (!/^(?:a|an|the|one|each|every|all|those|these|its|his|her|their|not|and|where|which|who|whose|[\w’'-]+(?:ing|ed)\b)/i.test(cont)) { remaining++; return m; }
      }
      // both sides must be verb-free simple phrases
      if (UNSAFE_INNER.test(x) || UNSAFE_INNER.test(y)) { remaining++; return m; }
      // must sit directly after a copula
      const before = f.content.slice(Math.max(0, offset - 12), offset);
      if (!COPULA.test(before)) { remaining++; return m; }
      // inside quotation marks → never touch testimony
      const para = f.content.slice(f.content.lastIndexOf('\n', offset) + 1, offset);
      const dq = (para.match(/["“”]/g) || []).length;
      if (dq % 2 === 1) { remaining++; return m; }
      chFixed++;
      fixed++;
      return y.trim() + ', not ' + x.trim();
    });
    if (chFixed > 0) changes.push('Ch.' + chNum + ': inverted ' + chFixed + ' excess not-X-but-Y construction(s)');
  }
  if (fixed > 0) changes.push('Antithesis cap: inverted ' + fixed + ' construction(s); ' + remaining + ' excess left for the LLM pass.');
  console.log('[ANTITHESIS] inverted=' + fixed + ' remainingExcess=' + remaining);
  return { changes, fixed, remaining };
}

console.log('[ANTITHESIS-CAP] ARCH2-4b-c loaded: deterministic not-X-but-Y density cap');
