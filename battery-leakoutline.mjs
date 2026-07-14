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

console.log(failures === 0 ? 'BATTERY: ALL PASS' : 'BATTERY: ' + failures + ' FAILURE(S)');
process.exit(failures === 0 ? 0 : 1);
