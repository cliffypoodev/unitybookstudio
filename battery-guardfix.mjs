// GUARDFIX-1 + MODELFIX-4 acceptance battery. Run from repo root.
import fs from 'fs';
let failures = 0;
const check = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) failures++; };

const { validateProjectChapterContent } = await import(process.cwd() + '/src/lib/projectContentGuard.js');

const advProject = {
  title: 'False North', genre: 'Adventure',
  seed_concept: 'The 1908 Abernathy Team Gamma expedition into the outcrop found sky-iron. Elias and Margot Reed climb the Charnel to recover it. Porter Jessup guides them.',
  characters_md: 'Elias Reed — climber. Margot Reed — his wife, keeps a ledger. Porter Jessup — guide. Elara Reed — daughter.',
};

// G1: paragraphs mirroring tonight's blocked prose — synthetic fibers, stunned, objective, pistol, sentence-initial capitals
const advText = [
  'Elias pulled the rope tight against his shoulder, the synthetic fibers biting into the wool of his jacket. The wind hammered the outcrop. Snow drove sideways across the ledge and the snow kept coming, harder each minute, until the whole face of the mountain vanished behind it. He counted pitons and checked the knots twice, because up here a mistake did not forgive. Her breath came in short bursts behind him.',
  'Her hands were shaking. One door of the shelter had torn loose in the night. Then the storm eased, and Margot stunned them all by laughing. Were they really going to keep climbing. The objective truth was simpler: the sky-iron was worth nothing if none of them came home. Two ropes remained. Like it or not, the old pistol Jessup carried since 1908 stayed in his pack, and every asset they owned was pinned to this mountain.',
  'Somewhere below, Porter Jessup called out. Outside the shelter the ledge held. Neither of them answered at first. Day broke grey and indifferent over the outcrop, and the endless wind carried grit that tasted like rusted iron. Marked stones led back down. Built into the rock face, the old anchors from Team Gamma still held their weight after all these years.',
].join('\n\n');
{
  const g = validateProjectChapterContent({ project: advProject, chapter: { chapter_number: 8 }, content: advText });
  check('G1 period-adventure prose passes clean (was blocked)', g.ok === true && g.shouldBlockSave === false);
  check('G2 no heist/spy hits on stunned/objective/pistol/asset', (g.stats.heistHits || []).length === 0);
  check('G3 no tech hits on synthetic fibers', (g.stats.hardTechHits || []).length === 0);
}

// G4: true contamination still blocks — cyberpunk heist block inside the same adventure book
const contaminated = advText + '\n\n' + [
  'Kael pressed the data-sliver into the interface crown and watched the holoscreen bloom. Voss checked the encrypted drive against the security grid while the transit pod hummed in the freight tunnel below Perennial Solutions.',
  'The grey room smelled of ozone. Kael keyed the charge cell into the flechette pistol and Voss ran the tracking chip once more. The burner phone buzzed: the dead drop at the sub-basement was live, the scanner plate spoofed, the neural template loaded.',
  'Quietus protocols came online. Voss slid the data chip across to Kael. Cybernetic fingers closed around it. The containment cell would open in ninety seconds and the recursive pattern would do the rest.',
].join('\n\n');
{
  const g = validateProjectChapterContent({ project: advProject, chapter: { chapter_number: 8 }, content: contaminated });
  check('G4 real cyberpunk contamination still blocked', g.shouldBlockSave === true);
  check('G5 trim keeps the clean adventure paragraphs', g.shouldAutoTrim === false || (g.sanitizedText.includes('Elias pulled the rope') && !g.sanitizedText.includes('data-sliver')));
}

// G6: word-boundary sanity
{
  const g = validateProjectChapterContent({ project: advProject, chapter: {}, content:
    'The crowd was stunned. Her assets were frozen. The trackers of game moved on. Objectively, the payload of the sled was light. He was a handler of dogs.\n\nStill they climbed on through the snow toward the outcrop, roped together against the wind, and nobody spoke of turning back.\n\nMargot wrote it all in her ledger that night, every yard gained and every finger lost to frost, because the record mattered more than comfort.' });
  check('G6 boundary words never hit', (g.stats.heistHits || []).length === 0 && g.ok === true);
}

// M1: retry layer normalizes legacy aliases (source-level; modelRouting uses @/ aliases)
{
  const src = fs.readFileSync(process.cwd() + '/src/lib/integrationRetry.js', 'utf8');
  check('M1 normalizeModelId imported + applied', src.includes("import { normalizeModelId } from '@/lib/modelRouting'") && src.includes('normalizeModelId(payload.model)'));
  const mr = fs.readFileSync(process.cwd() + '/src/lib/modelRouting.js', 'utf8');
  check('M2 openai_gpt5 alias maps to primary local model', mr.includes("'openai_gpt5': PRIMARY_WRITING_MODEL"));
  check('M3 gemini_3_flash alias maps to primary local model', mr.includes("'gemini_3_flash': PRIMARY_WRITING_MODEL"));
  check('M4 normalizeModelId passes unknown/local ids through', mr.includes('MODEL_ID_ALIASES[c] || c'));
}

console.log(failures === 0 ? 'BATTERY: ALL PASS' : 'BATTERY: ' + failures + ' FAILURE(S)');
process.exit(failures === 0 ? 0 : 1);
