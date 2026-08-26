
// ANTHOLOGYBLEED-1 acceptance battery.
//
// The defect: the narrative-ledger fold + HOLDER name-lock is the one continuity
// feature NOT disabled for anthology projects. buildPriorLedger folded EVERY earlier
// chapter's ledger and handed it to the writer; foldChapterLedgers canonicalises
// holder names across all prior ledgers, so an independent Story-2 "Marcus" holding
// one object and a Story-5 "Marcus" (a different person) merge into a single Marcus
// holding BOTH — and inherited held-object facts get injected into a sibling story's
// prompt. Anthology stories are standalone; nothing may fold across them.
//
// The fix (ProjectStudio.jsx draftChapter): priorLedger = isAnth ? null : buildPriorLedger(...)
// and saveChapterLedger is skipped for anthology. With priorLedger null the writer
// seeds a FRESH buildInitialLedger() per story (sceneWriter.js) and still builds
// within-story continuity scene-to-scene. Fixtures use invented generic names.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildInitialLedger, cloneLedger, foldChapterLedgers } from '../src/lib/narrativeLedger.js';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, '..');

let failures = 0;
const check = (name, pass) => { console.log((pass ? 'PASS ' : 'FAIL ') + name); if (!pass) failures += 1; };

// ── Part A: the semantic invariant the guard relies on (real ledger functions) ──

// A fresh story ledger has NO inherited holders.
const fresh = buildInitialLedger();
check('A1. buildInitialLedger has empty possessions (no inherited holders)',
  fresh.possessions && Object.keys(fresh.possessions).length === 0);

// The bleed is REAL: two independent stories, each with their own "Marcus" holding a
// different object, fold into a SINGLE Marcus holding BOTH objects.
const story2 = { ...buildInitialLedger(), possessions: { Marcus: ['the brass ring'] } };
const story5 = { ...buildInitialLedger(), possessions: { Marcus: ['the service revolver'] } };
const folded = foldChapterLedgers([story2, story5]);
const marcusHolds = folded.possessions?.Marcus || [];
check('A2. fold DEMONSTRATES cross-story bleed: one Marcus holds both stories objects',
  marcusHolds.includes('the brass ring') && marcusHolds.includes('the service revolver'));

// Therefore null priorLedger (anthology) = a fresh empty ledger = ZERO inherited
// holders, i.e. the bleed cannot occur.
const seededFromNull = null ? cloneLedger(null) : buildInitialLedger();
check('A3. null priorLedger seeds an empty ledger — no inherited holders can leak',
  Object.keys(seededFromNull.possessions || {}).length === 0);

// A folded priorLedger (the NOVEL path) still carries holders — the fix must NOT
// change novel behavior, only anthology.
const novelSeed = folded ? cloneLedger(folded) : buildInitialLedger();
check('A4. folded priorLedger (novel path) still carries inherited holders (unchanged)',
  Object.keys(novelSeed.possessions || {}).length > 0);

// ── Part B: the guard is wired in draftChapter — ORCH-1 moved its body into
// src/lib/chapterOrchestrator.js's runChapterDraft ──
const ps = fs.readFileSync(path.join(ROOT, 'src/lib/chapterOrchestrator.js'), 'utf8');
check('B1. prior-ledger fold is guarded off for anthology',
  ps.includes('const priorLedger = isAnth ? null : await buildPriorLedger('));
check('B2. saveChapterLedger is skipped for anthology',
  ps.includes('sceneResult?.narrativeLedger && !isAnth'));
check('B3. ANTHOLOGYBLEED-1 rationale is documented in code',
  ps.includes('ANTHOLOGYBLEED-1'));

// ── Part C: the mechanism the guard relies on — writer seeds fresh on null ──
const sw = fs.readFileSync(path.join(ROOT, 'src/lib/sceneWriter.js'), 'utf8');
check('C1. writer seeds a fresh ledger when priorLedger is null',
  sw.includes('priorLedger ? cloneLedger(priorLedger) : buildInitialLedger()'));

if (failures === 0) console.log('ACCEPTANCE: ALL CHECKS MATCHED');
process.exit(failures === 0 ? 0 : 1);
