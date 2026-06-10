# App UI Pipeline Map

## PIPELINE A: Rewrite All / Full Pipeline Rewrite

Entry: ProjectStudio.jsx → triggers sceneWriter.js or draft pipeline
LLM model: ghostwriter (local) or configured model
Each chapter calls: localLLM.js → Ollama

### Chain:
1. **UI button** → triggers batch draft/rewrite
2. **sceneWriter** generates prose from outlines/beats
3. **cleanGeneratedProse** (if called) → basic text normalization
4. **Save** → chapter.content_md or chapter.content field

### Safety features PRESENT:
- Basic prose generation prompt (tells LLM to write fiction)

### Safety features ABSENT:
- ❌ No process-leak detection
- ❌ No contamination guard
- ❌ No quality gate before save
- ❌ No reject/regenerate for bad output
- ❌ No post-generation validation

---

## PIPELINE B: Fix/Polish All (fixEntireManuscript)

Entry: `fixEntireManuscript()` in manuscriptFixer.js (line 7646)

### Chain (in order):
1. `loadDraftedBodyChapters()` — reads chapter content
2. `runDiagnosticKnowledgePass()` — generates per-chapter diagnostics
3. `runStructuralCollisionQuarantinePass()` — removes duplicate branches
4. `runGenericBranchCollisionPass()` — removes generic branch collisions
5. `runUniversalChapterCleanup()` — runs postDraftCleanup per chapter
   - **runLLM: false** — LLM copyedit is DISABLED
   - Only runs: regexCleanup, runFinalHygiene, runMicroCopyeditRepairs, runFinalHardSurvivorRepairs, runSurgicalArtifactRepair, runTargetedMalformedSentenceRepair
6. `runDeterministicWholeManuscriptPasses()`:
   - punctuation cleanup
   - spelling fixes
   - capitalization hygiene
   - dialogue punctuation fix
   - dialogue filler fix
   - dialogue tag caps
   - collapsed dialogue fragment repair
   - transition word caps
   - ChatGPT vocabulary caps
   - stacked clause variation
   - voice pattern cleanup (fixVoicePatterns)
   - external AI pattern cleanup
   - anti-detection polish (DISABLED — diagnostic only)
   - vocabulary caps (runVocabCaps)
   - sentence starter variation (DISABLED — diagnostic only)
   - AI detection resistance (DISABLED — diagnostic only)
   - broken sentence fixes
   - coping mechanism caps
   - hanging quote fixes (fixHangingQuotes)
7. `runAnthologySpecificPasses()`:
   - cross-chapter body-language dedup
   - anthology vocabulary bans (replaces: beacon→signal, profound→deep, cathedral→room, architecture→structure, etc.)
   - **contamination detector** — DIAGNOSTIC ONLY (line 691-762 in anthologyPolishChecks.js)
     - Only checks character names from other projects
     - Does NOT check business/org terms like "Unity Supported Living"
     - Does NOT delete or reject anything
     - FLAG ONLY, no removal
8. `runVoicePreservationAudit()` — LLM voice audit
9. `runStructuralCollisionQuarantinePass()` (pre-save)
10. `runGenericBranchCollisionPass()` (pre-save)
11. `runHardForbiddenPipelineArtifactSweep()` (×3 runs)
    - Only checks 4 specific internal phrases ("The false start collapsed...")
    - Does NOT check process-leak phrases
12. `runFinalSaveGateSurvivorSweep()`
13. `runFinalGrammarIntegrityGate()`
14. `runFinalStructuralRescuePass()`
15. `runNonfictionManuscriptIntegrityGate()`
16. `enforceExactFinalLine()` — per chapter
17. `saveChangedChapters()` — saves to DB
18. `verifySavedChapters()` — verifies saved content

### Safety features PRESENT:
- ✅ Structural collision quarantine
- ✅ Branch collision detection
- ✅ Voice preservation audit (LLM)
- ✅ Grammar integrity gate
- ✅ Exact final line enforcement
- ✅ Internal pipeline artifact removal (4 specific phrases)
- ✅ Malformed sentence repair
- ✅ Save verification

### Safety features ABSENT:
- ❌ **NO process-leak detection** (no check for "Action Plan:", "Best Next Move", "Analysis & Strengths", etc.)
- ❌ **NO process-leak rejection** (chapters with process leakage pass through unchanged)
- ❌ **NO contamination guard for org/business terms** (only character-name cross-check)
- ❌ **NO hard reject for contamination** (diagnostic-only, flag-only)
- ❌ **NO targeted regeneration** of rejected chapters
- ❌ **NO pre-save quality gate** that would catch process-leaked chapters

---

## PIPELINE C: Export / DOCX

Entry: ExportTab.jsx → export handler
Content resolution: chapterStorage.js → resolveChapterContent()

### Content field precedence:
1. `chapter.__polishedContent` (if set by manuscriptFixer)
2. `chapter.content_md` (raw content)
3. `chapter.content_md_url` → fetch from URL
4. `chapter.content` (fallback)

### Safety features ABSENT:
- ❌ No export-time quality gate
- ❌ No export-time process-leak scan
- ❌ No export-time contamination scan
