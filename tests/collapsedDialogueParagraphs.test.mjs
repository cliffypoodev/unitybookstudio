// PARABREAK-1 proof.
//
// Live failure, 2026-07-29, Brass Meridian TEST, Chapter 5. The console said:
//
//   [DIALOGUE-MECHANICS-REPAIR] 4 ambiguous orphan closer(s) left for review
//   [DIALOGUE-ADVISORY] Ch.5: unresolved malformed dialogue was NOT enforced
//     (orphans: 4, manual review: 0). The chapter was saved; proofread its
//     quotation marks.
//
// The chapter shipped (DIALOGUEPOLICY-1 doing its job) with four unbalanced quote
// marks on the page. Reading the exported manuscript showed what the log could not:
//
//   1. All four "orphan closers" are actually MISSING OPENING QUOTES.
//   2. All four sit inside ONE paragraph -- 748 words holding ~30 lines of
//      dialogue jammed inline with narration.
//
// Those two facts are the same bug. Every repairer in this module is line-oriented
// (`src.split('\n')`), so a 748-word wall starves all of them simultaneously. Inside
// a block that size repairOrphanClosers genuinely cannot tell whether a multi-sentence
// span is speech or narration-then-speech, so it correctly refuses to guess -- and the
// defect ships.
//
// PARABREAK-1 attacks the cause, not the symptom:
//   a) splitCollapsedDialogueParagraphs() breaks one speaker turn per paragraph.
//   b) repairOrphanClosers() lifts its multi-sentence bar ONLY when the orphan span
//      IS the whole line, where "narration may precede the speech" is impossible.
//
// The fixture below is the real paragraph, verbatim from the shipped .docx.
const COLLAPSED_CH5 = 'Marcus turned his head slowly. His eyes were sunken, the skin around them gray and puffy from exhaustion. He didn\u2019t look away. He couldn\u2019t. \u201cThe log?\u201d he asked. \u201cThe entry from November 14th, 1984. The one Vale marked \u2018inconclusive.\u2019\u201d Lena tapped the cylinder core against her palm. Click. Click. Click. \u201cYou signed off on the pressure override. Two hundred psi. The manual limit was one-fifty.\u201d Marcus swallowed. His Adam\u2019s apple bobbed in the hollow of his throat. \u201cVale wanted the data. The ice shelf was thinning faster than predicted. He needed the core sample from the deep strata.\u201d \u201cHe needed it before the storm hit.\u201d Lena took another step. The floor groaned under her weight. \u201cThe storm came early, Marcus. You didn\u2019t wait for the window.\u201d \u201cI thought I could make it.\u201d \u201cDid you?\u201d Marcus closed his eyes. A muscle feathered in his jaw. \u201cI hit the override button. Just for a second. To get the drill past the frozen layer. The pressure spiked. The pipe burst.\u201d \u201cThe pipe didn\u2019t burst.\u201d Lena\u2019s voice dropped an octave. \u201cThe valve blew. And your father was at the valve.\u201d Silence stretched, thick and suffocating. The only sound was the distant thrum of the condenser unit, a heartbeat that didn\u2019t belong to either of them. Marcus opened his eyes. They were clear now, stripped of the evasion that had defined their partnership for the last three days. He looked tired. Older. \u201cLena,\u201d he said. \u201cYou lied to me in Sector Two,\u201d she said. \u201cWhen I asked about the accident reports. You said Vale was the one at the controls.\u201d Vale was the supervisor. He took the blame.\u201d Because you were the engineer. Because you pushed the button.\u201d Marcus shifted on the stretcher, wincing as the movement jarred his shoulder. He lifted the brass key, holding it up between them. The metal caught the light, glinting like a second eye. \u201cI gave you the key in Sector Three. I thought you\u2019d open the archive and see the report. I thought you\u2019d understand.\u201d \u201cI thought you were protecting me from the truth.\u201d Lena leaned forward, resting her hands on the rails of the stretcher. The cold from the metal bit through her gloves. \u201cBut you were protecting yourself.\u201d Marcus looked down at the key. His thumb rubbed over the engraved coordinates, a nervous tic she had never noticed until now. \u201cIt wasn\u2019t just the valve, Lena. The official report said the ice shifted. That it was a natural collapse. But the sensors recorded a pressure wave. Coming from below.\u201d Lena froze. The cylinder core felt suddenly heavier, pressing into her palm until the bones ached. \u201cFrom below?\u201d \u201cThe archive,\u201d Marcus said. \u201cThe mechanical lock. It wasn\u2019t just storing paper. It was sealing the chamber. The one with the anomaly. The one your father was studying.\u201d Lena stared at him. The ozone smell seemed to intensify, sharp and electric, sparking against her skin. \u201cYou opened it.\u201d I opened to check the readings. The pressure was dropping. I thought it was leaking. I didn\u2019t know the ice was compressing the core.\u201d He looked up, his gaze pleading. \u201cI didn\u2019t know he was down there.\u201d Lena pulled back. The distance between them felt vast, a chasm opening in the narrow corridor. She could see the guilt etched into the lines of his face, the way his shoulders hunched as if carrying the weight of the ice above them. He hadn\u2019t just caused the accident. He had buried it. He had let Vale take the credit for the cover-up, let Lena believe the truth was simple, tragic, and out of their hands. \u201cYou knew,\u201d she said. \u201cAll this time. You knew the station was hiding something.\u201d Marcus nodded. \u201cVale showed me the logs. The ones from the seventies. The experiments. The deep-core drilling. He said the ice was reacting to the heat. That it was alive, in a way. We needed to keep it warm to keep it stable.\u201d \u201cAnd if we let it cool?\u201d It would collapse. Take the station with it.\u201d Lena looked at the brass key in his hand. It was small, unassuming. A piece of metal that had unlocked a door, and a door that had unlocked a secret. She thought of her father, standing in the dark, listening to the ice groan. She thought of the years she had spent chasing his shadow, believing he had died a hero, a scientist lost to the elements. \u201cHe died because you were impatient,\u201d she said.';

import {
  splitCollapsedDialogueParagraphs,
  repairOrphanClosers,
  runDialogueMechanicsPass,
} from '@/lib/dialogueMechanicsRepair';

let pass = 0;
let fail = 0;
function check(name, cond) {
  if (cond) { console.log('PASS ' + name); pass += 1; }
  else { console.log('FAIL ' + name); fail += 1; }
}
const lines = (t) => String(t).split('\n').filter((l) => l.trim());
const unbalanced = (t) => lines(t).filter((l) => (l.match(/\u201c/g) || []).length !== (l.match(/\u201d/g) || []).length);
const longest = (t) => Math.max(...lines(t).map((l) => l.split(/\s+/).length));

// ─── the live failure, reproduced ──────────────────────────────────────────────

check('fixture is the real 748-word paragraph',
  COLLAPSED_CH5.split(/\s+/).length === 748);

check('fixture carries exactly 4 more closers than openers',
  (COLLAPSED_CH5.match(/\u201d/g) || []).length - (COLLAPSED_CH5.match(/\u201c/g) || []).length === 4);

// ─── (a) the splitter ──────────────────────────────────────────────────────────

const split = splitCollapsedDialogueParagraphs(COLLAPSED_CH5);

check('PARABREAK-1: the splitter is exported',
  typeof splitCollapsedDialogueParagraphs === 'function');

check('PARABREAK-1: the 748-word wall is broken up',
  lines(split.text).length > 20);

check('PARABREAK-1: no resulting paragraph is over 200 words',
  longest(split.text) <= 200);

check('PARABREAK-1: it reports how many breaks it inserted',
  split.splits === lines(split.text).length - 1 && split.splits > 0);

check('PARABREAK-1: paragraphs are separated by a blank line (app convention)',
  split.text.includes('\n\n'));

check('PARABREAK-1: not one word is added, lost or duplicated',
  split.text.replace(/[\u201c\u201d\s]+/g, ' ').trim()
    === COLLAPSED_CH5.replace(/[\u201c\u201d\s]+/g, ' ').trim());

check('PARABREAK-1: each of the four orphan turns lands on a line of its own',
  ['Vale was the supervisor', 'Because you were the engineer',
   'I opened to check the readings', 'It would collapse'].every((frag) => {
    const line = lines(split.text).find((l) => l.includes(frag));
    return line
      && (line.match(/\u201c/g) || []).length === 0
      && (line.match(/\u201d/g) || []).length === 1
      && line.trim().endsWith('\u201d');
  }));

check('PARABREAK-1: a dialogue tag is NEVER split off from its speech',
  !lines(splitCollapsedDialogueParagraphs(
    '\u201cWait,\u201d Vale said. \u201cI heard it too,\u201d she said.'
  ).text).some((l) => /^(Vale|she) (said|asked)/.test(l.trim())));

check('PARABREAK-1: a lowercase continuation stays attached',
  splitCollapsedDialogueParagraphs('\u201cStop,\u201d he said.').splits === 0);

check('PARABREAK-1: closer-then-opener is a definite turn boundary',
  splitCollapsedDialogueParagraphs(
    '\u201cWe lost an hour.\u201d \u201cTime is fluid down here,\u201d Vale said.'
  ).splits === 1);

check('PARABREAK-1: prose with no dialogue is returned untouched',
  (() => {
    const plain = 'The tunnel was cold. Lena did not answer.';
    return splitCollapsedDialogueParagraphs(plain).text === plain;
  })());

check('PARABREAK-1: an already well-formed exchange is left alone',
  splitCollapsedDialogueParagraphs(
    '\u201cReady?\u201d Vale asked.\n\n\u201cReady,\u201d she said.'
  ).splits === 0);

// ─── (b) the whole-line relaxation ─────────────────────────────────────────────

check('PARABREAK-1: a whole-line multi-sentence orphan is now healed',
  (() => {
    const r = repairOrphanClosers('Vale was the supervisor. He took the blame.\u201d');
    return r.repaired === 1
      && r.flagged === 0
      && r.text === '\u201cVale was the supervisor. He took the blame.\u201d';
  })());

check('PARABREAK-1: whole-line heals are counted separately for telemetry',
  repairOrphanClosers('It would collapse. Take the station with it.\u201d').wholeLineRepaired === 1);

// This is the case the relaxation must NOT swallow. Narration, then speech, on one
// line: the healer still cannot tell where the speech starts, and must still refuse.
check('INTEGRITY: narration followed by speech on ONE line is still flagged, not guessed',
  (() => {
    const r = repairOrphanClosers('He crossed the room. You lied to me.\u201d Marcus looked away.\u201d');
    return r.flagged > 0;
  })());

check('INTEGRITY: a multi-sentence orphan is still refused when text FOLLOWS the closer',
  (() => {
    const r = repairOrphanClosers('Vale was the supervisor. He took the blame.\u201d Marcus shifted.');
    return r.repaired === 0 && r.flagged === 1;
  })());

check('INTEGRITY: a single-sentence orphan still heals exactly as before',
  repairOrphanClosers('He took the blame.\u201d').repaired === 1);

// ─── (c) end to end, on the real paragraph ─────────────────────────────────────

const after = runDialogueMechanicsPass(COLLAPSED_CH5, { stage: 'pre-save', splitCollapsedParagraphs: true });

check('END TO END: all four orphans are repaired',
  after.orphanRepaired === 4);

check('END TO END: nothing is left flagged for the writer to proofread',
  after.orphanFlagged === 0 && after.manualReview.length === 0);

check('END TO END: every quote in the output balances',
  unbalanced(after.text).length === 0);

check('END TO END: the pass reports its paragraph splits',
  after.paragraphSplits > 0);

check('END TO END: the chapter reads as paragraphs, not a wall',
  longest(after.text) <= 200 && lines(after.text).length > 20);

// ─── (d) the option is opt-in — nonfiction must not change ─────────────────────

check('SCOPE: with the option OFF the pass behaves exactly as it did at d210597',
  (() => {
    const off = runDialogueMechanicsPass(COLLAPSED_CH5, { stage: 'pre-save' });
    return off.orphanFlagged === 4 && off.orphanRepaired === 0 && off.paragraphSplits === 0;
  })());

// DEADTEST-3: this predates DIALOGREPAIR-2 (29401907), which added an UNCONDITIONAL
// close-heavy quote healer as the last stage of runDialogueMechanicsPass -- it runs
// regardless of splitCollapsedParagraphs (that option only gates paragraph SPLITTING,
// per the "Step 0... Opt-in" comment above splitCollapsedDialogueParagraphs's call
// site). DIALOGREPAIR-2 (missing dialogue opener insertion) is one of the master fix
// plan's few universally-allowed deterministic mutations (rule 0.2/2) and correctly
// finishes these 4 fixture quotes here, since repairOrphanClosers declined them all
// as ambiguous (orphanRepaired === 0, proven above). Byte-identity was never the
// right bar; paragraph structure being untouched, and nothing but quote characters
// changing, is.
check('SCOPE: with the option OFF no paragraph breaks are introduced',
  (() => {
    const off = runDialogueMechanicsPass(COLLAPSED_CH5, { stage: 'pre-save' });
    const sameStructure = off.text.split('\n').length === COLLAPSED_CH5.split('\n').length;
    const stripOpenQuotes = (s) => s.split('“').join('');
    const onlyQuotesChanged = stripOpenQuotes(off.text) === stripOpenQuotes(COLLAPSED_CH5);
    return sameStructure && onlyQuotesChanged;
  })());

// ─── (e) the two fiction call sites must actually turn it on ───────────────────

import fs from 'node:fs';
import path from 'node:path';
const projectStudio = fs.readFileSync(path.join(process.cwd(), 'src/pages/ProjectStudio.jsx'), 'utf8');

check('WIRING: both fiction call sites pass splitCollapsedParagraphs: true',
  (projectStudio.match(/runDialogueMechanicsFinal\([^)]*splitCollapsedParagraphs: true/g) || []).length === 2);

check('WIRING: the structured-scene path enables it',
  projectStudio.includes("runDialogueMechanicsFinal(sceneProse, { stage: 'pre-save', splitCollapsedParagraphs: true })"));

check('WIRING: the non-structured fallback path enables it',
  projectStudio.includes("runDialogueMechanicsFinal(chapterContent, { stage: 'pre-save', splitCollapsedParagraphs: true })"));

check('SCOPE: the NONFICTION pre-save path is left alone',
  projectStudio.includes("runDialogueMechanicsFinal(chapterContent, { stage: 'pre-save' })")
  && /dmFinalNf = runDialogueMechanicsFinal\(chapterContent, \{ stage: 'pre-save' \}\)/.test(projectStudio));

// -------------------------------------------------------------------------
// PARABREAK-2 -- the three defects the FIRST live run of PARABREAK-1 shipped.
//
// Live evidence, brassmeridiantest 5.docx, Chapter 1 re-drafted on PARABREAK-1:
//   364 paragraphs, longest 71 words, zero over 200 -- the wall was gone.
// But reading it showed 21 new defects the console could not see:
//   * 10 paragraphs that were NOTHING BUT a dialogue tag ("Marcus asked.")
//   * 11 paragraphs ending mid-sentence at a comma+closer ("”Neither do I,”)
//   * same-speaker turns split so the reader attributes the second line to the
//     WRONG character ("”Nothing,” she said. / ”Just thermal contraction.”)
//
// The third is the serious one: a missing break costs readability, a wrong break
// changes who spoke. Where attribution is not deterministic, stay joined.
import { rejoinOrphanedDialogueTags } from '@/lib/dialogueMechanicsRepair';

const split1 = (t) => splitCollapsedDialogueParagraphs(t).text.split('\n').filter((l) => l.trim());

check('PARABREAK-2: a dialogue tag is never left alone in a paragraph',
  !split1('\u201cThe ventilation system. It cycles every forty minutes.\u201d Does it cycle now?\u201d Marcus asked. Vale shrugged. \u201cDepends on the battery banks.\u201d')
    .some((l) => /^(?:Marcus|Vale|Lena|he|she) (?:asked|said|shrugged)\.?$/i.test(l.trim())));

check('PARABREAK-2: no paragraph ends mid-sentence at a comma+closer',
  !split1('\u201cGood. I don\u2019t like the dark.\u201d Neither do I,\u201d Lena said. \u201cKeep moving.\u201d They pushed deeper.')
    .some((l) => /,\u201d$/.test(l.trim())));

check('PARABREAK-2: a healed orphan keeps its own dialogue tag attached',
  split1('\u201cThe ventilation system.\u201d Does it cycle now?\u201d Marcus asked.')
    .some((l) => l.includes('Does it cycle now?') && l.includes('Marcus asked')));

check('PARABREAK-2: an orphan span behind a leading tag is still found and split',
  (() => {
    const r = runDialogueMechanicsPass(
      '\u201cTwo weeks,\u201d Lena repeated. That\u2019s enough time to find the archive.\u201d Vale turned from the window.',
      { stage: 'pre-save', splitCollapsedParagraphs: true });
    return r.orphanFlagged === 0
      && r.text.includes('\u201cThat\u2019s enough time to find the archive.\u201d');
  })());

// --- attribution: the one that must never regress ------------------------

check('ATTRIBUTION: a tag between two speeches means ONE speaker - do not split',
  split1('\u201cNothing,\u201d she said, pulling back. \u201cJust thermal contraction.\u201d Marcus exhaled.').length === 1);

check('ATTRIBUTION: a tag plus narration still means one speaker holding the floor',
  split1('\u201cSteady,\u201d Vale said. His voice was thin, scraped raw by years of shouting. \u201cThe humidity is higher down here.\u201d Lena swung her light.').length === 1);

check('ATTRIBUTION: a bare tag between two speeches does not split',
  split1('\u201cMarcus,\u201d she said. \u201cLook at the floor.\u201d He turned.').length === 1);

check('ATTRIBUTION: a genuine speaker change with NO tag between STILL splits',
  split1('\u201cGood. I don\u2019t like the dark.\u201d \u201cNeither do I,\u201d Lena said.').length === 2);

// --- the rejoin pass repairs text that already shipped damaged -----------

check('PARABREAK-2: rejoinOrphanedDialogueTags is exported',
  typeof rejoinOrphanedDialogueTags === 'function');

check('PARABREAK-2: an already-orphaned tag is rejoined to its speech',
  (() => {
    const r = rejoinOrphanedDialogueTags('\u201cDoes it cycle now?\u201d\n\nMarcus asked.\n\nVale shrugged.');
    return r.rejoined === 1
      && r.text.split('\n').filter((l) => l.trim())[0] === '\u201cDoes it cycle now?\u201d Marcus asked.';
  })());

check('PARABREAK-2: a mid-sentence comma split is rejoined',
  (() => {
    const r = rejoinOrphanedDialogueTags('\u201cNeither do I,\u201d\n\nLena said.');
    return r.rejoined === 1 && r.text.trim() === '\u201cNeither do I,\u201d Lena said.';
  })());

check('PARABREAK-2: a tag followed by narration is rejoined whole',
  rejoinOrphanedDialogueTags('\u201cGreenland,\u201d\n\nVale said. He had arrived, his face pale.').rejoined === 1);

check('PARABREAK-2: real narration is NOT swallowed into the speech above it',
  rejoinOrphanedDialogueTags('\u201cKeep moving.\u201d\n\nThey pushed deeper into the station.').rejoined === 0);

check('PARABREAK-2: a following speech is NOT rejoined into the one above',
  rejoinOrphanedDialogueTags('\u201cKeep moving.\u201d\n\n\u201cI am trying.\u201d').rejoined === 0);

check('PARABREAK-2: nothing is rejoined when the line above does not end in speech',
  rejoinOrphanedDialogueTags('He crossed the room.\n\nMarcus asked.').rejoined === 0);

check('PARABREAK-2: the split pass reports its rejoin count',
  typeof splitCollapsedDialogueParagraphs('\u201cA.\u201d Does it work?\u201d he asked.').rejoined === 'number');

check('PARABREAK-2: rejoining never changes a single word',
  (() => {
    const src = '\u201cDoes it cycle now?\u201d\n\nMarcus asked.\n\nVale shrugged.';
    const r = rejoinOrphanedDialogueTags(src);
    return r.text.replace(/[\u201c\u201d\s]+/g, ' ').trim() === src.replace(/[\u201c\u201d\s]+/g, ' ').trim();
  })());

console.log('\nCOLLAPSED DIALOGUE PARAGRAPHS (PARABREAK-1 + PARABREAK-2): ' + pass + ' passed, ' + fail + ' failed');
if (fail > 0) process.exit(1);
