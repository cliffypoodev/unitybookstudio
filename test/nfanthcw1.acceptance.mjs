// NFANTH-CW-1 acceptance battery — per-story closed world for nonfiction
// anthologies. Case A's facts are not valid evidence for Case C. Fixtures use
// the invented names named in the plan: Port Ellis / Dr. Hale / Dr. Vance.
import fs from 'node:fs';
import {
  STORY_ENTITY_OWNERSHIP_VERSION,
  buildStoryEntityOwnership,
  fenceForeignEntities,
  extractEntities,
} from '../src/lib/storyEntityOwnership.js';
import { CLOSED_WORLD_TEXT_VERSION, normCW, createInEV, buildEvidenceCorpus } from '../src/lib/closedWorldText.js';

let failures = 0;
const check = (name, pass, detail) => { console.log((pass ? 'PASS ' : 'FAIL ') + name + (pass || !detail ? '' : `\n      ${detail}`)); if (!pass) failures += 1; };

const CHAPTERS = [
  { chapter_number: 1, title: 'Case A', beat_summary: 'Dr. Hale investigated a disappearance in Port Ellis in 1966.' },
  { chapter_number: 3, title: 'Case C', beat_summary: 'Dr. Vance uncovered a forged ledger in 1997.' },
];

// ── 1. version ──
check('1. STORY_ENTITY_OWNERSHIP_VERSION', STORY_ENTITY_OWNERSHIP_VERSION === 'story-entity-ownership-v1');
check('1b. CLOSED_WORLD_TEXT_VERSION', CLOSED_WORLD_TEXT_VERSION === 'closed-world-text-v1');

// ── 2. ownership: Case A owns Hale/Port Ellis/1966 ──
{
  const ownership = buildStoryEntityOwnership({}, CHAPTERS);
  const s1 = ownership.byStory[1];
  check('2. Case A owns "dr hale"', s1.has('dr hale'), [...s1].join(', '));
  check('3. Case A owns "port ellis"', s1.has('port ellis'), [...s1].join(', '));
  check('4. Case A owns "1966"', s1.has('1966'), [...s1].join(', '));
}

// ── 5. ownership: Case C owns Vance/1997 ──
{
  const ownership = buildStoryEntityOwnership({}, CHAPTERS);
  const s3 = ownership.byStory[3];
  check('5. Case C owns "dr vance"', s3.has('dr vance'), [...s3].join(', '));
  check('6. Case C owns "1997"', s3.has('1997'), [...s3].join(', '));
  check('7. Case C does NOT own "dr hale"', !s3.has('dr hale'));
}

// ── 8-10. fencing: drafting Story 3 fences Hale/Port Ellis/1966, keeps Vance/1997 ──
{
  const ownership = buildStoryEntityOwnership({}, CHAPTERS);
  const research = [
    'Dr. Vance reviewed the ledger from 1997 and found irregularities in the account.',
    'Dr. Hale had closed the Port Ellis file back in 1966, long before this case began.',
  ].join('\n\n');
  const res = fenceForeignEntities(research, ownership, 3);
  check('8. keeps the Vance/1997 paragraph', res.text.includes('Dr. Vance reviewed the ledger'));
  check('9. fences the Hale/Port Ellis/1966 paragraph', res.text.includes('[evidence belonging to Story 1 — not available to this story]') && !res.text.includes('Dr. Hale had closed'));
  check('10. fenced entry carries {paragraph, entities}', res.fenced.length === 1 && res.fenced[0].paragraph.includes('Dr. Hale') && res.fenced[0].entities.includes('dr hale'), JSON.stringify(res.fenced));
}

// ── 11. an entity shared by >=2 stories is never fenced ──
{
  const sharedOwnership = { byStory: { 3: new Set(['dr vance']) }, byEntity: { 'port ellis': new Set([1, 3]), 'dr vance': new Set([3]) } };
  const res = fenceForeignEntities('The Port Ellis inquiry became a template other investigators still cite.', sharedOwnership, 3);
  check('11. shared entity is never fenced', res.fenced.length === 0 && res.text.includes('Port Ellis inquiry'), JSON.stringify(res));
}

// ── 12. non-anthology / no ownership: text passes through untouched ──
{
  const emptyOwnership = { byStory: {}, byEntity: {} };
  const research = 'Dr. Vance and Dr. Hale never worked the same case, but the research here is whole-project.';
  const res = fenceForeignEntities(research, emptyOwnership, 3);
  check('12. no ownership data -> nothing fenced (non-anthology behavior)', res.fenced.length === 0 && res.text === research);
}

// ── 13. zero-telemetry line ──
{
  const lines = [];
  const origLog = console.log;
  console.log = (...args) => { lines.push(args.join(' ')); };
  let res;
  try {
    res = fenceForeignEntities('Nothing here is owned by anyone.', { byStory: {}, byEntity: {} }, 9);
  } finally {
    console.log = origLog;
  }
  check('13. zero line: "[NFANTH-CW] ch9: fenced 0 paragraph(s)"', res.fenced.length === 0 && lines.some((l) => l.includes('[NFANTH-CW] ch9: fenced 0 paragraph(s)')), JSON.stringify(lines));
}

// ── 14. extractEntities: month-year + year atoms ──
{
  const ents = extractEntities('The report, dated June 1966, cited Port Ellis directly.');
  check('14. extractEntities finds a month-year atom', [...ents].some((e) => e.includes('1966')), JSON.stringify([...ents]));
}

// ── 15-17. shared closedWorldText.js helpers (normCW / createInEV / buildEvidenceCorpus) ──
{
  check('15. normCW lowercases and strips punctuation', normCW("Dr. Hale's Report!") === 'dr hales report');
  const inEV = createInEV(' the report names dr hale and port ellis in 1966 ');
  check('16. createInEV: supported phrase passes', inEV('Port Ellis'));
  check('17. createInEV: plural/singular fallback', inEV('reports'));
  check('18. createInEV: unsupported phrase fails', !inEV('Nairobi'));
  const corpus = buildEvidenceCorpus({ research_data: 'Dr. Hale worked Port Ellis in 1966.' });
  check('19. buildEvidenceCorpus normalizes project research fields', corpus.includes('dr hale') && corpus.includes('port ellis'));
}

// ── 20-21. source-shape wiring: sceneWriter.js fences research + buildSourceAudit's haystack ──
{
  const SW = fs.readFileSync(new URL('../src/lib/sceneWriter.js', import.meta.url), 'utf8');
  check('20. getProjectResearchText fences research via NFANTH-CW-1', SW.includes('NFANTH-CW-1') && SW.includes('fenceForeignEntities') && SW.includes('buildStoryEntityOwnership') && SW.includes('isNonfictionAnthology'));
  const auditStart = SW.indexOf('function buildSourceAudit(');
  const auditBody = auditStart >= 0 ? SW.slice(auditStart, auditStart + 1400) : '';
  check('21. buildSourceAudit haystack fenced (chapter param + cached ownership)', auditBody.includes('chapter = null') && auditBody.includes('getCachedStoryEntityOwnership') && auditBody.includes('isNonfictionAnthology'), auditBody.slice(0, 200));
}

console.log(failures === 0 ? '\nACCEPTANCE: ALL CHECKS MATCHED' : `\nACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
