#!/usr/bin/env node
// UBS gate suite runner.
//
// Every integrity gate in this app has an acceptance battery beside it. Before
// 2026-08-04 there was no way to run them together, five of them were never
// committed to git, and four had been silently red for days - three because they
// asserted against the LIVE manuscript and the manuscript had improved.
//
// One command, every battery, no silent skips: a quarantined battery prints its
// reason every run so it cannot quietly become permanent.
//
//   node test/run-all.mjs            all batteries
//   node test/run-all.mjs holder     only batteries whose name contains "holder"
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, '..');

// A battery lands here ONLY when the code it tests is not in the tree. It is not
// a way to silence a failure - the reason is printed on every run.
const QUARANTINE = {};

const filter = process.argv[2] || '';
const files = fs.readdirSync(DIR)
  .filter((f) => f.endsWith('.acceptance.mjs'))
  .filter((f) => !filter || f.includes(filter))
  .sort();

let green = 0; let red = 0; let checks = 0; let quarantined = 0;
const reds = [];

for (const f of files) {
  if (QUARANTINE[f]) {
    quarantined += 1;
    console.log(`SKIP  ${f.padEnd(42)} quarantined`);
    console.log(`      reason: ${QUARANTINE[f]}`);
    continue;
  }
  const r = spawnSync(process.execPath, [path.join(DIR, f)], { cwd: ROOT, encoding: 'utf8' });
  const out = (r.stdout || '') + (r.stderr || '');
  const pass = (out.match(/^PASS /gm) || []).length;
  const fail = (out.match(/^FAIL /gm) || []).length;
  checks += pass;
  if (r.status === 0 && pass === 0) {
    // silent-pass: exited clean while asserting nothing. This is how a battery
    // whose imports quietly stopped resolving reads as coverage.
    red += 1;
    reds.push([f, out + '\nRUNNER: exited 0 but emitted no PASS lines - this battery asserted nothing.']);
    console.log(`FAIL  ${f.padEnd(42)} exited 0 with NO checks (silent pass)`);
  } else if (r.status === 0) {
    green += 1;
    console.log(`OK    ${f.padEnd(42)} ${String(pass).padStart(4)} checks`);
  } else {
    red += 1;
    reds.push([f, out]);
    console.log(`FAIL  ${f.padEnd(42)} ${String(pass).padStart(4)} pass / ${fail} fail`);
  }
}

for (const [f, out] of reds) {
  console.log(`\n──────── ${f} ────────`);
  const lines = out.split('\n').filter((l) => /^FAIL |Error|PRECONDITION|ACCEPTANCE/.test(l));
  console.log((lines.length ? lines : out.split('\n').slice(-25)).join('\n'));
}

console.log('\n' + '─'.repeat(64));
console.log(`batteries: ${green} green, ${red} red, ${quarantined} quarantined   |   ${checks} checks passed`);
process.exit(red === 0 ? 0 : 1);
