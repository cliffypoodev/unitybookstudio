// ARCSTATE-1 acceptance battery — data-declared resolved-arc protection. No
// phrase list lives in code; authors write "RESOLVED ARC: <Name> — <label>
// (ch <N>); forbidden: "phrase"; "phrase"" lines into canon_md /
// characters_md. Fixtures use invented generic names (Mara, Dov, Ilse).
import { parseResolvedArcs, detectArcRestarts, CHAPTER_STATE_CONTRACT_VERSION } from '../src/lib/chapterStateContract.js';

let failures = 0;
const check = (name, pass, detail) => { console.log((pass ? 'PASS ' : 'FAIL ') + name + (pass || !detail ? '' : `\n      ${detail}`)); if (!pass) failures += 1; };

const CANON = 'RESOLVED ARC: Mara\'s grief — she stops blaming herself (ch 3); forbidden: "still blames herself"; "her fault"\nRESOLVED ARC: Dov — makes peace with Ilse (ch 5); forbidden: "still furious at Ilse"';

// 1. version
check('1. version', CHAPTER_STATE_CONTRACT_VERSION === 'chapter-state-contract-v1');

// 2. parse: two RESOLVED ARC lines parsed with name/label/chapter/forbidden
{
  const arcs = parseResolvedArcs(CANON);
  check('2a. parses two arcs', arcs.length === 2, JSON.stringify(arcs));
  check('2b. first arc name/label/chapter', arcs[0]?.name === "Mara's grief" && arcs[0]?.label === 'she stops blaming herself' && arcs[0]?.chapter === 3);
  check('2c. first arc forbidden phrases', JSON.stringify(arcs[0]?.forbidden) === JSON.stringify(['still blames herself', 'her fault']));
  check('2d. second arc with single forbidden phrase', arcs[1]?.name === 'Dov' && JSON.stringify(arcs[1]?.forbidden) === JSON.stringify(['still furious at Ilse']));
}

// 3. detector fires on declared phrase
{
  const arcs = parseResolvedArcs(CANON);
  const text = 'Mara walked to the window. She still blames herself for what happened that night.';
  const targets = detectArcRestarts(text, arcs);
  check('3. detector fires on declared phrase', targets.length === 1 && targets[0].kind === 'arc-restart', JSON.stringify(targets));
}

// 4. does not fire on other (unrelated) text
{
  const arcs = parseResolvedArcs(CANON);
  const text = 'Mara walked to the window and looked out at the wide, empty sea.';
  const targets = detectArcRestarts(text, arcs);
  check('4. does not fire on unrelated text', targets.length === 0);
}

// 5. no arcs -> no detector output
{
  const text = 'Mara still blames herself for what happened that night.';
  const targets = detectArcRestarts(text, []);
  check('5. no arcs -> no detector output', targets.length === 0);
}

// 6. no RESOLVED ARC line in the source -> empty parse
check('6. no RESOLVED ARC line -> empty array', parseResolvedArcs('Just some ordinary canon notes about the setting.').length === 0);

// 7. case-insensitive match
{
  const arcs = parseResolvedArcs(CANON);
  const text = 'She whispered that she was STILL BLAMES HERSELF, though no one heard.';
  const targets = detectArcRestarts(text, arcs);
  check('7. case-insensitive match', targets.length === 1);
}

console.log(failures === 0 ? '\nACCEPTANCE: ALL CHECKS MATCHED' : `\nACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
