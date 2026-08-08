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
// DRAFTGATE-3B: widened dropped-word object net
// DRAFTGATE-3G: + bare-noun objects ("a to industrial might" — measured in a
// shipped export). a/an + preposition + word is never valid English; the space
// requirement excludes hyphenated compounds ("a to-do list"), and "at" stays
// det-only so "an at sign" never flags.
export const DROPPED_WORD_RX = /\b(?:a|an)\s+(?:(?:to|of|in|on|for|with|from|by|at)\s+(?:the|its|this|that|their|his|her|these|those|a|an)\b|(?:to|of|in|on|for|with|from|by)\s+(?=[a-z]))/i;

// DRAFTGATE-3H: model-mangle shapes that are broken beyond repair.
// (a) aux BE + past-tense intransitive that never takes a passive
//     ("bodies were remained embedded").
// (b) adjective censor-hole: a/an + noun-less adjective + preposition + object
//     ("served as a grim to the proximity") — the PROSEGATE lexicon, in regex form.
export const MANGLE_RX = /\b(?:was|were|is|are|be|been|being)\s+(?:remained|existed|persisted|lingered|elapsed|occurred|happened)\b|\b(?:a|an)\s+(?:silent|lasting|direct|grim|stark|solemn|enduring|poignant|somber|tangible)\s+(?:to|of|in|on|for|with|from|by|at)\s+(?:the|its|this|that|their|his|her|these|those|a|an)\b/i;
// (c) citation stump: a sentence unit ending " v." is a truncated case name.
export const CITATION_STUMP_RX = /\bv\.$/;
export function stripMangledSentences(text) {
  const removed = [];
  const paragraphs = String(text || '').split(/(\n{2,})/);
  for (let pi = 0; pi < paragraphs.length; pi += 2) {
    const para = paragraphs[pi];
    if (!para || !para.trim()) continue;
    const sentences = para.split(/(?<=[.!?…”])\s+/);
    const kept = sentences.filter((s) => {
      const trimmed = s.trim();
      if (MANGLE_RX.test(trimmed) || CITATION_STUMP_RX.test(trimmed)) {
        removed.push(trimmed.slice(0, 90));
        return false;
      }
      return true;
    });
    if (kept.length !== sentences.length) paragraphs[pi] = kept.join(' ');
  }
  return { text: paragraphs.join(''), removed };
}

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

// DRAFTGATE-3C: a/an agreement — the one grammar fix that is provably safe to
// automate. Sound-based with the standard closed exception lexicon; anything
// ambiguous is left alone. Measured live: "a effort", "a enduring" shipped.
const AN_BEFORE = /^(?:[aeio]|u(?![a-z])|un(?!i)|honest|honor|hour|heir|herb\b|umbrella|uncle|urgent|ultimate)/i;
const A_BEFORE = /^(?:uni|use|user|usual|utility|utop|euro|eu|ewe|one\b|once\b|u[a-z]?-)/i;
export function fixIndefiniteArticles(text) {
  let fixed = 0;
  const out = String(text || '').replace(/\b(a|an|A|An)\s+([a-z][a-z-]*)\b/g, (m, art, word) => {
    const wantsAn = A_BEFORE.test(word) ? false : AN_BEFORE.test(word);
    const isAn = art.toLowerCase() === 'an';
    if (wantsAn === isAn) return m;
    if (!wantsAn && !A_BEFORE.test(word) && !/^[aeiou]/i.test(word)) {
      // "an" before consonant-initial word — always wrong
      fixed++;
      return (art[0] === 'A' ? 'A' : 'a') + ' ' + word;
    }
    if (wantsAn) { fixed++; return (art[0] === 'A' ? 'An' : 'an') + ' ' + word; }
    return m;
  });
  return { text: out, fixed };
}

// BOOKGATE-3: exact 12+-word sentences appearing in MORE THAN ONE chapter are
// duplicated text, not echoes. Keep the first chapter's copy; strip the rest.
// Measured live: 15 such sentences shipped in one export — an entire rescue
// passage re-appeared one chapter later.
export function stripCrossChapterDuplicates(chapterTexts) {
  const seen = new Map(); // normalized sentence -> first chapter index
  const removedPerChapter = chapterTexts.map(() => []);
  const out = chapterTexts.map((text, ci) => {
    const paragraphs = String(text || '').split(/(\n{2,})/);
    for (let pi = 0; pi < paragraphs.length; pi += 2) {
      const para = paragraphs[pi];
      if (!para || !para.trim()) continue;
      const sentences = para.split(/(?<=[.!?…”])\s+/);
      const kept = sentences.filter((s) => {
        const norm = s.replace(/\s+/g, ' ').trim();
        if (norm.split(' ').length < 12) return true;
        const firstCi = seen.get(norm);
        if (firstCi === undefined) { seen.set(norm, ci); return true; }
        if (firstCi === ci) return true;
        removedPerChapter[ci].push(norm.slice(0, 90));
        return false;
      });
      if (kept.length !== sentences.length) paragraphs[pi] = kept.join(' ');
    }
    return paragraphs.join('');
  });
  return { texts: out, removedPerChapter };
}
