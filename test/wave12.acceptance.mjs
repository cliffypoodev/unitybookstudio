// WAVE12 acceptance battery — the generation pipeline uses its inputs.
//
//   WAVE12-DIRECTIONS  the model's answer is parsed; placeholders are last resort
//   WAVE12-CONTEXT     the manuscript that gets read also gets sent
//   WAVE12-COVERTEXT   title/author reach the image model, per typography mode
//   WAVE12-GENRE       a cozy stops getting a thriller cover
//   WAVE12-FLUXNEG     Flux stops discarding the negative prompt
//   WAVE12-TEMPLATE    the chosen template is used by every part of the prompt
//
// The prompt builders and workflow builders are pure, so this executes them.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildFluxCoverWorkflow, buildPonyXLCoverWorkflow } from '../src/lib/coverComfyWorkflows.js';
import { buildFluxCoverPrompt, buildPonyXLCoverPrompt, resolveGenreTemplate } from '../src/lib/coverPromptBuilder.js';
import { getAllGenreCoverTemplates } from '../src/lib/coverGenreTemplates.js';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let failures = 0;
const check = (name, pass) => { console.log((pass ? 'PASS ' : 'FAIL ') + name); if (!pass) failures += 1; };

const client = read('src/api/base44Client.js');
const gen = read('src/components/cover/CoverArtGenerator.jsx');

const COZY = { genre: 'Cozy Mystery', subgenre: '', title: 'The Marmalade Conspiracy', author_name: 'Cliff Stump' };
const KIDS = { genre: 'Middle Grade', subgenre: '', title: 'The Lantern Boy', author_name: 'A N Other' };

/* ── WAVE12-DIRECTIONS ───────────────────────────────────────────────────── */
// Executed: the parser must survive every shape a local model actually emits.
const extractJsonArray = new Function(
  client.slice(client.indexOf('function extractJsonArray'), client.indexOf('async function handleGenerateCoverDirections'))
  + '; return extractJsonArray;'
)();
const FOUR = JSON.stringify([{ label: 'A' }, { label: 'B' }, { label: 'C' }, { label: 'D' }]);

check('1. a bare JSON array parses', extractJsonArray(FOUR)?.length === 4);
check('1b. a fenced ```json block parses', extractJsonArray('```json\n' + FOUR + '\n```')?.length === 4);
check('1c. an array wrapped in prose parses', extractJsonArray('Here you go:\n' + FOUR + '\nEnjoy.')?.length === 4);
check('1d. the { text } envelope parses', extractJsonArray({ text: FOUR })?.length === 4);
check('1e. an already-parsed array passes through', extractJsonArray(JSON.parse(FOUR))?.length === 4);
check('1f. prose-only returns null, NOT a string — the original defect',
  extractJsonArray('I think a moody cover would work') === null && extractJsonArray('') === null);

check('2. the handler returns directions as an array or null, never a string',
  /directions,\n {6}generated_by_llm: Array\.isArray\(directions\)/.test(client) &&
  !/directions: text/.test(client));
check('2b. the component falls back to its manuscript-grounded local set',
  /localPayload\.directions\?\.length \? localPayload\.directions : normalizeDirections\(null\)/.test(gen));
check('2c. placeholders are only reached when there is nothing else',
  /Placeholders are now the last resort/.test(gen));

/* ── WAVE12-CONTEXT ──────────────────────────────────────────────────────── */
check('3. the assembled manuscript context is actually sent to the model',
  /MANUSCRIPT CONTEXT \(ground every direction in this/.test(client) &&
  /params\.projectContext/.test(client));
check('3b. the author brief and the rebuild directive are used too',
  /ART DIRECTION BRIEF FROM THE AUTHOR/.test(client) && /params\.creativeDirective/.test(client));
check('3c. previous directions are sent, so Rebuild can differ',
  /ALREADY TRIED — do not repeat these/.test(client) && /params\.previousDirections/.test(client));
check('3d. the dead `tone` and `description` params are gone',
  !/params\.tone/.test(client) && !/params\.description \?/.test(client));

/* ── WAVE12-COVERTEXT ────────────────────────────────────────────────────── */
const promptFn = new Function('params',
  client.slice(client.indexOf('const wantsText ='),
    client.indexOf("].filter(Boolean).join('\\n');", client.indexOf('const wantsText =')) + 30)
  + '\n return coverPrompt;');
const P = { title: 'The Marmalade Conspiracy', subtitle: 'A Little Wickham Mystery', authorName: 'Cliff Stump', seriesText: 'Book One', genre: 'Mystery', directionBrief: 'An empty preserving tin.' };

const finished = promptFn(P);
check('4. by default the title, subtitle, author and series reach the model',
  finished.includes('The Marmalade Conspiracy') && finished.includes('A Little Wickham Mystery') &&
  finished.includes('Cliff Stump') && finished.includes('Book One'));
check('4b. and it is no longer told to omit all text',
  !finished.includes('No text, no title, no author name'));

const artOnly = promptFn({ ...P, typographyMode: 'image_only' });
check('4c. image_only still asks for clean artwork — the compositor overlays text',
  artOnly.includes('No text, no title, no author name') && !artOnly.includes('Cliff Stump'));
check('4d. both modes still carry the direction brief and genre',
  finished.includes('An empty preserving tin.') && artOnly.includes('Genre: Mystery'));

/* ── WAVE12-GENRE ────────────────────────────────────────────────────────── */
const helpers = new Function('getAllGenreCoverTemplates',
  gen.slice(gen.indexOf('const TEMPLATE_STYLE_TO_ART_STYLE'), gen.indexOf("function getBasicGenreDefaults(genre = '') {"))
  + '; return { getSpecificGenreTemplate, defaultsFromTemplate };'
)(getAllGenreCoverTemplates);

const cozyDefaults = helpers.defaultsFromTemplate(helpers.getSpecificGenreTemplate('Cozy Mystery'));
check('5. a cozy mystery gets the cozy template, not thriller defaults',
  cozyDefaults?.templateId === 'cozy_mystery_cottage' &&
  cozyDefaults.style === 'Illustrated' && cozyDefaults.mood === 'Warm');
check('5b. and its brief describes a cozy, not "strong tension, cinematic contrast"',
  /sage green|butter yellow|watercolor|whimsical/i.test(cozyDefaults.brief) &&
  !/thriller|cinematic contrast/i.test(cozyDefaults.brief));

check('5c. an ambiguous plain "Mystery" is NOT force-fed the cozy template',
  helpers.getSpecificGenreTemplate('Mystery') === null);
check('5d. other genres resolve to their own template, not one default',
  ['Psychological Thriller', 'Dark Fantasy', 'Contemporary Romance', 'Middle Grade', 'Horror']
    .every((g) => {
      const d = helpers.defaultsFromTemplate(helpers.getSpecificGenreTemplate(g));
      return d && d.style && d.mood;
    }));
check('5e. every template style preset is mapped — none silently defaults',
  getAllGenreCoverTemplates().every((t) => helpers.defaultsFromTemplate(t) !== null));

/* ── WAVE12-FLUXNEG ──────────────────────────────────────────────────────── */
const NEG = 'nsfw, explicit, violence, gore, weapons, book mockup';
const flux = buildFluxCoverWorkflow({ positivePrompt: 'a cat on a case file', negativePrompt: NEG, seed: 1 });
check('6. the Flux negative CLIPTextEncode carries the negative prompt',
  flux['3'].inputs.text === NEG);
check('6b. and the sampler is still wired to it',
  Object.values(flux).some((n) => n.class_type === 'KSampler' && n.inputs?.negative?.[0] === '3'));
check('6c. an empty negative is still handled',
  buildFluxCoverWorkflow({ positivePrompt: 'x', seed: 1 })['3'].inputs.text === '');
check('6d. PonyXL, which already worked, is unchanged',
  Object.values(buildPonyXLCoverWorkflow({ positivePrompt: 'x', negativePrompt: NEG, seed: 1 }))
    .some((n) => n.class_type === 'CLIPTextEncode' && n.inputs.text === NEG));

const cozyFlux = buildFluxCoverPrompt(COZY, {});
check('7. Flux prompts now carry the genre template\'s curated negatives',
  /gore|scary|noir/i.test(cozyFlux.negative));
const kidsFlux = buildFluxCoverPrompt(KIDS, {});
check('7b. a children\'s book gets its safety negatives on the default pipeline',
  /violence|weapon|gore|adult/i.test(kidsFlux.negative));

/* ── WAVE12-TEMPLATE ─────────────────────────────────────────────────────── */
check('8. one resolver honours the explicit template override',
  resolveGenreTemplate(COZY, { genreTemplateId: 'dark_fantasy' })?.id === 'dark_fantasy' &&
  resolveGenreTemplate(COZY, {})?.id === 'cozy_mystery_cottage');
const contradiction = buildFluxCoverPrompt(COZY, { genreTemplateId: 'dark_fantasy' });
check('8b. choosing dark fantasy no longer puts "gritty/noir" in its own negative',
  !/gritty|noir/i.test(contradiction.negative));
check('8c. the same holds for PonyXL',
  !/gritty|noir/i.test(buildPonyXLCoverPrompt(COZY, { genreTemplateId: 'dark_fantasy' }).negative));
check('8d. no prompt path re-derives the template from the project genre',
  !/const template = getGenreCoverTemplate\(genre, subgenre\)/.test(read('src/lib/coverPromptBuilder.js')));

console.log(failures === 0 ? 'ACCEPTANCE: ALL CHECKS MATCHED' : 'ACCEPTANCE: ' + failures + ' CHECK(S) FAILED');
process.exit(failures === 0 ? 0 : 1);
