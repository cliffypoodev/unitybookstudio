// PRONOUNLOCK-1 acceptance battery — canonical character pronouns.
//
// The defect (live 82k-word draft): one character took he/his ×31, she/her ×46,
// they/their ×44 — the book never settled a pronoun set and nothing knew it
// should. Design under test: canon by explicit declaration or dominant-usage
// inference; unresolved characters are never enforced; writer gets canon as a
// hard prompt contract; export gate WARNS on drift (never hard-blocks —
// disguise plots make automated pronoun fixes wrong).
import fs from 'node:fs';
import {
  parseDeclaredPronouns,
  inferPronounsFromProse,
  buildPronounCanon,
  scanPronounViolations,
  buildPronounCanonLines,
  harvestCastNames,
} from '../src/lib/pronounLock.js';

let failures = 0;
const check = (name, pass, detail) => { console.log((pass ? 'PASS ' : 'FAIL ') + name + (pass || !detail ? '' : `\n      ${detail}`)); if (!pass) failures += 1; };

// ── 1. declarations ──
const sheet = `### Major Characters
**1. Protagonist: Vessa 'Vee' Marlin**
- **Role:** Pilot. Pronouns: she/her
**2. Engineer: Torren Oduya (he/him)**
**3. Navigator: Quill Barrow — they/them**`;
const declared = parseDeclaredPronouns(sheet);
check('1. parses "Pronouns: she/her", "(he/him)", and "— they/them" declaration styles', declared.Vessa === 'she' && declared.Torren === 'he' && declared.Quill === 'they');

// ── 2. inference ──
const prose1 = 'Vessa checked the panel. She frowned at it. Vessa tightened her grip and held her breath. Vessa knew she was right. Vessa said she would fly. Vessa lifted her visor.';
const prose2 = 'The crowd cheered. They wanted more. Quill watched them go, and they all vanished into the dusk.';
const inf = inferPronounsFromProse([prose1, prose2], ['Vessa', 'Quill']);
check('2. dominant she-usage infers she/her canon', inf.canon.Vessa === 'she');
check('3. they-usage is NEVER inferred as canon (plural pollution)', inf.canon.Quill === undefined);
const mixed = 'Marn stood up. He grabbed the rail. Marn slipped and she caught the rail again. Marn shouted as he fell. Marn said she was fine. Marn wondered if he should stop. Marn knew she could not.';
check('4. heavily mixed usage stays unresolved, reported with tallies', (() => { const r = buildPronounCanon({ characters_md: '' }, [mixed], ['Marn']); return r.canon.Marn === undefined && r.unresolved.length === 1 && r.unresolved[0].name === 'Marn'; })());

// ── 3. declaration overrides inference ──
const canonOverride = buildPronounCanon({ characters_md: 'Marn (they/them)' }, [mixed], ['Marn']);
check('5. explicit declaration overrides mixed usage and resolves the character', canonOverride.canon.Marn === 'they' && canonOverride.unresolved.length === 0);

// ── 4. violation scanning ──
const drift = scanPronounViolations('Vessa sealed the hatch. He pulled the lever twice.', { Vessa: 'she' }, ['Vessa']);
check('6. opposite-gender pronoun after a sole-name sentence is flagged', drift.length === 1 && drift[0].expected === 'she/her');
check('7. plural they after a gendered-canon name is NOT flagged', scanPronounViolations('Vessa waved at the crew. They waved back at her.', { Vessa: 'she' }, ['Vessa']).length === 0);
check('8. two-name sentences are unattributable and skipped', scanPronounViolations('Vessa handed Torren the wrench and he smiled.', { Vessa: 'she' }, ['Vessa', 'Torren']).length === 0);
check('9. they-canon flags gendered pronouns', scanPronounViolations('Quill checked the charts. He nodded slowly.', { Quill: 'they' }, ['Quill']).length === 1);

// ── 5. cast harvesting ──
const cast = harvestCastNames(sheet, ['Vessa flew on. Brint waited by the silo. Brint had a long day. Brint, Brint, Brint, Brint, Brint, Brint, Brint, Brint, Brint spoke.'], { proseMin: 8 });
check('10. cast includes sheet-header names and prose-prominent names', cast.includes('Vessa') && cast.includes('Torren') && cast.includes('Quill') && cast.includes('Brint'));
check('11. sheet label soup (Role, Wound, Want) is excluded', !cast.includes('Role') && !cast.includes('Pronouns') && !cast.includes('Protagonist'));

// ── 6. prompt line ──
check('12. canon renders as a prompt-ready line', buildPronounCanonLines({ Vessa: 'she', Quill: 'they' }) === 'Vessa: she/her; Quill: they/them');
check('13. empty canon renders nothing', buildPronounCanonLines({}) === '');

// ── 7. wiring (source-level, live files) ──
const WRITER = fs.readFileSync(new URL('../src/lib/sceneWriter.js', import.meta.url), 'utf8');
check('14. writer builds canon per chapter and puts it in the scene contract', WRITER.includes('harvestCastNames(project?.characters_md, priorTexts)') && WRITER.includes('CHARACTER PRONOUNS (canonical'));
const GATE = fs.readFileSync(new URL('../src/lib/exportSafetyGate.js', import.meta.url), 'utf8');
check('15. export gate scans for drift and reports WARNINGS, with unresolved-cast notice', GATE.includes('scanPronounViolations(body, pronounCanon.canon, castNames)') && GATE.includes('MIXED pronoun usage and no declaration'));
check('16. gate never hard-blocks on pronouns', !/hardFailures\.push\([^)]*PRONOUNLOCK/s.test(GATE));

console.log(failures === 0 ? '\nACCEPTANCE: ALL CHECKS MATCHED' : `\nACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
