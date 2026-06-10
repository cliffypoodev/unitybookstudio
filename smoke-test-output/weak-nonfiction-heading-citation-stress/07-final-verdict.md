# Final Verdict

**Pipeline:** recast v4
**Date:** 2026-06-09

---

## Verdict: PASS WITH NOTES

---

## Why Not FINAL PASS

1. **No chunk was successfully recast and improved.** All chunks were correctly skipped or safety-blocked. The pipeline's improvement capability on weak nonfiction is not proven by this test.

2. **The heading preservation gate was not exercised live.** The word-count compression gate triggered first, preventing the heading gate from being reached. The heading gate is proven by 15 unit tests but not by a live recast event.

3. **The literary anti-flattening guard was not exercised.** This is a nonfiction test. The anti-flattening guard is designed for literary prose and was correctly not invoked.

4. **The model compressed too aggressively when forced to recast.** `prose-recast-polisher` at temperature 0.4 produced 158 words from a ~350-word input. This is a model quality issue, not a pipeline bug.

---

## What PASSED

| # | Check | Status |
|---|---|---|
| 1 | Citation protection correctly blocked citation-bearing chunks | ✅ |
| 2 | Score threshold correctly skipped above-threshold chunks | ✅ |
| 3 | Word-count compression safety gate correctly blocked bad recast | ✅ |
| 4 | Routing correctly chose prose-recast-polisher for nonfiction | ✅ |
| 5 | Weakness detection correctly identified filter_verb_heavy, essay_bot_transitions, heading_bearing | ✅ |
| 6 | All headings preserved (4→4) | ✅ |
| 7 | All citations preserved (3→3) | ✅ |
| 8 | No invented claims | ✅ |
| 9 | No fake literary dramatization | ✅ |
| 10 | All 846+ tests pass | ✅ |
| 11 | Build clean | ✅ |
| 12 | Defense-in-depth demonstrated: multiple safety layers working correctly | ✅ |

---

## Honest Assessment

### What Is Proven

The pipeline's **safety infrastructure** is proven. Five independent safety layers were exercised across two runs:

- **Citation protection gate** — blocked citation-bearing chunks in both runs
- **Score threshold gate** — blocked above-threshold chunks in Run 1
- **Word-count compression gate** — blocked model-compressed output in Run 2
- **Routing logic** — selected correct model, reason, and temperature
- **Weakness detection** — identified all three weakness categories

These layers work independently and in sequence. No single point of failure exists. A chunk must pass every gate to be accepted as a recast.

### What Is NOT Proven

The pipeline's **improvement capability on weak nonfiction** is not proven by this test. No chunk was actually improved. The pipeline correctly determined that every available recast would cause damage, and it blocked them all.

This is the right behavior—but it means we have not seen a successful nonfiction recast under pressure.

### The Model Issue

The `prose-recast-polisher` model at temperature 0.4 compresses nonfiction too aggressively. When forced to recast a ~350-word nonfiction chunk, it produced only 158 words—a 55% reduction. This is summarization, not recasting.

This behavior is specific to nonfiction. The same model produces appropriate-length output for thriller and literary fiction (demonstrated in the v4 bakeoff with +2 and +4 score improvements respectively).

The compression tendency is a **model-training issue**, not a pipeline bug. The pipeline correctly detected and blocked the compressed output.

---

## For FINAL PASS

One of the following would close the remaining gap:

**(a)** A model that can recast nonfiction without compressing — either a tuned version of `prose-recast-polisher` or a different model for nonfiction authority tasks.

**(b)** A nonfiction sample that naturally triggers recast and produces an improved result — a sample with a lower composite score where the model happens to produce good output.

Either path would demonstrate successful nonfiction improvement end-to-end.

---

## Recommendation

> [!IMPORTANT]
> **Accept v4 as the production pipeline.** Safety is proven. Improvement is demonstrated on thriller (+2) and literary (+4) from the v4 bakeoff. Nonfiction safety is proven by this stress test.

### Rationale

1. The pipeline **correctly blocks all damage** to nonfiction. This is the right behavior. A pipeline that damages nonfiction is worse than one that preserves it unchanged.

2. Nonfiction improvement was never promised as a v4 deliverable. The v4 scope was safety infrastructure and genre-aware routing. Both are proven.

3. The model compression behavior is a **model-training issue** that can be addressed independently of pipeline development.

### Next Steps

- **Consider a `prose-recast-polisher` modelfile tuning iteration** to reduce compression tendency on nonfiction inputs. The model needs to maintain input length when recasting information-dense prose.
- **Nonfiction improvement** can be pursued as a follow-up iteration once the model behavior is addressed.
- **The heading gate** should be exercised live in a future test with a model that produces heading-complete-length but heading-reduced output.
