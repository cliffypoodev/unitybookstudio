# Quote Repair Diagnosis

## Current quote repair in app:

The fix/polish pipeline includes `fixHangingQuotes()` (manuscriptFixer.js line 3833) as part of `runDeterministicWholeManuscriptPasses()`.

### Quote imbalance results:

| Ch | Rewrite Quote Issues | Polished Quote Issues | Verdict |
|----|---------------------|----------------------|---------|
| 5 | 6 | 0 | ✅ Fixed |
| All others | 0 | 0 | — |

The quote repair actually **worked** for the one chapter (Ch.5) that had quote issues in the rewrite. The polished file has **zero** quote imbalance issues.

### The missing opening quote examples from user report:

The user reported examples like:
- `Don't blend," Julian said...`
- `Worse is too strong," Julian corrected...`

These may have been observed in an earlier version or in a different extraction. The current polished DOCX (3) shows 0 quote issues in the automated scan.

However, the automated scan checks per-line quote balance (even vs odd count per paragraph). It may not catch all missing-opening-quote patterns, especially if the dialogue is on the same line as narration that provides balancing quotes.

### Diagnosis summary:
| Question | Answer |
|----------|--------|
| Is quote repair running? | Yes — `fixHangingQuotes()` in step 6 of deterministic passes |
| Does it detect missing opening quotes? | Partially — it fixes hanging/unbalanced quotes but may miss some edge cases |
| Does it fail on curly quotes? | Unknown — would need to test specifically |
| Does it fail after DOCX extraction? | N/A — repair runs before export, not after |
| Is it run before later transformations break quotes? | It's the last pass in deterministic chain — transformations after it could break quotes |
| Does a later cleanup remove opening quotes? | Unlikely — later passes (voice audit, structural rescue) don't target quotes |
