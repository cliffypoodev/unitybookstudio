// NFGUARD-1 (POLISHFIX-8): content-equivalence check for the nonfiction polish
// path. Two texts are "polish-equivalent" when they differ only by quote glyphs
// (straight vs curly), whitespace, and collapsed runs of identical punctuation
// (",," → ","; " ," → ","). Everything else — a deleted appositive comma, a
// swapped word, a merged or rewritten sentence — is a CONTENT change. Three
// deterministic rewrite passes each independently damaged real nonfiction prose
// (POLISHFIX-7 and the run after it); on nonfiction, polish may fix typography
// and nothing else, and this predicate is what enforces it.
export function nfPolishNormalize(text) {
  return String(text || '')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/([,.;:!?])\1+/g, '$1')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

export function nfContentEquivalent(before, after) {
  return nfPolishNormalize(before) === nfPolishNormalize(after);
}

// DRAFTGATE-2: deterministic dropped-word sentence strip. "Article + preposition
// + the" ("a to the", "an of the") is never valid prose — it is a model-dropped
// noun. LLM repair does not converge on it (the model re-drops the banned word
// every regeneration), so after repairs exhaust, the broken sentence is removed
// entirely. Blank beats broken; nothing is invented. Splits on sentence
// boundaries, preserves paragraph breaks, and returns what was removed so every
// call site can log loudly.
export const DROPPED_WORD_RX = /\b(?:a|an)\s+(?:to|of|in|on|for|with|from|by|at)\s+the\b/i;

export function stripDroppedWordSentences(text) {
  const removed = [];
  const paragraphs = String(text || '').split(/(\n{2,})/);
  for (let pi = 0; pi < paragraphs.length; pi += 2) {
    const para = paragraphs[pi];
    if (!para || !para.trim()) continue;
    const sentences = para.split(/(?<=[.!?…”])\s+/);
    const kept = sentences.filter((s) => {
      if (DROPPED_WORD_RX.test(s)) { removed.push(s.trim().slice(0, 90)); return false; }
      return true;
    });
    if (kept.length !== sentences.length) paragraphs[pi] = kept.join(' ');
  }
  return { text: paragraphs.join(''), removed };
}
