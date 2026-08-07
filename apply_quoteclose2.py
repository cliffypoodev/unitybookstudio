import io, sys

p1 = 'src/lib/quoteFixPolish.js'
c1 = io.open(p1, encoding='utf-8').read()

f1 = r'''export default {
  repairChapterQuotes,
  analyzeQuoteIntegrity,
  fixHangingQuotes,
  normalizeSmartQuotesOnly,
};'''
r1 = r'''/**
 * QUOTECLOSE-2 — close a paragraph's trailing unclosed dialogue quote.
 *
 * Paragraph-safe and structure-safe: never splits, merges, or reorders
 * paragraphs (so the polish runner's STRUCTURE-GUARD cannot revert it), and only
 * ever APPENDS one closing curly quote. Fires on a paragraph only when ALL hold:
 * exactly one more “ than ” (one net unclosed open), the text after the LAST “
 * contains no ”, and the paragraph ends in sentence-terminal punctuation. That is
 * the "dialogue opened, sentence finished, close-quote dropped" shape —
 * e.g. `“It did not.` → `“It did not.”`. Other imbalance shapes are left
 * untouched. Word and paragraph counts are invariant. Returns { text, changed }.
 */
export function closeTrailingUnclosedQuotes(text) {
  if (typeof text !== 'string' || !text) return { text: text || '', changed: 0 };
  let changed = 0;
  const parts = text.split(/(\n\s*\n)/);
  const out = parts.map((seg) => {
    if (/^\n\s*\n$/.test(seg) || !seg.trim()) return seg;
    const open = (seg.match(/“/g) || []).length;
    const close = (seg.match(/”/g) || []).length;
    if (open === close + 1) {
      const lastOpen = seg.lastIndexOf('“');
      const afterLastOpen = seg.slice(lastOpen + 1);
      const trimmedEnd = seg.replace(/\s+$/, '');
      if (!afterLastOpen.includes('”') && /[.!?…]$/.test(trimmedEnd)) {
        changed++;
        return trimmedEnd + '”' + seg.slice(trimmedEnd.length);
      }
    }
    return seg;
  }).join('');
  return { text: out, changed };
}

export default {
  repairChapterQuotes,
  analyzeQuoteIntegrity,
  fixHangingQuotes,
  normalizeSmartQuotesOnly,
  closeTrailingUnclosedQuotes,
};'''

count1 = c1.count(f1)
if count1 != 1:
    print(f"ABORT quoteFixPolish.js: Expected 1, found {count1}")
    sys.exit(1)
c1 = c1.replace(f1, r1)
io.open(p1, 'w', encoding='utf-8').write(c1)


p2 = 'src/lib/manuscriptPolishRunner.js'
c2 = io.open(p2, encoding='utf-8').read()

f2 = r'''import { fixHangingQuotes, normalizeSmartQuotesOnly } from './quoteFixPolish.js';'''
r2 = r'''import { fixHangingQuotes, normalizeSmartQuotesOnly, closeTrailingUnclosedQuotes } from './quoteFixPolish.js';'''
count2 = c2.count(f2)
if count2 != 1:
    print(f"ABORT manuscriptPolishRunner.js import: Expected 1, found {count2}")
    sys.exit(1)
c2 = c2.replace(f2, r2)


f3 = r'''  console.log(`[POLISH-RUNNER] [QUOTENORM-1] normalized ${smartQuotesNormalized} straight quote mark(s) across ${loaded.length} chapter(s)`);

  console.log(`[POLISH-RUNNER] ========== COMPLETE ==========`);'''
r3 = r'''  console.log(`[POLISH-RUNNER] [QUOTENORM-1] normalized ${smartQuotesNormalized} straight quote mark(s) across ${loaded.length} chapter(s)`);

  // QUOTECLOSE-2: close any trailing unclosed dialogue quote left in a paragraph.
  // Runs AFTER typography is uniform (all curly). Paragraph-count-preserving, so
  // STRUCTURE-GUARD has nothing to revert; it only appends a closing ”.
  let trailingQuotesClosed = 0;
  for (let i = 0; i < loaded.length; i++) {
    const f = loaded[i];
    const before = f.content || '';
    const res = closeTrailingUnclosedQuotes(before);
    if (res.changed > 0 && res.text !== before) {
      f.content = res.text;
      trailingQuotesClosed += res.changed;
    }
  }
  if (trailingQuotesClosed > 0) {
    changes.push(`Dialogue: closed ${trailingQuotesClosed} trailing unclosed quote(s) (QUOTECLOSE-2)`);
  }
  console.log(`[POLISH-RUNNER] [QUOTECLOSE-2] closed ${trailingQuotesClosed} trailing unclosed quote(s) across ${loaded.length} chapter(s)`);

  console.log(`[POLISH-RUNNER] ========== COMPLETE ==========`);'''
count3 = c2.count(f3)
if count3 != 1:
    print(f"ABORT manuscriptPolishRunner.js logic: Expected 1, found {count3}")
    sys.exit(1)
c2 = c2.replace(f3, r3)

io.open(p2, 'w', encoding='utf-8').write(c2)

print("SUCCESS: QUOTECLOSE-2 applied")
