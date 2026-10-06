import assert from 'node:assert/strict';
import {extractBeatDeclaredStateUpdates, extractCharacterStateUpdates, collectChapterBeatEvents, buildCharacterState, auditProseAgainstCharacterState} from '../src/lib/characterStateLedger.js';
let failures=0, checks=0;
function check(label, fn) { checks++; try { fn(); console.log('PASS '+label); } catch(error) { failures++; console.error('FAIL '+label+': '+error.message); } }
const cast=['Mara','Dov'];
for (const source of [
  'Mara leaves town without changing presentation.',
  'Mara leaves the town with Dov and takes their supplies back to camp.',
  'Mara leaves the ship to fetch water, then resumes work with the crew.',
  'Mara departs town with the crew after buying rope.',
]) {
  check('beat location is not party membership: '+source, () => assert.deepEqual(extractBeatDeclaredStateUpdates([source],cast).departures,[]));
}
for (const source of [
  'Mara left the town with Dov and carried their supplies back to camp.',
  'Mara left the ship to fetch water and came back with the bucket.',
]) {
  check('prose location is not party membership: '+source, () => assert.deepEqual(extractCharacterStateUpdates(source,cast).departures,[]));
}
for (const source of ['Mara leaves the crew after the argument.','Mara quits the team and travels alone.','Mara departs the group for good.','Mara leaves the ship for good.','Mara leaves town permanently.']) {
  check('real planned departure preserved: '+source, () => assert(extractBeatDeclaredStateUpdates([source],cast).departures.includes('Mara')));
}
for (const source of ['Mara left the crew and took the north road alone.','Mara left the ship for good.','Mara left the town permanently.']) {
  check('real prose departure preserved: '+source, () => assert(extractCharacterStateUpdates(source,cast).departures.includes('Mara')));
}
const record={scene_beats_json:JSON.stringify({beats:[
  {scene_number:1,scene_goal:'Buy repair supplies.',exit_state:'Mara leaves town without changing presentation.'},
  {scene_number:2,scene_goal:'Unpack supplies with the crew.',exit_state:'Mara and Dov are working together at their grounded ship.'}
]})};
const prose=('The storekeeper counted the supplies while Dov paid for the rope. ').repeat(5)+'Mara carried the supplies back to camp. Mara worked beside Dov at the ship.';
check('cross-chapter fold keeps the shopping party present',()=>{const state=buildCharacterState([{chapterNumber:13,text:prose,beatEvents:collectChapterBeatEvents(record)}],cast);assert.equal(state.Mara.partyStatus,'present');assert.deepEqual(auditProseAgainstCharacterState('Mara worked beside Dov at the engine.',state,cast),[]);});
check('genuine absent-character audit remains blocking',()=>{const state=buildCharacterState([{chapterNumber:9,text:('They packed the equipment for the evening. ').repeat(8)+'Mara left the crew and took the north road alone.'}],cast);assert.equal(state.Mara.partyStatus,'departed');assert(auditProseAgainstCharacterState('Mara stood beside the engine.',state,cast).some(x=>x.code==='DEPARTED_CHARACTER_ACTIVE'));});
console.log(JSON.stringify({checks,failures,ok:failures===0}));
if(failures)process.exitCode=1;
