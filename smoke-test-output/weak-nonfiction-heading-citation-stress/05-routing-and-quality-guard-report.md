# Routing and Quality Guard Report

**Pipeline:** recast v4
**Date:** 2026-06-09

---

## Routing Decision

| Parameter | Value | Status |
|---|---|---|
| Model selected | prose-recast-polisher | ✅ Correct |
| Routing reason | nonfiction_authority | ✅ Correct |
| Temperature | 0.4 (conservative) | ✅ Correct |

The pipeline correctly identified the input as nonfiction and routed to `prose-recast-polisher` with the `nonfiction_authority` reason. Temperature 0.4 is the conservative setting appropriate for nonfiction, where factual accuracy and structural preservation take priority over stylistic transformation.

---

## Weakness Detection

| Weakness | Detected | Status |
|---|---|---|
| `filter_verb_heavy` | ✅ Yes | Correct — 18 filter verbs at 27.6/1K density |
| `essay_bot_transitions` | ✅ Yes | Correct — 10 essay-bot transitions |
| `heading_bearing` | ✅ Yes | Correct — 4 markdown headings |

All three weaknesses were correctly identified. The weakness detection feeds into both the recast prompt (telling the model what to fix) and the safety gates (informing which post-recast checks to run).

---

## Quality Guard: Word-Count Compression Block

This is the critical safety event of the stress test.

### What Happened

In Run 2, Chunk 1 passed the citation gate (no citations) and passed the score threshold (score < 80). It was sent to `prose-recast-polisher` for recast.

The model returned **158 words** against an expected output of **~350 words**.

| Metric | Value |
|---|---|
| Input word count | ~350 |
| Output word count | 158 |
| Compression ratio | ~45% of original |
| Safety threshold | Triggered |
| Action taken | Output blocked, original preserved |

### Why This Is Correct

A 55% word-count reduction in nonfiction recast is not editing—it is summarization. The pipeline's word-count compression gate exists specifically to catch this failure mode. When the output is significantly shorter than the input, content has been lost. The gate blocks the output and preserves the original.

### The Model's Behavior

The `prose-recast-polisher` model at temperature 0.4 compressed the nonfiction input too aggressively. This is a **model quality issue**, not a pipeline bug. The model was given text with headings, technical content, and multiple paragraphs, and it condensed them into a fraction of the original length.

> [!NOTE]
> This compression tendency is specific to nonfiction at conservative temperature. The same model produces appropriate-length output for thriller and literary fiction. Nonfiction's information density may be triggering summarization behavior in the model.

### Pipeline Response

The pipeline's response was exactly correct:

1. Detected the compression via word-count ratio check
2. Blocked the compressed output
3. Preserved the original text unchanged
4. Logged the event as a safety block

No human intervention was needed. No damaged text reached the output.

---

## Safety Gate Sequence (Run 2, Chunk 1)

```
Chunk 1 input (~350 words)
  │
  ├─ Citation gate: PASS (no citations)
  ├─ Score threshold: PASS (score < 80)
  ├─ Routed to: prose-recast-polisher (nonfiction_authority, temp 0.4)
  ├─ Model output: 158 words
  ├─ Word-count compression gate: BLOCKED ← triggered here
  ├─ Heading gate: not reached
  └─ Result: original preserved
```

---

## Summary

The routing and quality guard system performed correctly:

- **Routing:** Right model, right reason, right temperature
- **Weakness detection:** All three weaknesses identified
- **Quality guard:** Caught aggressive compression and preserved original
- **No damage:** Original text survived intact
