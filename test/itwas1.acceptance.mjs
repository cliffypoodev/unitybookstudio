// ITWAS-1 + GRAMMARREPAIR-2 acceptance battery.
//
// ITWAS-1 — live polish damage (REDUX ch.11, 2026-08-15): the "It was" starter
// cap deleted the opener before ANY non-stoplisted word, 30 sentences per Fix
// Manuscript pass. "It was indeed JB, his coat flapping wildly behind him…"
// shipped as "Indeed JB, his coat flapping wildly behind him…" — a fragment,
// in the chapter's most important sentence. Deletion is only safe for a SHORT
// adjective-only sentence ("It was quiet." → "Quiet."); anything with a comma,
// a name, an adverb opener, or more than six words is left alone.
//
// GRAMMARREPAIR-2 — three exports in one night hard-blocked on "a axle" /
// "a erratic" / "A honest" (PROSEGATE-1) even though the app already owns a
// deterministic article healer: it ran only inside cleanSceneOutput, BEFORE the
// LLM echo/repeat repairs and outside the salvage/save paths. It now also runs
// as the last pass of finalizeChapterProse — the artifact that ships. And the
// healer's "an + consonant-sound" branch ("an unicorn") no longer falls through.
import fs from 'node:fs';
import { runSentenceStarterVariation } from '../src/lib/vocabCaps.js';
import { fixIndefiniteArticles } from '../src/lib/nfContentGuard.js';

let failures = 0;
const check = (name, pass, detail) => { console.log((pass ? 'PASS ' : 'FAIL ') + name + (pass || !detail ? '' : `\n      ${detail}`)); if (!pass) failures += 1; };

// ── ITWAS-1 ──
const run = (text) => { const loaded = [{ chapter: { chapter_number: 11 }, content: text }]; runSentenceStarterVariation(loaded, () => {}); return loaded[0].content; };
// Six "It was" openers → excess 3 → the cap wants to remove three.
const SRC = 'It was indeed JB, his coat flapping wildly behind him like the wings of a distressed bat. He plodded on.\n\nIt was quiet. Nobody spoke.\n\nIt was Ottie who broke first. She laughed.\n\nIt was cold and getting colder. The wind rose.\n\nIt was a bad idea. Everyone knew it.\n\nIt was late. It was raining hard on the roof, and the crew listened.';
const OUT = run(SRC);
check('1. the live kill shape is untouched ("It was indeed JB, his coat flapping…")', OUT.includes('It was indeed JB, his coat flapping wildly'));
check('2. a name after the opener is untouched ("It was Ottie who…")', OUT.includes('It was Ottie who broke first.'));
check('3. a comma clause after the opener is untouched ("It was raining hard on the roof, and…")', OUT.includes('It was raining hard on the roof, and the crew listened.'));
check('4. POLISHSAFE-3: "It was" deletion RETIRED — short fragments are now PRESERVED (flag-only, no mutation)', OUT.includes('It was quiet. Nobody spoke.') && OUT.includes('It was cold and getting colder.') && OUT.includes('It was late. It was raining'));
check('5. the stoplist still protects "It was a …"', OUT.includes('It was a bad idea.'));
check('6. dialogue is still untouched', (() => { const t = '“It was awful. It was terrible. It was bad. It was worse. It was grim.” She sat.\n\nIt was quiet.'; const o = run(t); return o.startsWith('“It was awful. It was terrible. It was bad. It was worse. It was grim.”'); })());
check('7. more than six words after the opener is untouched', (() => { const t = 'It was one. It was two. It was three. It was four.\n\nIt was dark enough that nobody could see the far wall anymore.'; return run(t).includes('It was dark enough that nobody could see the far wall anymore.'); })());

// ── GRAMMARREPAIR-2: the healer ──
check('8. "a axle" / "a erratic" / "A honest" (the three live blocks) are healed', fixIndefiniteArticles('Broke a axle. It was a erratic leap. A honest man.').text === 'Broke an axle. It was an erratic leap. An honest man.');
check('9. "an unicorn" / "an European" (consonant SOUND) are healed to "a"', fixIndefiniteArticles('He saw an unicorn and an European.').text === 'He saw a unicorn and a European.');
check('10. correct articles are byte-identical', (() => { const s = 'An hour later a European with a unicorn and an honest umbrella left.'; return fixIndefiniteArticles(s).text === s; })());

// ── wiring (source-level) ──
const WRITER = fs.readFileSync(new URL('../src/lib/sceneWriter.js', import.meta.url), 'utf8');
const finStart = WRITER.indexOf('export async function finalizeChapterProse');
const finEnd = WRITER.indexOf('\n}\n', finStart);
const FIN = WRITER.slice(finStart, finEnd);
check('11. finalizeChapterProse heals articles as its LAST pass (after echo/repeat LLM repairs)', FIN.includes('const healedArticles = fixIndefiniteArticles(finalProse);') && FIN.lastIndexOf('fixIndefiniteArticles') > FIN.lastIndexOf('[REPEAT-1]'));
check('12. the heal is logged ([GRAMMARREPAIR-2])', FIN.includes('[GRAMMARREPAIR-2] finalize'));
const VOCAB = fs.readFileSync(new URL('../src/lib/vocabCaps.js', import.meta.url), 'utf8');
check('13. the cap regex now captures the whole sentence to judge it', VOCAB.includes('(It was(?:n\'t)?\\s+)(\\w+)([^.!?\\n]*)([.!?])') && VOCAB.includes('ITWAS_ADVERB_OPENERS'));

console.log(failures === 0 ? '\nACCEPTANCE: ALL CHECKS MATCHED' : `\nACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
