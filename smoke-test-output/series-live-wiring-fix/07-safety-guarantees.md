# 07 — Safety Guarantees

## What Was NOT Changed

1. **No safety gates were weakened.** All existing guards (manuscript safety, contamination, dialogue, reference integrity) remain unchanged.
2. **No stale URL blocking was disabled.** The stale content resolution check in `buildResolvedExportChapters` is untouched.
3. **No unsafe export override was used.** `ALLOW_UNSAFE_EXPORT` behavior is unchanged.
4. **No existing series data was broken.** The SeriesBible entity schema is unchanged. Only the *loading* code was fixed.
5. **No hardcoded series/project.** All code uses `project.series_bible_id` dynamically.
6. **No standalone mode bypass.** For `standalone` and `anthology_volume` flavors, the gate explicitly adjusts severity (warnings instead of blocks) but still runs.
7. **No anthology contamination bleed.** Anthology volumes get shared theme only, no character obligations, and explicit protagonist-reuse prohibition.
8. **No silent contradictions allowed.** Dead characters, resolved threads, and world rules are checked at both generation time (warning) and export time (block for continuation).

## New Safety Layers

| Layer | Location | Severity | When |
|-------|----------|----------|------|
| Series continuity prompt | sceneWriter.js (buildFictionPrompt) | Preventive | During generation |
| Volume contract prompt | sceneWriter.js (buildFictionPrompt) | Preventive | During generation |
| Post-gen contract gate | sceneWriter.js (after validateProjectChapterContent) | Diagnostic (warn) | After each chapter |
| Export contract gate | exportSafetyGate.js (runPreExportSafetyGate) | Enforcement (block) | Before export |

## Inspection Points

| Window Variable | Set By | Contains |
|----------------|--------|----------|
| `__UBS_LAST_SERIES_CONTRACT_REPORT` | Post-gen gate in sceneWriter.js | Per-chapter series violation report |
| `__UBS_LAST_EXPORT_SERIES_REPORT` | Export gate in exportSafetyGate.js | Full-manuscript series violation report |
| `__UBS_LAST_SAFETY_REPORT` | Export gate (existing) | Complete export safety report (now includes `seriesReport`) |

## User Directives Compliance

| Directive | Status |
|-----------|--------|
| Do not weaken safety gates | ✅ Compliant |
| Do not disable stale URL blocking | ✅ Compliant |
| Do not use unsafe export override | ✅ Compliant |
| Do not break existing series data | ✅ Compliant |
| Do not hardcode one series/project | ✅ Compliant |
| Do not make series continuity optional for linked volumes | ✅ Compliant |
| Do not let anthology contamination bleed | ✅ Compliant |
| Do not allow dead characters/resolved threads contradicted silently | ✅ Compliant |
| Do not refactor SeriesManager.jsx | ✅ Compliant |
| Do not redesign the whole canon model | ✅ Compliant |
