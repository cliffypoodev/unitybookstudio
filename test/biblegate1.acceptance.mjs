// BIBLEGATE-1 acceptance battery — the bible must be complete and parseable
// before drafting. Detection only, never mutates the bible. Fixtures use
// invented generic names (Mara, Dov, Ilse), never a real book's cast.
import fs from 'node:fs';
import { auditBibleCompleteness, BIBLE_GATE_VERSION } from '../src/lib/bibleGate.js';

let failures = 0;
const check = (name, pass, detail) => { console.log((pass ? 'PASS ' : 'FAIL ') + name + (pass || !detail ? '' : `\n      ${detail}`)); if (!pass) failures += 1; };

const CLEAN_SHEET = '**1. Mara** (she/her)\n**Role:** Captain\n\n**2. Dov** (he/him)\n**Role:** Engineer';

// 1. version
check('1. version', BIBLE_GATE_VERSION === 'bible-gate-v1');

// 2. missing name with 3 mentions blocks
{
  const project = { characters_md: CLEAN_SHEET, outline_md: 'Ilse joins the crew at the harbor. Ilse warns them of the storm. Ilse insists they turn back before it is too late.' };
  const r = auditBibleCompleteness({ project, chapters: [] });
  check('2. missing name with 3 mentions blocks', r.ok === false && r.missing.some((m) => m.name === 'Ilse' && m.mentions >= 3), JSON.stringify(r));
}

// 3. a name with only 1 mention does not block (below the threshold)
{
  const project = { characters_md: CLEAN_SHEET, outline_md: 'A stranger named Ilse passes through the harbor once, unremarked.' };
  const r = auditBibleCompleteness({ project, chapters: [] });
  check('3. a name with only 1 mention does not block', !r.missing.some((m) => m.name === 'Ilse'), JSON.stringify(r));
}

// 4. "**6. Crew: Lark**" shape is malformed
{
  const project = { characters_md: '**1. Mara** (she/her)\n**Role:** Captain\n\n**6. Crew: Lark** (he/him)\n**Role:** Deckhand' };
  const r = auditBibleCompleteness({ project, chapters: [] });
  check('4. "Crew: Lark" header is flagged malformed', r.ok === false && r.malformedHeaders.some((h) => h.header.includes('Crew: Lark') && h.reason.includes('role word')), JSON.stringify(r));
}

// 5. missing pronoun declaration flagged
{
  const project = { characters_md: '**1. Mara**\n**Role:** Captain\n\n**2. Dov** (he/him)\n**Role:** Engineer' };
  const r = auditBibleCompleteness({ project, chapters: [] });
  check('5. missing pronoun declaration flagged', r.ok === false && r.malformedHeaders.some((h) => h.header === 'Mara' && h.reason.includes('pronoun')), JSON.stringify(r));
}

// 6. clean bible -> ok
{
  const project = { characters_md: CLEAN_SHEET, outline_md: 'Mara and Dov set sail into the storm together.' };
  const r = auditBibleCompleteness({ project, chapters: [] });
  check('6. clean bible -> ok', r.ok === true && r.missing.length === 0 && r.malformedHeaders.length === 0, JSON.stringify(r));
}

// 7. beat_summary mentions also count toward "missing"
{
  const project = { characters_md: CLEAN_SHEET };
  const chapters = [
    { beat_summary: 'Ilse arrives at the dock with urgent news for the crew.' },
    { beat_summary: 'Ilse argues with Dov about the plan and refuses to back down.' },
    { beat_summary: 'Ilse leaves before dawn, taking the notebook with her.' },
  ];
  const r = auditBibleCompleteness({ project, chapters });
  check('7. beat_summary mentions count toward missing', r.missing.some((m) => m.name === 'Ilse'), JSON.stringify(r));
}

// 8. context-variable pronoun declaration is accepted (not flagged missing)
{
  const project = { characters_md: '**1. Mara**\nPronouns: context-variable\n**Role:** Captain' };
  const r = auditBibleCompleteness({ project, chapters: [] });
  check('8. context-variable declaration accepted', !r.malformedHeaders.some((h) => h.reason.includes('pronoun')), JSON.stringify(r));
}

// 9. wiring source-shape: ProjectStudio.jsx calls the audit in both draftChapter and handleDraftAll
{
  const PS = fs.readFileSync(new URL('../src/pages/ProjectStudio.jsx', import.meta.url), 'utf8');
  const draftChapterIdx = PS.indexOf('const draftChapter = async');
  const handleDraftAllIdx = PS.indexOf('const handleDraftAll = async');
  check('9a. draftChapter wires auditBibleCompleteness', draftChapterIdx >= 0 && PS.slice(draftChapterIdx, draftChapterIdx + 3000).includes('auditBibleCompleteness'));
  check('9b. handleDraftAll wires auditBibleCompleteness', handleDraftAllIdx >= 0 && PS.slice(handleDraftAllIdx, handleDraftAllIdx + 2000).includes('auditBibleCompleteness'));
  check('9c. wiring is fiction-only (gated by isNonfictionProjectAuthority)', PS.includes('if (!isNonfictionProjectAuthority(generationProject)) {') && PS.includes('if (!isNonfictionProjectAuthority(project)) {'));
  check('9d. blocks via toast.error and return', PS.includes("toast.error(`Story bible incomplete"));
}

console.log(failures === 0 ? '\nACCEPTANCE: ALL CHECKS MATCHED' : `\nACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
