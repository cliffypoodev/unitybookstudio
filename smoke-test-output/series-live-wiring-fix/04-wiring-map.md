# 04 — Series Pipeline Wiring Map

## Data Flow: Series Canon → Prompt → Gate

```
┌─────────────────────────────────────────────────┐
│  SeriesBible Entity (base44)                    │
│  ├── deaths_and_losses                          │
│  ├── resolved_threads                           │
│  ├── world_state                                │
│  ├── last_book_ending                           │
│  ├── voice_profile                              │
│  ├── rules_and_systems                          │
│  └── tone_and_themes                            │
└────────────┬────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────┐
│  getSeriesContinuity(project)                   │
│  [sceneWriter.js]                               │
│  ├── Loads SeriesBible by project.series_bible_id│
│  ├── Checks project.series_flavor               │
│  ├── continuation → buildSeriesContinuityBlock  │
│  ├── standalone → light world/voice only        │
│  └── anthology_volume → shared theme only       │
└────────────┬────────────────────────────────────┘
             │ seriesContinuityBlock
             ▼
┌─────────────────────────────────────────────────┐
│  NovelProject Fields                            │
│  ├── entry_contract_json                        │
│  ├── exit_contract_json                         │
│  ├── series_number                              │
│  └── series_flavor                              │
└────────────┬────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────┐
│  getVolumeContractBlock(project, chapter)       │
│  [sceneWriter.js]                               │
│  ├── Parses entry/exit contracts                │
│  ├── Respects series_flavor                     │
│  └── Calls buildVolumeContractBlock(...)        │
└────────────┬────────────────────────────────────┘
             │ volumeContractBlock
             ▼
┌─────────────────────────────────────────────────┐
│  Promise.all (generateChapterSceneByScene)      │
│  ├── getProjectResearchText                     │
│  ├── getSeriesContinuity ──→ seriesContinuityBlock │
│  ├── getVolumeContractBlock ──→ volumeContractBlock│
│  ├── getAuthorStyleBlock                        │
│  ├── getChapterContinuity                       │
│  ├── getPriorChapterSummaries                   │
│  └── getTwistBlock                              │
└────────────┬────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────┐
│  buildFictionPrompt(...)                        │
│  Prompt array includes:                         │
│  ├── ... (setup, genre, pov, etc.)              │
│  ├── seriesContinuityBlock   ◀── canon          │
│  ├── volumeContractBlock     ◀── contracts      │
│  ├── anthologyContext                           │
│  └── ... (craft rules, output rules)            │
└────────────┬────────────────────────────────────┘
             │ prompt
             ▼
┌─────────────────────────────────────────────────┐
│  generateSceneWithRepair → LLM call             │
│  ├── Prose generated scene by scene             │
│  ├── Duplicate/restart repair                   │
│  └── Scene-level content guard                  │
└────────────┬────────────────────────────────────┘
             │ finalProse
             ▼
┌─────────────────────────────────────────────────┐
│  POST-GENERATION SERIES CONTRACT GATE           │
│  [sceneWriter.js]                               │
│  ├── Loads SeriesBible                          │
│  ├── Runs runSeriesContractGate(finalProse,...) │
│  ├── Logs BLOCK/WARNING with [SERIES-GATE]      │
│  ├── Stores at window.__UBS_LAST_SERIES_..      │
│  └── Does NOT throw (export gate handles)       │
└────────────┬────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────┐
│  EXPORT SAFETY GATE (pre-export)                │
│  [exportSafetyGate.js → ExportTab.jsx]          │
│  ├── Process leaks                              │
│  ├── Contamination                              │
│  ├── Dialogue issues                            │
│  ├── Reference integrity                        │
│  ├── SERIES CONTRACT GATE ◀── NEW               │
│  │   ├── Loads SeriesBible + contracts           │
│  │   ├── continuation: BLOCK → hard failure     │
│  │   └── all: WARNING → non-blocking            │
│  └── Stores at window.__UBS_LAST_EXPORT_...     │
└────────────────────────────────────────────────┘
```

## File → Function Mapping

| File | Function | Role |
|------|----------|------|
| `seriesBible.js` | `buildSeriesContinuityBlock(seriesBible, n)` | Builds canon text block from SeriesBible |
| `volumeBible.js` | `buildVolumeContractBlock(entry, exit, ch, total)` | Builds position-aware contract block |
| `seriesContractGate.js` | `runSeriesContractGate(text, project, bible, ...)` | Validates prose against canon |
| `sceneWriter.js` | `getSeriesContinuity(project)` | Loads bible, selects flavor strategy |
| `sceneWriter.js` | `getVolumeContractBlock(project, chapter)` | Loads contracts, selects flavor strategy |
| `sceneWriter.js` | `generateChapterSceneByScene(...)` | Orchestrates Promise.all + gate |
| `sceneWriter.js` | `generateSingleScene(...)` | Same wiring for single-scene path |
| `exportSafetyGate.js` | `runPreExportSafetyGate(chapters, options)` | Async full-manuscript gate |
| `ExportTab.jsx` | `buildResolvedExportChapters(...)` | Calls safety gate before export |
