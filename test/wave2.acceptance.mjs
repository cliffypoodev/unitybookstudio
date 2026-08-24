// WAVE2 acceptance battery — vocabulary + enum corruption fixes.
//
//   WAVE2-POVNORMALIZE  canonical POV/tense slugs everywhere + self-healing normalizer
//   WAVE2-ENUMFIX       project_type 'novel' and book_type 'anthology' poison writes
//   WAVE2-PHASECOLORS   Dashboard phase keys match the phase enum
//   WAVE2-WORDCOUNT     total_word_count is finally written (schema + rollup helper)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  normalizePovMode, normalizeTense, buildPovTenseBlock, checkTenseConsistency, checkPovConsistency,
} from '../src/lib/povTense.js';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let failures = 0;
const check = (name, pass) => { console.log((pass ? 'PASS ' : 'FAIL ') + name); if (!pass) failures += 1; };

// ── WAVE2-POVNORMALIZE: behavioral ───────────────────────────────────────────
check('1. legacy display strings normalize to canonical slugs',
  normalizePovMode('Third Person Limited') === 'third-close' &&
  normalizePovMode('Third Person Omniscient') === 'third-omni' &&
  normalizeTense('Past') === 'past' && normalizeTense('Present') === 'present');
check('1b. nonfiction "First Person" maps to author voice, not fiction first',
  normalizePovMode('First Person', 'nonfiction') === 'nf-author' &&
  normalizePovMode('First Person', 'fiction') === 'first');
check('1c. canonical slugs pass through untouched',
  normalizePovMode('third-close') === 'third-close' && normalizePovMode('nf-editorial') === 'nf-editorial' &&
  normalizeTense('mixed') === 'mixed');

check('2. buildPovTenseBlock understands a legacy-vocabulary project',
  (() => {
    const block = buildPovTenseBlock({ pov_mode: 'Third Person Limited', tense: 'Past', book_type: 'fiction' });
    return block.includes('THIRD PERSON CLOSE') && block.includes('PAST TENSE');
  })());

const driftText =
  'He walks toward the door without a word spoken. ' +
  'She runs across the empty room in a hurry. ' +
  'He says nothing at all to anyone today. ' +
  'She thinks about the plan one more time. ' +
  'He turns toward the window very slowly now.';
check('3. checkTenseConsistency fires on a legacy "Past" project (was a silent no-op)',
  checkTenseConsistency(driftText, { tense: 'Past' }).length > 0);
check('3b. checkPovConsistency fires on a legacy "First Person" project',
  (() => {
    const v = checkPovConsistency(
      'He walks to the door. He says it plainly. He thinks hard. He turns away now.',
      { pov_mode: 'First Person', book_type: 'fiction' }, 1);
    return Array.isArray(v) && v.length > 0;
  })());

// ── WAVE2-POVNORMALIZE: static (write sites use slugs) ───────────────────────
const dash = read('src/pages/Dashboard.jsx');
check('4. Dashboard creation defaults use canonical slugs for all four types',
  !/pov_mode: 'Third Person Limited'/.test(dash) && !/tense: 'Past'/.test(dash) &&
  /pov_mode: 'third-close'/.test(dash) && /pov_mode: 'nf-author'/.test(dash));
check('4b. importBackup and SeriesBibleView no longer write display strings',
  !/Third Person Limited/.test(read('src/tools/importBackup.js')) &&
  !/Third Person Limited/.test(read('src/components/tools/SeriesBibleView.jsx')));
check('4c. qualityScan normalizes POV before keying',
  /normalizePovMode\(project\.pov_mode/.test(read('src/lib/qualityScan.js')));

// ── WAVE2-ENUMFIX ────────────────────────────────────────────────────────────
const ps = read('src/pages/ProjectStudio.jsx');
check('5. project_type can never be written as \'novel\' again',
  !/project_type[^\n]*'novel'/.test(ps));
const sm = read('src/pages/SeriesManager.jsx');
check('5b. anthology volumes write project_type \'anthology\'; book_type stays enum-legal and is inherited from the series, not hardcoded (SERIESHYGIENE-1)',
  /projectPayload\.project_type = 'anthology';/.test(sm) &&
  !/projectPayload\.book_type = 'anthology';/.test(sm) &&
  !/projectPayload\.book_type = 'fiction';/.test(sm) &&
  /declaredTypeOf\(lastVolume\)/.test(sm));
check('5c. the anth. badge keys on project_type (book_type kept only for legacy rows)',
  /project\.project_type === 'anthology' \|\| project\.book_type === 'anthology'/.test(sm));

// ── WAVE2-PHASECOLORS ────────────────────────────────────────────────────────
check('6. PHASE_COLORS keys match the phase enum (drafting/revision present)',
  /drafting:\s*{/.test(dash) && /revision:\s*{/.test(dash));
check('6b. legacy phase values still render via aliases',
  /PHASE_COLORS\.outline = PHASE_COLORS\.drafting/.test(dash) &&
  /PHASE_COLORS\.review = PHASE_COLORS\.revision/.test(dash));
check('6c. revision projects can no longer fall through to the Drafting card',
  !/const colors = PHASE_COLORS\[phase\] \|\| PHASE_COLORS\.outline/.test(dash));

// ── WAVE2-WORDCOUNT ──────────────────────────────────────────────────────────
check('7. total_word_count is now a declared schema field',
  /"total_word_count":\s*{/.test(read('base44/entities/NovelProject.jsonc')));
const pwc = read('src/lib/projectWordCount.js');
check('7b. rollup helper sums BODY chapters only and stamps the project',
  /isBodyChapter\(ch\)/.test(pwc) && /total_word_count: total/.test(pwc));
check('7c. every verified draft save triggers the rollup',
  /refreshProjectWordCount\(verifyRecord\.project_id\)/.test(read('src/lib/verifiedChapterSave.js')));
const rollupCallers = [
  'src/components/tools/ProjectPolishView.jsx',
  'src/components/tools/AnthologyPolishView.jsx',
  'src/lib/nonfictionPolish.js',
].filter((p) => /refreshProjectWordCount\(project\??\.id\)/.test(read(p)));
check('7d. all three polish save loops trigger the rollup', rollupCallers.length === 3);

console.log(failures === 0 ? 'ACCEPTANCE: ALL CHECKS MATCHED' : 'ACCEPTANCE: ' + failures + ' CHECK(S) FAILED');
process.exit(failures === 0 ? 0 : 1);
