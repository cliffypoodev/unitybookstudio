# 06 — Series Consistency UI Report

**Module:** Cover Production — Series Consistency Lock
**Date:** 2026-06-09
**Status:** ✅ PASS (data layer + source audit verified)

---

## Series Signature Structure

`extractSeriesCoverSignature()` returns:

```javascript
{
  hasSeriesSignature: true,
  lighting: "moody",
  palette: "dark-teal",
  typographyStyle: {
    fontFamily: "Playfair Display",
    titlePlacement: "top-center",
    authorPlacement: "bottom-center"
  },
  compositionPattern: "center-figure",
  modelPipeline: "flux",
  exportPreset: "ebook"
}
```

---

## Workflow: Extract → Apply → Validate

### 1. Extract Series Signature
- Captures current generation settings as the "signature" for a book series
- Requires an active variation (properly guarded)
- Extracts: lighting, palette, typography style, composition, model, export preset

### 2. Apply Series Signature
- `applySeriesCoverSignature(signature, settings)` — overrides matching fields
- Maps signature fields back to generation settings
- Preserves non-signature fields (title, author, prompt text)

### 3. Validate Series Consistency
- `validateSeriesCoverConsistency(signature, currentSettings)` — compares fields
- Returns `{ consistent: boolean, deviations: [{field, expected, actual}] }`
- Matching settings → `consistent: true`
- Mismatched settings → `consistent: false` with deviation details

---

## Data Layer Test Results

| Test | Scenario | Result |
|------|----------|--------|
| Extract | Active variation with full settings | ✅ `hasSeriesSignature: true`, all fields populated |
| Validate (match) | Identical settings | ✅ `consistent: true`, 0 deviations |
| Validate (mismatch) | Different model + preset | ✅ `consistent: false`, 2 deviations detected |

### Deviation Example

```javascript
{
  consistent: false,
  deviations: [
    { field: "modelPipeline", expected: "flux", actual: "ponyxl" },
    { field: "exportPreset", expected: "ebook", actual: "6x9" }
  ]
}
```

---

## UI Controls (Source Audit)

**4 controls** in the Series Consistency Lock panel:

| Control | ID | Handler | Status |
|---------|----|---------|--------|
| Enable Checkbox | `series-lock-enabled` | Toggles `seriesLockEnabled` state | ✅ REAL |
| Extract Signature | `extract-series-signature` | `extractSeriesCoverSignature()` | ✅ REAL |
| Apply Signature | `apply-series-signature` | Maps signature fields to settings | ✅ REAL |
| Validate Consistency | `validate-series-consistency` | `validateSeriesCoverConsistency()` → toast | ✅ REAL |

---

## UI Feedback

| Scenario | Feedback |
|----------|----------|
| Extract success | Toast: "Series signature extracted" |
| Extract no variation | Guard clause prevents — requires active variation |
| Validate consistent | Toast: "Series is consistent ✓" |
| Validate deviations | Toast: warning with deviation count |
| Deviation details | Yellow info box listing each field/expected/actual |

---

## Series Signature Display

When a signature is extracted, the UI shows:

| Field | Display |
|-------|---------|
| Lighting | e.g., "moody" |
| Palette | e.g., "dark-teal" |
| Pipeline | e.g., "flux" |
| Font | e.g., "Playfair Display" |
| Export Preset | e.g., "ebook" |

---

## Conclusion

The series consistency lock is correctly implemented with a full extract/apply/validate workflow. Deviation detection works accurately, identifying specific field-level mismatches. All 4 controls are wired to real handlers with appropriate guard clauses and toast feedback. The data layer is fully verified with both matching and mismatching scenarios.
