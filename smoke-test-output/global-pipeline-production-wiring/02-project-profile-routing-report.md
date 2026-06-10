# Project Profile Routing Report

## Profile Resolution

| Project Input | Expected Profile | Actual Intensity | Status |
|---|---|---|---|
| `{ genre: "fiction" }` | fiction | high | ✅ |
| `{ genre: "Fiction" }` | fiction | high | ✅ |
| `{ type: "novel" }` | fiction (alias) | high | ✅ |
| `{ genre: "thriller" }` | fiction (alias) | high | ✅ |
| `{ type: "sci-fi" }` | fiction (alias) | high | ✅ |
| `{ genre: "short_story" }` | fiction (alias) | high | ✅ |
| `{ genre: "anthology" }` | fiction (alias) | high | ✅ |
| `{ genre: "horror" }` | fiction (alias) | high | ✅ |
| `{ genre: "nonfiction" }` | nonfiction | medium | ✅ |
| `{ genre: "Nonfiction" }` | nonfiction | medium | ✅ |
| `{ type: "investigative_journalism" }` | nonfiction (alias) | medium | ✅ |
| `{ type: "biography" }` | nonfiction (alias) | medium | ✅ |
| `{ genre: "training", type: "manual" }` | training_manual (alias) | low | ✅ |
| `{ genre: "training_manual" }` | training_manual | low | ✅ |
| `{ type: "caregiving" }` | training_manual (alias) | low | ✅ |
| `{ genre: "business", type: "guide" }` | business_guide (alias) | medium | ✅ |
| `{ genre: "business_guide" }` | business_guide | medium | ✅ |
| `{ genre: "memoir" }` | memoir | medium | ✅ |
| `{ genre: "Memoir" }` | memoir | medium | ✅ |
| `{}` | unknown | low | ✅ |
| `null` | unknown | low | ✅ |
| `undefined` | unknown | low | ✅ |
| `{ genre: "unknown_xyz" }` | unknown | low | ✅ |

## Total: 23 routing tests — ALL PASS ✅
