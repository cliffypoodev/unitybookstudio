// LEAKFIX-1 + OUTLINEFIX-1 acceptance battery. Run from repo root: node battery-leakoutline.mjs
import fs from 'fs';
let failures = 0;
const check = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) failures++; };

/* ── LEAKFIX-1: modelLeakGuard (pure) ── */
{
  const { stripModelControlTokens, stripNonLatinDrift, scrubModelLeaks } = await import(process.cwd() + '/src/lib/modelLeakGuard.js');
  const t1 = 'She did not reach for the book. Not yet. /nothink /nothink Margot stood still.';
  const r1 = stripModelControlTokens(t1);
  check('L1 /nothink stripped mid-paragraph', r1.removed === 2 && !r1.text.includes('/nothink') && r1.text.includes('Not yet. Margot stood still.'));
  const t2 = 'A plan formed. /think Wait. <think>internal chain of thought</think> He moved. <|im_end|>';
  const r2 = stripModelControlTokens(t2);
  check('L2 /think + <think> block + <|special|> stripped', !/\/think|<think>|<\|/.test(r2.text) && r2.text.includes('He moved.'));
  const t3 = 'Jessup’s head hung back. His mouth hung open, a无声的尖叫凝固在空中。磁力场完成了它的工作。\n\nShe sliced.';
  const r3 = stripNonLatinDrift(t3);
  check('L3 CJK run removed', !/[\u4E00-\u9FFF]/.test(r3.text));
  check('L4 beheaded lead-in removed with it', !r3.text.includes('His mouth hung open') && r3.text.includes('Jessup’s head hung back.') && r3.text.includes('She sliced.'));
  const clean = 'A normal paragraph. With two sentences.\n\nAnother paragraph follows here.';
  check('L5 clean text is a byte-identical no-op', scrubModelLeaks(clean).text === clean);
  const t5 = 'The storm eased at dawn.\n\n風が止んだ。彼女は立ち上がった。\n\nMargot checked the ropes.';
  const r5 = stripNonLatinDrift(t5);
  check('L6 standalone foreign paragraph removed, neighbors intact', !/[\u3040-\u30FF\u4E00-\u9FFF]/.test(r5.text) && r5.text.includes('storm eased') && r5.text.includes('checked the ropes'));
  // LEAKFIX-1B regression guards: Antigravity once rewrote the drift regex and
  // left a literal '-' in the character class, shredding every hyphenated word.
  const t6 = 'The well-known climber checked his ice-axe. Then he moved on — slowly.';
  check('L11 hyphenated words and em-dashes untouched', scrubModelLeaks(t6).text === t6);
  const t7 = 'He nodded. 彼は叫んだ！ The rope held.';
  const r7 = stripNonLatinDrift(t7);
  check('L12 fullwidth punctuation removed with its drift run', !/[\uFF01-\uFF5D]/.test(r7.text) && r7.text.includes('He nodded.') && r7.text.includes('The rope held.'));
}

/* ── LEAKFIX-1: wiring ── */
{
  const sw = fs.readFileSync(process.cwd() + '/src/lib/sceneWriter.js', 'utf8');
  check('L7 sceneWriter scrubs before truncation check', sw.includes("scrubModelLeaks(prose, 'scene')") && sw.indexOf("scrubModelLeaks(prose") < sw.indexOf('GATEFIX-25: an ending without terminal punctuation'));
  check('L8 sceneWriter naive CJK line replaced', !sw.includes("prose.replace(/[\\u3400-\\u9FFF"));
  const pd = fs.readFileSync(process.cwd() + '/src/lib/postDraftCleanup.js', 'utf8');
  check('L9 postDraftCleanup scrubs first', pd.includes('scrubModelLeaks(normalizeText(text)'));
  const mp = fs.readFileSync(process.cwd() + '/src/lib/manuscriptPolishRunner.js', 'utf8');
  check('L10 polish runner scrubs every chapter pre-A0', mp.includes('A-LEAK (LEAKFIX-1)') && mp.indexOf('A-LEAK (LEAKFIX-1)') < mp.indexOf('A0: Legacy artifact healing'));
}

/* ── OUTLINEFIX-1: gate (pure) ── */
{
  const { analyzeOutlineDuplication, buildOutlineDistinctnessRules, buildOutlineDedupeRetryAppendix } = await import(process.cwd() + '/src/lib/outlineDedupeGate.js');
  const fnTitles = ['The Weight of the World','The First Cut','The Ledger Begins','The Charnel Approach','The First Avalanche','The Cut Rope','The Ghost of J. Harris','The Mutiny','The Descent Begins',"The Stone Mother's Wound",'The Final Reckoning','The Ledger Closes','The Open Road','The Legacy of the Godsfang','The Final Avalanche','The Last Outpost Revisited','The Ghosts of the Past','The Final Cut','The Open Road Continues','The Final Ledger','The Final Descent','The Final Reckoning — Aftermath','The Final Avalanche — Aftermath','The Last Outpost Revisited — Aftermath','The Open Road — Aftermath'];
  const bad = fnTitles.map((t,i)=>({chapter_number:i+1,title:t,beat_summary:''}));
  const rb = analyzeOutlineDuplication(bad);
  check('O1 the real False North outline is flagged critical', rb.critical === true && rb.pairs.length >= 10);
  const goodSum = [
    'Margot signs on to guide the Abernathy expedition and inventories the team at the Last Outpost, hiding the debt that forces her hand.',
    'A brutal storm on the lower ridge forces the first camp early; Voss is injured and Margot makes her first entry in the ledger.',
    'Declan reveals the 1908 map fragment and the true objective; Margot realizes the route crosses Dead Mans Pass.',
    'Crossing the pass, the team finds the frozen remains of Team Gamma and a green notebook belonging to J Harris.',
    'An avalanche buries the supply sled; the investors demand retreat while Declan pushes on, splitting the expedition.',
    'Jessup is pinned by an ice block; Margot must cut the rope, her first kill, and Reed begins documenting her choices.',
    'Harris notebook pages reveal the sky-iron drove the 1908 team mad; the compass begins to fail near the cirque.',
    'The remaining porters mutiny at the high camp and take the fuel; Calder sides with Margot against Declan.',
    'The descent into the cirque begins; magnetic interference destroys navigation and Reed confesses her employers motives.',
    'At the Stone Mothers Wound they find the sky-iron vein and what became of Harris; Declan stakes his claim.',
    'Declan falls to his death defending the core sample; Margot chooses the survivors over the prize.',
    'Margot and Calder walk out to the valley, the ledger balanced, leaving the sky-iron sealed under the ice.'
  ];
  const titles=['Ashfall at the Outpost','Ropes and Ledgers','The Charnel Throat','What Harris Left Behind','Whiteout','A Body on the Line','Iron in the Blood','The Investors Break','Dead Reckoning','The Stone Mother','What the Mountain Keeps','The Long Walk West'];
  const good = goodSum.map((sm,i)=>({chapter_number:i+1,title:titles[i],beat_summary:sm}));
  const rg = analyzeOutlineDuplication(good);
  check('O2 a distinct 12-chapter outline passes clean', rg.ok === true && rg.critical === false);
  const dup = good.concat([{chapter_number:13,title:'The Reckoning',beat_summary:'A second avalanche buries the camp; the team again demands retreat while the leader pushes on, splitting the group once more.'}]);
  const rd = analyzeOutlineDuplication(dup);
  check('O3 a paraphrased event re-run is flagged critical', rd.critical === true && rd.pairs.some(p => p.a === 5 && p.b === 13));
  check('O4 motif word 3+ is soft, not critical', (() => {
    const motif = good.map((c,i)=> i<3 ? {...c, title: c.title + ' Ledger'} : c);
    const rm = analyzeOutlineDuplication(motif);
    return rm.critical === false && rm.issues.some(x => x.includes('"ledger"'));
  })());
  check('O5 rules + retry appendix are generic (no book specifics)', !/margot|avalanche|sky-iron/i.test(buildOutlineDistinctnessRules(25)) && buildOutlineDedupeRetryAppendix(rb, 25).includes('REJECTED'));
}

/* -- OUTLINEFIX-2: wiring -- */
{
  const pb = fs.readFileSync(process.cwd() + '/src/lib/parallelBibleGenerator.js', 'utf8');
  check('O6 repair loop wired, fiction-only, gutted-aware', pb.includes('if (isFiction && chapters.length > 1)') && pb.includes('while ((dupe.critical || forced.length) && round < 3)') && pb.includes('buildOutlineChapterRepairPrompt(chapters, offenders, targetCount, { charactersMd, canonMd, soft: dupe.soft })'));
  check('O7 never hard-fails: best-effort acceptance, no throw', pb.includes('Accepting best-effort outline') && !pb.includes('Outline failed the distinctness gate twice'));
  check('O8 distinctness rules in main outline prompt (fiction only)', pb.includes("${isFiction ? buildOutlineDistinctnessRules(chapterCount) : ''}"));
  check('O9 repair prompt bans padding re-runs', pb.includes('NEVER pad by re-running events'));
  check('O13 outline_md rebuilt after any splice', pb.includes('outlineMd = rebuildOutlineMd(chapters)'));
}

/* -- OUTLINEFIX-2: repair machinery (pure) -- */
{
  const { analyzeOutlineDuplication, findOutlineOffenders, buildOutlineChapterRepairPrompt, spliceOutlineChapters, rebuildOutlineMd } = await import(process.cwd() + '/src/lib/outlineDedupeGate.js');
  const chs = [
    { chapter_number: 1, title: 'The Approach', beat_summary: 'The team assembles at the trailhead and the guide hides her debt while inventorying supplies and people for the climb ahead.' },
    { chapter_number: 2, title: 'Whiteout', beat_summary: 'An avalanche buries the supply sled and the investors demand retreat while the leader pushes on, splitting the expedition in two.' },
    { chapter_number: 3, title: 'The Approach Revisited', beat_summary: 'They assemble again at the trailhead, checking supplies and people once more before climbing.' },
    { chapter_number: 4, title: 'Second Snow', beat_summary: 'Another avalanche buries the camp; the team again demands retreat while the leader pushes on, splitting the group once more.' },
  ];
  const an = analyzeOutlineDuplication(chs);
  const off = findOutlineOffenders(an);
  check('O10 offenders are the later re-run chapters', an.critical === true && off.includes(3) && off.includes(4) && !off.includes(1) && !off.includes(2));
  const prompt = buildOutlineChapterRepairPrompt(chs, off, 4);
  check('O11 repair prompt marks only offenders and keeps the rest', prompt.includes('Ch.3 [REPLACE]') && prompt.includes('Ch.4 [REPLACE]') && !prompt.includes('Ch.1 [REPLACE]') && prompt.includes('REPLACE ONLY'));
  const sp = spliceOutlineChapters(chs, [
    { chapter_number: 3, title: 'The Wire Cutter', beat_summary: 'A saboteur severs the radio line and the guide discovers the expedition was never meant to report back; she hides the cut wire and starts watching everyone.' },
    { chapter_number: 4, title: 'Iron Fever', beat_summary: 'The doctor reveals the mineral sickness spreading through the porters; the guide must choose who carries the lighter loads, making her first enemy.' },
    { chapter_number: 1, title: 'HACK', beat_summary: 'should be ignored - not an offender chapter at all here' },
    { chapter_number: 4, title: '', beat_summary: 'no title so this replacement is rejected' },
  ], off);
  check('O12 splice replaces only valid offender chapters', sp.replaced.length === 2 && sp.chapters[0].title === 'The Approach' && sp.chapters[2].title === 'The Wire Cutter' && sp.chapters[3].title === 'Iron Fever');
  const after = analyzeOutlineDuplication(sp.chapters);
  check('O14 outline converges after splice', after.critical === false);
  check('O15 rebuilt outline_md covers every chapter', (rebuildOutlineMd(sp.chapters).match(/## Chapter /g) || []).length === 4);
}

/* -- OUTLINEFIX-3: ending shapes, verbatim phrases, advisories -- */
{
  const { analyzeOutlineDuplication, buildOutlineChapterRepairPrompt } = await import(process.cwd() + '/src/lib/outlineDedupeGate.js');
  const dbl = [
    { chapter_number: 13, title: 'The Turn', beat_summary: 'Margot accepts she cannot save everyone, leading to a moment of grace and hard self-knowledge on the ridge.' },
    { chapter_number: 14, title: 'The Give-Back', beat_summary: 'Declan abandons his sample, and the survivors reach the lowlands, choosing the open road.' },
    { chapter_number: 15, title: 'The Long Walk', beat_summary: 'Margot and Calder leave civilization behind, symbolizing their break from the past.' },
    { chapter_number: 16, title: 'Iron Debts', beat_summary: 'A creditor from the outpost tracks the survivors and demands payment in sky-iron they no longer carry.' },
    { chapter_number: 17, title: 'The Road Ahead', beat_summary: 'Margot and Calder emerge changed and embrace the uncertainty of the future, symbolizing their break from the past.' },
  ];
  const an = analyzeOutlineDuplication(dbl);
  check('O16 ending shapes before the finale flagged as offenders', an.critical === true && an.offenderNums.includes(14) && an.offenderNums.includes(15) && !an.offenderNums.includes(17));
  check('O17 verbatim 5-word phrase across summaries is critical', an.pairs.some(p => p.b === 17 && p.reasons.some(r => r.includes('verbatim 5-word phrase'))));
  const two = [
    { chapter_number: 1, title: 'The Outpost Ledger', beat_summary: 'Margot reviews expedition gear at the outpost, clashes with Declan over weight, and discovers an unmapped cairn.' },
    { chapter_number: 2, title: 'The Storm Price', beat_summary: 'A reckless night march kills the lead porter in a brutal storm and Margot finds an unmapped cairn.' },
  ];
  const two2 = analyzeOutlineDuplication(two);
  check('O18 repeated event mention is a soft advisory, not a block', two2.critical === false && (two2.soft || []).some(x => x.includes('unmapped cairn')));
  const prompt = buildOutlineChapterRepairPrompt(dbl, [14, 15], 17, { charactersMd: 'Margot Hayes: guide haunted by her brother Finn.', canonMd: 'Sky-iron disrupts compasses.', soft: two2.soft });
  check('O19 repair prompt carries canon, chronology, no-retcon, advisories', prompt.includes('STORY BIBLE (established canon') && prompt.includes('CHRONOLOGY') && prompt.includes('NO RETCONS') && prompt.includes('ADVISORY') && prompt.includes('unmapped cairn'));
}

/* -- LEAKFIX-2: outline + bible field scrubbing -- */
{
  const { scrubOutlineChapters } = await import(process.cwd() + '/src/lib/modelLeakGuard.js');
  const r = scrubOutlineChapters([
    { chapter_number: 18, title: 'The裂痕的呼唤', beat_summary: 'Calder faces a moral dilemma that tests his loyalty to Margot in a way that changes both of them.' },
    { chapter_number: 19, title: 'The Price of Survival', beat_summary: 'Margot must sacrifice resources, threatening the team fragile unity in the high passes tonight.' },
  ]);
  check('L13 drift-gutted chapter title reported for replacement', r.gutted.length === 1 && r.gutted[0] === 18 && r.chapters[1].title === 'The Price of Survival');
  const pb = fs.readFileSync(process.cwd() + '/src/lib/parallelBibleGenerator.js', 'utf8');
  check('L14 outline chapters scrubbed + gutted forced into repair', pb.includes('scrubOutlineChapters(chapters)') && pb.includes('let forced = scrub0.gutted'));
  check('L15 every bible field scrubbed before return', ['world','characters','voice','canon','mystery','outline','twists'].every(f => pb.includes("scrubField(" + f + "Md, '" + f + "')")));
}

/* -- FIELDGUARD-1: bible field floors -- */
{
  const { BIBLE_FIELD_FLOORS, fieldLengthOk, buildFieldRetryAppendix } = await import(process.cwd() + '/src/lib/bibleFieldGuard.js');
  check('F1 floors cover the five bible documents', ['world_md','characters_md','voice_md','canon_md','mystery_md'].every(f => BIBLE_FIELD_FLOORS[f] >= 400));
  check('F2 empty and stub fields fail the floor', fieldLengthOk('characters_md', '') === false && fieldLengthOk('characters_md', 'Not generated') === false && fieldLengthOk('world_md', 'x'.repeat(1300)) === true);
  check('F3 retry appendix is generic and demands completeness', (() => { const a = buildFieldRetryAppendix('characters_md', 1200); return a.includes('LENGTH ENFORCEMENT') && a.includes('characters_md') && !/margot|godsfang|juneteenth/i.test(a); })());
  const pb = fs.readFileSync(process.cwd() + '/src/lib/parallelBibleGenerator.js', 'utf8');
  check('F4 all five fields guarded with single retry then throw', ['world_md','characters_md','voice_md','canon_md','mystery_md'].every(f => pb.includes("fieldGuardRetry('" + f + "'")) && pb.includes('Nothing was saved - run Build Story Bible again.'));
}

/* -- DIALOGUEFIX-1 + QUOTEDEDUPE-1 -- */
{
  const { runDialogueMechanicsPass } = await import(process.cwd() + '/src/lib/dialogueMechanicsRepair.js');
  const t1 = 'He placed a hand on the ledger. \u201cOptimism is a resource, Margot. Don\u2019t waste it on meteorology.\u201d Optimism is dead weight.\u201d Margot dropped the rope into a crate.';
  const r1 = runDialogueMechanicsPass(t1, {});
  check('D1 orphan closer after action beat healed', r1.orphanRepaired === 1 && r1.text.includes('\u201d \u201cOptimism is dead weight.\u201d Margot dropped'));
  const t2 = 'Margot faced him. The charter pays for my silence.\u201d Margot turned to face him.';
  const r2 = runDialogueMechanicsPass(t2, {});
  check('D2 ambiguous narration-prefix orphan flagged, never guessed', r2.orphanRepaired === 0 && r2.orphanFlagged >= 1 && r2.text === t2);
  const clean = 'Margot said, \u201cHold the line.\u201d He nodded. \u201cGood.\u201d They climbed on in silence.';
  check('D3 clean dialogue is a no-op', runDialogueMechanicsPass(clean, {}).text === clean);
  const sw = fs.readFileSync(process.cwd() + '/src/lib/sceneWriter.js', 'utf8');
  check('D4 draft path heals dialogue BEFORE quote dedupe', sw.includes("runDialogueMechanicsPass(finalProse, { stage: 'draft-final' })") && sw.indexOf("stage: 'draft-final'") < sw.indexOf('finalProse = dedupeRepeatedQuotes(finalProse);'));
  const dm = fs.readFileSync(process.cwd() + '/src/lib/dialogueMechanicsRepair.js', 'utf8');
  check('D5 module version bumped', dm.includes('dialogue-mechanics-repair-v1.1.0-orphan-closer'));
}
{
  // QUOTEDEDUPE-1 functional: extract the private functions and run them.
  const src = fs.readFileSync(process.cwd() + '/src/lib/sceneWriter.js', 'utf8');
  const grab = (name) => { const i = src.indexOf('function ' + name); const j = src.indexOf('\n}\n', i) + 3; return src.slice(i, j); };
  const tmp = '/tmp/battery-dedupelib.mjs';
  fs.writeFileSync(tmp, grab('splitSentencesSafe') + '\n' + grab('dedupeRepeatedQuotes') + '\nexport { dedupeRepeatedQuotes };\n');
  const { dedupeRepeatedQuotes } = await import(tmp);
  const t = 'A. \u201cOptimism is a resource, Margot. Don\u2019t waste it on meteorology.\u201d B ran for an hour after that exchange had ended. C. \u201cOptimism is a resource, Margot. Don\u2019t waste it on meteorology. Or mechanics.\u201d D dropped the harness onto the table again.';
  const out = dedupeRepeatedQuotes(t);
  check('D6 multi-sentence quote repeats collapse (containment)', (out.match(/Optimism is a resource/g) || []).length === 1 && out.includes('B ran for an hour'));
  const ok = '\u201cHold the line tonight, all of you,\u201d she said. \u201cDifferent words entirely in this one,\u201d he replied without turning around.';
  check('D7 distinct quotes untouched', dedupeRepeatedQuotes(ok) === ok);
}

/* -- DIALOGUEFIX-2: save-path quote integrity -- */
{
  const pd = fs.readFileSync(process.cwd() + '/src/lib/postDraftCleanup.js', 'utf8');
  check('D8 copyedit validator rejects quote-structure damage', pd.includes('broke quote balance') && pd.includes('outImbalance > inImbalance + 1'));
  const qf = fs.readFileSync(process.cwd() + '/src/lib/quoteFixPolish.js', 'utf8');
  check('D9 book-specific name list purged from quote balancer', qf.includes('Never delete quotation marks') && qf.indexOf('Pauline') === -1 && qf.indexOf('Langston') === -1);
  const { repairChapterQuotes } = await import(process.cwd() + '/src/lib/quoteFixPolish.js');
  const orphanPara = 'We need oxygen."';
  const r = repairChapterQuotes(orphanPara);
  check('D10 orphan speech line is wrapped, not stripped', r.text.includes('\u201cWe need oxygen.\u201d') || r.text.includes('"We need oxygen."'));
  const narr = 'The wind rose over the eastern face and did not stop for three days"';
  const rn = repairChapterQuotes(narr);
  check('D11 unresolvable line keeps its quote (no deletion)', rn.text.includes('"') || rn.text.includes('\u201d'));
  const ps = fs.readFileSync(process.cwd() + '/src/pages/ProjectStudio.jsx', 'utf8');
  check('D12 true-last dialogue heal at BOTH save sites', (ps.match(/stage: 'pre-save'/g) || []).length === 2);
}

console.log(failures === 0 ? 'BATTERY: ALL PASS' : 'BATTERY: ' + failures + ' FAILURE(S)');
process.exit(failures === 0 ? 0 : 1);
