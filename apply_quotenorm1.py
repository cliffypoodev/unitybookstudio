import io, sys

p1 = 'src/lib/quoteFixPolish.js'
c1 = io.open(p1, encoding='utf-8').read()

f1 = r'''export default {
  repairChapterQuotes,
  analyzeQuoteIntegrity,
  fixHangingQuotes,
};'''
r1 = r'''/**
 * QUOTENORM-1 — typography-only smart-quote normalization.
 *
 * The last mutating step of the polish pipeline. Character-for-character:
 * - straight double quotes -> directional curly (“ opening / ” closing)
 * - straight apostrophes -> ’ ONLY in contraction/possessive positions
 *   (a letter or digit on the left). Opening single quotes that begin nested
 *   dialogue are left exactly as authored — zero-risk.
 *
 * It never inserts, deletes, or reorders anything except swapping one quote
 * glyph for its curly equivalent, so word counts and paragraph counts are
 * invariant by construction. Idempotent: fully-curly input returns unchanged.
 * Returns { text, changed }.
 */
export function normalizeSmartQuotesOnly(text) {
  if (typeof text !== 'string' || !text) return { text: text || '', changed: 0 };
  let changed = 0;
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      const prev = i > 0 ? text[i - 1] : '';
      const opening = prev === '' || /[\s(\[{—–‘“]/.test(prev);
      out += opening ? '“' : '”';
      changed++;
    } else if (ch === "'") {
      const prev = i > 0 ? text[i - 1] : '';
      const next = i + 1 < text.length ? text[i + 1] : '';
      const ld = /[A-Za-z0-9]/;
      if (ld.test(prev) && (ld.test(next) || next === '' || /[\s.,;:!?)\]—–]/.test(next))) {
        out += '’';
        changed++;
      } else {
        out += ch;
      }
    } else {
      out += ch;
    }
  }
  return { text: out, changed };
}

export default {
  repairChapterQuotes,
  analyzeQuoteIntegrity,
  fixHangingQuotes,
  normalizeSmartQuotesOnly,
};'''

count1 = c1.count(f1)
if count1 != 1:
    print(f"ABORT quoteFixPolish.js: Expected 1, found {count1}")
    sys.exit(1)
c1 = c1.replace(f1, r1)
io.open(p1, 'w', encoding='utf-8').write(c1)


p2 = 'src/lib/manuscriptPolishRunner.js'
c2 = io.open(p2, encoding='utf-8').read()

f2 = r'''import { fixHangingQuotes } from './quoteFixPolish.js';'''
r2 = r'''import { fixHangingQuotes, normalizeSmartQuotesOnly } from './quoteFixPolish.js';'''

count2 = c2.count(f2)
if count2 != 1:
    print(f"ABORT manuscriptPolishRunner.js (import): Expected 1, found {count2}")
    sys.exit(1)
c2 = c2.replace(f2, r2)


f3 = r'''  console.log(`[POLISH-RUNNER] ========== COMPLETE ==========`);'''
r3 = r'''  // ══════════════════════════════════════════════════════════════════════════
  // PHASE H: Typography normalization — QUOTENORM-1.
  // The last mutating step. Deterministic passes (and, when enabled, the LLM)
  // can emit straight quotes; this makes quote typography uniform (all curly) so
  // the export gate's typography verdict cannot hard-block a finished book on
  // mixed straight/curly quotes. Character-for-character only — word and
  // paragraph counts are invariant by construction.
  // ══════════════════════════════════════════════════════════════════════════
  onProgress('Polish: Typography normalization (quotes)…');
  let smartQuotesNormalized = 0;
  for (let i = 0; i < loaded.length; i++) {
    const f = loaded[i];
    const before = f.content || '';
    const res = normalizeSmartQuotesOnly(before);
    if (res.changed > 0 && res.text !== before) {
      f.content = res.text;
      smartQuotesNormalized += res.changed;
    }
  }
  if (smartQuotesNormalized > 0) {
    changes.push(`Typography: normalized ${smartQuotesNormalized} straight quote mark(s) to curly (QUOTENORM-1)`);
  }
  console.log(`[POLISH-RUNNER] [QUOTENORM-1] normalized ${smartQuotesNormalized} straight quote mark(s) across ${loaded.length} chapter(s)`);

  console.log(`[POLISH-RUNNER] ========== COMPLETE ==========`);'''

count3 = c2.count(f3)
if count3 != 1:
    print(f"ABORT manuscriptPolishRunner.js (PHASE H): Expected 1, found {count3}")
    sys.exit(1)
c2 = c2.replace(f3, r3)

io.open(p2, 'w', encoding='utf-8').write(c2)

print("SUCCESS: QUOTENORM-1 applied")
