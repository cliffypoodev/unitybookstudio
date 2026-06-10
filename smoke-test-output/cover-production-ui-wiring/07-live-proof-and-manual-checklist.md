# 07 — Live Proof & Manual Checklist

**Date:** 2026-06-09

---

## Live Proof Results

### ComfyUI Server

| Check | Result |
|-------|--------|
| ComfyUI reachable | ✅ Port 8000, HTTP 200 |
| API `/prompt` endpoint | ✅ Accepts workflow JSON |
| API `/history` endpoint | ✅ Returns generation history |

### PonyXL Generation

| Field | Value |
|-------|-------|
| Output file | `UBS_Live_Proof_PonyXL_00001_.png` |
| File size | 456 KB |
| HTTP status | 200 |
| Source | Prior session live proof |

### Flux Generation

| Field | Value |
|-------|-------|
| Output file | `UBS_Live_Proof_Flux_00001_.png` |
| File size | 337 KB |
| HTTP status | 200 |
| Source | Prior session live proof |

### Typography Overlay

| Check | Result |
|-------|--------|
| `buildTypographyOverlay()` with title + author | ✅ Produces 2 layers (`title`, `author`) |
| Layer structure includes font, size, color, position | ✅ Verified |
| Series/subtitle/tagline layers conditional | ✅ Only included when text is non-empty |

### Export Composite

| Check | Result |
|-------|--------|
| `renderCoverCompositeToCanvas()` | Requires browser canvas — tested via unit tests on data layer |
| `exportCompositeCoverPNG()` | Canvas → blob pipeline verified in unit tests |
| `exportCompositeCoverJPG()` | Canvas → blob pipeline verified in unit tests |
| `downloadCoverImage()` | Requires `document.createElement` — browser only |

### Variation Persistence

| Check | Result |
|-------|--------|
| Create variation | ✅ Unit test passes |
| Duplicate variation | ✅ New ID, "(Copy)" suffix |
| Update variation | ✅ Immutable, guards `id` and `createdAt` |
| Delete variation | ✅ Returns remaining |
| Select active | ✅ Only one active at a time |
| localStorage round-trip | ✅ 12 tests pass |

---

## Manual Browser Verification Checklist

The following steps require a running browser with the dev server. Complete each step and check it off:

### Cover Tab Access
- [ ] Open Cover tab in browser via ProjectStudio navigation
- [ ] Verify all 6 collapsible panels are visible

### Typography Compositor
- [ ] Expand Typography Compositor panel
- [ ] Enter a book title in the title field
- [ ] Enter an author name in the author field
- [ ] Select a different font family from the dropdown
- [ ] Adjust font size, color, and letter spacing
- [ ] Select a title placement preset (e.g., "Center")
- [ ] Select an author placement preset (e.g., "Bottom Right")
- [ ] Toggle shadow on/off
- [ ] Toggle glow on/off
- [ ] Toggle safe margins on/off
- [ ] Click "Preview Typography" — verify overlay renders on cover image

### Cover Generation
- [ ] Generate a cover image via ComfyUI (Direction-Based Workflow or Advanced panel)
- [ ] Verify generated image appears in the gallery/preview area

### Export
- [ ] Expand Export Front Cover panel
- [ ] Select a preset (e.g., "eBook Cover")
- [ ] Click "Export PNG" — verify file downloads with sanitized filename
- [ ] Change format to JPG
- [ ] Click "Export JPG" — verify file downloads

### Variations
- [ ] Expand Cover Variations panel
- [ ] Enter a variation name
- [ ] Click "Save Variation" — verify it appears in the list
- [ ] Click "Select" on the saved variation — verify it becomes active
- [ ] Click "Duplicate" — verify a copy appears with "(Copy)" suffix
- [ ] Click "Delete" on the copy — verify it is removed
- [ ] Reload page — verify variations persist in localStorage

### Series Consistency
- [ ] Expand Series Consistency Lock panel
- [ ] Click "Extract Series Signature" — verify signature is extracted from active cover
- [ ] Modify a generation setting (e.g., change model pipeline)
- [ ] Click "Validate Consistency" — verify deviation report appears
- [ ] Click "Apply Series Signature" — verify settings are restored to match signature
- [ ] Click "Validate Consistency" again — verify no deviations
