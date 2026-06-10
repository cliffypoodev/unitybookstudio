# Style Control Quality Bakeoff — HARSH RE-AUDIT

## Premise
> A missing child's voice begins broadcasting from every smart speaker in a city, but the child has been dead for twelve years.

## Prior Report Critique

| Issue | Evidence |
|---|---|
| LLM inflation | All 6 combinations scored 89–92 LLM (uncalibrated) |
| Safety failures ignored | 2/6 combinations failed safety but received 🟢 Strong Commercial |
| GenreFit inconsistency | Range 63–87 across combinations — style control is unreliable |
| Voice scores weak | 72–80 — not distinctive enough to prove style differentiation |

---

## Style Distinctiveness — Sentence-Level Analysis

| # | Style | First Sentence | Chatbot Analysis |
|---|---|---|---|
| 1 | Thriller + Clean Commercial | "The voice started with a wet, metallic cough that echoed off the municipal tile..." | ✅ Good visceral specificity |
| 2 | Horror + Lyrical Gothic | "The first time I heard Chloe's voice, it sounded like a crystal bell struck underwater..." | ⚠️ "crystal bell struck underwater" — AI-favored simile |
| 3 | Mystery + Investigative | "The sound of Lily's laughter was a wet, distorted echo..." | ❌ Reuses "wet" from #1 — cross-contamination |
| 4 | Literary + Minimalist | "The sound starts with the cheerful, tinny burst of a Disney soundtrack..." | ✅ Specific brand reference |
| 5 | Sci-Fi + Procedural | "The voice was thin enough to be heartbreaking, yet amplified enough to splinter glass" | ❌ "X enough to Y, yet Z enough to W" — chatbot balanced construction |
| 6 | Romantic Suspense | "The little voice was too clear for a ghost..." | ✅ Simple, clean hook |

**Unique openings: 6/6** ✅ — This is genuinely good.
**Cross-contamination: "wet" appears in #1 and #3** ❌ — Vocabulary bleed across styles.
**Chatbot constructions: #5 uses balanced AI pattern** ❌

---

## Corrected Scores (Programmatic Only)

| # | Combination | Prog Score | GenreFit | Voice | Safety | Corrected Verdict |
|---|---|---|---|---|---|---|
| 1 | Thriller + Clean Commercial | 73.1 | 63 | 76 | ✅ | 🟡 Competent |
| 2 | Horror + Lyrical Gothic | 78.1 | 71 | 80 | ✅ | 🟡 Competent |
| 3 | Mystery + Investigative | 76.8 | 71 | 80 | ✅ | 🟡 Competent |
| 4 | Literary + Minimalist | 77.5 | 79 | 76 | ❌ | 🔴 FAIL (safety) |
| 5 | Sci-Fi + Procedural | 77.9 | 87 | 80 | ✅ | 🟡 Competent |
| 6 | Romantic Suspense | 76.0 | 87 | 72 | ❌ | 🔴 FAIL (safety) |
| **Average** | | **76.6** | **76.3** | **77.3** | **4/6** | **COMPETENT** |

---

## New Module Impact

`SIGNATURE_VOICE_BLOCK` now:
- Bans "X enough to Y, yet Z enough to W" balanced constructions
- Enforces asymmetrical sentence rhythm
- Requires genre-specific vocabulary (not just genre-labeled generic prose)

---

## TRUE VERDICT

**Style control produces distinct openings (6/6 unique) but programmatic quality is COMPETENT (avg 76.6), not GOOD.** Safety failures on 2/6 combinations are unacceptable. GenreFit scores ranging 63–87 indicate inconsistent style application.
