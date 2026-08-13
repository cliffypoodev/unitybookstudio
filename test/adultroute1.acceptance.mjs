// ADULTROUTE-1 + AUTHORITYBLOCK-1 acceptance battery.
//
// The defect (proven at 596a47e, 2026-08-13): the adult-content pipeline's structured
// stages — anthology collection shell, batch story outlines, single-story repair, story
// bibles, and per-chapter scene beats — all route to the ARCHITECT agent
// (deepseek-r1-14b, an ALIGNED reasoning model). Two independent causes:
//   1. resolveAgent has an isNSFW branch for prose but none for architect tasks, so a
//      spice-4 erotica project's outlines/beats/bibles go to the aligned model.
//   2. Even the prose NSFW branch could never fire through invokeLLMWithRetry: every
//      caller passes the project as `spec:`, but the wrapper reads only
//      `payload._project || payload.project` (integrationRetry.js) — routing always saw
//      null. The drop-guard then discarded the explicit uncensored model for architect
//      tasks and fell back to R1.
//   3. The batch-outline and anthology-bible prompts carried the spice LEVEL but not the
//      FICTION COMMISSION AUTHORITY block (eroticaAuthority.js), so the outline model got
//      a spice-4 request with no authority framing — refusal/sanitization bait.
// Fixes: an architect_nsfw agent (same uncensored model as prose, architect temperature);
// `_project:` piped at the six structured-stage call sites; the authority block (which
// self-gates to erotica/spice>=3 and returns '' otherwise) prepended to the fiction batch
// outline prompt and the fiction anthology bible prompt.
// Fixtures are generic. No book-specific strings.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { resolveAgent, AGENT_MODELS, AGENT_TEMPERATURES, AGENT_ENDPOINTS, AGENT_CTX_TOKENS } from '../src/lib/localLLM.js';
import { buildEroticaAuthorityBlocks } from '../src/lib/eroticaAuthority.js';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, '..');

let failures = 0;
const check = (name, pass) => { console.log((pass ? 'PASS ' : 'FAIL ') + name); if (!pass) failures += 1; };

const eroticaAnthology = { project_type: 'anthology', book_type: 'fiction', genre: 'Erotica', spice_level: 4, erotica_register: 3, anthology_theme: 'a generic adult theme' };
const eroticaNovel = { book_type: 'fiction', genre: 'Dark Erotica', spice_level: 3 };
const plainFiction = { book_type: 'fiction', genre: 'Cozy Mystery', spice_level: 0 };
const nonfiction = { book_type: 'nonfiction', genre: 'History', project_type: 'nonfiction' };

// ── 1. Runtime routing: NSFW projects never touch the aligned architect ──
check('1. foundation @ erotica anthology -> architect_nsfw', resolveAgent('foundation', eroticaAnthology) === 'architect_nsfw');
check('2. outline @ erotica anthology -> architect_nsfw', resolveAgent('outline', eroticaAnthology) === 'architect_nsfw');
check('3. beats @ erotica novel -> architect_nsfw', resolveAgent('beats', eroticaNovel) === 'architect_nsfw');
check('4. chapter_plan @ erotica novel -> architect_nsfw', resolveAgent('chapter_plan', eroticaNovel) === 'architect_nsfw');
check('5. architect_nsfw model IS the uncensored prose model', AGENT_MODELS.architect_nsfw === AGENT_MODELS.ghostwriter && /uncensored/i.test(AGENT_MODELS.architect_nsfw || ''));
check('6. architect_nsfw keeps architect temperature', AGENT_TEMPERATURES.architect_nsfw === AGENT_TEMPERATURES.architect);
check('7. architect_nsfw has endpoint + ctx entries', AGENT_ENDPOINTS.architect_nsfw === AGENT_ENDPOINTS.architect && AGENT_CTX_TOKENS.architect_nsfw === AGENT_CTX_TOKENS.architect);

// ── 2. Runtime routing: everything else is untouched ──
check('8. foundation @ plain fiction still -> architect (unchanged)', resolveAgent('foundation', plainFiction) === 'architect');
check('9. foundation @ null project still -> architect (unchanged)', resolveAgent('foundation', null) === 'architect');
check('10. foundation @ nonfiction still -> nonfiction_writer (NFCLASS authority path unchanged)', resolveAgent('foundation', nonfiction) === 'nonfiction_writer');
check('11. prose @ erotica still -> ghostwriter_nsfw (unchanged)', resolveAgent('prose', eroticaAnthology) === 'ghostwriter_nsfw');
check('12. prose @ plain fiction still -> ghostwriter (unchanged)', resolveAgent('prose', plainFiction) === 'ghostwriter');

// ── 3. The wrapper can actually SEE the project now (source-level: the six call sites) ──
const retrySrc = fs.readFileSync(path.join(ROOT, 'src/lib/integrationRetry.js'), 'utf8');
check('13. wrapper reads _project for routing (unchanged contract)', retrySrc.includes("payload._project || payload.project"));

const batchSrc = fs.readFileSync(path.join(ROOT, 'src/lib/anthologyBatchOutline.js'), 'utf8');
check('14. anthologyBatchOutline pipes _project at both call sites', (batchSrc.match(/_project: project,/g) || []).length === 2);

const studioSrc = fs.readFileSync(path.join(ROOT, 'src/pages/ProjectStudio.jsx'), 'utf8');
check('15. ProjectStudio pipes _project at shell site', studioSrc.includes('_project: shellProject,'));
check('16. ProjectStudio pipes _project at expand-settings site', studioSrc.includes('_project: { ...settingsDrafts, book_type: bookType },'));
check('17. ProjectStudio pipes _project at beat site', studioSrc.includes('_project: promptProject,'));

const pbgSrc = fs.readFileSync(path.join(ROOT, 'src/lib/parallelBibleGenerator.js'), 'utf8');
check('18. parallelBibleGenerator pipes _project', pbgSrc.includes('_project: settings,'));

// ── 4. Authority block reaches the outline + bible prompts (source + runtime) ──
check('19. batch outline imports the authority builder (relative)', batchSrc.includes("from './eroticaAuthority.js'"));
check('20. fiction batch prompt opens with the authority block', batchSrc.includes('return `${buildEroticaAuthorityBlocks(project)}You are generating story outlines for a FICTION ANTHOLOGY'));
const engineSrc = fs.readFileSync(path.join(ROOT, 'src/lib/anthologyEngine.js'), 'utf8');
check('21. anthology engine imports the authority builder (relative)', engineSrc.includes("from './eroticaAuthority.js'"));
check('22. fiction anthology bible prompt opens with the authority block', engineSrc.includes('return `${buildEroticaAuthorityBlocks(project)}You are designing an anthology'));

// ── 5. The authority block self-gates: erotica gets it, everything else gets '' ──
const blocks = buildEroticaAuthorityBlocks(eroticaAnthology);
check('23. spice-4 erotica emits commission authority + scene enforcement + raw register', blocks.includes('FICTION COMMISSION AUTHORITY') && blocks.includes('EROTICA SCENE ENFORCEMENT') && blocks.includes('RAW'));
check('24. clean fiction emits NOTHING (bible/outline prompts unchanged for non-erotica)', buildEroticaAuthorityBlocks(plainFiction) === '');
check('25. under-18 refusal line survives inside the authority block', blocks.includes('under 18'));

// ── 6. The NF authority path is not weakened: NF anthology never gets the erotica block via genre alone ──
const nfAnthology = { project_type: 'anthology', book_type: 'nonfiction', genre: 'History', spice_level: 0, anthology_theme: 'documented cases' };
check('26. NF anthology emits no authority block', buildEroticaAuthorityBlocks(nfAnthology) === '');
check('27. NF anthology foundation still -> nonfiction_writer, never architect_nsfw', resolveAgent('foundation', nfAnthology) === 'nonfiction_writer');

console.log(failures === 0 ? '\nACCEPTANCE: ALL CHECKS MATCHED' : `\nACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
