// WAVE11 acceptance battery — stop losing the writer's work.
//
//   WAVE11-SERIALIZE   fabric v7's toJSON ignores the property list; toObject does not
//   WAVE11-FLUSH       a pending autosave is written on unmount, not cancelled
//   WAVE11-REFRESH     a save invalidates the cached project so a remount sees it
//   WAVE11-REHYDRATE   ...without the canvas reloading itself mid-edit
//   WAVE11-TOOLBARSAVE obj.set() edits reach the autosave and the undo stack
//   WAVE11-BARCODE     the generated barcode survives a reload
//   WAVE11-MIGRATE     an older save format is migrated, not discarded
//   WAVE11-LOGO        an uploaded logo appears without a hard reload
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let failures = 0;
const check = (name, pass) => { console.log((pass ? 'PASS ' : 'FAIL ') + name); if (!pass) failures += 1; };

const editor = read('src/components/cover/FabricEditor.jsx');
const wrap = read('src/components/cover/FullWrapComposite.jsx');
const history = read('src/lib/coverHistory.js');
const logo = read('src/components/cover/PublisherLogoUpload.jsx');

/* ── WAVE11-SERIALIZE ────────────────────────────────────────────────────── */
// Executed against the installed fabric, because this whole defect exists only
// because a v6 call signature kept compiling under v7.
// 'fabric/node' is the headless entry; the default export is the browser bundle
// and evaluating it without a DOM throws at module load, not at call time.
let fabric = null;
try {
  fabric = await import('fabric/node');
} catch (err) {
  console.log('NOTE  fabric/node unavailable (' + (err?.message || err) + ') — runtime checks skipped');
}

check('1. fabric is importable so this can be tested for real', !!fabric?.StaticCanvas);

if (fabric?.StaticCanvas) {
  const { StaticCanvas, Rect } = fabric;
  const canvas = new StaticCanvas(null, { width: 100, height: 100 });
  const rect = new Rect({ width: 10, height: 10 });
  rect._fabricEditorId = 'background';
  rect.selectable = false;
  rect.lockMovementX = true;
  canvas.add(rect);

  const PROPS = ['_fabricEditorId', 'selectable', 'lockMovementX'];
  const viaToJSON = JSON.parse(JSON.stringify(canvas.toJSON(PROPS)));
  const viaToObject = JSON.parse(JSON.stringify(canvas.toObject(PROPS)));

  check('1b. toJSON really does ignore the property list (the trap)',
    !('_fabricEditorId' in viaToJSON.objects[0]));
  check('1c. toObject really does honour it (the fix)',
    viaToObject.objects[0]._fabricEditorId === 'background' &&
    viaToObject.objects[0].selectable === false &&
    viaToObject.objects[0].lockMovementX === true);
}

check('2. the editor serializes with toObject, not toJSON',
  /fc\.toObject\(CANVAS_JSON_PROPS\)/.test(editor) && !/fc\.toJSON\(/.test(editor));
check('2b. undo snapshots do too — an undo used to unlock the background',
  /canvas\.toObject\(jsonProps\)/.test(history) && !/canvas\.toJSON\(/.test(history));
check('2c. the background tag that hydration filters on is in the saved props',
  /'_fabricEditorId'/.test(editor) && /_fabricEditorId === 'background'/.test(editor));

/* ── WAVE11-FLUSH ────────────────────────────────────────────────────────── */
check('3. the unmount path writes the pending edit instead of only cancelling it',
  /pendingSaveRef/.test(editor) &&
  /Flush-on-unmount/.test(editor) &&
  /base44\.entities\.NovelProject\.update\(projectIdRef\.current, \{ cover_canvas_json: json \}\)/.test(editor));
check('3b. it serializes before the canvas is disposed',
  editor.indexOf('Flush-on-unmount') < editor.indexOf('fc.dispose()'));
check('3c. scheduling an autosave marks work as pending, saving clears it',
  /pendingSaveRef\.current = true;\n {4}autosaveTimerRef\.current = setTimeout/.test(editor) &&
  /pendingSaveRef\.current = false;\n {6}onSavedRef\.current\?\.\(\);/.test(editor));
check('3d. the project id is read from a ref, not a stale closure',
  /const projectIdRef = useRef\(project\?\.id\);/.test(editor));

/* ── WAVE11-REFRESH ──────────────────────────────────────────────────────── */
check('4. saving invalidates the cached project in both components',
  /invalidateQueries\(\{ queryKey: \['novel-project', projectIdRef\.current\] \}\)/.test(editor) &&
  /invalidateQueries\(\{ queryKey: \['novel-project', project\.id\] \}\)/.test(wrap));
check('4b. both import the query client',
  /useQueryClient/.test(editor) && /useQueryClient/.test(wrap));

/* ── WAVE11-REHYDRATE ────────────────────────────────────────────────────── */
// The dangerous half: invalidating without this would reload the canvas ~3s
// after every keystroke, which is worse than the bug being fixed.
check('5. hydration reads the saved canvas from a ref',
  /const saved = safeParseCanvasJson\(savedCanvasRef\.current\);/.test(editor));
check('5b. and no longer re-runs when the saved canvas changes',
  !/project\?\.cover_canvas_json,\n {4}syncObjects,/.test(editor));
check('5c. it still re-runs for a different project or a new background',
  /\}, \[\n {4}artUrl,\n {4}project\?\.id,/.test(editor));

/* ── WAVE11-TOOLBARSAVE ──────────────────────────────────────────────────── */
check('6. the rich-text toolbar reaches the autosave',
  /const handleToolbarChanged = useCallback/.test(editor) &&
  /onUpdate=\{handleToolbarChanged\}/.test(editor) &&
  !/onUpdate=\{bumpVersion\}/.test(editor));
check('6b. and fires object:modified so history records it as a real edit',
  /fc\.fire\('object:modified', \{ target: active \}\)/.test(editor));

/* ── WAVE11-BARCODE ──────────────────────────────────────────────────────── */
check('7. the generated barcode is saved with the rest of the settings',
  /barcodeDataUrl,\n {8}\},/.test(wrap));
check('7b. and restored on mount rather than falling back to the placeholder',
  /useState\(savedSettings\.barcodeDataUrl \|\| ''\)/.test(wrap));

/* ── WAVE11-MIGRATE ──────────────────────────────────────────────────────── */
check('8. an older save format is migrated instead of silently discarded',
  /const savedLayers = Array\.isArray\(saved\?\.layers\) \? saved\.layers : \[\];/.test(wrap) &&
  !/saved\?\.version === SAVE_VERSION && Array\.isArray\(saved\?\.layers\)/.test(wrap));
check('8b. and the migration is recorded rather than being invisible',
  /savedLayersAreStale/.test(wrap) && /migrated \$\{savedLayers\.length\} layer/.test(wrap));

/* ── WAVE11-LOGO ─────────────────────────────────────────────────────────── */
check('9. the upload panel shows the logo it just uploaded',
  /const \[justUploaded, setJustUploaded\] = useState\(''\);/.test(logo) &&
  /justUploaded \|\| project\?\.publisher_logo_url/.test(logo) &&
  /setJustUploaded\(file_url\)/.test(logo));
check('9b. and the editor finally passes the callback nothing was listening to',
  /<PublisherLogoUpload\n/.test(editor) && /onLogoChange=\{\(\) => \{/.test(editor));

/* ── the fix must not break what worked ──────────────────────────────────── */
check('10. hydration still filters the background and legacy auto-layers',
  /objectJson\._fabricEditorId === 'background'/.test(editor) &&
  /isLegacyAutoDefaultLayer\(objectJson\)/.test(editor));
check('10b. the wrap still writes both canonical fields',
  /wrap_canvas_json: JSON\.stringify\(payload\)/.test(wrap) &&
  /full_wrap_cover_url/.test(wrap));

console.log(failures === 0 ? 'ACCEPTANCE: ALL CHECKS MATCHED' : 'ACCEPTANCE: ' + failures + ' CHECK(S) FAILED');
process.exit(failures === 0 ? 0 : 1);
