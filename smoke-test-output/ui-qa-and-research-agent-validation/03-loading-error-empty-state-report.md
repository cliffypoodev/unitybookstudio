# Loading, Error, and Empty State Report

## Method
Code-level analysis of conditional rendering, error handling, and edge cases.

## State Analysis

| State | Expected Behavior | Actual (Code Analysis) | Status |
|---|---|---|---|
| No project selected | Shows selection prompt | Dashboard renders project list; no crash without selection | ✅ |
| Empty chapter list | Shows empty state | ChapterQueue handles empty array; outline editor shows placeholder | ✅ |
| Chapter with no content | Shows editor with placeholder | ChapterEditor renders empty textarea; export skips empty chapters | ✅ |
| Failed polish | Shows error toast | catch block: `toast.error('Polish failed: ' + message)` | ✅ |
| Blocked export (safety gate) | Shows block reason | ManuscriptHealthCheck shows detailed safety findings | ✅ |
| Stale URL block | Prevents stale content use | `contentLooksStaleAgainstMetadata()` returns false for stale URLs | ✅ |
| Safety gate block | Shows rejection reason | `REJECT_REGENERATE` status with detailed report | ✅ |
| No model available | Shows error message | `invokeLLMWithRetry` catches model errors; toast notification | ✅ |
| No research result | Shows empty state | FictionResearchPanel: 'No research data yet...' with guidance | ✅ |
| Research API failure | Shows error toast | FictionResearchPanel catch: `toast.error('Research failed: ' + message)` | ✅ |
| Very long chapter | Handles gracefully | Content truncated to 30K chars in research; uploaded via GitHub for storage | ✅ |
| Project reload | Chapters preserved | resolveChapterContent fetches from URL/inline; safe replacement survives | ✅ |

## Error Handling Patterns

| Pattern | Used In | Status |
|---|---|---|
| `toast.error()` for user-facing errors | Research, Polish, Export, Save | ✅ |
| `toast.success()` for completion | Research, Polish, Export | ✅ |
| `toast.info()` for informational | No topics found, NF draft save notes | ✅ |
| `console.error()` for dev errors | All modules | ✅ |
| `console.warn()` for non-fatal | Research retry, storage fallback | ✅ |
| Try/catch in async handlers | All async operations | ✅ |
| `busyLabel` prevents concurrent ops | ProjectStudio-wide | ✅ |
| Disabled buttons during busy | All action buttons | ✅ |

## Safety Gate User Messaging

| Gate | Message to User | Status |
|---|---|---|
| Manuscript safety gate block | Detailed findings with process leak/contamination counts | ✅ |
| Corrupted content rejection | `REJECT_REGENERATE` status — tells user to regenerate | ✅ |
| Missing story bible for research | 'Generate a story bible first on the Foundation tab.' | ✅ |
| Missing seed concept for NF research | 'Add a seed concept/topic before running deep research.' | ✅ |
| Export safety check | ManuscriptHealthCheck shows per-chapter safety scores | ✅ |

## Recovery Paths

| Failure | Recovery | Status |
|---|---|---|
| Failed research | Retry button available (Re-run / Re-Research) | ✅ |
| Failed polish | Re-run polish; original content preserved | ✅ |
| Blocked export | Fix issues shown in health check, re-export | ✅ |
| Stale URL | System falls back to inline content | ✅ |
| Safety rejection | Regenerate chapter content | ✅ |

## Debug Exposure Assessment

| Item | Visible to Normal Users? | Risk | Status |
|---|---|---|---|
| Console.log statements | No (browser devtools only) | None | ✅ |
| `busyLabel` text | Yes (shows progress) | Low — informational | ✅ |
| ResearchSubPage 'Load from DB' button | Yes — debug button exposed | Minor — cosmetic clutter | ⚠️ |
| `alert()` in DB load handler | Yes — shows raw char counts | Minor — debug info exposed | ⚠️ |
| Unsafe export override | Not surfaced as normal UI action | None | ✅ |

## Verdict

All critical error/loading/empty states are handled. User gets understandable messages. App does not crash on edge cases. Recovery paths exist for all failure modes. Two minor debug exposure items noted (ResearchSubPage DB load button and alert).
