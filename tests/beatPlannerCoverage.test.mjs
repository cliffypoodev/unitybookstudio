// NARRATIVE-CONNECT-3 proof: the fiction beat planner must receive prior-chapter
// coverage memory, and must omit the block entirely when there is none.
import { buildSceneBeatPrompt } from '@/lib/autonovel';

let pass = 0;
let fail = 0;
function check(name, cond) {
  if (cond) { console.log('PASS ' + name); pass += 1; }
  else { console.log('FAIL ' + name); fail += 1; }
}

const project = {
  title: 'Test Novel',
  book_type: 'fiction',
  genre: 'thriller',
  outline_md: 'Outline text.',
  canon_md: 'Canon rules.',
  mystery_md: 'Mystery thread.',
  twists_md: 'Twist contract.',
  settings: { chapter_length: 'standard' },
};
const chapter = { chapter_number: 7, title: 'The Archive', beat_summary: 'Iris opens the archive.' };
const previousChapter = { chapter_number: 6, content_md: 'Prior prose tail.' };
const chapters = [
  { chapter_number: 6, title: 'Six', beat_summary: 'Six beats.' },
  { chapter_number: 7, title: 'The Archive', beat_summary: 'Iris opens the archive.' },
];

const COVERAGE = '\n=== WHAT HAS ALREADY BEEN COVERED (do NOT repeat) ===\n--- Chapter 4: The Confrontation ---\nEvents: Iris confronted Cross in the parking garage and he admitted the forgery.\n===\n';

const withCoverage = await buildSceneBeatPrompt(project, chapter, previousChapter, chapters, COVERAGE);
const withoutCoverage = await buildSceneBeatPrompt(project, chapter, previousChapter, chapters, '');
const legacyFourArg = await buildSceneBeatPrompt(project, chapter, previousChapter, chapters);

check('coverage text reaches the beat prompt',
  withCoverage.includes('Iris confronted Cross in the parking garage'));
check('coverage carries the do-not-replay directive',
  withCoverage.includes('DO NOT PLAN ANY SCENE THAT REPEATS THIS'));
check('coverage sits before the uniqueness block',
  withCoverage.indexOf('DO NOT PLAN ANY SCENE THAT REPEATS THIS') <
  withCoverage.indexOf('Generate approximately'));
check('empty coverage emits no block',
  !withoutCoverage.includes('DO NOT PLAN ANY SCENE THAT REPEATS THIS'));
check('4-arg legacy callers still work and emit no block',
  typeof legacyFourArg === 'string' &&
  legacyFourArg.length > 0 &&
  !legacyFourArg.includes('DO NOT PLAN ANY SCENE THAT REPEATS THIS'));
check('adding coverage is the ONLY difference vs. the no-coverage prompt',
  withoutCoverage === legacyFourArg &&
  withCoverage.length > withoutCoverage.length);
check('nonfiction path is untouched by the new argument', await (async () => {
  const nf = { ...project, book_type: 'nonfiction' };
  const a = await buildSceneBeatPrompt(nf, chapter, previousChapter, chapters, COVERAGE);
  const b = await buildSceneBeatPrompt(nf, chapter, previousChapter, chapters);
  return a === b;
})());

console.log('\nBEAT PLANNER COVERAGE: ' + pass + ' passed, ' + fail + ' failed');
if (fail > 0) process.exit(1);
