# Live App-Path Export Proof — Procedure

## Objective
Prove the production-wired global UBS polish pipeline works on a real live export, not just isolated tests.

## Input
| Field | Value |
|---|---|
| **DOCX** | `digital-equity-tribunal (9).docx` |
| **Size** | 180,559 bytes |
| **Extracted text** | 434,153 chars |
| **Chapters parsed** | 20 |

## Procedure

1. **Extract** DOCX text via mammoth (same library used in app)
2. **Resolve profile** via `getPolishProfileForProject()` using generic project metadata
3. **Run polish trace** — same code path as `handleManuscriptPolish()`:
   - Pre-polish safety gate (`runManuscriptSafetyGate`)
   - Dialogue issue detection (`detectDialogueQuoteIssues`)
   - Profile-aware dialogue repair (`shouldRunDialogueRepair` → `runDialogueMechanicsPass`)
   - Profile-aware AI-slop reduction (`shouldRunAISlopReduction` → `runAISlopReductionPass`)
4. **Run export trace** — same code path as `buildResolvedExportChapters()`:
   - Stale URL check
   - Pre-export surface dialogue repair
   - Pre-export safety gate (`runPreExportSafetyGate`)
   - ALLOW_UNSAFE_EXPORT override check
5. **Scan final DOCX** for hard failures:
   - Missing dialogue quotes
   - Process/editorial leakage
   - Contamination
   - Malformed grammar
   - AI-slop patterns (warning-only)
6. **Verify chapter integrity** (20 chapters, correct order)
7. **Run regression lock** (`npm run test:polish-pipeline`)

## Constraints
- No chapters rewritten or regenerated
- No DET-specific hardcoding used
- No smoke-test recast maps in runtime
- No safety gates weakened
- No stale URL blocking disabled
- No unsafe export override used
