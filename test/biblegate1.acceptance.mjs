// BIBLEGATE-1 acceptance battery — the bible must be complete and parseable
// before drafting. Detection only, never mutates the bible. Fixtures use
// invented generic names (Mara, Dov, Ilse), never a real book's cast.
import fs from 'node:fs';
import { auditBibleCompleteness, BIBLE_GATE_VERSION } from '../src/lib/bibleGate.js';

let failures = 0;
const check = (name, pass, detail) => { console.log((pass ? 'PASS ' : 'FAIL ') + name + (pass || !detail ? '' : `\n      ${detail}`)); if (!pass) failures += 1; };

const CLEAN_SHEET = '**1. Mara** (she/her)\n**Role:** Captain\n\n**2. Dov** (he/him)\n**Role:** Engineer';

// 1. version (bumped to v3 by BIBLEGATE-1C, see checks 14-15)
check('1. version', BIBLE_GATE_VERSION === 'bible-gate-v3');

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

// 4. BIBLEGATE-1B (live proof on REDUX, 2026-08-24): "**N. Role: Name**" is
// the app's own foundation-generator shape ("**1. Protagonist: Ottilie 'Ottie'
// Brisa**") — parseCanonCast's colon-split already recovers the real name,
// so it is legitimate and must NOT be flagged. This check used to assert
// "Crew: Solveig" was malformed on the (stale) assumption parseCanonCast
// extracted "Crew"; live evidence proved parseCanonCast already extracts
// "Solveig" correctly for this exact shape. The real malformed case — no name
// at all recoverable, just a bare role word — is check 4b.
{
  const project = { characters_md: '**1. Mara** (she/her)\n**Role:** Captain\n\n**2. Protagonist: Ilse** (they/them)\n**Role:** Protagonist' };
  const r = auditBibleCompleteness({ project, chapters: [] });
  check('4a. "Protagonist: Ilse" (Role: Name shape) is NOT flagged malformed', r.malformedHeaders.length === 0, JSON.stringify(r));
}
{
  const project = { characters_md: '**1. Mara** (she/her)\n**Role:** Captain\n\n**6. Crew**\n**Role:** Deckhand\n**Pronouns:** he/him' };
  const r = auditBibleCompleteness({ project, chapters: [] });
  check('4b. a bare role word with no recoverable name IS flagged malformed', r.malformedHeaders.some((h) => h.reason.includes('role word')), JSON.stringify(r));
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

// 10. BIBLEGATE-1B: a compound proper noun (ship/place name) is never "missing"
// (fixture hygiene, BIBLEGATE-1C: invented names, not a real book's ship/town)
{
  const project = {
    characters_md: CLEAN_SHEET,
    outline_md: 'The Amber Tide left port at dawn. Mara stood at the helm of the Amber Tide. They passed through Briar Hollow on the way. Briar Hollow was quiet, the streets of Briar Hollow empty.',
  };
  const r = auditBibleCompleteness({ project, chapters: [] });
  check('10. compound proper nouns (ship/place names) are not flagged missing', !r.missing.some((m) => ['Amber', 'Tide', 'Briar', 'Hollow'].includes(m.name)), JSON.stringify(r.missing));
}

// 11. BIBLEGATE-1B: a title-only word (only appears in a chapter heading) is never "missing"
{
  const project = {
    characters_md: CLEAN_SHEET,
    outline_md: '## Chapter 10: The Long Winter Silence\n\nMara and Dov argued about the plan long into the night, saying little of comfort.',
  };
  const r = auditBibleCompleteness({ project, chapters: [] });
  check('11. a title-only word is not flagged missing', !r.missing.some((m) => m.name === 'Winter' || m.name === 'Silence'), JSON.stringify(r.missing));
}

// 12. BIBLEGATE-1B: a "the X" common/place noun is never "missing"
{
  const project = {
    characters_md: CLEAN_SHEET,
    outline_md: 'They walked past the Lighthouse. The Lighthouse stood dark against the storm. No one had lit the Lighthouse in years.',
  };
  const r = auditBibleCompleteness({ project, chapters: [] });
  check('12. a "the X" common noun is not flagged missing', !r.missing.some((m) => m.name === 'Lighthouse'), JSON.stringify(r.missing));
}

// 13. BIBLEGATE-1B: a real missing person survives all three filters (regression against over-filtering)
{
  const project = {
    characters_md: CLEAN_SHEET,
    outline_md: 'Ilse’s voice crackled over the comm. "Warning," Ilse said, "debris ahead." The crew listened as Ilse repeated it. Dov cursed under his breath at Ilse.',
  };
  const r = auditBibleCompleteness({ project, chapters: [] });
  check('13. a real missing person still survives the filters', r.missing.some((m) => m.name === 'Ilse'), JSON.stringify(r.missing));
}

// 14. BIBLEGATE-1C: it/its is a legal pronoun declaration (a ship AI, a robot,
// an animal, a haunted object — any non-human cast member)
{
  const project = { characters_md: '**1. Mara** (she/her)\n**Role:** Captain\n\n**3. Aegis** (it/its)\n**Role:** Ship AI' };
  const r = auditBibleCompleteness({ project, chapters: [] });
  check('14. it/its pronoun declaration accepted', !r.malformedHeaders.some((h) => h.header === 'Aegis'), JSON.stringify(r));
}

// 15. BIBLEGATE-1C: a quoted/cited name that never acts is never "missing" —
// possessive and object mentions only, the actor filter (not the title-only
// filter) is what saves it
{
  const project = {
    characters_md: CLEAN_SHEET,
    outline_md: 'Dov quotes Voss to make his point. The plan was pure Voss, everyone agreed. Mara rolled her eyes at Dov\'s Voss obsession.',
  };
  const r = auditBibleCompleteness({ project, chapters: [] });
  check('15. a quoted-author name that never acts is not flagged missing', !r.missing.some((m) => m.name === 'Voss'), JSON.stringify(r.missing));
}

// 9. wiring source-shape: the audit runs in both draftChapter and handleDraftAll.
// ORCH-1 moved draftChapter's body (and its bible-gate call) out of
// ProjectStudio.jsx into src/lib/chapterOrchestrator.js's runChapterDraft;
// handleDraftAll's own, separate bible check was untouched by that move.
{
  const PS = fs.readFileSync(new URL('../src/pages/ProjectStudio.jsx', import.meta.url), 'utf8');
  const ORCH = fs.readFileSync(new URL('../src/lib/chapterOrchestrator.js', import.meta.url), 'utf8');
  const runChapterDraftIdx = ORCH.indexOf('export async function runChapterDraft');
  const handleDraftAllIdx = PS.indexOf('const handleDraftAll = async');
  check('9a. draftChapter (now runChapterDraft) wires auditBibleCompleteness', runChapterDraftIdx >= 0 && ORCH.slice(runChapterDraftIdx, runChapterDraftIdx + 3000).includes('auditBibleCompleteness'));
  check('9b. handleDraftAll wires auditBibleCompleteness', handleDraftAllIdx >= 0 && PS.slice(handleDraftAllIdx, handleDraftAllIdx + 2000).includes('auditBibleCompleteness'));
  check('9c. wiring is fiction-only (gated by isNonfictionProjectAuthority)', ORCH.includes('if (!isNonfictionProjectAuthority(generationProject)) {') && PS.includes('if (!isNonfictionProjectAuthority(project)) {'));
  check('9d. blocks via toast.error and return', PS.includes("toast.error(`Story bible incomplete") && ORCH.includes("deps.toast.error(`Story bible incomplete"));
}

console.log(failures === 0 ? '\nACCEPTANCE: ALL CHECKS MATCHED' : `\nACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
