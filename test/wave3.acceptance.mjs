// WAVE3 acceptance battery — schema reconciliation + publishing race + UI sync.
//
//   WAVE3-SCHEMA      every field the code writes is now declared in the schemas
//   WAVE3-PKGRACE     publishing-kit save no longer wipes sibling fields
//   WAVE3-EXTRACTALL  volume-bible cards reflect Extract All without a reload
//   WAVE3-IMPORTWC    imported ideas get a real word_count
//   WAVE3-WRAPFIELD   one canonical full-wrap field; phantom cover_url reads gone
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let failures = 0;
const check = (name, pass) => { console.log((pass ? 'PASS ' : 'FAIL ') + name); if (!pass) failures += 1; };

// ── WAVE3-SCHEMA: all schema files must PARSE (jsonc: strip //-comment lines) ─
const schemaDir = path.join(ROOT, 'base44', 'entities');
const schemaFiles = fs.readdirSync(schemaDir).filter((f) => f.endsWith('.jsonc'));
const parsed = {};
let parseFailures = 0;
for (const f of schemaFiles) {
  try {
    const raw = fs.readFileSync(path.join(schemaDir, f), 'utf8')
      .split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
    parsed[f] = JSON.parse(raw);
  } catch (err) {
    parseFailures += 1;
    console.log('       PARSE FAIL: ' + f + ' — ' + err.message);
  }
}
check('1. all ' + schemaFiles.length + ' entity schemas parse as JSON (comments stripped)', parseFailures === 0);
check('1b. PublishingAsset schema now exists', !!parsed['PublishingAsset.jsonc']);

const np = parsed['NovelProject.jsonc']?.properties || {};
const NEW_NP_FIELDS = [
  'publishing_package', 'launch_checklist', 'isbn_ebook', 'isbn_hardcover', 'agent_queries',
  'full_wrap_cover_url', 'volume_bible_json', 'entry_contract_json', 'exit_contract_json',
  'content_lane', 'project_format', 'rights_mode', 'commercial_use_allowed', 'genre_group',
  'market_category', 'reading_level', 'fandom_name', 'source_universe', 'canon_mode',
  'fanfic_posting_target', 'canon_characters', 'canon_boundary', 'series_flavor',
  'series_flavor_note', 'violence_level', 'title_working', 'twist_count', 'total_word_count',
];
const missingNp = NEW_NP_FIELDS.filter((f) => !np[f]);
check('2. all ' + NEW_NP_FIELDS.length + ' previously-phantom NovelProject fields are declared', missingNp.length === 0);
if (missingNp.length) console.log('       MISSING: ' + missingNp.join(', '));

const pc = parsed['PromptCatalog.jsonc']?.properties || {};
check('2b. PromptCatalog declares is_favorite + status', !!pc.is_favorite && !!pc.status);
const chp = parsed['Chapter.jsonc']?.properties || {};
check('2c. Chapter declares draft_all_mode + preview/upload-failed flags',
  !!chp.draft_all_mode && !!chp.content_md_preview_only && !!chp.content_md_upload_failed);
const pa = parsed['PublishingAsset.jsonc']?.properties || {};
check('2d. PublishingAsset declares project_id/kind/label/content',
  !!pa.project_id && !!pa.kind && !!pa.label && !!pa.content);

// ── WAVE3-PKGRACE ────────────────────────────────────────────────────────────
const pub = read('src/components/tools/PublishingSubPage.jsx');
check('3. setPackageData is no longer used as a synchronous getter',
  !/setPackageData\(\(cur\)\s*=>\s*{\s*\w+\s*=\s*cur/.test(pub));
check('3b. debounced save reads the ref, which tracks latest state',
  /packageDataRef\.current/.test(pub) && /packageDataRef\.current = packageData/.test(pub));

// ── WAVE3-EXTRACTALL ─────────────────────────────────────────────────────────
const vbv = read('src/components/series/VolumeBiblesView.jsx');
check('4. VolumeCard re-derives bible state when the refreshed project prop arrives',
  /useEffect\(\(\) => { setData\(loadVolumeBible\(project\)\); }, \[project\]\)/.test(vbv));

// ── WAVE3-IMPORTWC ───────────────────────────────────────────────────────────
const ic = read('src/pages/ImportCatalog.jsx');
check('5. imported ideas compute word_count from content (no hardcoded 0)',
  !/word_count: 0\b/.test(ic) && /word_count: \(content \|\| ''\)/.test(ic));

// ── WAVE3-WRAPFIELD ──────────────────────────────────────────────────────────
const cc = read('src/components/cover/CoverCreator.jsx');
const fwc = read('src/components/cover/FullWrapComposite.jsx');
check('6. cover_fullwrap_url is never written again (single canonical field)',
  !/cover_fullwrap_url:/.test(cc) && !/cover_fullwrap_url:/.test(fwc));
check('6b. phantom project.cover_url reads are gone',
  !/project\?\.cover_url/.test(cc) && !/project\?\.cover_url/.test(fwc));
check('6c. the wrap save persists full_wrap_cover_url + wrap_canvas_json',
  /full_wrap_cover_url: fileUrl \|\| project\?\.full_wrap_cover_url/.test(fwc) &&
  /wrap_canvas_json: JSON\.stringify\(payload\)/.test(fwc));

// ── Sweep: no NovelProject.update write key should be undeclared ─────────────
// (spot-sweep over the highest-traffic writers)
const WRITERS = ['src/pages/SeriesManager.jsx', 'src/components/tools/PublishingSubPage.jsx', 'src/lib/volumeBible.js'];
const KNOWN_OK = new Set(Object.keys(np));
const undeclared = [];
for (const w of WRITERS) {
  const src = read(w);
  const re = /NovelProject\.update\([^,]+,\s*{([^}]*)}/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    for (const key of m[1].split(',').map((s) => s.split(':')[0].trim()).filter((k) => /^[a-z_]+$/.test(k))) {
      if (!KNOWN_OK.has(key)) undeclared.push(w + ' → ' + key);
    }
  }
}
check('7. spot-sweep: no undeclared NovelProject field writes in high-traffic writers', undeclared.length === 0);
if (undeclared.length) undeclared.forEach((u) => console.log('       UNDECLARED: ' + u));

console.log(failures === 0 ? 'ACCEPTANCE: ALL CHECKS MATCHED' : 'ACCEPTANCE: ' + failures + ' CHECK(S) FAILED');
process.exit(failures === 0 ? 0 : 1);
