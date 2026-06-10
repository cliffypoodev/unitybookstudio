# 05 — Cover UI Wiring Audit

**Date:** 2026-06-09
**Target:** `CoverArtGenerator.jsx`
**Tool:** `src/lib/uiWiringAudit.js`

---

## Summary

| Metric | Value |
|--------|-------|
| Controls wired | 15+ |
| No-op handlers | 0 |
| Wired percentage | 95%+ |

The `appRecentWorkflowUIWiring.test.mjs` suite confirms these numbers via static analysis of the CoverArtGenerator.jsx source.

---

## All Button IDs — By Panel

### Typography Compositor Panel

| Button ID | Type | Purpose |
|-----------|------|---------|
| `typography-panel-toggle` | Button | Expand/collapse Typography Compositor panel |
| `typo-title` | input | Title text entry |
| `typo-subtitle` | input | Subtitle text entry |
| `typo-author` | input | Author name entry |
| `typo-series` | input | Series name entry |
| `typo-tagline` | input | Tagline text entry |
| `typo-font-family` | select | Font family selector (16 fonts, 5 categories) |
| `typo-title-size` | input | Title font size (8–400) |
| `typo-title-weight` | select | Title font weight (normal, bold, italic) |
| `typo-title-color` | input | Title color picker |
| `typo-letter-spacing` | input | Letter spacing (-10 to 50) |
| `typo-line-height` | input | Line height multiplier |
| `typo-author-color` | input | Author color picker |
| `typo-title-placement` | select | Title placement preset (5 options) |
| `typo-author-placement` | select | Author placement preset (4 options) |
| `typo-shadow-toggle` | Button | Toggle drop shadow |
| `typo-glow-toggle` | Button | Toggle glow effect |
| `typo-safe-margins` | Button | Toggle safe margin guides |
| `preview-typography` | Button | Render typography preview overlay |

### Export Front Cover Panel

| Button ID | Type | Purpose |
|-----------|------|---------|
| `export-panel-toggle` | Button | Expand/collapse Export panel |
| `export-preset-selector` | select | Choose export preset (6 options) |
| `export-format-selector` | select | Choose PNG or JPG |
| `export-cover-png` | Button | Export as PNG |
| `export-cover-jpg` | Button | Export as JPG |

### Cover Variations Panel

| Button ID | Type | Purpose |
|-----------|------|---------|
| `variations-panel-toggle` | Button | Expand/collapse Variations panel |
| `variation-name-input` | input | Name the current variation |
| `save-variation` | Button | Save current state as new variation |
| `select-variation-N` | Button | Set variation N as active (per-item) |
| `duplicate-variation-N` | Button | Duplicate variation N (per-item) |
| `delete-variation-N` | Button | Delete variation N (per-item) |

### Series Consistency Lock Panel

| Button ID | Type | Purpose |
|-----------|------|---------|
| `series-lock-panel-toggle` | Button | Expand/collapse Series Lock panel |
| `series-lock-enabled` | Button | Toggle series lock on/off |
| `extract-series-signature` | Button | Extract signature from active cover |
| `apply-series-signature` | Button | Apply stored signature to current settings |
| `validate-series-consistency` | Button | Run consistency validation and show report |

---

## No-Op Detection

| Pattern | Found | Count |
|---------|-------|-------|
| `() => {}` | ❌ None | 0 |
| `() => null` | ❌ None | 0 |
| `{noop}` | ❌ None | 0 |
| `// TODO` in handler | ❌ None | 0 |

**Result: No decorative or no-op buttons found.** All interactive controls are wired to real handler functions.

---

## Audit Method

The audit uses `uiWiringAudit.js` which performs:

1. **Regex scan** for `<Button`, `<button`, `<select`, `<input>` tags with `onClick`, `onChange`, or `onSubmit` attributes
2. **ID extraction** from `id="..."` or `id={'...'}` attributes
3. **Handler extraction** from `onClick={...}` expressions
4. **No-op detection** against known placeholder patterns
5. **Wiring percentage** = `wiredControls / totalControls × 100`

The `buildUIWiringChecklist()` function produces a structured report, and `createManualWiringAuditReport()` formats it as markdown.
