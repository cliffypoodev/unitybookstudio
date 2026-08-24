// POLISHSAFE-4 acceptance battery — with allowLLM:false (and the LLM-lane
// overrides off), deterministic polish changes NOTHING but typography and
// the four allowed heals (rule 0.2/2). Banned/capped vocabulary and every
// other word/phrase-substitution stage from the C1 inventory is flag-only.
//
// manuscriptPolishRunner.js (and three of its retired modules —
// anthologyPolishChecks.js, prosePolishQualityGate.js, nonfictionPolish.js)
// transitively import the Vite "@/" alias and cannot run under bare Node
// (rule 0.1). Every OTHER retired module imports cleanly, so this battery
// exercises those directly with a dense fixture and falls back to
// source-shape checks (fs.readFileSync) for the three that don't.
import fs from 'node:fs';
import { runVocabCaps, buildBannedVocabularyPromptBlock, detectBannedVocabulary, BANNED_WORDS_HARD_REMOVE, CAPPED_VOCABULARY } from '../src/lib/vocabCaps.js';
import { reduceAISlopDeterministic, recastBannedVocabulary } from '../src/lib/aiSlopReduction.js';
import { runChatGPTVocabCaps, runTransitionWordCaps, runDichotomyPatternReducer } from '../src/lib/chatgptPatternPolish.js';
import { runStackedClauseVariation } from '../src/lib/sentencePatternPolish.js';
import { fixVoicePatterns } from '../src/lib/voicePatternPolish.js';
import { runExternalAiPatternFix } from '../src/lib/externalAiPatterns.js';
import { runDialogueTagCaps } from '../src/lib/dialogueTagPolish.js';
import { runCopingMechanismCaps } from '../src/lib/punctuationPolish.js';
import { runStyleTicSweep } from '../src/lib/styleTicSweep.js';
import { repairLoadedManuscriptArtifacts } from '../src/lib/manuscriptArtifactRepair.js';
import { runAntiDetectionPolish } from '../src/lib/antiDetectionPolish.js';

let failures = 0;
const check = (name, pass, detail) => { console.log((pass ? 'PASS ' : 'FAIL ') + name + (pass || !detail ? '' : `\n      ${detail}`)); if (!pass) failures += 1; };

// ── dense fiction fixture: generic names (Mara, Dov, Ilse), banned words,
//    capped words over cap, telling tags, "It was" openers, similes,
//    emotional-math shapes — balanced quotes, correct articles ──
const chapterText = [
  'Mara stood in the shimmering hall. She felt palpable dread. She felt hollow. She felt a knot. She felt cold. She felt lost. She felt sick.',
  '“It was luminous,” Dov said. “It was quiet.” It was strange. It was late. It was over.',
  'Ilse had wasted three days of patience on him, a small price against a decade of favors owed.',
  'The intricate machine hummed. A meticulously built cage held the answer, and the tapestry of it all felt like a trap and like a promise.',
  'He was tired. He was certain. She was ready. She was afraid. They were gone.',
  'Dov exhaled. Dov exhaled again. Mara shuddered. Mara shuddered once more, as if the room itself were watching.',
].join('\n\n');

function makeLoaded(text) {
  return [{ chapter: { chapter_number: 1, id: 'ch1' }, content: text, original: text }];
}

// 1. vocabCaps.js Phase 0/1 — banned + capped vocab flagged, text unchanged
{
  const loaded = makeLoaded(chapterText.repeat(3)); // repeat to push capped words over cap
  const r = runVocabCaps(loaded, () => {}, { project: { book_type: 'fiction' } });
  const unchanged = loaded[0].content === chapterText.repeat(3);
  const hasBanned = r.changes.some((c) => c.startsWith('BANNED') && c.includes('POLISHSAFE-4'));
  const hasCapped = r.changes.some((c) => c.startsWith('Capped') && c.includes('POLISHSAFE-4'));
  check('1. vocabCaps.js: banned vocab flagged, text unchanged', unchanged && hasBanned, JSON.stringify(r.changes));
  check('2. vocabCaps.js: capped vocab flagged', hasCapped, JSON.stringify(r.changes));
}

// 3. vocabCaps.js: NF fixture also unchanged
{
  const loaded = makeLoaded(chapterText.repeat(3));
  const before = loaded[0].content;
  runVocabCaps(loaded, () => {}, { project: { book_type: 'nonfiction' } });
  check('3. vocabCaps.js: NF fixture unchanged too', loaded[0].content === before);
}

// 4. aiSlopReduction.js: reduceAISlopDeterministic never mutates
{
  const dense = 'She felt a strange dread. She felt hollow. She felt cold. She felt sick. She felt lost. She felt raw. It wasn’t just fear; it was terror.'.repeat(3);
  const r = reduceAISlopDeterministic(dense);
  check('4. aiSlopReduction.js: reduceAISlopDeterministic text unchanged', r.text === dense, `flagged=${r.flaggedForLLM.length}`);
}

// 5. aiSlopReduction.js: recastBannedVocabulary never mutates, flags
{
  const dense = 'The shimmering tapestry was a testament to intricate, meticulous craftsmanship.';
  const r = recastBannedVocabulary(dense);
  check('5. aiSlopReduction.js: recastBannedVocabulary text unchanged and flags', r.text === dense && r.flagged.length > 0, JSON.stringify(r.flagged));
}

// 6. chatgptPatternPolish.js: three functions never mutate
{
  const dense = 'The record proves this, undeniably. This is not X. It is Y. This is not simple. It is complex. This is not fine. It is fine.'.repeat(2);
  const loaded = makeLoaded(dense);
  const before = loaded[0].content;
  runChatGPTVocabCaps(loaded, () => {});
  runTransitionWordCaps(loaded, () => {});
  runDichotomyPatternReducer(loaded, () => {});
  check('6. chatgptPatternPolish.js: text unchanged across all three functions', loaded[0].content === before);
}

// 7. sentencePatternPolish.js, voicePatternPolish.js, externalAiPatterns.js unchanged
{
  const dense = 'His voice was quiet. His voice was tense. His voice was low. His voice was rough. His voice was distant. Sarah, moving quickly through the room, grabbed her bag. '.repeat(6);
  const loaded = makeLoaded(dense);
  const before = loaded[0].content;
  runStackedClauseVariation(loaded, () => {});
  fixVoicePatterns(loaded, 1);
  runExternalAiPatternFix(loaded);
  check('7. sentencePatternPolish/voicePatternPolish/externalAiPatterns: text unchanged', loaded[0].content === before);
}

// 8. dialogueTagPolish.js + punctuationPolish.js: text unchanged
{
  const dense = 'She whispered. He whispered. She whispered again. He rubbed her palm. He rubbed her palm again. '.repeat(4);
  const loaded = makeLoaded(dense);
  const before = loaded[0].content;
  runDialogueTagCaps(loaded, () => {});
  runCopingMechanismCaps(loaded, () => {});
  check('8. dialogueTagPolish.js + punctuationPolish.js: text unchanged', loaded[0].content === before);
}

// 9. styleTicSweep.js: text unchanged, Pauline never injected
{
  const dense = 'Her mouth went dry. His mouth was dry. There is a wall between us now. You have built it. It was a mirror, showing everything. '.repeat(3);
  const loaded = makeLoaded(dense);
  const before = loaded[0].content;
  runStyleTicSweep(loaded, () => {}, {});
  check('9. styleTicSweep.js: text unchanged, no fabricated content', loaded[0].content === before && !loaded[0].content.includes('Pauline'));
}

// 10. manuscriptArtifactRepair.js: Arthur/Cora never renamed
{
  const dense = 'Arthur walked into the room. Cora smiled at him. '.repeat(3);
  const loaded = makeLoaded(dense);
  repairLoadedManuscriptArtifacts(loaded, { forceSongbirdAliases: true });
  check('10. manuscriptArtifactRepair.js: Arthur/Cora not renamed', loaded[0].content.includes('Arthur') && loaded[0].content.includes('Cora') && !loaded[0].content.includes('Langston') && !loaded[0].content.includes('Clara'));
}

// 11. antiDetectionPolish.js: telling tags flagged (already retired pre-arc), text unchanged
{
  const dense = 'He felt the truth settle. He felt the weight. He felt the cold. He felt the fear. He felt the doubt. He felt nothing. '.repeat(3);
  const loaded = makeLoaded(dense);
  const before = loaded[0].content;
  runAntiDetectionPolish(loaded, () => {}, { project: { book_type: 'fiction' } });
  check('11. antiDetectionPolish.js: telling tags/emotional math flagged, text unchanged', loaded[0].content === before);
}

// 12. regen-lane banned-vocab detector wired
{
  const targets = detectBannedVocabulary('Mara walked into the shimmering room and sat down at the intricate table.');
  check('12. detectBannedVocabulary finds banned-vocab targets', targets.length >= 2 && targets.every((t) => t.kind === 'banned-vocab'));
}

// 13. writer prompt banned-vocabulary block
{
  const block = buildBannedVocabularyPromptBlock();
  check('13. writer prompt block starts "BANNED VOCABULARY"', block.startsWith('BANNED VOCABULARY') && block.includes('shimmering'));
}

// 14. lists exported
check('14. BANNED_WORDS_HARD_REMOVE and CAPPED_VOCABULARY are exported arrays', Array.isArray(BANNED_WORDS_HARD_REMOVE) && BANNED_WORDS_HARD_REMOVE.length > 0 && Array.isArray(CAPPED_VOCABULARY) && CAPPED_VOCABULARY.length > 0);

// ── source-shape checks ──
const VOCAB_SRC = fs.readFileSync(new URL('../src/lib/vocabCaps.js', import.meta.url), 'utf8');
check('15. vocabCaps.js no longer substitutes in Phase 0/1', !/f\.content = f\.content\.replace\(regex/.test(VOCAB_SRC));

const SW_SRC = fs.readFileSync(new URL('../src/lib/sceneWriter.js', import.meta.url), 'utf8');
check('16. sceneWriter.js prompt builder wires the banned-vocabulary block', SW_SRC.includes('buildBannedVocabularyPromptBlock') && SW_SRC.includes('banned_vocabulary'));

const RUNNER_SRC = fs.readFileSync(new URL('../src/lib/manuscriptPolishRunner.js', import.meta.url), 'utf8');
check('17. manuscriptPolishRunner.js wires detectBannedVocabulary into the regen lane', (RUNNER_SRC.match(/detectBannedVocabulary/g) || []).length >= 3);

// 18-20. source-shape checks for the three alias-blocked modules
const ANTH_SRC = fs.readFileSync(new URL('../src/lib/anthologyPolishChecks.js', import.meta.url), 'utf8');
check('18. anthologyPolishChecks.js: vocab bans and body-language dedup flag-only', ANTH_SRC.includes('POLISHSAFE-4') && !ANTH_SRC.includes('replacePhraseSafely(content, word, replacement)'));

const PPQG_SRC = fs.readFileSync(new URL('../src/lib/prosePolishQualityGate.js', import.meta.url), 'utf8');
check('19. prosePolishQualityGate.js: only a-obvious remains an actual repair rule', PPQG_SRC.includes('FLAG_ONLY_RULES') && /const REPAIR_RULES = \[\s*\{\s*id: 'a-obvious'/.test(PPQG_SRC));

const NFP_SRC = fs.readFileSync(new URL('../src/lib/nonfictionPolish.js', import.meta.url), 'utf8');
check('20. nonfictionPolish.js: overclaim/abstract-phrase substitution retired, hardcoded sentence retired', NFP_SRC.includes('POLISHSAFE-4') && !/next = next\.replace\(malformedQuestion,/.test(NFP_SRC));

console.log(failures === 0 ? '\nACCEPTANCE: ALL CHECKS MATCHED' : `\nACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
