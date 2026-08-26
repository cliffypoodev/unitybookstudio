// LEGACYSTAGES-1 acceptance battery — Pre-Quote Artifact Repair and Final
// Artifact Cleanup become flag-only (Arc F finding 34).
//
// Neither stage deletes a paragraph from an array — manuscriptArtifactRepair.js
// operates on the whole chapter STRING through ~90 chained regex rules. The
// "deletion" was always a MERGE: a handful of those rules connect two spans
// with an unbounded \s+/\s*, which (unlike every other rule in the file) can
// match straight through a real \n{2,} paragraph break and silently fuse two
// paragraphs into one. verifyInvariant then reverted the WHOLE chapter back
// to its pre-stage snapshot — discarding every other, legitimate, in-paragraph
// fix the stage made to that chapter too, not just the merge.
//
// Fixed with guardedReplace: a drop-in for text.replace(rx, replacement) that
// refuses to let a match cross a paragraph break — it leaves that one match
// untouched and records { paragraphIndex, reason } instead, while every other
// match (same-paragraph prose, the overwhelming majority) is replaced exactly
// as before.
//
// manuscriptPolishRunner.js transitively imports the Vite "@/" alias —
// node:module's register() resolves it from inside this file, matching
// test/polishsafe5.acceptance.mjs / test/versions1d.acceptance.mjs.
import fs from 'node:fs';
import { register } from 'node:module';
register('../tests/helpers/aliasLoader.mjs', import.meta.url);
const { runManuscriptPolishPipeline } = await import('../src/lib/manuscriptPolishRunner.js');
const { repairManuscriptArtifacts } = await import('../src/lib/manuscriptArtifactRepair.js');

let failures = 0;
const check = (name, pass, detail) => { console.log((pass ? 'PASS ' : 'FAIL ') + name + (pass || !detail ? '' : `\n      ${detail}`)); if (!pass) failures += 1; };

const withCapturedConsole = async (fn) => {
  const lines = [];
  const origLog = console.log;
  const origWarn = console.warn;
  console.log = (...a) => { lines.push(a.join(' ')); };
  console.warn = (...a) => { lines.push(a.join(' ')); };
  let result;
  try {
    result = await fn();
  } finally {
    console.log = origLog;
    console.warn = origWarn;
  }
  return { result, lines };
};

const countParas = (text) => text.split(/\n{2,}/).filter((p) => p.trim().length > 0).length;

// ── 1. a fixture that previously merged two paragraphs into one now keeps both ──
{
  const text = '“Stop.”\n\nHe said it quietly, before turning to leave the small, cluttered room.';
  const loaded = [{ chapter: { chapter_number: 1, title: 'Ch 1', id: 'ch1' }, content: text, original: text }];
  await runManuscriptPolishPipeline({ loaded, project: { title: 'Test', genre: 'Fantasy', book_type: 'fiction' }, allowLLM: false, mode: 'fiction' });
  check('1. the paragraph survives (2 paragraphs before, 2 after)', countParas(loaded[0].content) === 2, loaded[0].content);
  check('1b. both original paragraphs are still present verbatim',
    loaded[0].content.includes('“Stop.”') && loaded[0].content.includes('He said it quietly, before turning to leave the small, cluttered room.'));
}

// ── 2. the flag record is present with the correct chapter/paragraphIndex/reason, and the exact log line fires ──
{
  const text = '“Stop.”\n\nHe said it quietly, before turning to leave the small, cluttered room.';
  const loaded = [{ chapter: { chapter_number: 1, title: 'Ch 1', id: 'ch1' }, content: text, original: text }];
  const { result, lines } = await withCapturedConsole(() => runManuscriptPolishPipeline({
    loaded, project: { title: 'Test', genre: 'Fantasy', book_type: 'fiction' }, allowLLM: false, mode: 'fiction',
  }));
  const flag = (result.paragraphDeletionFlags || []).find((f) => f.stage === 'Pre-Quote Artifact Repair');
  check('2. paragraphDeletionFlags has a chapter/paragraphIndex/reason record for Pre-Quote Artifact Repair',
    flag && flag.chapter === 1 && flag.paragraphIndex === 0 && typeof flag.reason === 'string' && flag.reason.length > 0,
    JSON.stringify(result.paragraphDeletionFlags));
  check('2b. the exact log line fires',
    lines.includes(`[LEGACYSTAGES-1] Ch.1: would have deleted paragraph 0 (${flag.reason}) — flagged, not removed`), JSON.stringify(lines.filter((l) => l.includes('LEGACYSTAGES-1'))));
}

// ── 3. reason attribution for a specifically-labeled culprit rule ──
{
  const r = repairManuscriptArtifacts('She spoke\n\n— low, almost afraid of being heard by the others in the room.');
  check('3. the spoke-em-dash rule is attributed by name, not a generic reason',
    (r.flaggedDeletions || []).some((f) => f.reason === 'fixed spoke-em-dash fragment'), JSON.stringify(r.flaggedDeletions));
  check('3b. the paragraph break itself is preserved', countParas(r.text) === 2, r.text);
}

// ── 4. in-paragraph artifact repair (the same stages' non-deletion edits) still happens ──
{
  const text = 'She didn t change her mind, though she knew Iris s answer wouldn t be different.';
  const loaded = [{ chapter: { chapter_number: 1, title: 'Ch 1', id: 'ch1' }, content: text, original: text }];
  const { lines } = await withCapturedConsole(() => runManuscriptPolishPipeline({
    loaded, project: { title: 'Test', genre: 'Fantasy', book_type: 'fiction' }, allowLLM: false, mode: 'fiction',
  }));
  check('4. contraction repair (same stage, no paragraph risk) still fires', loaded[0].content.includes('didn’t change') && loaded[0].content.includes('wouldn’t'), loaded[0].content);
  check('4b. a single-paragraph fixture is never flagged (negative control)', !lines.some((l) => l.includes('[LEGACYSTAGES-1]')), JSON.stringify(lines.filter((l) => l.includes('LEGACYSTAGES-1'))));
}

// ── 5. the paragraph-count invariant holds — STRUCTURE-GUARD never fires for these two stages any more ──
{
  const text = '“Stop.”\n\nHe said it quietly, before turning to leave the small, cluttered room.';
  const loaded = [{ chapter: { chapter_number: 1, title: 'Ch 1', id: 'ch1' }, content: text, original: text }];
  const { result, lines } = await withCapturedConsole(() => runManuscriptPolishPipeline({
    loaded, project: { title: 'Test', genre: 'Fantasy', book_type: 'fiction' }, allowLLM: false, mode: 'fiction',
  }));
  check('5. no [STRUCTURE-GUARD] ... REVERTED line for Pre-Quote Artifact Repair',
    !lines.some((l) => l.includes('[STRUCTURE-GUARD]') && l.includes('Pre-Quote Artifact Repair') && l.includes('REVERTED')));
  check('5b. no [STRUCTURE-GUARD] ... REVERTED line for Final Artifact Cleanup',
    !lines.some((l) => l.includes('[STRUCTURE-GUARD]') && l.includes('Final Artifact Cleanup') && l.includes('REVERTED')));
  check('5c. no structureViolations entry attributes either stage', !(result.structureViolations || []).some((v) => v.stage === 'Pre-Quote Artifact Repair' || v.stage === 'Final Artifact Cleanup'), JSON.stringify(result.structureViolations));
}

// ── 6. both stage names are unchanged in the verifyInvariant call sequence ──
{
  const src = fs.readFileSync(new URL('../src/lib/manuscriptPolishRunner.js', import.meta.url), 'utf8');
  check('6. verifyInvariant(\'Pre-Quote Artifact Repair\') is unchanged', src.includes("verifyInvariant('Pre-Quote Artifact Repair')"));
  check('6b. verifyInvariant(\'Final Artifact Cleanup\') is unchanged', src.includes("verifyInvariant('Final Artifact Cleanup')"));
}

// ── 7. the flag fires independently at both call sites when the boundary persists, without spurious duplication for a single conceptual event ──
{
  const chA = '“Stop.”\n\nHe said it quietly, before turning to leave the small, cluttered room.';
  const chB = 'A perfectly ordinary paragraph with no risky boundary at all in it whatsoever.';
  const loaded = [
    { chapter: { chapter_number: 1, title: 'Ch 1', id: 'ch1' }, content: chA, original: chA },
    { chapter: { chapter_number: 2, title: 'Ch 2', id: 'ch2' }, content: chB, original: chB },
  ];
  const { result } = await withCapturedConsole(() => runManuscriptPolishPipeline({
    loaded, project: { title: 'Test', genre: 'Fantasy', book_type: 'fiction' }, allowLLM: false, mode: 'fiction',
  }));
  const ch1Flags = (result.paragraphDeletionFlags || []).filter((f) => f.chapter === 1);
  const ch2Flags = (result.paragraphDeletionFlags || []).filter((f) => f.chapter === 2);
  check('7. chapter 1 gets exactly one flag per stage it actually runs through (C1 and C4 both see the same still-intact boundary)',
    ch1Flags.length === 2 && ch1Flags[0].stage === 'Pre-Quote Artifact Repair' && ch1Flags[1].stage === 'Final Artifact Cleanup',
    JSON.stringify(ch1Flags));
  check('7b. chapter 2 (no risk) gets zero flags', ch2Flags.length === 0, JSON.stringify(ch2Flags));
}

// ── 8. multi-chapter isolation: only the triggering chapter is ever named ──
{
  const chA = 'A perfectly ordinary paragraph with no risky boundary at all in it whatsoever.';
  const chB = '“Stop.”\n\nHe said it quietly, before turning to leave the small, cluttered room.';
  const loaded = [
    { chapter: { chapter_number: 1, title: 'Ch 1', id: 'ch1' }, content: chA, original: chA },
    { chapter: { chapter_number: 2, title: 'Ch 2', id: 'ch2' }, content: chB, original: chB },
  ];
  const { result, lines } = await withCapturedConsole(() => runManuscriptPolishPipeline({
    loaded, project: { title: 'Test', genre: 'Fantasy', book_type: 'fiction' }, allowLLM: false, mode: 'fiction',
  }));
  const legacyLines = lines.filter((l) => l.includes('[LEGACYSTAGES-1]'));
  check('8. only chapter 2 appears in the LEGACYSTAGES-1 log lines', legacyLines.length > 0 && legacyLines.every((l) => l.includes('Ch.2:')), JSON.stringify(legacyLines));
  check('8b. only chapter 2 appears in paragraphDeletionFlags', (result.paragraphDeletionFlags || []).every((f) => f.chapter === 2) && (result.paragraphDeletionFlags || []).length > 0, JSON.stringify(result.paragraphDeletionFlags));
  check('8c. the clean chapter (1) is completely untouched by this mechanism', countParas(loaded[0].content) === 1 && loaded[0].content === chA);
}

// ── 9. LEGACYSTAGES-1-FIX-INCOMPLETE-GUARD-COVERAGE: the two reviewer-found
// gaps (normalizeSmartApostropheSpacing/finalPossessiveApostropheGuard's
// unguarded \s*, and the ~30 plain-applyRule \s+ call sites the original
// commit's audit missed) no longer silently merge a paragraph ──
{
  // Reviewer's exact repro: an apostrophe split by an export artifact right
  // at a paragraph break used to collapse two paragraphs into one via
  // normalizeSmartApostropheSpacing's unguarded \s* rule.
  const r = repairManuscriptArtifacts('Something about Iris’\n\ns coat was still damp from the rain. She said nothing.');
  check('9. an apostrophe split at a paragraph break no longer silently merges the paragraph', countParas(r.text) === 2, r.text);
  check('9b. the merge is recorded as a flag, not silently applied', (r.flaggedDeletions || []).length > 0, JSON.stringify(r.flaggedDeletions));
}
{
  // Reviewer's exact repro: a contraction corrupted across a paragraph break
  // (plain applyRule, \s+ connector) used to trigger STRUCTURE-GUARD, which
  // reverted the WHOLE chapter — discarding an unrelated, legitimate,
  // same-stage, in-paragraph fix elsewhere in that same chapter.
  const text = 'She said she didn t know what to say next, and neither did he.\n\nHe insisted he didn\n\nt change his mind about anything that mattered to her.';
  const loaded = [{ chapter: { chapter_number: 1, title: 'Ch 1', id: 'ch1' }, content: text, original: text }];
  const { result, lines } = await withCapturedConsole(() => runManuscriptPolishPipeline({
    loaded, project: { title: 'Test', genre: 'Fantasy', book_type: 'fiction' }, allowLLM: false, mode: 'fiction',
  }));
  check('10. the co-located, non-boundary-crossing contraction fix still lands', loaded[0].content.includes('didn’t know what to say next'), loaded[0].content);
  check('10b. no [STRUCTURE-GUARD] ... REVERTED line fires for either stage', !lines.some((l) => l.includes('[STRUCTURE-GUARD]') && l.includes('REVERTED')), JSON.stringify(lines.filter((l) => l.includes('STRUCTURE-GUARD'))));
  check('10c. the boundary-crossing contraction split is flagged, not merged', (result.paragraphDeletionFlags || []).some((f) => f.chapter === 1 && f.reason === 'fixed did not contraction corruption'), JSON.stringify(result.paragraphDeletionFlags));
}
{
  // Source-shape audit: no plain (non-paragraph-safe) applyRule(out, ...)
  // call site anywhere in the file uses a QUANTIFIED \s+/\s* connector any
  // more — the exact class of gap this follow-up closes. A bare, unquantified
  // \s (e.g. the "(^|\s)" restored-opener rules) matches exactly one
  // character and can never span a \n{2,} boundary by itself, so it is
  // deliberately excluded here — this check only rules out the
  // one-or-more/zero-or-more shape that CAN. A future rule added the old,
  // unguarded way should fail this check rather than ship a silent regression.
  const src = fs.readFileSync(new URL('../src/lib/manuscriptArtifactRepair.js', import.meta.url), 'utf8');
  const offenders = [];
  const rx = /applyRule\(out, (\/(?:\\.|\[(?:\\.|[^\]\\])*\]|[^/\\])*\/[a-z]*),/g;
  let m;
  while ((m = rx.exec(src)) !== null) {
    if (/\\s[+*]/.test(m[1])) offenders.push(m[1]);
  }
  check('11. no plain applyRule(out, ...) call site uses a quantified \\s+/\\s* connector', offenders.length === 0, offenders.join(', '));
}

console.log(failures === 0 ? '\nACCEPTANCE: ALL CHECKS MATCHED' : `\nACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
