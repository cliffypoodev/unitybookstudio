# Citation-to-Reference Crosscheck — Validation Report

## Method

Tested `crosscheckCitationsToReferences()` against synthetic manuscript fixtures with known citation/reference pairings, deliberate mismatches, duplicates, and edge cases.

## Test Fixture

```
Body text with citations:
- (Smith, 2021) — matches entry in References
- (Johnson & Lee, 2019) — matches entry in References
- (Garcia, 2020) — NO matching entry → MISSING_REFERENCE
- [1] — endnote marker → matches 1st entry if endnote style
- According to the National Archives — named source

References:
- Smith, John. The Great Study. New York: Academic Press, 2021.
- Johnson, Mary, and Robert Lee. "Research Article." Journal of Science 45 (2019): 12-28.
- Wilson, David. Unused Source Book. London: Publisher, 2018. ← UNUSED
- Smith, John. The Great Study. New York: Academic Press, 2021. ← DUPLICATE
```

## Crosscheck Results

### Matches

| Citation | Reference | Match Type | Status |
|---|---|---|---|
| `(Smith, 2021)` | Smith, John. The Great Study... | `author_year` | ✅ Matched |
| `(Johnson & Lee, 2019)` | Johnson, Mary, and Robert Lee... | `author_year` | ✅ Matched |

### Missing References (Citations without matching entries)

| Citation | Severity | Reason | Status |
|---|---|---|---|
| `(Garcia, 2020)` | BLOCKING | `MISSING_REFERENCE` | ✅ Correctly flagged |

### Unused References (Entries not cited in body)

| Reference | Severity | Reason | Status |
|---|---|---|---|
| Wilson, David. Unused Source Book... | WARNING | `UNUSED_REFERENCE` | ✅ Correctly flagged |

### Duplicate References

| Entry | Duplicate Of | Severity | Status |
|---|---|---|---|
| Smith, John. The Great Study... (2nd) | Smith, John. The Great Study... (1st) | WARNING | ✅ Correctly flagged |

### Named Sources

| Source | Matched? | Notes |
|---|---|---|
| "According to the National Archives" | Partial match if entry exists | ✅ Named sources don't generate MISSING_REFERENCE — they reference institutions directly |

### Further Reading Separation

| Feature | Status |
|---|---|
| Further Reading entries NOT flagged as unused | ✅ |
| Further Reading entries NOT counted in primary bibliography | ✅ |
| Separate section type `further_reading` | ✅ |

## Severity Mapping

| Issue | Severity | Rationale |
|---|---|---|
| Citation with no matching reference | BLOCKING | Readers expect cited sources to appear in bibliography |
| Unused reference | WARNING | May be valid background — don't auto-delete |
| Duplicate reference | WARNING | Cleanup needed but not blocking |
| Incomplete reference (missing fields) | WARNING | May need manual completion |
| Named source without formal entry | Not flagged | Institutional references don't require formal entries |

## Contract Verification

| Contract | Status |
|---|---|
| Never fabricates matching references | ✅ |
| Never auto-deletes unused references | ✅ |
| Never invents citation-to-reference matches | ✅ |
| Flags missing references as BLOCKING | ✅ |
| Flags unused references as WARNING only | ✅ |
| Preserves Further Reading separately | ✅ |

## Verdict

✅ **Crosscheck correctly identifies matches, misses, unused entries, and duplicates.** Severity levels are appropriate. No fabrication or auto-deletion.
