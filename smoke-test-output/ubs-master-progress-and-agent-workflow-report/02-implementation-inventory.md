# UBS Implementation Inventory

## Core Safety Modules

| File | Size | Purpose | Production-Wired? | Test Coverage |
|---|---|---|---|---|
| `manuscriptSafetyGate.js` | 23KB | Process leak, contamination, malformed grammar detection | ✅ Yes | 33 assertions |
| `exportSafetyGate.js` | 10KB | Dialogue issue + slop density warnings for export | ✅ Yes | 25 assertions |
| `contaminationDetector.js` | 15KB | Training data contamination patterns | ✅ Yes (via safety gate) | Via safety gate |

## Polish Pipeline Modules

| File | Size | Purpose | Production-Wired? | Test Coverage |
|---|---|---|---|---|
| `polishPipelineConfig.js` | 11KB | Profile routing: 6 genre profiles | ✅ Yes | 66 assertions |
| `dialogueMechanicsRepair.js` | 34KB | Missing quote detection + auto-repair | ✅ Yes | 86 assertions |
| `aiSlopReduction.js` | 29KB | AI cliché detection and removal | ✅ Yes | 24 assertions |
| `llmSentenceRecast.js` | 5KB | Deterministic sentence recasting (NOT an LLM call) | ✅ Yes | Via pipeline |
| `llmProsePolisher.js` | 12KB | LLM prose polish orchestrator | ✅ Yes | 13 assertions |
| `prosePolishQualityGate.js` | 17KB | Post-polish quality scoring | ✅ Yes | 15 assertions |
| `punctuationPolish.js` | 35KB | Deterministic punctuation cleanup | ✅ Yes | Via pipeline |
| `nonfictionPolish.js` | 41KB | Nonfiction-specific polish | ✅ Yes | Via workflow |

## Chapter Management

| File | Size | Purpose | Production-Wired? | Test Coverage |
|---|---|---|---|---|
| `safeChapterReplace.js` | 12KB | Safe content replacement + verification | ✅ Yes | 67 assertions |
| `chapterStorage.js` | 23KB | Chapter CRUD, URL resolution | ✅ Yes | Via workflow |
| `richContentStorage.js` | 9KB | Rich HTML content resolver | ✅ Yes | Via export |
| `exportVersionSafety.js` | 14KB | Stale URL detection/blocking | ✅ Yes | Via workflow |

## Reference & Research

| File | Size | Purpose | Production-Wired? | Test Coverage |
|---|---|---|---|---|
| `referenceIntegrityGate.js` | 38KB | Citation crosscheck, formatting, suspicious refs | ❌ Not wired | 155 assertions |
| `bibliographyGenerator.js` | 30KB | Bibliography generation | ✅ Yes | Via smoke |
| `fictionResearch.js` | 18KB | Fiction plausibility research | ✅ Yes | 69 assertions |
| `researchStorage.js` | 3KB | Research data persistence | ✅ Yes | Via research |

## Agent/Model Infrastructure

| File | Size | Purpose | Production-Wired? |
|---|---|---|---|
| `localLLM.js` | 5KB | Ollama API client, 5 agent roles | ✅ Yes |
| `writingModel.js` | 2KB | Model resolution + policy | ✅ Yes |
| `modelRouting.js` | 6KB | Alias mapping, fallback controls | ✅ Yes |
| `integrationRetry.js` | 8KB | Retry wrapper with JSON salvage | ✅ Yes |

## Module Count

| Category | Count |
|---|---|
| Total src/lib/ files | 127 |
| Core safety modules | 3 |
| Polish pipeline modules | 8 |
| Chapter management | 4 |
| Reference & research | 4 |
| Agent/model infra | 4 |
| Deterministic polish modules | 12+ |
| Major UI components | 3 |
