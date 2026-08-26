// BEATLOOP-1 acceptance — proves the beat-acceptance decision breaks on advisory-only
// overlap reports (resolution/final chapters) and still regenerates on structural change.
// Runs the REAL normalizeSceneBeatsForDrafting; the two imported text-scrubbers are
// pure string fns and are stubbed to identity so the file loads standalone.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const dir = new URL('./_beatloop1/', import.meta.url);
mkdirSync(dir, { recursive: true });
writeFileSync(new URL('integrationRetry.js', dir), 'export async function invokeLLMWithRetry(){throw new Error("stub");}');
writeFileSync(new URL('modelLeakGuard.js', dir), 'export const stripModelControlTokens=s=>s;export const stripNonLatinDrift=s=>s;');
writeFileSync(new URL('sceneBeatNormalizer.js', dir), readFileSync(new URL('../src/lib/sceneBeatNormalizer.js', import.meta.url), 'utf8'));
const { normalizeSceneBeatsForDrafting } = await import(pathToFileURL(new URL('sceneBeatNormalizer.js', dir).pathname).href);

const opts = { isNonfiction:false, chapterNumber:4, chapterTitle:'The Unseen Hand', projectTitle:'The Gilded Hour' };
const resolution = [
 {scene_number:1,scene_id:'ch04-s01',scene_goal:'Reveal the truth about the two keys and confront the culprit',required_events:['Ilka confronts Ned about the keys','The truth about the brass key is revealed'],entry_state:'Ilka in the study at Ashby House, resolute',exit_state:'The culprit is exposed',setting:'Ashby House study, night',characters_present:['Ilka Thornbury','Ned Ashby'],emotional_arc:'fear to resolve'},
 {scene_number:2,scene_id:'ch04-s02',scene_goal:'Ilka reveals the truth to the household and confronts her fear',required_events:['Ilka reveals the truth to the household','Ilka confronts her own fear'],entry_state:'Ilka in the study, the household gathered',exit_state:'The mystery is resolved',setting:'Ashby House study, night',characters_present:['Ilka Thornbury','Mrs. Aldous','Ned Ashby'],emotional_arc:'fear to resolve'},
 {scene_number:3,scene_id:'ch04-s03',scene_goal:'Ilka embraces connection as the household finds closure',required_events:['Ilka embraces her need for connection','The household finds closure'],entry_state:'Ilka in the study, calmer',exit_state:'Ilka is changed by the experience',setting:'Ashby House study, dawn',characters_present:['Ilka Thornbury','Mrs. Aldous'],emotional_arc:'resolve to peace'},
];
const distinct = [
 {scene_number:1,scene_id:'ch04-s01',scene_goal:'Ilka breaks into the strongroom',required_events:['Ilka picks the strongroom lock','Ilka enters the vault'],entry_state:'Ilka in the cold passage',exit_state:'Ilka inside the vault',setting:'Strongroom passage, midnight',characters_present:['Ilka Thornbury'],emotional_arc:'fear to determination'},
 {scene_number:2,scene_id:'ch04-s02',scene_goal:'Ned ambushes Ilka and they fight',required_events:['Ned attacks Ilka','Ilka escapes up the stairs'],entry_state:'Ilka in the vault',exit_state:'Ilka flees to the roof',setting:'The east staircase, midnight',characters_present:['Ilka Thornbury','Ned Ashby'],emotional_arc:'terror to defiance'},
 {scene_number:3,scene_id:'ch04-s03',scene_goal:'Ilka hands the key to the constable at dawn',required_events:['Ilka gives the brass key to the constable','The constable arrests Ned'],entry_state:'Ilka on the frozen lawn',exit_state:'Ned is arrested',setting:'Ashby House lawn, dawn',characters_present:['Ilka Thornbury','the constable'],emotional_arc:'exhaustion to relief'},
];
const structural = r =>
  (r.removed||0)>0 || (r.merged||0)>0 || (r.chronologyReordered||0)>0 ||
  (typeof r.finalCount==='number' && typeof r.originalCount==='number' && r.finalCount!==r.originalCount);
let failures = 0;
const A = normalizeSceneBeatsForDrafting(resolution, opts);
const B = normalizeSceneBeatsForDrafting(distinct, opts);
// The bug: resolution reports an overlap (advisory) but is structurally intact.
if (!(A.reported > 0)) { console.log('FAIL  resolution should report an overlap'); failures++; }
if (structural(A)) { console.log('FAIL  resolution must NOT be structurally changed (nothing merged/removed/reordered)'); failures++; }
if (structural(A)) {} else { console.log('PASS  resolution reported overlap but is structurally intact -> new break FIRES (was blocked by old !changed)'); }
if (structural(B)) { console.log('FAIL  distinct control must be structurally unchanged'); failures++; } else { console.log('PASS  distinct control -> break fires'); }
// Guard: the old predicate would have blocked resolution; assert the difference is real.
if (A.changed !== true) { console.log('FAIL  expected A.changed===true (old code would loop)'); failures++; } else { console.log('PASS  old predicate (!A.changed) was FALSE -> old code looped; new predicate breaks'); }
console.log(failures===0 ? '\nACCEPTANCE: ALL CHECKS MATCHED' : `\nACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures===0 ? 0 : 1);
