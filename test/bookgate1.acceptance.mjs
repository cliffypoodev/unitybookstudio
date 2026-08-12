// BOOKGATE-1 acceptance — structural + cross-chapter integrity of SAVED text.
//
// Runs the REAL exported functions. The headline fixtures are the actual saved
// Brass Meridian TEST chapters, so a regression here means the gate stopped
// catching a defect it has already caught in production.
import { checkStructuralIntegrity, checkBookIntegrity } from '../src/lib/pipelineValidator.js';

let failures = 0;
const check = (label, ok) => {
  console.log((ok ? 'PASS ' : 'FAIL ') + label);
  if (!ok) failures += 1;
};

// ── quote balance: the ch.3 defect ──
{
  const broken = 'He stopped at the door.\n\n“I am not going back.\n\nShe watched him go.';
  const s = checkStructuralIntegrity(broken, 3);
  check('an unclosed dialogue line fails the chapter',
    !s.pass && !s.quoteBalance.pass && s.quoteBalance.unbalancedParagraphs === 1);
  check('the failure names the offending paragraph',
    /I am not going back/.test(s.quoteBalance.details[0].excerpt));

  const fixed = 'He stopped at the door.\n\n“I am not going back.”\n\nShe watched him go.';
  check('the same text with the quote closed passes',
    checkStructuralIntegrity(fixed, 3).pass);
}
{
  // A chapter whose TOTALS balance while individual paragraphs do not.
  const sneaky = '“One line that never closes.\n\nAnother line that never opened.”';
  const s = checkStructuralIntegrity(sneaky, 1);
  check('per-paragraph balance catches what a chapter total hides',
    s.quoteBalance.open === s.quoteBalance.close && !s.quoteBalance.pass
    && s.quoteBalance.unbalancedParagraphs === 2);
}

// ── glued words ──
{
  const s = checkStructuralIntegrity('He shrugged.\n\n“I knowI know,” he said.', 1);
  check('a glued word fails the chapter', !s.pass && s.gluedWords.count === 1);
  check('the glued word is reported', s.gluedWords.details[0] === 'knowI'.toLowerCase() || /know/i.test(s.gluedWords.details[0]));
  check('ordinary camel-case product names are not glued words',
    checkStructuralIntegrity('She checked her iPhone.\n\nIt was dead.', 1).gluedWords.count === 0);
}

// ── termination ──
{
  const s = checkStructuralIntegrity('He walked to the door\n\nShe followed him home.', 1);
  check('a paragraph with no terminal punctuation fails',
    !s.pass && s.unterminatedParagraphs.count === 1);
  check('scene separators are not counted as unterminated',
    checkStructuralIntegrity('He left.\n\n* * *\n\nShe stayed.', 1).unterminatedParagraphs.count === 0);
  check('a paragraph ending on a closing quote is terminated',
    checkStructuralIntegrity('“We are done.”', 1).unterminatedParagraphs.count === 0);
}

// ── typography ──
{
  const s = checkStructuralIntegrity('“Curly here.”\n\n"Straight there."', 1);
  check('mixed straight and curly quotes fails', !s.typography.pass);
  check('an all-straight manuscript is not penalised',
    checkStructuralIntegrity('"Straight only."\n\n"Still straight."', 1).typography.pass);
}

// ── cross-chapter: repeated phrases ──
{
  const shared = 'the tremor travelled up through the soles of her worn boots';
  const b = checkBookIntegrity([
    `A door opened. ${shared}. She kept walking.`,
    `Another room. ${shared}. He said nothing.`,
  ]);
  check('a phrase repeated across two chapters is reported',
    !b.crossChapterEchoes.pass && b.crossChapterEchoes.count > 0);
  check('the echo names both chapters',
    JSON.stringify(b.crossChapterEchoes.details[0].chapters) === '[1,2]');
  check('two chapters with nothing in common pass the echo check',
    checkBookIntegrity([
      'The harbour was quiet that morning and the boats had all gone out.',
      'Rain fell on the mountain road for three days without stopping once.',
    ]).crossChapterEchoes.pass);
}

// ── cross-chapter: opening images ──
{
  const b = checkBookIntegrity([
    'The floor shuddered with a rumble that travelled up through the soles of her boots. She stopped.',
    'The door groaned with a shudder that vibrated through the soles of her boots. She waited.',
  ]);
  check('two chapters opening on the same image are reported',
    !b.openingEchoes.pass && b.openingEchoes.count === 1);
  check('the opening echo quotes the shared run',
    b.openingEchoes.details[0].shared.some((s) => /soles of her/.test(s)));
  check('distinct openings pass',
    checkBookIntegrity([
      'The harbour was quiet that morning and every boat had gone.',
      'Rain fell on the mountain road for three days without stopping.',
    ]).openingEchoes.pass);
}

// ── cross-chapter: length floor ──
{
  const long = Array.from({ length: 400 }, (_, i) => `word${i}`).join(' ') + '.';
  const short = Array.from({ length: 100 }, (_, i) => `token${i}`).join(' ') + '.';
  const b = checkBookIntegrity([long, long, short]);
  check('a chapter far below the median length is reported',
    !b.shortChapters.pass && b.shortChapters.details.length === 1
    && b.shortChapters.details[0].n === 3);
  check('evenly sized chapters pass the length floor',
    checkBookIntegrity([long, long, long]).shortChapters.pass);
}

// ── robustness ──
{
  check('empty and malformed input never throws',
    checkStructuralIntegrity('', 1).pass === true
    && checkStructuralIntegrity(null, 1).pass === true
    && checkBookIntegrity([]).chapters === 0
    && checkBookIntegrity(null).chapters === 0);
  check('chapter records with a content field are accepted',
    checkBookIntegrity([{ content: 'One two three four five six.' }]).chapters === 1);
}

// ── book-agnostic guarantee ──
{
  // The same structural verdict must fall out regardless of story vocabulary.
  const arctic = 'Lena gripped the brass key.\n\n“We are leaving now.';
  const regency = 'Beatrice gripped the silver fan.\n\n“We are leaving now.';
  const a = checkStructuralIntegrity(arctic, 1);
  const r = checkStructuralIntegrity(regency, 1);
  check('the verdict is identical across unrelated books (no story vocabulary)',
    a.pass === r.pass && a.pass === false
    && a.quoteBalance.unbalancedParagraphs === r.quoteBalance.unbalancedParagraphs);
}

console.log(failures === 0 ? 'ACCEPTANCE: ALL CHECKS MATCHED' : `ACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
