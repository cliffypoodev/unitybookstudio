# Cross-Project Fixture Tests

## Test Suite: globalPolishPipelineRegression.test.mjs

| Fixture | Tests | Result |
|---|---|---|
| 1. Fiction Thriller (non-DET characters) | 10 | ✅ All pass |
| 2. Nonfiction Investigative | 5 | ✅ All pass |
| 3. Training Manual | 6 | ✅ All pass |
| 4. Business Guide | 4 | ✅ All pass |
| 5. Memoir (first-person) | 7 | ✅ All pass |
| 6. Corrupted Project (must block) | 5 | ✅ All pass |
| 7. Generic Fiction (no DET refs) | 6 | ✅ All pass |
| 8. Profile Config Coverage | 23 | ✅ All pass |
| **TOTAL** | **66** | ✅ **All pass** |

## Key Verifications

| Check | Result |
|---|---|
| Fiction dialogue repair (non-DET names: Sarah, Kovacs, Jackson, Victoria) | ✅ 0 remaining |
| Nonfiction skips dialogue repair when no dialogue present | ✅ Correct |
| Training manual not falsely flagged for compliance language | ✅ No false contamination |
| Business guide business terms allowed | ✅ Safety gate passes |
| Memoir first-person voice auto-detects dialogue | ✅ Correct |
| Corrupted text hard-blocks | ✅ REJECT_REGENERATE |
| All profiles have hardSafety: true | ✅ Verified |
| Unknown/empty project defaults to conservative | ✅ Verified |
