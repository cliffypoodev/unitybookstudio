#!/usr/bin/env node
// UBS manuscript probe — run every continuity gate against a LIVE book and REPORT.
//
// This is the other half of the 2026-08-04 test-suite repair. Three acceptance
// batteries used to read data/_FileStore.json and assert exact verdicts about
// Brass Meridian. They went red every time a chapter was re-drafted - including
// when it was re-drafted BETTER - and because they were never committed, nobody
// saw it. Assertions moved to frozen fixtures; the live-manuscript work lives here.
//
// This tool ASSERTS NOTHING and always exits 0. Its output is telemetry for a
// human. Nothing about it is specific to any book: the project, its cast and its
// chapters are all discovered from the data.
//
//   node --max-old-space-size=8192 tools/manuscript-probe.mjs
//   node --max-old-space-size=8192 tools/manuscript-probe.mjs --project <id>
//   node --max-old-space-size=8192 tools/manuscript-probe.mjs --object "brass key" --object "flare gun"
//   node --max-old-space-size=8192 tools/manuscript-probe.mjs --list
import fs from 'fs';
import path from 'path';
import { checkPossessionContinuity } from '../src/lib/objectPossession.js';
import { inferCastGenders, normalizeCast } from '../src/lib/referentResolver.js';
import { extractLimbFacts, checkConditionAttribution, checkConditionInflation } from '../src/lib/sceneContractGate.js';
import { measureRhythm, formatRhythmLine } from '../src/lib/proseRhythm.js';

const DATA = path.resolve('data');
const argv = process.argv.slice(2);
const argOf = (flag) => { const i = argv.indexOf(flag); return i >= 0 ? argv[i + 1] : null; };
const argsOf = (flag) => argv.reduce((a, v, i) => (v === flag && argv[i + 1] ? [...a, argv[i + 1]] : a), []);

const readJson = (file) => {
  const p = path.join(DATA, file);
  if (!fs.existsSync(p)) return null;
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  return Array.isArray(j) ? j : (j.items || Object.values(j));
};

const projects = readJson('NovelProject.json') || [];
if (!projects.length) { console.log('No data/NovelProject.json — run from the repo root on the machine that holds the data.'); process.exit(0); }

const chaptersAll = readJson('Chapter.json') || [];
const chaptersFor = (pid) => chaptersAll
  .filter((c) => String(c?.project_id || '') === pid)
  .sort((a, b) => (a.chapter_number || 0) - (b.chapter_number || 0));

const withChapters = projects.filter((p) => chaptersFor(p.id).length > 0)
  .sort((a, b) => String(b.updated_date || '').localeCompare(String(a.updated_date || '')));

if (argv.includes('--list')) {
  console.log('projects with chapters, most recently updated first:\n');
  for (const p of withChapters.slice(0, 25)) {
    console.log(`  ${String(p.id).padEnd(22)} ${String(p.genre || '?').padEnd(14)} ${String(chaptersFor(p.id).length).padStart(3)} ch   ${p.title || '(untitled)'}`);
  }
  process.exit(0);
}

const wanted = argOf('--project');
const project = wanted ? projects.find((p) => p.id === wanted) : withChapters[0];
if (!project) { console.log(`No project ${wanted}. Try --list.`); process.exit(0); }

// ── chapter text: the entity record first, the file store as fallback ──
const textOf = (c) => String(c?._resolved_content || c?.content_md || c?.content || '');
let chapters = chaptersFor(project.id).map((c) => ({
  n: c.chapter_number, title: c.title || '', text: textOf(c),
}));
if (chapters.some((c) => !c.text)) {
  const store = readJson('_FileStore.json') || [];
  const byFolder = new Map();
  for (const e of store) {
    const m = /^([^/]+)\/([^/]+)\/chapter-/.exec(String(e?.id || ''));
    if (!m || m[1] !== project.id) continue;
    const cur = byFolder.get(m[2]);
    if (!cur || String(e.id) > String(cur.id)) byFolder.set(m[2], e);
  }
  const ordered = [...byFolder.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  if (ordered.length) {
    chapters = ordered.map(([, e], i) => ({ n: i + 1, title: '(from file store, draft order)', text: String(e.content || '') }));
  }
}
chapters = chapters.filter((c) => c.text.trim());
if (!chapters.length) { console.log(`Project ${project.id} has no saved chapter text yet.`); process.exit(0); }

// ── cast: from the project's own character sheet, or --cast ──
const castArg = argOf('--cast');
let castNames = castArg ? castArg.split(',').map((s) => s.trim()).filter(Boolean) : [];
if (!castNames.length) {
  const md = String(project._resolved_characters_md || project.characters_md || '');
  const lines = md.split('\n');
  for (let i = 0; i < lines.length - 1; i += 1) {
    const name = lines[i].trim();
    const next = (lines[i + 1] || '').trim();
    if (!name || name.length > 44 || /^[-#*>|]/.test(name) || name.endsWith(':')) continue;
    if (!/^[A-ZÀ-ɏ]/.test(name)) continue;
    if (/^(Structural|Behavioral|Relational|Voice|Arc)\b/i.test(name)) continue;
    if (/^(Structural|Behavioral|Relational|Voice|Arc)\s*:/i.test(next)) castNames.push(name);
  }
  castNames = [...new Set(castNames)];
}
const allProse = chapters.map((c) => c.text).join('\n\n');
const cast = castNames.length ? inferCastGenders(allProse, castNames) : [];

const words = (t) => t.split(/\s+/).filter(Boolean).length;
const bar = (s) => console.log('\n' + s + '\n' + '─'.repeat(Math.max(20, s.length)));

console.log(`UBS MANUSCRIPT PROBE — reports only, asserts nothing, always exits 0`);
console.log(`project : ${project.title || '(untitled)'}  [${project.id}]`);
console.log(`genre   : ${project.genre || '?'}   chapters with text: ${chapters.length}`);
console.log(`cast    : ${cast.length ? cast.map((c) => `${c.name}(${c.gender || '?'})`).join(', ') : '(none discovered — pass --cast "A,B")'}`);

bar('LENGTH');
const counts = chapters.map((c) => words(c.text));
const median = [...counts].sort((a, b) => a - b)[Math.floor(counts.length / 2)];
for (const [i, c] of chapters.entries()) {
  const pct = median ? Math.round((counts[i] / median) * 100) : 0;
  console.log(`  ch.${String(c.n).padStart(2)} ${String(counts[i]).padStart(6)} words  ${String(pct).padStart(4)}% of median${pct < 80 ? '   <- BELOW THE 80% FLOOR' : ''}   ${c.title}`);
}
console.log(`  median ${median} words | total ${counts.reduce((a, b) => a + b, 0)}`);

bar('RHYTHM');
for (const c of chapters) console.log('  ' + formatRhythmLine(`ch.${c.n}`, measureRhythm(c.text)).line);

if (cast.length) {
  bar('POSSESSION CONTINUITY (carried across chapters)');
  const objects = argsOf('--object');
  if (!objects.length) {
    console.log('  no --object given, so nothing was checked. Pass one or more:');
    console.log('    --object "brass key" --object "flare gun"');
  }
  for (const obj of objects) {
    let entry = null;
    console.log(`  ── ${obj} ──`);
    for (const c of chapters) {
      const r = checkPossessionContinuity({ prose: c.text, object: obj, cast, entryHolder: entry });
      console.log(`     ch.${String(c.n).padStart(2)} events=${String(r.events.length).padStart(3)} violations=${r.violations.length} exit=${r.exitHolder || '(none)'}`);
      for (const v of r.violations) console.log(`        ${v.from} -> ${v.to} :: ${String(v.sentence).slice(0, 110)}`);
      entry = r.exitHolder ?? entry;
    }
  }

  bar('LIMB FACTS AND CONDITION CONSISTENCY');
  const ledgerConditions = {};
  for (const c of chapters) {
    const facts = extractLimbFacts(c.text, cast);
    if (!facts.length) { console.log(`  ch.${String(c.n).padStart(2)} (no limb facts)`); continue; }
    console.log(`  ch.${String(c.n).padStart(2)} ${facts.map((f) => `${f.displayName}/${f.side}/${f.part || '?'}/${f.kind}`).join('  ')}`);
    const drift = checkConditionAttribution({ facts, ledgerConditions });
    const infl = checkConditionInflation({ facts, ledgerConditions });
    for (const d of [...drift, ...infl]) console.log(`        ${d.code}: ${String(d.message).slice(0, 150)}`);
    for (const f of facts) {
      (ledgerConditions[f.displayName] = ledgerConditions[f.displayName] || [])
        .push(`${f.side}${f.part ? ' ' + f.part : ''} ${f.kind === 'loss' ? 'amputated/severed' : f.kind}`);
    }
  }
}

bar('DONE');
console.log('Nothing above is an assertion. Frozen-fixture assertions live in test/*.acceptance.mjs;');
console.log('run them with: node test/run-all.mjs');
process.exit(0);
