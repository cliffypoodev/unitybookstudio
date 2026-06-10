# Regression & Build Report — Quality Calibration Pass

## Test Results Summary

| Test Suite | Passed | Failed | Status |
|---|---|---|---|
| **Anti-Chatbot Prose Quality** | 40 | 0 | ✅ NEW |
| **Blockbuster Quality Calibration** | 20 | 0 | ✅ NEW |
| AI Slop Reduction | 24 | 0 | ✅ |
| Dialogue Mechanics Repair | 23 | 0 | ✅ |
| Exact Final Line | 34 | 0 | ✅ |
| Full Author Workflow | 176 | 0 | ✅ |
| Global Polish Pipeline | 66 | 0 | ✅ |
| LLM Prose Polisher | 13 | 0 | ✅ |
| Manuscript Safety Gate | 33 | 0 | ✅ |
| Mid-Paragraph Dialogue | 63 | 0 | ✅ |
| Polish Pipeline Integration | 9 | 0 | ✅ |
| Prose Polisher Quality Gate | 15 | 0 | ✅ |
| Reference Integrity Gate | 155 | 0 | ✅ |
| Reference Integrity Wiring | 56 | 0 | ✅ |
| Research Agent Behavior | 69 | 0 | ✅ |
| Series Contract Gate Context | All | 0 | ✅ |
| Series Live Wiring Fix | 44 | 0 | ✅ |
| Series Pipeline Hardening | 37 | 0 | ✅ |
| Style Controls Effectiveness | 270 | 1 | ⚠️ Pre-existing |
| Production Wiring Smoke | 142 | 1 | ⚠️ Pre-existing |

**New tests: 60/60** ✅
**Pre-existing passing: All green** ✅
**Zero regressions from quality calibration changes** ✅

---

## Pre-Existing Failures (Not Caused by This Work)

| Test Suite | Failure | Root Cause |
|---|---|---|
| Style Controls | 1/271 | Pre-existing (chapter title hygiene edge case) |
| Production Wiring | 1/143 | Pre-existing |
| Setup Foundation Wiring | ERR_MODULE_NOT_FOUND | Vite-dependent, not node-runnable |
| Story Architect Chat | ERR_MODULE_NOT_FOUND | Vite-dependent, not node-runnable |
| Unity Contamination Source | ERR_MODULE_NOT_FOUND | Vite-dependent, not node-runnable |
| Violence Level Wiring | ERR_MODULE_NOT_FOUND | Vite-dependent, not node-runnable |
| Export Resolved Dialogue | ERR_MODULE_NOT_FOUND | Vite-dependent, not node-runnable |
| Safe Chapter Replace | TypeError (pre-existing) | exportReport.passed iteration bug |

---

## Build Verification

```
npx vite build → ✅ Clean (zero warnings, zero errors)
```

---

## New Test Coverage

### `antiChatbotProseQuality.test.mjs` (40 tests)

| Section | Tests | Status |
|---|---|---|
| SIGNATURE_VOICE_BLOCK content | 8 | ✅ |
| POLISHER_ANTI_CHATBOT_RULES | 4 | ✅ |
| Good prose scoring | 6 | ✅ |
| Chatbot prose scoring | 8 | ✅ |
| Chatbot pattern counting | 7 | ✅ |
| Edge cases | 4 | ✅ |
| Module exports | 3 | ✅ |

### `blockbusterQualityCalibration.test.mjs` (20 tests)

| Section | Tests | Status |
|---|---|---|
| Craft compact wiring | 3 | ✅ |
| Scene writer injection | 4 | ✅ |
| Prose polisher wiring | 4 | ✅ |
| Enforcement block status | 2 | ✅ |
| Module structure | 6 | ✅ |
| Build verification | 1 | ✅ |
