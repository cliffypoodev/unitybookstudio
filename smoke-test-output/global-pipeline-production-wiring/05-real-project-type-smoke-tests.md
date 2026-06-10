# Real Project-Type Smoke Tests

## Test Results

| Project | Profile | Polish Result | Export Result | Safety Result | Status |
|---|---|---|---|---|---|
| Fiction Novel | fiction (high) | Dialogue: 4→0, Slop: detected+reduced | Export gate: PASS | Safety gate: PASS | ✅ |
| Nonfiction Investigative | nonfiction (medium) | No dialogue (auto-detect skip), Slop: on | N/A | Safety gate: PASS | ✅ |
| Training Manual | training_manual (low) | No dialogue, LLM recast disabled | N/A | Safety gate: PASS (compliance terms ok) | ✅ |
| Business Guide | business_guide (medium) | No dialogue, LLM recast disabled | N/A | Safety gate: PASS | ✅ |
| Memoir | memoir (medium) | Dialogue auto-detected: 1→0, LLM recast enabled | N/A | Safety gate: PASS | ✅ |
| Unknown/Legacy | unknown (low) | Slop reduction: OFF (conservative), LLM: disabled | N/A | Safety gate: PASS, hard safety on | ✅ |
| Corrupted Project | fiction (hard block) | N/A (blocked) | Export gate: BLOCKED | Safety gate: BLOCKED (process leaks + contamination + malformed) | ✅ |

## Detailed Fixture Summary

- **Fiction Novel**: Sarah/Kovacs/Jackson/Reyes characters work without DET names. 4 missing opening quotes detected and repaired to 0. Slop patterns detected. Export gate passes after repair.
- **Nonfiction**: shouldRunDialogueRepair returns false (no dialogue verbs/quotes). Slop reduction still runs. Compliance language not falsely flagged.
- **Training Manual**: shouldRunLLMSentenceRecast returns false. Preserve-structure profile active. Compliance terms (documentation, incidents) not flagged as contamination.
- **Business Guide**: Business terms (KPIs, churn, A/B) allowed. Structure preserved.
- **Memoir**: First-person "felt" patterns detected. Dialogue auto-detected from Mom's speech. Missing opening quote repaired.
- **Unknown/Legacy**: Conservative defaults. Slop reduction OFF. LLM recast OFF. Hard safety always on.
- **Corrupted**: Process leaks ("Action Plan:"), contamination ("Unity Supported Living Services"), malformed grammar all detected. REJECT_REGENERATE. Export hard-blocked.

## Total: 143 smoke tests — ALL PASS ✅
