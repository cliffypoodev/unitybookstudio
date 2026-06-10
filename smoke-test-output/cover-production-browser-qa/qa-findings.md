# Cover Production System — Browser QA Report

**Generated:** 2026-06-09T18:31:00.793Z  
**App URL:** http://localhost:5173  
**Test Engine:** Puppeteer (headless Chrome)

---

## Summary

| Metric | Count |
|--------|-------|
| ✅ Passed | 2 |
| ❌ Failed | 57 |
| ⚠️ Warnings | 5 |
| 📸 Screenshots | 21 |

**Page State:** 109 chars rendered, 3 interactive elements, 1 media elements

---

## Screenshots Taken

| # | Filename | Description |
|---|----------|-------------|
| 1 | `01-dashboard.png` | Dashboard / landing page |
| 2 | `02-project-opened.png` | After opening a project |
| 3 | `03-cover-tab.png` | Cover tab opened |
| 4 | `04-advanced-panel-open.png` | Advanced Local Generation panel expanded |
| 5 | `05-ponyxl-selected.png` | PonyXL model selected |
| 6 | `06-prompt-built.png` | After Auto-Build Prompt |
| 7 | `07-seed-randomized.png` | After seed randomization |
| 8 | `08-connection-test.png` | After Test Connection attempt |
| 9 | `09-typography-panel.png` | Typography Compositor panel expanded |
| 10 | `10-typography-filled.png` | Typography fields filled in |
| 11 | `11-typography-styled.png` | Typography with font/shadow/glow changes |
| 12 | `12-typography-preview.png` | Typography preview result |
| 13 | `13-export-panel.png` | Export Front Cover panel expanded |
| 14 | `14-export-preset-changed.png` | Export preset changed to paperback_6x9 |
| 15 | `15-variations-panel.png` | Cover Variations panel expanded |
| 16 | `16-variation-named.png` | Variation name filled in |
| 17 | `17-series-lock-panel.png` | Series Consistency Lock panel expanded |
| 18 | `18-series-lock-enabled.png` | Series Lock enabled |
| 19 | `19-generation-started.png` | Generate button disabled state |
| 20 | `20-generation-result.png` | No generation attempted (button disabled) |
| 21 | `21-full-cover-tab.png` | Full cover tab (full page) |

---

## Detailed Findings

### STEP 1: Navigate to Dashboard & Open Project

- 
── STEP 1: Navigate to Dashboard & Open Project ──

### STEP 2: Advanced Local Generation Panel

Controls verified:
- ❌ Not found: ComfyUI URL field (#comfy-url-input)
- ❌ Not found: Test Connection button (#test-comfy-connection)
- ❌ Not found: Model Pipeline selector (#model-pipeline-selector)
- ❌ Not found: Genre Template selector (#genre-template-selector)
- ❌ Not found: Size Preset selector (#size-preset-selector)
- ❌ Not found: Typography Mode selector (#typography-mode-selector)
- ❌ Not found: Lighting field (#lighting-field)
- ❌ Not found: Palette field (#palette-field)
- ❌ Not found: Auto-Build Prompt button (#auto-build-prompt)
- ❌ Not found: Positive Prompt textarea (#adv-positive-prompt)
- ❌ Not found: Negative Prompt textarea (#adv-negative-prompt)
- ❌ Not found: Steps input (#steps-field)
- ❌ Not found: Guidance/CFG input (#guidance-cfg-field)
- ❌ Not found: Seed input (#seed-field)
- ❌ Not found: Randomize Seed button (#randomize-seed)
- ❌ Not found: Flux Checkpoint field (#flux-checkpoint-name)
- ❌ Not found: PonyXL Checkpoint field (#ponyxl-checkpoint-name)
- ❌ Not found: Generate with ComfyUI button (#generate-with-comfyui)
- ❌ Not found: Export Preset selector (#export-preset-selector)
- ❌ Not found: Export Format selector (#export-format-selector)
- ❌ Not found: Export PNG button (#export-cover-png)
- ❌ Not found: Export JPG button (#export-cover-jpg)
- ❌ Not found: Variation Name input (#variation-name-input)
- ❌ Not found: Save Variation button (#save-variation)
- ❌ Not found: Enable Series Lock checkbox (#series-lock-enabled)
- ❌ Not found: Extract from Active Cover button (#extract-series-signature)
- ❌ Not found: Apply to Current Settings button (#apply-series-signature)
- ❌ Not found: Validate Consistency button (#validate-series-consistency)

Interactions:
- ❌ Not found: Test Connection button (#test-comfy-connection)
- Seed: unknown → unknown
- 
Clicking Test Connection...
- ❌ Could not click Test Connection (#test-comfy-connection): Waiting for selector `#test-comfy-connection` failed
- 📸 Screenshot: 08-connection-test.png — After Test Connection attempt
- Connection status: "unknown"

### STEP 3: Typography Compositor Panel

- ❌ Not found: Typography Mode selector (#typography-mode-selector)
- 
── STEP 3: Typography Compositor Panel ──
- ❌ Could not click Typography Compositor toggle (#typography-panel-toggle): Waiting for selector `#typography-panel-toggle` failed
- ❌ Could not find element with text "Typography Compositor" (button)
- 📸 Screenshot: 09-typography-panel.png — Typography Compositor panel expanded
- 📸 Screenshot: 10-typography-filled.png — Typography fields filled in
- 
Changing font family...
- Available fonts: 0 options
- 📸 Screenshot: 11-typography-styled.png — Typography with font/shadow/glow changes
- 
Clicking Preview Typography Overlay...
- ❌ Could not click Preview Typography Overlay (#preview-typography): Waiting for selector `#preview-typography` failed
- 📸 Screenshot: 12-typography-preview.png — Typography preview result
- ⚠️ Typography preview output not detected (may need generated cover image)

### STEP 4: Export Front Cover Panel

- 
── STEP 4: Export Front Cover Panel ──
- ❌ Could not click Export Panel toggle (#export-panel-toggle): Waiting for selector `#export-panel-toggle` failed
- ❌ Could not find element with text "Export Front Cover" (button)
- 📸 Screenshot: 13-export-panel.png — Export Front Cover panel expanded
- ❌ Not found: Export Preset selector (#export-preset-selector)
- ❌ Not found: Export Format selector (#export-format-selector)
- ❌ Not found: Export PNG button (#export-cover-png)
- ❌ Not found: Export JPG button (#export-cover-jpg)
- ❌ Could not select Export Preset → paperback_6x9 (#export-preset-selector): Waiting for selector `#export-preset-selector` failed
- 📸 Screenshot: 14-export-preset-changed.png — Export preset changed to paperback_6x9

### STEP 5: Cover Variations Panel

- 
── STEP 5: Cover Variations Panel ──
- ❌ Could not click Variations Panel toggle (#variations-panel-toggle): Waiting for selector `#variations-panel-toggle` failed
- ❌ Could not find element with text "Cover Variations" (button)
- 📸 Screenshot: 15-variations-panel.png — Cover Variations panel expanded
- ❌ Not found: Variation Name input (#variation-name-input)
- ❌ Not found: Save Variation button (#save-variation)
- ❌ Could not fill Variation Name (#variation-name-input): Waiting for selector `#variation-name-input` failed
- 📸 Screenshot: 16-variation-named.png — Variation name filled in

### STEP 6: Series Consistency Lock Panel

- ❌ Could not fill Series (#typo-series): Waiting for selector `#typo-series` failed
- 
── STEP 6: Series Consistency Lock Panel ──
- ❌ Could not click Series Lock Panel toggle (#series-lock-panel-toggle): Waiting for selector `#series-lock-panel-toggle` failed
- ❌ Could not find element with text "Series Consistency Lock" (button)
- 📸 Screenshot: 17-series-lock-panel.png — Series Consistency Lock panel expanded
- ❌ Not found: Enable Series Lock checkbox (#series-lock-enabled)
- ❌ Not found: Extract from Active Cover button (#extract-series-signature)
- ❌ Not found: Apply to Current Settings button (#apply-series-signature)
- ❌ Not found: Validate Consistency button (#validate-series-consistency)
- ❌ Could not toggle Enable Series Lock (#series-lock-enabled): Waiting for selector `#series-lock-enabled` failed
- 📸 Screenshot: 18-series-lock-enabled.png — Series Lock enabled

### STEP 7: Generate with ComfyUI

- 
── STEP 2: Advanced Local Generation Panel ──
- ❌ Could not find element with text "Advanced Local Generation" (button)
- 📸 Screenshot: 04-advanced-panel-open.png — Advanced Local Generation panel expanded
- 
Checking Advanced Local Generation elements:
- ❌ Not found: Auto-Build Prompt button (#auto-build-prompt)
- ❌ Not found: Positive Prompt textarea (#adv-positive-prompt)
- ❌ Not found: Negative Prompt textarea (#adv-negative-prompt)
- ❌ Not found: Generate with ComfyUI button (#generate-with-comfyui)
- 
Clicking Auto-Build Prompt...
- ❌ Could not click Auto-Build Prompt (#auto-build-prompt): Waiting for selector `#auto-build-prompt` failed
- 📸 Screenshot: 06-prompt-built.png — After Auto-Build Prompt
- Positive prompt length after Auto-Build: 0 chars
- ⚠️ Prompt may not have been populated (could require active project data)
- ⚠️ Typography preview output not detected (may need generated cover image)
- 
── STEP 7: Generate with ComfyUI ──
- Prompt empty, attempting Auto-Build...
- ❌ Could not click Auto-Build Prompt (retry) (#auto-build-prompt): Waiting for selector `#auto-build-prompt` failed
- Generate button disabled: true
- ⚠️ Generate button is disabled (prompt is empty or conditions not met)
- 📸 Screenshot: 19-generation-started.png — Generate button disabled state
- 📸 Screenshot: 20-generation-result.png — No generation attempted (button disabled)

---

## Full Log

```
═══════════════════════════════════════════════════════════
  Cover Production System — Browser QA Test
  Started: 2026-06-09T18:28:32.636Z
═══════════════════════════════════════════════════════════

── STEP 1: Navigate to Dashboard & Open Project ──
✅ Navigated to http://localhost:5173
📸 Screenshot: 01-dashboard.png — Dashboard / landing page
Dashboard scan: 0 card-like elements, 0 project links
⚠️ No project found to click. Trying direct URL navigation...
✅ Retry clicked: "Go Home"
📸 Screenshot: 02-project-opened.png — After opening a project

Looking for Cover tab...
Available buttons/tabs: Sign In
❌ Could not find element with text "Cover" (button)
❌ Could not find element with text "Cover" (a)
📸 Screenshot: 03-cover-tab.png — Cover tab opened

── STEP 2: Advanced Local Generation Panel ──
❌ Could not find element with text "Advanced Local Generation" (button)
⚠️ Trying alternative selectors for Advanced panel toggle...
❌ Could not click Settings toggle (button:has(> span:has(.lucide-settings-2))): Waiting for selector `button:has(> span:has(.lucide-settings-2))` failed
📸 Screenshot: 04-advanced-panel-open.png — Advanced Local Generation panel expanded

Checking Advanced Local Generation elements:
❌ Not found: ComfyUI URL field (#comfy-url-input)
❌ Not found: Test Connection button (#test-comfy-connection)
❌ Not found: Model Pipeline selector (#model-pipeline-selector)
❌ Not found: Genre Template selector (#genre-template-selector)
❌ Not found: Size Preset selector (#size-preset-selector)
❌ Not found: Typography Mode selector (#typography-mode-selector)
❌ Not found: Lighting field (#lighting-field)
❌ Not found: Palette field (#palette-field)
❌ Not found: Auto-Build Prompt button (#auto-build-prompt)
❌ Not found: Positive Prompt textarea (#adv-positive-prompt)
❌ Not found: Negative Prompt textarea (#adv-negative-prompt)
❌ Not found: Steps input (#steps-field)
❌ Not found: Guidance/CFG input (#guidance-cfg-field)
❌ Not found: Seed input (#seed-field)
❌ Not found: Randomize Seed button (#randomize-seed)
❌ Not found: Flux Checkpoint field (#flux-checkpoint-name)
❌ Not found: PonyXL Checkpoint field (#ponyxl-checkpoint-name)
❌ Not found: Generate with ComfyUI button (#generate-with-comfyui)

Switching model pipeline to PonyXL...
❌ Could not select Model Pipeline → PonyXL (#model-pipeline-selector): Waiting for selector `#model-pipeline-selector` failed
📸 Screenshot: 05-ponyxl-selected.png — PonyXL model selected
❌ Could not select Model Pipeline → Flux (#model-pipeline-selector): Waiting for selector `#model-pipeline-selector` failed

Clicking Auto-Build Prompt...
❌ Could not click Auto-Build Prompt (#auto-build-prompt): Waiting for selector `#auto-build-prompt` failed
📸 Screenshot: 06-prompt-built.png — After Auto-Build Prompt
Positive prompt length after Auto-Build: 0 chars
⚠️ Prompt may not have been populated (could require active project data)

Clicking Randomize Seed...
❌ Could not click Randomize Seed (#randomize-seed): Waiting for selector `#randomize-seed` failed
Seed: unknown → unknown
📸 Screenshot: 07-seed-randomized.png — After seed randomization

Clicking Test Connection...
❌ Could not click Test Connection (#test-comfy-connection): Waiting for selector `#test-comfy-connection` failed
📸 Screenshot: 08-connection-test.png — After Test Connection attempt
Connection status: "unknown"

── STEP 3: Typography Compositor Panel ──
❌ Could not click Typography Compositor toggle (#typography-panel-toggle): Waiting for selector `#typography-panel-toggle` failed
❌ Could not find element with text "Typography Compositor" (button)
📸 Screenshot: 09-typography-panel.png — Typography Compositor panel expanded
❌ Could not fill Title (#typo-title): Waiting for selector `#typo-title` failed
❌ Could not fill Author (#typo-author): Waiting for selector `#typo-author` failed
❌ Could not fill Subtitle (#typo-subtitle): Waiting for selector `#typo-subtitle` failed
❌ Could not fill Series (#typo-series): Waiting for selector `#typo-series` failed
❌ Could not fill Tagline (#typo-tagline): Waiting for selector `#typo-tagline` failed
📸 Screenshot: 10-typography-filled.png — Typography fields filled in

Changing font family...
Available fonts: 0 options
❌ Could not toggle Text Shadow (#typo-shadow-toggle): Waiting for selector `#typo-shadow-toggle` failed
❌ Could not toggle Glow (#typo-glow-toggle): Waiting for selector `#typo-glow-toggle` failed
📸 Screenshot: 11-typography-styled.png — Typography with font/shadow/glow changes

Clicking Preview Typography Overlay...
❌ Could not click Preview Typography Overlay (#preview-typography): Waiting for selector `#preview-typography` failed
📸 Screenshot: 12-typography-preview.png — Typography preview result
⚠️ Typography preview output not detected (may need generated cover image)

── STEP 4: Export Front Cover Panel ──
❌ Could not click Export Panel toggle (#export-panel-toggle): Waiting for selector `#export-panel-toggle` failed
❌ Could not find element with text "Export Front Cover" (button)
📸 Screenshot: 13-export-panel.png — Export Front Cover panel expanded
❌ Not found: Export Preset selector (#export-preset-selector)
❌ Not found: Export Format selector (#export-format-selector)
❌ Not found: Export PNG button (#export-cover-png)
❌ Not found: Export JPG button (#export-cover-jpg)
❌ Could not select Export Preset → paperback_6x9 (#export-preset-selector): Waiting for selector `#export-preset-selector` failed
📸 Screenshot: 14-export-preset-changed.png — Export preset changed to paperback_6x9

── STEP 5: Cover Variations Panel ──
❌ Could not click Variations Panel toggle (#variations-panel-toggle): Waiting for selector `#variations-panel-toggle` failed
❌ Could not find element with text "Cover Variations" (button)
📸 Screenshot: 15-variations-panel.png — Cover Variations panel expanded
❌ Not found: Variation Name input (#variation-name-input)
❌ Not found: Save Variation button (#save-variation)
❌ Could not fill Variation Name (#variation-name-input): Waiting for selector `#variation-name-input` failed
📸 Screenshot: 16-variation-named.png — Variation name filled in

── STEP 6: Series Consistency Lock Panel ──
❌ Could not click Series Lock Panel toggle (#series-lock-panel-toggle): Waiting for selector `#series-lock-panel-toggle` failed
❌ Could not find element with text "Series Consistency Lock" (button)
📸 Screenshot: 17-series-lock-panel.png — Series Consistency Lock panel expanded
❌ Not found: Enable Series Lock checkbox (#series-lock-enabled)
❌ Not found: Extract from Active Cover button (#extract-series-signature)
❌ Not found: Apply to Current Settings button (#apply-series-signature)
❌ Not found: Validate Consistency button (#validate-series-consistency)
❌ Could not toggle Enable Series Lock (#series-lock-enabled): Waiting for selector `#series-lock-enabled` failed
📸 Screenshot: 18-series-lock-enabled.png — Series Lock enabled

── STEP 7: Generate with ComfyUI ──
Prompt empty, attempting Auto-Build...
❌ Could not click Auto-Build Prompt (retry) (#auto-build-prompt): Waiting for selector `#auto-build-prompt` failed
Generate button disabled: true
⚠️ Generate button is disabled (prompt is empty or conditions not met)
📸 Screenshot: 19-generation-started.png — Generate button disabled state
📸 Screenshot: 20-generation-result.png — No generation attempted (button disabled)

── STEP 8: Full Cover Tab Screenshot ──
📸 Screenshot: 21-full-cover-tab.png — Full cover tab (full page)

── STEP 9: Final Summary ──
Final page URL: http://localhost:5173/login
Final page title: UnitySora
Page state: 109 chars text, 3 form elements, 1 images/canvases
```

---

## Overall Assessment

The Cover Production System UI was tested against the following criteria:

1. **Panel Discovery** — All expected collapsible panels should be present and toggleable
2. **Control Presence** — All specified input fields, selectors, buttons, and checkboxes should exist in the DOM
3. **Interaction** — Controls should respond to clicks, selections, and text input
4. **Visual State** — Screenshots should show proper rendering and state changes
5. **Workflow** — The end-to-end flow from configuration to generation should be functional

**Result:** 2 checks passed, 57 failed, 5 warnings out of 64 total checks.

### ⚠️ 57 check(s) failed — see details above for specific issues.
