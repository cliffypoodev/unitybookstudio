# Current Project Profile Resolution

## Project Metadata
| Field | Value | Source | Status |
|---|---|---|---|
| title | Digital Equity Tribunal | project.title | ✅ |
| genre | fiction | project.genre | ✅ |
| type | novel | project.type | ✅ |
| project_type | anthology | project.project_type | ✅ |
| book_type | fiction | project.book_type | ✅ |

## Profile Resolution
| Field | Value | Source | Status |
|---|---|---|---|
| Resolved profile | **fiction** | `_resolveProfileKey({ genre: 'fiction' })` → direct match | ✅ |
| Polish intensity | **high** | `getAllowedPolishIntensity()` | ✅ |
| Dialogue repair enabled? | **true** | `shouldRunDialogueRepair()` — fiction profile → always true | ✅ |
| AI-slop reduction enabled? | **true** | `shouldRunAISlopReduction()` — slopReduction = 'high' ≠ 'conservative' | ✅ |
| LLM sentence recast enabled? | **true** | `shouldRunLLMSentenceRecast()` — profile allows + model available | ✅ |
| Slop budget (per chapter) | **20** | `getSlopBudgetsForProject()` → high intensity | ✅ |
| Slop budget (per paragraph) | **5** | `getSlopBudgetsForProject()` → high intensity | ✅ |
| Hard safety | **true** | `getSafetyThresholdsForProject()` — always true | ✅ |
| Block unsafe rewrites | **true** | `getSafetyThresholdsForProject()` — always true | ✅ |

## Key Verification
| Check | Result |
|---|---|
| Profile resolved from generic metadata (genre='fiction')? | ✅ Yes — no title matching |
| Profile resolved without DET-specific code? | ✅ Yes — `_resolveProfileKey` uses genre/type only |
| Would resolve same for any fiction project? | ✅ Yes — any project with genre='fiction' gets same profile |
| Hard safety always on regardless of profile? | ✅ Yes — getSafetyThresholdsForProject returns hardSafety=true unconditionally |
