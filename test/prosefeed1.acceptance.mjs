// PROSEFEED-1 acceptance battery.
//
// The defect (found live during the ch.10 state-machine proof): every
// prose-fed writer system — pronoun inference, the STYLEBUDGET-1 book ledger,
// the CHARSTATE-1 state machine — read `prior.content_md` directly, which is
// an EMPTY STRING for every URL-stored chapter. They all built from nothing:
// the style ledger shipped empty ban lists for an entire 80k-word draft
// (why "like a" ROSE after STYLEBUDGET-1 landed), and the CHARSTATE contract
// silently skipped its own proof run. PRONOUNLOCK escaped only because its
// canon can come from sheet declarations without prose.
//
// Design under test: one resolved prior-prose array, built through
// resolveChapterContent with an inline fast-path, feeds all three writer
// systems and the beat planner's state block.
import fs from 'node:fs';

let failures = 0;
const check = (name, pass, detail) => { console.log((pass ? 'PASS ' : 'FAIL ') + name + (pass || !detail ? '' : `\n      ${detail}`)); if (!pass) failures += 1; };

const WRITER = fs.readFileSync(new URL('../src/lib/sceneWriter.js', import.meta.url), 'utf8');
const STUDIO = fs.readFileSync(new URL('../src/pages/ProjectStudio.jsx', import.meta.url), 'utf8');

// ── 1. the resolver exists and is loud ──
check('1. writer resolves prior prose once, through chapterStorage, with an inline fast-path', WRITER.includes("import { resolveChapterContent } from '@/lib/chapterStorage'") && /const body = inline\.length > 200 \? inline : String\(\(await resolveChapterContent\(prior\)\) \|\| ''\)/.test(WRITER));
check('2. resolution is logged (silent skips are how this bug lived for a week)', WRITER.includes('[PROSEFEED] Resolved'));
check('3. resolution fails open per chapter AND as a whole', WRITER.includes('fail open per chapter') && WRITER.includes('[PROSEFEED] Prior-prose resolution failed open'));

// ── 2. all three prose-fed systems consume the RESOLVED array ──
check('4. pronoun inference reads resolved prose', /const priorTexts = resolvedPriorProse\.map\(\(entry\) => entry\.text\)/.test(WRITER));
check('5. the character state machine reads resolved prose', /const statePriorChapters = resolvedPriorProse; \/\/ PROSEFEED-1/.test(WRITER));
check('6. the style ledger reads resolved prose', /const styleTexts = resolvedPriorProse\.map\(\(entry\) => entry\.text\); \/\/ PROSEFEED-1/.test(WRITER));
check('7. no prose-fed writer system reads prior.content_md directly anymore', !/allProjectChapters\s*\n?\s*\.filter\([^)]*\)\s*\n?\s*\.map\(\(prior\) => String\(prior\?\.content_md/.test(WRITER));

// ── 3. planner side ──
check('8. beat planner resolves prior prose for its state block', STUDIO.includes('PROSEFEED-1: content_md is empty for URL-stored chapters') && /String\(\(await resolveChapterContent\(prior\)\) \|\| ''\)/.test(STUDIO));

console.log(failures === 0 ? '\nACCEPTANCE: ALL CHECKS MATCHED' : `\nACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
