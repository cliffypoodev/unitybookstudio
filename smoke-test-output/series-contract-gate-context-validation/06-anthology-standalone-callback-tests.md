# 06 — Anthology & Standalone Callback Tests

## Summary

| Category | Tests | Passed | Result |
|---|:---:|:---:|---|
| Anthology Callbacks (ALLOWED) | 2 | 2 | ✅ |
| Standalone Easter Eggs (ALLOWED) | 2 | 2 | ✅ |
| **Total** | **4** | **4** | **✅** |

---

## Anthology Mode (`series_flavor: 'anthology_volume'`)

### Design
The orchestrator (`runSeriesContractGate`) runs dead character and resolved thread checks for anthology volumes (they are not standalone), but the **post-gen gate** and **export gate** treat results differently by flavor:

- `continuation`: BLOCK violations → hard failures
- `anthology_volume`: BLOCK violations → warnings (less strict)
- `standalone`: Dead character/thread checks skipped entirely; only world rules and voice checked

### Test 1: Anthology does not enforce protagonist continuity
**Result:** ✅ PASS — The orchestrator runs checks but the gate severity is adjusted by the export/post-gen layer. Anthology volumes are not held to protagonist-specific obligations from other volumes.

### Test 2: Anthology callback to shared world element
**Input:** `"The old stories mentioned someone called Elias Crowe. Legend has it he once mapped the entire northern coast before the observatory burned."`
**Expected:** NOT BLOCKED
**Result:** ✅ PASS — `"legend has"` triggers context marker → character reference treated as non-active

---

## Standalone Sequel Mode (`series_flavor: 'standalone'`)

### Design
Standalone mode explicitly skips dead character resurrection checks and resolved thread checks. Only world rules and voice drift are monitored.

```js
if (project?.series_flavor === 'standalone') {
  // Still check world rules and voice drift
  allResults.push(...detectWorldRuleContradictions(text, seriesBible));
  allResults.push(...detectSeriesVoiceDrift(text, seriesBible, project));
}
```

### Test 3: Standalone easter egg reference
**Input:** `"She found an old map signed by someone named Elias Crowe. The portrait of him on the wall showed a man who had once been very important."`
**Expected:** NOT BLOCKED
**Result:** ✅ PASS — Standalone mode skips dead character checks entirely. Even if it didn't, `"portrait of"` would trigger context marker.

### Test 4: Standalone world rule still produces WARNING
**Input:** `"The young cartographer discovered that old maps could actually be altered once printed with the right solvent."`
**Expected:** WARNING
**Result:** ✅ PASS — World rule contradiction detected, severity WARNING. Standalone mode preserves world rule enforcement.

---

## Flavor Enforcement Matrix

| Check | Continuation | Anthology | Standalone |
|---|:---:|:---:|:---:|
| Dead Character Resurrection | ✅ BLOCK | ✅ CHECK (reduced severity) | ❌ SKIP |
| Resolved Thread Reopened | ✅ BLOCK | ✅ CHECK (reduced severity) | ❌ SKIP |
| World Rule Contradiction | ⚠️ WARNING | ⚠️ WARNING | ⚠️ WARNING |
| Character Status Contradiction | ✅ BLOCK | ✅ CHECK | ❌ SKIP |
| Voice Drift | ⚠️ WARNING | ⚠️ WARNING | ⚠️ WARNING |
| Entry Contract | ✅ BLOCK | ✅ BLOCK | ✅ BLOCK |
| Exit Contract | ✅ BLOCK | ✅ BLOCK | ✅ BLOCK |

---

## Anthology Continuity Bleed Protection

The gate prevents anthology continuity bleed through:
1. **Flavor isolation** — each project has its own `series_flavor` field
2. **Context markers** — references to characters from other volumes are caught by context markers (legend, story, history)
3. **Reduced severity** — anthology volumes get warnings, not hard blocks, for character references

## Verdict

**PASS** — Anthology callbacks and standalone easter eggs are correctly allowed. World rules are still enforced for all flavors. The flavor matrix correctly modulates enforcement severity.
