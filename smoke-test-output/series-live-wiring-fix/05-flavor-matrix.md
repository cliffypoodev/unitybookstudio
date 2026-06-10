# 05 — Series Flavor Behavior Matrix

## Flavor Definitions

| Flavor | When Used | Example |
|--------|-----------|----------|
| `continuation` | True sequel — same characters, ongoing plot | Book 2 of a trilogy |
| `standalone` | Same world, different protagonist, own plot | Spin-off novel |
| `anthology_volume` | Shared theme collection, no character overlap | Anthology series |
| *(none)* | Not a series-linked project | Any standalone novel |

## Prompt Injection Matrix

| Feature | continuation | standalone | anthology_volume | non-series |
|---------|:---:|:---:|:---:|:---:|
| SeriesBible loaded | ✅ | ✅ | ✅ | ❌ |
| Deaths (DEAD — do NOT resurrect) | ✅ strict | ❌ | ❌ | ❌ |
| Resolved threads (CLOSED) | ✅ strict | ❌ | ❌ | ❌ |
| World state | ✅ | ✅ | ❌ | ❌ |
| Last book ending | ✅ | ❌ | ❌ | ❌ |
| Voice profile | ✅ | ✅ | ✅ (as tone) | ❌ |
| Rules and systems | ✅ | ✅ | ✅ | ❌ |
| Tone and themes | ✅ (embedded) | ✅ (embedded) | ✅ (primary) | ❌ |
| "Not bound by prev characters" | ❌ | ✅ | ✅ | N/A |
| "Do NOT reuse protagonists" | ❌ | ❌ | ✅ | N/A |
| Entry contract block | ✅ strict | ✅ light | ❌ | ❌ |
| Exit contract block | ✅ strict | ✅ light (optional) | ❌ | ❌ |
| Position-aware guidance | ✅ | ❌ | ❌ | ❌ |

## Post-Generation Gate Matrix

| Feature | continuation | standalone | anthology_volume | non-series |
|---------|:---:|:---:|:---:|:---:|
| Series gate runs | ✅ | ✅ | ✅ | ❌ |
| Dead character BLOCK | ✅ hard error | ⚠️ warning | ⚠️ warning | N/A |
| Resolved thread BLOCK | ✅ hard error | ⚠️ warning | ⚠️ warning | N/A |
| World rule BLOCK | ✅ hard error | ⚠️ warning | ⚠️ warning | N/A |
| Report stored | ✅ | ✅ | ✅ | ❌ |
| Throws/blocks draft | ❌ (warn only) | ❌ | ❌ | N/A |

## Export Gate Matrix

| Feature | continuation | standalone | anthology_volume | non-series |
|---------|:---:|:---:|:---:|:---:|
| Series gate runs | ✅ | ✅ | ✅ | ❌ |
| BLOCK → hard failure | ✅ export blocked | ⚠️ warning only | ⚠️ warning only | N/A |
| WARNING → warning | ✅ | ✅ | ✅ | N/A |
| Report stored | ✅ | ✅ | ✅ | ❌ |

## Design Rationale

1. **continuation** gets the strictest treatment because readers expect consistency across books.
2. **standalone** gets world rules but no character obligations because spin-offs need creative freedom.
3. **anthology_volume** gets only shared theme/rules because each volume has its own protagonist.
4. Post-generation does NOT throw because heuristic text-matching could produce false positives during generation. The Export gate provides the hard stop.
5. The Export gate IS the enforcement point because it's the last step before the reader sees the manuscript.
