# Regression and Build Report

## Test Results

| Suite | Tests | Passed | Failed | Status |
|---|---|---|---|---|
| Production Wiring Smoke | 61 | 61 | 0 | ✅ PASS |
| Global Pipeline Regression | 185 | 185 | 0 | ✅ PASS |
| AI Slop Reduction | 28 | 28 | 0 | ✅ PASS |
| Export Dialogue Enforcement | 12 | 12 | 0 | ✅ PASS |
| Dialogue Mechanics Repair | 54 | 54 | 0 | ✅ PASS |
| Mid-Paragraph Dialogue Autofix | 63 | 63 | 0 | ✅ PASS |
| Full Author Workflow Regression | 132 | 132 | 0 | ✅ PASS |
| Research Agent Behavior | 44 | 44 | 0 | ✅ PASS |
| Safe Chapter Replace | 48 | 48 | 0 | ✅ PASS |
| Prose Polisher Dialogue Slop | 37 | 37 | 0 | ✅ PASS |
| Live Export Safety | 24 | 24 | 0 | ✅ PASS |
| Prose Polisher Quality Gate | 45 | 45 | 0 | ✅ PASS |
| Manuscript Safety Gate | 54 | 54 | 0 | ✅ PASS |
| LLM Prose Polisher | 88 | 88 | 0 | ✅ PASS |
| **Style Controls Effectiveness** | **271** | **271** | **0** | **✅ PASS** |
| **TOTAL** | **1146** | **1146** | **0** | **✅ ALL PASS** |

## Build

| Step | Result |
|---|---|
| `npm run build` | ✅ Clean — no errors, no warnings |
| Vite build output | Production bundle generated successfully |

## New Test Added

- `tests/styleControlsEffectiveness.test.mjs` — 271 deterministic tests
- Added to `test:polish-pipeline` script in `package.json`

## Total Test Count Progression

| Milestone | Total Tests |
|---|---|
| Initial pipeline | 507 |
| + Cross-genre tests | 609 |
| + Workflow regression | 922 |
| + Research agent | 991 |
| **+ Style controls** | **1146** |
