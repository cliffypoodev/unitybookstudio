// RESEARCHQUALITY-1 acceptance — the research query builder must put focus-term
// queries first, cap the total, and never turn a date fragment or sentence
// opener into a search term. The old build fired 14-35 title-first queries in
// a 300ms burst; searxng suspended and the high-signal queries got noise.
import { buildResearchQueries, deriveSearchSubject, extractFocusTerms, MAX_RESEARCH_QUERIES, MAX_FOCUS_TERMS } from '../src/lib/researchQueryBuilder.js';
let pass = 0, failures = 0;
function check(name, cond){ if(cond){pass++;console.log('PASS '+name);}else{failures++;console.log('FAIL '+name);} }

const osageTopic = 'In the 1920s, members of the Osage Nation in Oklahoma became the richest people per capita on earth from oil headrights. Then they began to die. William K. Hale orchestrated the murders of Mollie Burkhart family members including Anna Brown. Tom White of the Bureau of Investigation built the case. Ernest Burkhart confessed in 1926.';

const r1 = buildResearchQueries({ title: 'The Osage Reign of Terror', topic: osageTopic, nfStructureMode: 'investigative' });
check('cap respected (<= ' + MAX_RESEARCH_QUERIES + ')', r1.queries.length <= MAX_RESEARCH_QUERIES);
check('at least 8 queries built', r1.queries.length >= 8);
check('focus terms found', r1.focusTerms.length >= 3);
check('first query is a FOCUS query, not a bare subject query', r1.focusTerms.some(t => r1.queries[0].includes(t)));
const firstNonFocus = r1.queries.findIndex(q => !r1.focusTerms.some(t => q.includes(t)));
check('every focus query precedes the generic subject queries', firstNonFocus === -1 || firstNonFocus >= r1.focusTerms.length);
check('no empty queries', r1.queries.every(q => q && q.trim().length > 3));
check('no duplicate queries', new Set(r1.queries).size === r1.queries.length);
check('multi-word names outrank single words', r1.focusTerms[0].includes(' '));

const r2 = buildResearchQueries({ title: 'The Osage Murders: A True Story', topic: osageTopic, nfStructureMode: 'standard' });
check('subject splits on colon', r2.subject === 'The Osage Murders');

const r3 = buildResearchQueries({ title: 'a quiet book', topic: 'a story about ordinary things with no proper nouns at all.', nfStructureMode: 'standard' });
check('no-focus-terms fallback still builds queries', r3.queries.length >= 4 && r3.queries.length <= MAX_RESEARCH_QUERIES);

// A brief that OPENS with a date must not search for the date fragment.
const molassesTopic = 'On January 15, 1919, a fifty-foot steel tank on Commercial Street in Boston led to hearings before auditor Hugh W. Ogden. The tank belonged to United States Industrial Alcohol through its subsidiary Purity Distilling.';
const r4 = buildResearchQueries({ title: 'The Molasses File', topic: molassesTopic, nfStructureMode: 'narrative' });
check('date fragment never becomes a focus term', !r4.focusTerms.some(t => /^(On|In|At|By|January|February|December)\b/.test(t)));
check('company names survive into focus terms', r4.focusTerms.includes('Purity Distilling'));
check('initialed person names survive into focus terms', r4.focusTerms.includes('Hugh W. Ogden'));
check('focus cap respected', r4.focusTerms.length <= MAX_FOCUS_TERMS);

check('deriveSearchSubject strips markup', deriveSearchSubject('**The Tank**', '') === 'The Tank');
check('extractFocusTerms drops STOP-led candidates', !extractFocusTerms('The Whole Thing happened. William K. Hale did it.', 'x').some(t => t.startsWith('The ')));

console.log(failures === 0 ? '\nACCEPTANCE: ALL CHECKS MATCHED' : `\nACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
