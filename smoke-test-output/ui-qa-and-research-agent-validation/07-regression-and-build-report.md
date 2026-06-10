# Regression and Build Report

## Full Pipeline Regression

| Suite | Tests | Failed | Status |
|---|---|---|---|
| Production Wiring Smoke | 143 | 0 | ✅ |
| Global Polish Pipeline | 66 | 0 | ✅ |
| AI-Slop Reduction | 24 | 0 | ✅ |
| Export Dialogue Enforcement | 60 | 0 | ✅ |
| Dialogue Mechanics Repair | 23 | 0 | ✅ |
| Mid-Paragraph Autofix | 63 | 0 | ✅ |
| Full Author Workflow | 176 | 0 | ✅ |
| **Research Agent Behavior** | **69** | **0** | **✅** |
| Safe Chapter Replace | 67 | 0 | ✅ |
| Prose Polisher D+S | 38 | 0 | ✅ |
| Live Export Safety | 25 | 0 | ✅ |
| Prose Polish Quality | 15 | 0 | ✅ |
| Manuscript Safety Gate | 33 | 0 | ✅ |
| LLM Prose Polisher | 13 | 0 | ✅ |
| **Grand Total** | **991** | **0** | **✅** |

## Research Agent Regression Detail

New test: `tests/researchAgentBehaviorRegression.test.mjs` — 69 assertions across 11 sections:

| Section | Tests | Status |
|---|---|---|
| Fiction Plausibility Mode | 12 | ✅ |
| Nonfiction Deep Fact-Check | 12 | ✅ |
| Source Discipline | 6 | ✅ |
| Genre-Aware Routing | 6 | ✅ |
| Research Injection into Prose | 6 | ✅ |
| LLM Agent Routing | 2 | ✅ |
| Research Storage Safety | 4 | ✅ |
| Adult Content Boundaries | 2 | ✅ |
| Format Differences | 7 | ✅ |
| Edge Cases and Safety | 8 | ✅ |
| No Contamination | 4 | ✅ |

## Build

| Check | Result |
|---|---|
| `npm run build` | ✅ Clean |
| Vite bundle | ✅ No errors |
| No warnings | ✅ |

## Added to Pipeline

`researchAgentBehaviorRegression.test.mjs` added to `npm run test:polish-pipeline` in `package.json`.
