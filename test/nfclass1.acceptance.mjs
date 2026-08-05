// NFCLASS-1 acceptance — one authority for "is this project nonfiction".
//
// MEASURED on the live library, 2026-08-05. Six detectors existed and disagreed. The
// widest, manuscriptFixer.isNonfictionFixerProject, matched /historical/ against a
// haystack containing the genre AND THE TITLE, and claimed EIGHT declared-fiction
// novels as nonfiction — every Historical Fiction book in the library:
//
//   Siren in the Sand · The Scribe of Galilee · The Field of Blood
//   The Stone Rolled Away · The Tongues of Fire · The Persecutor's Road
//   The House of Cornelius (27 chapters, 101,400 words) · Songbird
//
// All eight carry book_type: 'fiction'. The detector gates
// runNonfictionManuscriptIntegrityGate, whose job is stripping invented personas —
// on a novel that replaces the author's characters with role labels.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  isNonfictionProject, isFictionProject, isNonfictionGenreName, explainProjectType,
  NONFICTION_GENRE_TERMS,
} from '../src/lib/projectType.js';

let failures = 0;
const check = (label, ok, detail) => {
  console.log((ok ? 'PASS ' : 'FAIL ') + label + (ok || !detail ? '' : `\n      ${detail}`));
  if (!ok) failures += 1;
};

// ── the eight books, exactly as the live records carry them ──
const MISCLASSIFIED = [
  { title: 'Siren in the Sand', book_type: 'fiction', project_type: 'fiction', genre: 'Romance', subgenre: 'Historical Romance' },
  { title: 'The Scribe of Galilee', book_type: 'fiction', project_type: 'fiction', genre: 'Historical Fiction' },
  { title: 'The Field of Blood', book_type: 'fiction', project_type: 'fiction', genre: 'Historical Fiction' },
  { title: 'The Stone Rolled Away', book_type: 'fiction', project_type: 'fiction', genre: 'Historical Fiction' },
  { title: 'The Tongues of Fire', book_type: 'fiction', project_type: 'fiction', genre: 'Historical Fiction' },
  { title: "The Persecutor's Road", book_type: 'fiction', project_type: 'fiction', genre: 'Historical Fiction' },
  { title: 'The House of Cornelius', book_type: 'fiction', project_type: 'fiction', genre: 'Historical Fiction' },
  { title: 'Songbird', book_type: 'fiction', project_type: 'fiction', genre: 'Women’s Fiction', subgenre: 'LGBTQ Historical Fiction' },
];
for (const p of MISCLASSIFIED) {
  check(`"${p.title}" is fiction`, isFictionProject(p) && !isNonfictionProject(p),
    JSON.stringify(explainProjectType(p)));
  check(`   …and it is decided by the DECLARED type, not the genre`,
    explainProjectType(p).basis === 'declared');
}

// ── a declared type always wins; inference may never override the author ──
check('declared nonfiction is nonfiction', isNonfictionProject({ book_type: 'nonfiction', genre: 'Thriller' }));
check('declared fiction beats a nonfiction-looking genre',
  isFictionProject({ book_type: 'fiction', genre: 'History' }));
check('declared fiction beats a nonfiction-looking title',
  isFictionProject({ book_type: 'fiction', genre: 'Mystery', title: 'A Field Guide to Automata' }));
check('project_type alone is enough to declare',
  isNonfictionProject({ project_type: 'nonfiction' }) && isFictionProject({ project_type: 'fiction' }));
check('erotica is a declared type and is not nonfiction',
  isFictionProject({ project_type: 'erotica', genre: 'Romance' }));

// ── A TITLE IS NEVER A TYPE ──
for (const title of [
  'A Field Guide to Automata', 'The Field of Blood', 'A History of Small Rooms',
  'The Memoir of a Liar', 'Documentary Evidence', 'The Policy', 'Medical Grade',
  'Training Day', 'The Manual', 'Case Study in Scarlet',
]) {
  check(`title "${title}" does not make a novel nonfiction`,
    isFictionProject({ book_type: 'fiction', genre: 'Thriller', title }));
  check(`   …and with nothing declared, the title is STILL ignored`,
    isFictionProject({ genre: 'Thriller', title }), JSON.stringify(explainProjectType({ genre: 'Thriller', title })));
}

// ── genre inference, used only when nothing is declared ──
check('a qualified fiction genre is fiction', !isNonfictionGenreName('Historical Fiction'));
for (const g of ['Crime Fiction', 'Literary Fiction', 'Speculative Fiction', 'Science Fiction',
  'Romantic Fiction', "Women's Fiction", 'Young Adult Fiction', 'Christian Fiction', 'Contemporary Fiction']) {
  check(`"${g}" is fiction`, !isNonfictionGenreName(g));
}
for (const g of ['Nonfiction', 'Non-Fiction', 'Memoir', 'Biography', 'True Crime', 'History',
  'Self-Help', 'Business', 'Cookbook']) {
  check(`"${g}" infers nonfiction`, isNonfictionGenreName(g));
}
check('an empty genre infers nothing', !isNonfictionGenreName('') && !isNonfictionGenreName(null));
check('the term list is frozen', Object.isFrozen(NONFICTION_GENRE_TERMS));

// ── the verdict can always explain itself ──
{
  const d = explainProjectType({ book_type: 'fiction', genre: 'Historical Fiction' });
  check('a declared verdict says so', d.basis === 'declared' && /fiction/.test(d.detail));
  const i = explainProjectType({ genre: 'Memoir' });
  check('an inferred verdict says so', i.basis === 'genre-inference' && /Memoir/.test(i.detail));
  check('null and undefined do not throw',
    isFictionProject(null) && isFictionProject(undefined) && isFictionProject({}));
}

// ── nothing may classify from a title again ──
{
  const LIB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'lib');
  const offenders = [];
  // Extract the BODY of every function whose name says it classifies nonfiction, and
  // assert none of them reads a title. The first version of this check used a loose
  // proximity regex and flagged four unrelated files — a battery that cries wolf is
  // worse than none, so it now slices the actual function.
  for (const f of fs.readdirSync(LIB).filter((x) => x.endsWith('.js'))) {
    const src = fs.readFileSync(path.join(LIB, f), 'utf8');
    const rx = /(?:export )?function (isNonfiction[A-Za-z]*)\s*\([^)]*\)\s*\{/g;
    let m;
    while ((m = rx.exec(src)) !== null) {
      const close = src.indexOf('\n}', m.index);
      const body = src.slice(m.index, close < 0 ? src.length : close);
      const code = body.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
      if (/\.title|\.subtitle/.test(code)) offenders.push(`${f}:${m[1]}`);
    }
  }
  check('no nonfiction detector reads the project title', offenders.length === 0, offenders.join(', '));
}

console.log(failures === 0 ? 'ACCEPTANCE: ALL CHECKS MATCHED' : `ACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
