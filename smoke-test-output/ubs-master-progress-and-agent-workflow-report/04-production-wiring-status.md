# UBS Production Wiring Status

## Workflow Audit

| Workflow | UI Entry Point | Safety Gate? | Profile-Aware? | Status |
|---|---|---|---|---|
| Create Project | Dashboard → NewProjectModal | N/A | ✅ Genre captured | ✅ Wired |
| Load Project | Dashboard → ProjectStudio | N/A | ✅ Profile resolved | ✅ Wired |
| Draft All | ProjectStudio → Draft handler | ✅ manuscriptSafetyGate | ✅ Genre-routed | ✅ Wired |
| Rewrite All | ProjectStudio → Rewrite handler | ✅ manuscriptSafetyGate | ✅ Genre-routed | ✅ Wired |
| Fix/Polish (Fiction) | ProjectStudio → Polish handler | ✅ manuscriptSafetyGate | ✅ Fiction profile | ✅ Wired |
| Fix/Polish (Nonfiction) | ProjectStudio → Polish handler | ✅ manuscriptSafetyGate | ✅ NF profile | ✅ Wired |
| Research (Fiction) | FoundationTab → FictionResearchPanel | N/A | ✅ Plausibility | ✅ Wired |
| Research (Nonfiction) | FoundationTab → ResearchSection | N/A | ✅ Deep research | ✅ Wired |
| Safe Chapter Replace | ProjectStudio → Replace handler | ✅ Verification | N/A | ✅ Wired |
| Export DOCX | ExportTab → DOCX handler | ✅ Both gates | ✅ Profile-aware | ✅ Wired |
| Export PDF | ExportTab → PDF handler | ✅ Both gates | ✅ Profile-aware | ✅ Wired |
| Bibliography Generation | ProjectStudio → NF draft | N/A | ✅ NF only | ✅ Wired |
| Reference Integrity Check | **Not wired** | ✅ Module has gate | N/A | ⚠️ Not wired |
| Style/Beat/Genre Selection | SetupTab | N/A | ✅ | ✅ Wired |

## Wiring Summary

| Category | Wired | Not Wired |
|---|---|---|
| User workflows | 13 | 1 |
| Safety gates | 3/3 | 0 |
| Profile-aware paths | 11/11 | 0 |

## ⚠️ Not Wired to Production UI

| Item | Status | Risk |
|---|---|---|
| `referenceIntegrityGate.js` | 155 tests pass but not called from UI | Medium |
| ResearchSubPage fiction-only routing | Always uses fiction engine | Medium |
