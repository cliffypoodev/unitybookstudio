// BYLINE-1 acceptance — the app never injects "Hermes Agent" as an author; blank author yields no fake byline
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

let pass = 0, failures = 0;
function check(name, cond) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { failures++; console.log('FAIL ' + name); }
}

const root = new URL('..', import.meta.url).pathname;
const read = (p) => readFileSync(join(root, p), 'utf-8');

const autonovel = read('src/lib/autonovel.js');
check('autonovel has zero Hermes Agent author defaults', !autonovel.includes("author_name: 'Hermes Agent'"));
check('autonovel has three blank author defaults', (autonovel.match(/author_name: '',/g) || []).length >= 3);
check('cover prompt uses conditional author clause', autonovel.includes('${project.author_name ? ` by ${project.author_name}` : '));
check('cover prompt fallback to Hermes Agent removed', !autonovel.includes("project.author_name || 'Hermes Agent'"));

const dashboard = read('src/pages/Dashboard.jsx');
check('Dashboard quick-create paths have zero Hermes Agent', !dashboard.includes('Hermes Agent'));
check('Dashboard quick-create paths use blank author', (dashboard.match(/author_name: '',/g) || []).length >= 2);

const rewrite = read('src/components/dashboard/RewriteFromManuscript.jsx');
check('RewriteFromManuscript has zero Hermes Agent', !rewrite.includes('Hermes Agent'));

const psf = read('src/components/novel/ProjectSettingsFields.jsx');
const setup = read('src/components/notebook/SetupTab.jsx');
check('ProjectSettingsFields placeholder says Enter pen name', psf.includes('placeholder="Enter pen name"') && !psf.includes('Hermes Agent'));
check('SetupTab placeholder says Enter pen name', setup.includes('placeholder="Enter pen name"') && !setup.includes('Hermes Agent'));

const wiring = read('tests/setupFoundationWiring.test.mjs');
check('wiring test asserts blank defaults', wiring.includes("author_name === ''") && !wiring.includes("author_name === 'Hermes Agent'"));

function srcFilesContaining(dir, needle, hits) {
  for (const entry of readdirSync(join(root, dir))) {
    const rel = join(dir, entry);
    const st = statSync(join(root, rel));
    if (st.isDirectory()) srcFilesContaining(rel, needle, hits);
    else if (readFileSync(join(root, rel), 'utf-8').includes(needle)) hits.push(rel);
  }
  return hits;
}
const allowed = new Set([
  'src/components/home/ExplainerSection.jsx',
  'src/components/home/NovelHero.jsx',
  'src/components/home/ActionLinks.jsx',
]);
const residual = srcFilesContaining('src', 'Hermes Agent', []);
check('only homepage branding still mentions Hermes Agent', residual.every((f) => allowed.has(f)) && residual.length <= allowed.size);
if (!residual.every((f) => allowed.has(f))) console.log('UNEXPECTED FILES: ' + residual.filter((f) => !allowed.has(f)).join(', '));

console.log(failures === 0 ? '\nACCEPTANCE: ALL CHECKS MATCHED' : `\nACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
