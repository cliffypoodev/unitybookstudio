// SWEEP-1 acceptance battery (UBS_plan.md Phase 2A) — the mechanical,
// whole-book, pairwise beat comparison. Report only: no gates, no writes to
// Chapter/NovelProject. Generic fixture names only (Mara, Dov, Ilse).
import fs from 'node:fs';
import {
  REPETITION_SWEEP_VERSION,
  TYPE_MATCH_WEIGHT,
  PARTICIPANT_OVERLAP_WEIGHT,
  CONTENT_SIMILARITY_WEIGHT,
  EMOTIONAL_CORE_WEIGHT,
  SUBJECT_SIMILARITY_FLOOR,
  DISTANCE_BOOST_CAP,
  DISTANCE_BOOST_PER_UNIT,
  CLUSTER_MIN_OCCURRENCES,
  DEFAULT_SWEEP_THRESHOLD,
  compareBeats,
  compareUnits,
  recommendForUnitPair,
  detectClusters,
  buildEntityAliasMap,
  applyAliasToBeat,
  sweepProject,
  formatSweepReport,
} from '../src/lib/repetitionSweep.js';
import { runSweepCommand, parseArgs } from '../scripts/sweep.mjs';

let failures = 0;
const check = (name, pass, detail) => { console.log((pass ? 'PASS ' : 'FAIL ') + name + (pass || !detail ? '' : `\n      ${detail}`)); if (!pass) failures += 1; };

// ── version + weight shape ──
check('1. REPETITION_SWEEP_VERSION', REPETITION_SWEEP_VERSION === 'repetition-sweep-v1');
check('2. compareBeats weights sum to 1.0', Math.abs((TYPE_MATCH_WEIGHT + PARTICIPANT_OVERLAP_WEIGHT + CONTENT_SIMILARITY_WEIGHT + EMOTIONAL_CORE_WEIGHT) - 1) < 1e-9);
check('3. DEFAULT_SWEEP_THRESHOLD matches the plan\'s example (0.72)', DEFAULT_SWEEP_THRESHOLD === 0.72);

// ── compareBeats: planted repeat, unrelated, protagonist-only overlap ──
const REPEAT_A = { beat_type: 'confrontation', participants: ['Mara', 'Dov'], subject: 'the missing ledger', summary: 'Dov confronts Mara about the ledger going missing.', emotional_core: 'distrust -> anger' };
const REPEAT_B = { beat_type: 'confrontation', participants: ['Mara Vale', 'Dov'], subject: 'the missing ledger', summary: 'Dov confronts Mara again about the ledger going missing.', emotional_core: 'distrust -> anger' };
const UNRELATED = { beat_type: 'setpiece', participants: ['Ilse'], subject: 'the harbor fire', summary: 'Ilse escapes the burning warehouse.', emotional_core: 'fear -> relief' };
// same protagonist + same type as REPEAT_A, but a DIFFERENT subject — the
// Sep 4 single-POV false-positive shape: type+participant alone must not match.
const PROTAGONIST_ONLY = { beat_type: 'confrontation', participants: ['Mara', 'Ilse'], subject: 'the stolen boat', summary: 'Ilse yells at Mara about the boat.', emotional_core: 'distrust -> anger' };

{
  const cmp = compareBeats(REPEAT_A, REPEAT_B);
  check('4. compareBeats scores a planted repeat high (same subject, same type, overlapping participant tokens "Mara"/"Mara Vale")', cmp.score >= DEFAULT_SWEEP_THRESHOLD, JSON.stringify(cmp));
}
{
  const cmp = compareBeats(REPEAT_A, UNRELATED);
  check('5. compareBeats scores unrelated beats near zero', cmp.score < 0.1, JSON.stringify(cmp));
}
{
  const cmp = compareBeats(REPEAT_A, PROTAGONIST_ONLY);
  check('6. protagonist-only overlap does NOT match without subject overlap (Sep 4 lesson — the subject-similarity floor)', cmp.score < 0.3 && cmp.gated === true, JSON.stringify(cmp));
  check('7. the gate is keyed on the named SUBJECT_SIMILARITY_FLOOR constant, not a hidden threshold', cmp.contentScore < SUBJECT_SIMILARITY_FLOOR);
}

// ── compareUnits: distance boost, capped ──
{
  const unitNear = { chapterNumber: 4, sceneNumber: 2, beats: [REPEAT_A] };
  const unitFar = { chapterNumber: 12, sceneNumber: 1, beats: [REPEAT_B] };
  const nearCmp = compareUnits(unitNear, unitFar, 1);
  const farCmp = compareUnits(unitNear, unitFar, 1000000);
  check('8. distance boost is capped — an enormous distance never exceeds 1 + DISTANCE_BOOST_CAP', farCmp.distanceBoost <= 1 + DISTANCE_BOOST_CAP + 1e-9, `distanceBoost=${farCmp.distanceBoost}`);
  check('9. a larger distance boosts more than a smaller one, up to the cap', farCmp.distanceBoost > nearCmp.distanceBoost);
  check('10. DISTANCE_BOOST_PER_UNIT is a named, non-zero constant driving the boost', DISTANCE_BOOST_PER_UNIT > 0);
}

// ── recommendation: novelty-weighted, keeps an unmatched revelation ──
{
  const revelation = { beat_type: 'revelation', participants: ['Mara'], subject: 'her true parentage', summary: 'Mara learns her real father\'s identity.', emotional_core: 'confusion -> clarity' };
  const earlierUnit = { chapterNumber: 4, sceneNumber: 2, beats: [REPEAT_A] };
  const laterUnit = { chapterNumber: 12, sceneNumber: 1, beats: [REPEAT_B, revelation] };
  const cmp = compareUnits(earlierUnit, laterUnit, 8);
  const rec = recommendForUnitPair(earlierUnit, laterUnit, cmp.matchedBeats);
  check('11. a later unit with an unmatched high-novelty beat (revelation) gets partial_compress_later, not a flat cut', rec.action === 'partial_compress_later');
  check('12. the unmatched revelation is in the KEEP list', rec.keep.includes(revelation));
  check('13. the matched (repeat) beat is in the COMPRESS list', rec.compress.includes(REPEAT_B));
}
{
  // no unmatched high-novelty beat in the later unit -> full cut
  const earlierUnit = { chapterNumber: 4, sceneNumber: 2, beats: [REPEAT_A] };
  const laterUnit = { chapterNumber: 12, sceneNumber: 1, beats: [REPEAT_B] };
  const cmp = compareUnits(earlierUnit, laterUnit, 8);
  const rec = recommendForUnitPair(earlierUnit, laterUnit, cmp.matchedBeats);
  check('14. a later unit with nothing unmatched gets full_cut_later, not partial', rec.action === 'full_cut_later');
}

// ── cluster detection: found at 3 occurrences even when no pair crosses the pairwise threshold ──
{
  const motifA = { beat_type: 'emotional_beat', participants: ['Ilse'], subject: 'staring at the sea', summary: 'Ilse stares at the gray sea, thinking of home.', emotional_core: 'longing -> resolve' };
  const motifB = { beat_type: 'decision', participants: ['Ilse'], subject: 'staring at the sea', summary: 'Ilse stares at the sea again, deciding to leave.', emotional_core: 'longing -> resolve' };
  const motifC = { beat_type: 'setpiece', participants: ['Ilse'], subject: 'staring at the harbor', summary: 'Ilse stares at the harbor waters, remembering home.', emotional_core: 'longing -> resolve' };
  const allBeats = [REPEAT_A, motifA, motifB, motifC, UNRELATED];

  const pairwiseScores = [[motifA, motifB], [motifA, motifC], [motifB, motifC]].map(([x, y]) => compareBeats(x, y).score);
  check('15. no pair among the 3 motif beats crosses the pairwise sweep threshold on its own', pairwiseScores.every((s) => s < DEFAULT_SWEEP_THRESHOLD), JSON.stringify(pairwiseScores));

  const clusters = detectClusters(allBeats);
  const motifCluster = clusters.find((c) => c.occurrences === 3);
  check(`16. a motif recurring ${CLUSTER_MIN_OCCURRENCES}+ times clusters together even though no pair crosses the pairwise threshold`, !!motifCluster, JSON.stringify(clusters));
  check('17. the unrelated beat and the one-off repeat do not join the motif cluster', motifCluster && !motifCluster.beats.includes(UNRELATED) && !motifCluster.beats.includes(REPEAT_A));
}

// ── entity aliasing: in-memory only, fails open ──
{
  const beats = [REPEAT_A, REPEAT_B];
  const mockLLM = async () => ({ text: JSON.stringify({ 'Mara Vale': 'Mara', Mara: 'Mara', Dov: 'Dov' }), finishReason: 'stop' });
  const before = JSON.stringify(beats);
  const result = await buildEntityAliasMap(beats, { callLLM: mockLLM });
  check('18. buildEntityAliasMap parses a well-formed alias map', result.applied === true && result.aliasMap['Mara Vale'] === 'Mara');
  check('19. buildEntityAliasMap never mutates its input beats', JSON.stringify(beats) === before);

  const aliased = applyAliasToBeat(REPEAT_B, result.aliasMap);
  check('20. applyAliasToBeat returns a NEW object (never mutates the input)', aliased !== REPEAT_B && REPEAT_B.participants.includes('Mara Vale'));
  check('21. applyAliasToBeat resolves the variant to the canonical name', aliased.participants.includes('Mara') && !aliased.participants.includes('Mara Vale'));
}
{
  const failingLLM = async () => ({ text: '', finishReason: null });
  const result = await buildEntityAliasMap([REPEAT_A], { callLLM: failingLLM });
  check('22. an aliasing failure (empty completion) fails open — applied:false, never throws', result.applied === false);
}
check('23. buildEntityAliasMap requires an injected callLLM (never resolves a model itself, per beatLedger.js\'s scope boundary)', (await buildEntityAliasMap([REPEAT_A], {})).applied === false);

// ── sweepProject: ties it together; aliasing store-unchanged; one model call per book ──
{
  const entries = [
    { id: '1', chapter_number: 4, scene_number: 2, ...REPEAT_A },
    { id: '2', chapter_number: 12, scene_number: 1, ...REPEAT_B },
    { id: '3', chapter_number: 1, scene_number: 1, ...UNRELATED },
  ];
  const beforeEntries = JSON.stringify(entries);
  let llmCallCount = 0;
  const mockLLM = async () => { llmCallCount += 1; return { text: JSON.stringify({}), finishReason: 'stop' }; };

  const store = { BeatLedgerEntry: { filter: async () => entries } };
  const result = await sweepProject('proj-9', { store, threshold: 0.5, callLLM: mockLLM });

  check('24. sweepProject finds the planted cross-chapter repeat', result.pairs.some((p) => p.unitA === 'ch4/s2' && p.unitB === 'ch12/s1'));
  check('25. sweepProject reports unitCount matching the distinct (chapter, scene) keys', result.unitCount === 3);
  check('26. sweepProject makes exactly ONE model call for the whole book (entity aliasing), never per-pair', llmCallCount === 1);
  check('27. aliasing applied in-memory only — the store\'s own entries are never mutated by sweepProject', JSON.stringify(entries) === beforeEntries);
}

// ── report + script: saved via the store mock, never Chapter.update ──
{
  const entries = [
    { id: '1', chapter_number: 4, scene_number: 2, ...REPEAT_A },
    { id: '2', chapter_number: 12, scene_number: 1, ...REPEAT_B },
  ];
  const createdAssets = [];
  let chapterUpdateCalled = false;
  let novelProjectUpdateCalled = false;
  const store = {
    NovelProject: { get: async () => ({ id: 'proj-9', title: 'Fixture Book' }), update: async () => { novelProjectUpdateCalled = true; } },
    Chapter: { update: async () => { chapterUpdateCalled = true; } },
    BeatLedgerEntry: { filter: async () => entries },
    PublishingAsset: { create: async (doc) => { createdAssets.push(doc); return { id: 'asset-1', ...doc }; } },
  };

  const { result, report, asset } = await runSweepCommand({
    projectId: 'proj-9',
    threshold: 0.5,
    store,
    sweepProject,
    formatSweepReport,
    pickModel: () => 'the-writer-model',
    callAgentWithMeta: async () => ({ text: '{}', finishReason: 'stop' }),
    log: () => {},
  });

  check('28. runSweepCommand saves the report via the store mock (PublishingAsset.create)', createdAssets.length === 1 && asset.id === 'asset-1');
  check('29. the saved asset carries kind: \'repetition_sweep_report\' and the project_id', createdAssets[0].kind === 'repetition_sweep_report' && createdAssets[0].project_id === 'proj-9');
  check('30. the saved asset\'s content is the JSON result (parseable, carries the pairs)', JSON.parse(createdAssets[0].content).pairs.length === result.pairs.length);
  check('31. the printed report names both units and a recommendation', report.includes('ch4/s2') && report.includes('ch12/s1') && report.includes('recommendation:'));
  check('32. runSweepCommand never calls Chapter.update or NovelProject.update', chapterUpdateCalled === false && novelProjectUpdateCalled === false);
}

// ── script argument parsing + source-shape (never writes Chapter/NovelProject) ──
check('33. parseArgs parses --project and --threshold', (() => { const f = parseArgs(['--project', 'p1', '--threshold', '0.6']); return f.project === 'p1' && f.threshold === '0.6'; })());
check('34. scripts/sweep.mjs never calls Chapter.update or NovelProject.update (source scan)', !/store\.Chapter\.update|store\.NovelProject\.update/.test(fs.readFileSync(new URL('../scripts/sweep.mjs', import.meta.url), 'utf8')));

console.log(failures === 0 ? '\nACCEPTANCE: ALL CHECKS MATCHED' : `\nACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
