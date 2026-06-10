# UBS Risk, Gap, and Next Actions Report

## Technical Risks

| Risk | Severity | Recommendation |
|---|---|---|
| Reference integrity gate not wired | Medium | Wire `runReferenceIntegrityGate()` into nonfiction polish/export |
| No live Ollama integration tests | Medium | Add smoke test calling `checkOllamaHealth()` |
| DOCX export strips URLs | Low | Document as known limitation |
| ResearchSubPage always fiction engine | Medium | Add `book_type` check for routing |
| 20-minute Ollama timeout | Low | Add progress indicator + cancel |
| JSON salvage may mask errors | Low | Log salvage events prominently |

## Product/UX Risks

| Risk | Severity | Recommendation |
|---|---|---|
| No user explanation of export blocks | Medium | Add tooltip/modal for block reasons |
| Debug button in ResearchSubPage | Low | Remove or gate behind dev mode |
| `alert()` used for debug info | Low | Replace with `toast.info()` |
| No undo for safe chapter replace | Medium | Add confirmation dialog |

## Agent/Model Risks

| Risk | Severity | Recommendation |
|---|---|---|
| All 5 models must be manually loaded | Medium | Add startup health check |
| No model version pinning | Medium | Add model fingerprint tracking |
| Fallbacks fully disabled | Medium | Consider graceful degradation |
| No model performance monitoring | Low | Add generation time tracking |

## Investigation Results

| Question | Answer |
|---|---|
| All agents using intended model? | ✅ Yes — `resolveAgent()` maps correctly |
| Silent fallback to weaker models? | ✅ No — fallbacks disabled |
| Model names hardcoded? | ⚠️ In `localLLM.js AGENT_MODELS`, not env vars |
| Fiction research = plausibility? | ✅ Yes |
| Nonfiction research = deep research? | ✅ Yes |
| Bibliography system implemented? | ✅ Implemented + tested, not wired |
| Style controls tested? | ✅ 271 assertions |
| Debug globals exposed? | ⚠️ ResearchSubPage has debug button |
