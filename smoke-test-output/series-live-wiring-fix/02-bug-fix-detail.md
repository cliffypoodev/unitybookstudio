# 02 — Bug Fix Detail

## Bug 1: getSeriesContinuity Passes Wrong Object

### Before (BROKEN)
```js
async function getSeriesContinuity(project) {
  try {
    return await buildSeriesContinuityBlock(project); // BUG: passes project, not seriesBible
  } catch (error) {
    console.warn('[sceneWriter] Series continuity load failed:', error);
    return '';
  }
}
```

### After (FIXED)
```js
async function getSeriesContinuity(project) {
  try {
    if (!project?.series_bible_id) return '';

    // Load the actual SeriesBible entity (not the project)
    const bibles = await base44.entities.SeriesBible.filter({ id: project.series_bible_id });
    const seriesBible = bibles?.[0];
    if (!seriesBible) return '';

    const flavor = project.series_flavor || 'continuation';

    if (flavor === 'standalone') {
      // Light world/voice context only
      return buildStandaloneBlock(seriesBible);
    }
    if (flavor === 'anthology_volume') {
      // Shared theme/rules only
      return buildAnthologyBlock(seriesBible);
    }

    // True continuation — strict canon injection
    return buildSeriesContinuityBlock(seriesBible, project.series_number);
  } catch (error) {
    console.warn('[sceneWriter] Series continuity load failed:', error);
    return '';
  }
}
```

### Why It Was Wrong
`buildSeriesContinuityBlock` expects `(seriesBible, seriesNumber)` — an object with fields like `deaths_and_losses`, `resolved_threads`, `world_state`. The `project` object has none of these fields, so every `.length` check returned falsy and the function returned just the empty header/footer.

### Impact
Every series-linked volume was being drafted with zero series canon. Dead characters could be resurrected, resolved threads reopened, world state contradicted — all silently.

---

## Bug 2: buildVolumeContractBlock Never Called

### Before (BROKEN)
`buildVolumeContractBlock` existed in `volumeBible.js` (fully functional, 43 lines) but was never imported by `sceneWriter.js` or any other generation file.

### After (FIXED)
```js
// sceneWriter.js imports
import { buildVolumeContractBlock } from '@/lib/volumeBible';

// New helper function
async function getVolumeContractBlock(project, chapter) {
  if (!project?.series_bible_id) return '';
  const flavor = project.series_flavor || 'continuation';
  if (flavor === 'anthology_volume') return '';

  let entryContract = null;
  let exitContract = null;
  try { entryContract = project.entry_contract_json ? JSON.parse(project.entry_contract_json) : null; } catch {}
  try { exitContract = project.exit_contract_json ? JSON.parse(project.exit_contract_json) : null; } catch {}

  if (!entryContract && !exitContract) return '';

  return buildVolumeContractBlock(entryContract, exitContract, chapterNumber, totalChapters);
}
```

This function is now called in `Promise.all` alongside `getSeriesContinuity` and the result is passed as `volumeContractBlock` into `buildFictionPrompt`.

### Impact
Volume-level contracts (entry state, exit requirements, character obligations) are now enforced during drafting. Position-aware guidance (opening/mid/final chapter) shapes the LLM's output.

---

## Bug 3: No Post-Generation Gate

### Before
The only post-generation validation was `validateProjectChapterContent` which checks for cross-project contamination (wrong title/characters from a different book). There was zero series-specific validation.

### After
Added a series contract gate block after the contamination guard:
- Loads SeriesBible and contracts
- Runs `runSeriesContractGate` on the full chapter
- Logs BLOCK/WARNING violations with `[SERIES-GATE]` prefix
- Stores report at `window.__UBS_LAST_SERIES_CONTRACT_REPORT`
- Does NOT throw (to avoid false-positive DOA during generation) — the Export gate provides the hard stop

---

## Bug 4: Export Has Zero Series Awareness

### Before
`runPreExportSafetyGate` was a synchronous function that checked:
- Process leaks
- Contamination
- Dialogue issues
- Slop density
- Reference integrity

Series continuity was not checked.

### After
1. Function made `async` to support dynamic import of seriesContractGate
2. ExportTab.jsx updated to `await` the call
3. After reference integrity gate, a new series contract gate section:
   - Loads SeriesBible entity
   - Runs `runSeriesContractGate` on full manuscript
   - For `continuation`: BLOCK violations → hard failures (export blocked)
   - For all flavors: WARNING violations → non-blocking warnings
   - Stores at `window.__UBS_LAST_EXPORT_SERIES_REPORT`
4. `seriesReport` included in the returned report object
