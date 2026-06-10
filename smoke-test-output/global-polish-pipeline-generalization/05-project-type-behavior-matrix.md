# Project-Type Behavior Matrix

| Project Type | Dialogue Repair | AI-Slop Reduction | LLM Sentence Recast | Safety Gate | Export Surface Repair | Notes |
|---|---|---|---|---|---|---|
| Fiction | ✅ Always on | ✅ High | ✅ If model avail. | ✅ Hard | ✅ Always | Preserve voice strongly |
| Nonfiction | Auto-detect | ✅ Medium | ✅ If model avail. | ✅ Hard | ✅ Always | Clarity-focused |
| Training Manual | Auto-detect | ✅ Low | ❌ Off | ✅ Hard | ✅ Always | Preserve structure |
| Business Guide | Auto-detect | ✅ Medium | ❌ Off | ✅ Hard | ✅ Always | Preserve lists/frameworks |
| Memoir | Auto-detect | ✅ Medium | ✅ If model avail. | ✅ Hard | ✅ Always | Preserve emotional voice |
| Unknown/Default | Auto-detect | ✅ Conservative | ❌ Off | ✅ Hard | ✅ Always | Minimal intervention |

## Universal Safety (All Project Types)

| Check | Status |
|---|---|
| Process leak detection | ✅ Always on |
| Cross-project contamination | ✅ Always on |
| Malformed grammar detection | ✅ Always on |
| Stale URL blocking | ✅ Always on |
| Export safety gate | ✅ Always on |
| Unsafe export override | ⚠️ Dev-only |
