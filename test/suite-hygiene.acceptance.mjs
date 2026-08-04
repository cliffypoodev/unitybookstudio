// SUITE-HYGIENE acceptance — the rules that keep the other batteries honest.
//
// On 2026-08-04 four batteries were red and nobody knew. The causes were all
// structural, not clever:
//   1. three of them read data/_FileStore.json and asserted against the LIVE
//      manuscript, so re-drafting a chapter turned them red;
//   2. two pinned themselves to a chapter's exact word count;
//   3. five were never committed to git, so they rotted invisibly;
//   4. there was no single command that ran them all.
// This battery makes each of those a test failure instead of a surprise.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, '..');
const SELF = path.basename(fileURLToPath(import.meta.url));

let failures = 0;
const check = (label, ok, detail) => {
  console.log((ok ? 'PASS ' : 'FAIL ') + label + (ok || !detail ? '' : `\n      ${detail}`));
  if (!ok) failures += 1;
};

const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.acceptance.mjs') && f !== SELF).sort();
check('the suite is not empty', files.length >= 10, `found ${files.length}`);

// ── RULE 1: a battery never reads the live book ──
// Live book data is mutable by design - Cliff re-drafts chapters. An assertion
// against it is a photograph, and it goes red for a manuscript getting BETTER.
// Live-manuscript verdicts belong in tools/manuscript-probe.mjs, which reports.
for (const f of files) {
  const src = fs.readFileSync(path.join(DIR, f), 'utf8');
  const code = src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  check(`${f}: does not read live book data`,
    !/_FileStore|data\/_|DATA_DIR|process\.env\.UBS_DATA/.test(code),
    'move live-manuscript verdicts to tools/manuscript-probe.mjs');
  check(`${f}: does not pin itself to a live chapter word count`,
    !/expected\s+(?:about\s+)?~?\d{3,}|Re-measure before trusting/.test(code));
}

// ── RULE 2: a battery reports a verdict and exits on it ──
for (const f of files) {
  const src = fs.readFileSync(path.join(DIR, f), 'utf8');
  check(`${f}: prints the ACCEPTANCE verdict line`, /ACCEPTANCE: ALL CHECKS MATCHED/.test(src));
  check(`${f}: exits non-zero when a check fails`,
    /process\.exit\(\s*failures\s*===\s*0\s*\?\s*0\s*:\s*1\s*\)/.test(src));
}

// ── RULE 3: every battery is committed ──
// The four that rotted were all untracked. Git is the only thing that would have
// shown them changing - or not changing - while the code moved underneath them.
const git = spawnSync('git', ['-C', ROOT, 'ls-files', 'test'], { encoding: 'utf8' });
if (git.status !== 0) {
  console.log('NOTE  git unavailable here; the tracked-file rule was not evaluated.');
} else {
  const tracked = new Set(git.stdout.split('\n').map((l) => path.basename(l.trim())).filter(Boolean));
  for (const f of files) check(`${f}: is tracked by git`, tracked.has(f), 'git add it - untracked batteries rot unseen');
  check('the suite runner is tracked by git', tracked.has('run-all.mjs'));
}

// ── RULE 4: one command runs the suite ──
check('test/run-all.mjs exists', fs.existsSync(path.join(DIR, 'run-all.mjs')));
const runner = fs.existsSync(path.join(DIR, 'run-all.mjs'))
  ? fs.readFileSync(path.join(DIR, 'run-all.mjs'), 'utf8') : '';
check('the runner discovers batteries instead of listing them',
  /readdirSync/.test(runner) && /acceptance\.mjs/.test(runner),
  'a hardcoded list silently omits every battery added after it');
check('the runner prints a reason for anything it skips',
  /QUARANTINE/.test(runner) && /reason/.test(runner),
  'a silent skip reads as coverage that does not exist');
check('the runner fails the process when any battery is red',
  /process\.exit\(red === 0 \? 0 : 1\)/.test(runner));
// A battery that exits 0 while asserting nothing is worse than a red one: it reads
// as coverage. The runner counts PASS lines, so the runner is where this is caught -
// a source regex here would only check how the string is spelled.
check('the runner treats a battery that exits 0 with no checks as a failure',
  /silent-pass|pass === 0/.test(runner));

console.log(failures === 0 ? 'ACCEPTANCE: ALL CHECKS MATCHED' : `ACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
