// RESEARCHFETCH-1 acceptance — the deep-research FETCH phase must fetch the pages
// most RELEVANT to the book's subject/focus terms, not just any archive URL. The
// old archive-first slice let loc.gov / Chronicling-America keyword-noise
// newspapers fill all 24 fetch slots and starve the real open-web sources (root
// cause of the empty "Molasses File" brief: 20 loc.gov items, 0 relevant pages).
import { rankFetchCandidates, relevanceTokens, scoreHit, extractFocusTerms, DEFAULT_FETCH_LIMIT } from '../src/lib/researchQueryBuilder.js';
let pass = 0, failures = 0;
function check(name, cond){ if(cond){pass++;console.log('PASS '+name);}else{failures++;console.log('FAIL '+name);} }

const subject = 'The Molasses File';
const topic = "On January 15, 1919, a fifty-foot steel tank on Commercial Street in Boston's North End burst and released roughly 2.3 million gallons of molasses. The tank belonged to United States Industrial Alcohol through its subsidiary Purity Distilling. Hearings before auditor Hugh W. Ogden followed.";
const focusTerms = extractFocusTerms(topic, subject);
const toks = relevanceTokens(subject, focusTerms);

check('relevanceTokens includes subject + focus tokens', toks.includes('molasses') && toks.includes('purity') && toks.includes('ogden'));
check('relevanceTokens drops stop/short words', !toks.includes('the') && !toks.includes('on') && toks.every(t => t.length >= 4));
check('DEFAULT_FETCH_LIMIT is 24', DEFAULT_FETCH_LIMIT === 24);

const good = { title:'Purity Distilling Company - Wikipedia', url:'https://en.wikipedia.org/wiki/Purity_Distilling_Company', snippet:'chemical firm based in Boston; the molasses tank' };
const junk = { title:'The Filer record (Filer, Idaho) 1922-07-20', url:'https://www.loc.gov/item/sn89055223/1922-07-20/ed-1/', snippet:'Local farming community news from southern Idaho.' };
check('scoreHit: on-topic outscores junk', scoreHit(good, toks) > scoreHit(junk, toks));
check('scoreHit: unrelated loc.gov newspaper scores 0', scoreHit(junk, toks) === 0);

// Realistic mixed set: 20 loc.gov junk (as the bridge merge front-loads) + 5 real sources.
const hits = [
  ...Array.from({length:12}, (_,i)=>({title:`The critic and record (Washington, D.C.) 1891-05-0${i%9}`, url:`https://www.loc.gov/item/sn87062228/1891-05-0${i%9}/ed-1/`, snippet:'Daily news and advertisements from the capital.'})),
  ...Array.from({length:8}, (_,i)=>({title:`The Filer record (Filer, Idaho) 192${i%5}-04-1${i%9}`, url:`https://www.loc.gov/item/sn89055223/192${i%5}-0${i%8}/ed-1/`, snippet:'Local farming community news from southern Idaho.'})),
  {title:'Purity Distilling Company - Wikipedia', url:'https://en.wikipedia.org/wiki/Purity_Distilling_Company', snippet:'chemical firm based in Boston Massachusetts molasses'},
  {title:'Albert Ladd Colby Report on the Boston Molasses Tank Explosion', url:'https://www.lehigh.edu/library/speccoll/colby.html', snippet:'Purity Distilling Company tank on Commercial Street Boston molasses'},
  {title:'Dark Tide: The Great Boston Molasses Flood', url:'https://erenow.org/common/dark-tide-great-boston-molasses-flood-1919/11.php', snippet:'Colonel Hugh W. Ogden ruled against United States Industrial Alcohol Boston molasses'},
  {title:'The Great Boston Molasses Flood of 1919', url:'https://www.missedhistory.com/article/boston-molasses-tank-collapse-1919', snippet:'tank belonged to Purity Distilling a subsidiary of United States Industrial Alcohol'},
  {title:'Hugh Ogden Issues Report on Cause of the Molasses Flood', url:'https://www.massmoments.org/moment-details/great-molasses-flood.html', snippet:'Auditor Hugh W. Ogden submitted his report on the molasses'},
];
const top = rankFetchCandidates({ hits, subject, focusTerms, limit: 5 });
check('limit respected', top.length === 5);
const topUrls = top.map(h=>h.url).join(' ');
check('Wikipedia surfaces into fetch set', topUrls.includes('en.wikipedia.org/wiki/Purity'));
check('Colby engineering report surfaces', topUrls.includes('lehigh.edu/library/speccoll/colby'));
check('Dark Tide surfaces', topUrls.includes('erenow.org/common/dark-tide'));
check('NO loc.gov newspaper item in top fetch set', !top.some(h=>/loc\.gov\/item\/(sn|mesn)/.test(h.url)));
check('every top hit is genuinely on-topic (score>=2)', top.every(h=>scoreHit(h,toks) >= 2));

// The old archive-first behavior would fetch these junk items FIRST — assert the
// fix does not: with a small limit, no slot is wasted on a score-0 archive page
// while relevant sources remain unfetched.
const smallTop = rankFetchCandidates({ hits, subject, focusTerms, limit: 3 });
check('small limit fetches only the most relevant, never junk', smallTop.every(h=>scoreHit(h,toks) >= 2));

// Archive-ness is a tiebreak ONLY among equally-relevant hits.
const tie = [
  {title:'web: molasses purity distilling boston', url:'https://example.com/a', snippet:'boston molasses purity distilling'},
  {title:'archive: molasses purity distilling boston', url:'https://www.loc.gov/item/relevant-molasses/', snippet:'boston molasses purity distilling'},
];
const tr = rankFetchCandidates({ hits: tie, subject, focusTerms, limit: 2 });
check('archive wins tiebreak among equally-relevant hits', /loc\.gov/.test(tr[0].url));

// Fallback: no relevance signal -> stable input order, no crash.
const noSig = [{title:'x',url:'https://a.com/1',snippet:''},{title:'y',url:'https://b.com/2',snippet:''}];
const fb = rankFetchCandidates({ hits: noSig, subject:'Zz', focusTerms:[], limit: 24 });
check('fallback returns all hits in stable order when nothing scores', fb.length === 2 && fb[0].url === 'https://a.com/1');
check('empty hits -> empty result (no crash)', rankFetchCandidates({ hits: [], subject, focusTerms }).length === 0);
check('missing hits arg -> empty result (no crash)', rankFetchCandidates({ subject, focusTerms }).length === 0);

// Book-agnostic: a different book, no hardcoded terms.
const osageTopic = 'William K. Hale orchestrated the murders of the Osage in Oklahoma. Tom White of the Bureau of Investigation built the case.';
const osSubj = 'The Osage Reign of Terror';
const osFocus = extractFocusTerms(osageTopic, osSubj);
const osHits = [
  {title:'The Filer record (Idaho)', url:'https://www.loc.gov/item/sn89055223/1922/', snippet:'idaho farm community news'},
  {title:'The Osage murders and William K. Hale', url:'https://en.wikipedia.org/wiki/Osage_murders', snippet:'William K. Hale Osage Oklahoma Bureau of Investigation'},
];
const osTop = rankFetchCandidates({ hits: osHits, subject: osSubj, focusTerms: osFocus, limit: 1 });
check('book-agnostic: relevant Osage source outranks unrelated Idaho archive', /wikipedia\.org\/wiki\/Osage/.test(osTop[0].url));

console.log(failures === 0 ? '\nACCEPTANCE: ALL CHECKS MATCHED' : `\nACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
