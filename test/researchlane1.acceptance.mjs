// RESEARCHQUALITY-2C acceptance battery — one evidence corpus for every lane.
//
// The defect: buildFactLedger / closedWorldCheck read project.research_md RAW.
// The draft lane hydrates it from research_md_url (hydrateProjectForGeneration),
// but runManuscriptPolishPipeline and runPreExportSafetyGate received the raw
// record, so a URL-backed brief silently thinned the polish/export closed world.
// A fate attested only in the brief passed drafting, then was stripped at polish
// or blocked at export. Fixture uses generic content only.
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, '..');

let failures = 0;
const check = (name, pass) => {
  console.log((pass ? 'PASS ' : 'FAIL ') + name);
  if (!pass) failures += 1;
};

// ── wiring: both lanes hydrate, helper exists and fails open ──
const rs = fs.readFileSync(path.join(ROOT, 'src/lib/researchStorage.js'), 'utf8');
check('researchStorage exports ensureResearchEvidence', rs.includes('export async function ensureResearchEvidence(project)'));
const mpr = fs.readFileSync(path.join(ROOT, 'src/lib/manuscriptPolishRunner.js'), 'utf8');
check('polish lane hydrates before gate evaluation', mpr.includes('project = await ensureResearchEvidence(project);'));
check('polish lane imports the helper', mpr.includes("import { ensureResearchEvidence } from './researchStorage.js';"));
const esg = fs.readFileSync(path.join(ROOT, 'src/lib/exportSafetyGate.js'), 'utf8');
check('export lane hydrates before gate evaluation', esg.includes('project = await ensureResearchEvidence(project);'));
check('export lane imports the helper', esg.includes("import { ensureResearchEvidence } from './researchStorage.js';"));

// ── behavior: vm harness over researchStorage with a mocked file store ──
const mkCtx = (fileText) => {
  const ctx = {
    console: { log: () => {}, warn: () => {} },
    String, Number, Object, Array, Math, Date, JSON, Error, Promise, RegExp, setTimeout,
    retrieveFile: async (url) => (url && String(url).startsWith('local://') ? fileText : null),
    base44: { functions: { invoke: async () => ({ data: {} }) } },
  };
  vm.createContext(ctx);
  const body = rs.split('\n').filter((l) => !l.startsWith('import ')).join('\n');
  vm.runInContext(body.replace(/^export /gm, '') + '\nthis.ensureResearchEvidence = ensureResearchEvidence;', ctx);
  return ctx;
};

const FULL = 'The committee heard testimony through the spring and recorded each session in the county ledger. '.repeat(3);
const hyd = await mkCtx(FULL).ensureResearchEvidence({ id: 'p1', research_md: '', research_md_url: 'local://p1/research_md/blob' });
check('URL-backed record gains inline research_md for gate evaluation', hyd.research_md === FULL);
const inl = await mkCtx(FULL).ensureResearchEvidence({ id: 'p2', research_md: 'already inline', research_md_url: 'local://p2/blob' });
check('inline-present record is returned unchanged', inl.research_md === 'already inline');
const dead = await mkCtx(null).ensureResearchEvidence({ id: 'p3', research_md: '', research_md_url: 'local://p3/dead' });
check('dead URL fails open — project returned unchanged', dead.research_md === '');
const nul = await mkCtx(FULL).ensureResearchEvidence(null);
check('null project fails open', nul === null);

if (failures === 0) console.log('ACCEPTANCE: ALL CHECKS MATCHED');
process.exit(failures === 0 ? 0 : 1);
