// SCENECOLLIDE-1 + CANON-2 acceptance battery.
//
// The defects (measured on the REDUX draft, ChatGPT re-score 73/100):
// 1. Ch.3 re-staged the rival team's arrival ("The rival team did not so much
//    arrive as they did unfold…") after scene 1's beat contract completed
//    "A rival salvage team arrives…" — the bag-of-words PRIOR_EVENT_REPLAY
//    gate matched 3 of 11 tokens and passed it. Design under test: class-based
//    (entity, action) collision detection, planner-side and prose-side.
// 2. The story bible contradicted itself (characters_md: Zin = navigator;
//    world_md AND canon_md: "Sadie, the ship's navigator") and the book
//    printed it. Design under test: foundation role-consistency checking.
// 3. "Rodger" appeared 3x in a Rodge/Roderick book. Design under test:
//    near-miss name-variant detection + deterministic polish heal.
import fs from 'node:fs';
import {
  classifyEventAction,
  extractEventEntities,
  findProseEventCollisions,
  findBeatEventCollisions,
  rewriteBeatCollisions,
} from '../src/lib/eventCollision.js';
import {
  parseCanonCast,
  checkFoundationRoleConsistency,
  findNameVariants,
  healNameVariants,
  buildRoleCanonLine,
} from '../src/lib/canonRoles.js';

let failures = 0;
const check = (name, pass, detail) => { console.log((pass ? 'PASS ' : 'FAIL ') + name + (pass || !detail ? '' : `\n      ${detail}`)); if (!pass) failures += 1; };

// ── 1. collision classification and entities ──
const ARRIVAL_EVENT = "A rival salvage team arrives, led by a ruthless collector who knows the crew's true identities.";
check('1. arrival events classify as ARRIVAL', classifyEventAction(ARRIVAL_EVENT).includes('ARRIVAL'));
const entities = extractEventEntities(ARRIVAL_EVENT);
check('2. group entities include dropped-modifier forms (rival team, salvage team)', entities.has('rival team') && entities.has('salvage team') && entities.has('rival salvage team'));
check('3. verbs before group nouns are not entities ("knows the crew")', ![...entities].some((e) => e.includes('knows')));

// ── 2. prose-side collision: the REAL ch.3 failure shape ──
const RESTAGE = 'Zin looked at the chip in her hand.\n\nThe rival team did not so much arrive as they did unfold, like a complex origami crane made of rusted steel and bad intentions. Three vehicles crunched over the dry scrub.';
const hits = findProseEventCollisions([ARRIVAL_EVENT], RESTAGE);
check('4. vocabulary-independent re-staging is caught (the exact REDUX ch.3 miss)', hits.length === 1 && hits[0].class === 'ARRIVAL' && hits[0].entity === 'rival team');
check('5. narration ABOUT the arrival is NOT a collision', findProseEventCollisions([ARRIVAL_EVENT], 'The rival team had arrived hours earlier, and the camp still smelled of their exhaust.').length === 0);
check('6. dialogue ABOUT the arrival is NOT a collision', findProseEventCollisions([ARRIVAL_EVENT], '“The rival team arrives tonight, I hear,” Thompson said, spitting into the dust and shaking his head slowly.').length === 0);
check('7. "arrived at a decision" idiom is NOT a collision', findProseEventCollisions(['Dean arrives at the crash site with his crew.'], 'Dean arrived at a decision that surprised everyone standing there.').length === 0);
check('8. REVEAL needs shared substance, not just verb + name ("It\'s pretty," Zin admitted)', findProseEventCollisions(['Zin reveals her past failure as a navigator to the assembled crew.'], 'The paint caught the light. It really was something to see. “It’s pretty,” Zin admitted, tilting her head at the hull.').length === 0);

// ── 3. planner-side collision ──
const beats = [
  { scene_number: 1, scene_goal: 'The rival team arrives at the crash site and confronts the crew.', required_events: ['A rival team arrives at the crash site.'] },
  { scene_number: 2, scene_goal: 'Zin repairs the manifold under pressure.', required_events: ['Zin repairs the manifold.'] },
];
const beatHits = findBeatEventCollisions(beats, [ARRIVAL_EVENT]);
check('9. a beat plan re-staging a completed arrival is flagged', beatHits.length >= 1 && beatHits.every((f) => f.scene_number === 1));
check('10. beats with explicit causal markers ("returns") are NOT flagged', findBeatEventCollisions([{ scene_number: 1, scene_goal: 'The rival team returns for a second confrontation.', required_events: ['The rival team comes back to the site.'] }], [ARRIVAL_EVENT]).length === 0);
const rewritten = rewriteBeatCollisions(beats, beatHits);
check('11. exhausted-attempt rewrite annotates the colliding beat only', rewritten[0].scene_goal.includes('already arrived') && !rewritten[1].scene_goal.includes('already arrived'));

// ── 4. false-positive sweep needs real data: proven in the sandbox run on all
//      20 REDUX chapters (164 real ledgered events, 0 cross-chapter hits, the
//      1 known ch.3 defect caught) — recorded in the arc doc. Here: clean
//      ordinary prose stays clean. ──
check('12. ordinary prose with arrivals of OTHER entities stays clean', findProseEventCollisions([ARRIVAL_EVENT], 'Mr. Thompson arrived with the wagon at noon. The mail arrived late. A storm arrived from the west that evening.').length === 0);

// ── 5. canon cast parsing ──
const SHEET = `### Major Characters\n\n**1. Protagonist: Zinnia 'Zin' Quark**\n\n- **Role:** Navigator and heart of the crew.\n\n**2. Antagonist: Roderick 'Rodge' Krye**\n\n- **Role:** The gruff, no-nonsense leader of the crew.\n\n**4. Key Supporting: Missy 'The Spanner' Marlowe**\n\n- **Role:** The ship's engineer, tough and resourceful.`;
const cast = parseCanonCast(SHEET);
check('13. cast parses names, nicknames, and roles ("Major Characters" header is not a character)', cast.length === 3 && cast[0].name === 'Zinnia' && cast[0].aliases.has('Zin') && cast[0].uniqueRole === 'navigator' && cast[2].name === 'Missy' && cast[2].aliases.has('Spanner'));

// ── 6. foundation contradictions (the REAL Sadie-navigator shape) ──
const project = {
  characters_md: SHEET,
  world_md: '**Sadie**, the ship’s navigator, is a tiny, hyperactive alien with a penchant for quoting Shakespeare.',
  canon_md: "The crew includes Zinnia 'Zin' Quark, the navigator and heart of the crew; and Lark, the genderfluid engineer.",
};
const contradictions = checkFoundationRoleConsistency(project);
check('14. a unique role claimed for two characters across fields is a contradiction', contradictions.length === 1 && contradictions[0].role === 'navigator' && contradictions[0].distinctNames.includes('Sadie'));
check('15. the same character under an alias is NOT a contradiction (Quark = Zinnia)', !contradictions[0].distinctNames.includes('Quark') || contradictions[0].distinctNames.length === 2);
check('16. shared roles (engineer) never flag — multi-holder roles are craft, not contradiction', !contradictions.some((c) => c.role === 'engineer'));
check('17. a consistent foundation is clean', checkFoundationRoleConsistency({ characters_md: SHEET, world_md: 'The ship is gaudy.', canon_md: 'Zin navigates.' }).length === 0);

// ── 7. name variants ──
const prose = 'Rodge grabbed the wrench. Rodge swore. Rodge, Rodge, Rodge — always fixing. Then Rodger looked up at the sky. Messy tools covered the bench, and the messy bench annoyed him.';
const variants = findNameVariants(prose, cast);
check('18. one-edit near-miss of a canonical name is flagged (Rodger -> Rodge)', variants.length === 1 && variants[0].variant === 'Rodger' && variants[0].canonical === 'Rodge');
check('19. capitalized ordinary words are NOT variants (Messy has a lowercase twin)', !variants.some((v) => v.variant === 'Messy'));
const healed = healNameVariants(prose, cast);
check('20. heal replaces the variant when canon dominates (>=5x)', healed.repairs.length === 1 && !/\bRodger\b/.test(healed.text));
check('21. heal refuses when the "variant" is too established to be drift', healNameVariants('Rodger walked in. Rodger sat. Rodger spoke. Rodge nodded.', cast).repairs.length === 0);

// ── 8. role canon prompt line + wiring ──
check('22. role canon line renders from the sheet', buildRoleCanonLine(SHEET).startsWith('Zinnia: Navigator'));
const WRITER = fs.readFileSync(new URL('../src/lib/sceneWriter.js', import.meta.url), 'utf8');
check('23. writer contract carries the role canon', WRITER.includes('buildRoleCanonLine(project?.characters_md)') && WRITER.includes('CHARACTER ROLES (canonical'));
const GATE_SRC = fs.readFileSync(new URL('../src/lib/sceneContractGate.js', import.meta.url), 'utf8');
check('24. scene audit raises EVENT_CLASS_REPLAY from the collision detector', GATE_SRC.includes("code: 'EVENT_CLASS_REPLAY'") && GATE_SRC.includes('findProseEventCollisions(priorEvents, prose)'));
const STUDIO = fs.readFileSync(new URL('../src/pages/ProjectStudio.jsx', import.meta.url), 'utf8');
check('25. beat planner rejects colliding plans and rewrites on exhaustion', STUDIO.includes('findBeatEventCollisions(normalizedBeatPlan, ledgerEvents)') && STUDIO.includes('rewriteBeatCollisions(repairedBeats, beatCollisions)'));
const RUNNER = fs.readFileSync(new URL('../src/lib/manuscriptPolishRunner.js', import.meta.url), 'utf8');
check('26. polish heals name variants deterministically', RUNNER.includes('healNameVariants(f.content') && RUNNER.includes('[CANON-2]'));
const EXPORT_GATE = fs.readFileSync(new URL('../src/lib/exportSafetyGate.js', import.meta.url), 'utf8');
check('27. export gate reports foundation contradictions and surviving variants as WARNINGS', EXPORT_GATE.includes('checkFoundationRoleConsistency(project)') && EXPORT_GATE.includes('Canon contradiction') && !/hardFailures\.push\([^)]*CANON-2/s.test(EXPORT_GATE));
const BIBLE = fs.readFileSync(new URL('../src/lib/parallelBibleGenerator.js', import.meta.url), 'utf8');
check('28. bible generator checks its own output for contradictions at birth', BIBLE.includes('checkFoundationRoleConsistency({') && BIBLE.includes('BIBLE CONTRADICTION'));

console.log(failures === 0 ? '\nACCEPTANCE: ALL CHECKS MATCHED' : `\nACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
