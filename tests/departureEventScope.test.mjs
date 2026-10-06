import assert from 'node:assert/strict';
import {findProseEventCollisions,findBeatEventCollisions} from '../src/lib/eventCollision.js';
let checks=0, failures=0;
function check(label,fn){checks++;try{fn();console.log('PASS '+label);}catch(e){failures++;console.error('FAIL '+label+': '+e.message);}}
const contemplated=['Mara has a conversation with Dov about her doubts and considers leaving the crew.'];
check('considering a departure is not a completed departure',()=>assert.deepEqual(findProseEventCollisions(contemplated,'Mara departed the crew for good.'),[]));
check('beat planner does not treat contemplation as completed departure',()=>assert.deepEqual(findBeatEventCollisions([{scene_number:2,required_events:['Mara departs the crew for good.']}],contemplated),[]));
const departed=['Mara departs the crew for good.'];
for (const text of ['Mara walked out of the engine bay.','Mara walks out of the tent to collect water.','Mara walked out of the workshop with a hammer.']){
 check('local scene movement does not replay crew departure: '+text,()=>assert.deepEqual(findProseEventCollisions(departed,text),[]));
}
check('planner local movement is not party departure',()=>assert.deepEqual(findBeatEventCollisions([{scene_number:2,required_events:['Mara walks out of the engine bay.']}],departed),[]));
check('actual repeated departure still detected',()=>assert(findProseEventCollisions(departed,'Mara departed the crew for good.').some(x=>x.class==='DEPARTURE')));
check('local exit with explicit finality still detected',()=>assert(findProseEventCollisions(departed,'Mara walked out of the engine bay, leaving the crew for good.').some(x=>x.class==='DEPARTURE')));
check('actual arrival replay unchanged',()=>assert(findProseEventCollisions(['A rival salvage team arrives at the camp.'],'The rival salvage team rolled into the camp.').some(x=>x.class==='ARRIVAL')));
check('arrives-at-conclusion remains a harmless idiom',()=>assert.deepEqual(findProseEventCollisions(['Mara arrives at the camp.'],'Mara arrived at a conclusion about the repair.'),[]));
console.log(JSON.stringify({checks,failures,ok:failures===0}));
if(failures)process.exitCode=1;
