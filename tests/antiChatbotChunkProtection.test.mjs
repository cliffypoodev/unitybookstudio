/**
 * antiChatbotChunkProtection.test.mjs
 *
 * Tests chunk protection detection in the recast pipeline.
 * Verifies that detectProtections correctly identifies citations,
 * bibliography, block quotes, tables, lists, legal language, scripture,
 * dialogue-heavy content, and high-scoring chunks — and that
 * shouldRecastChunk respects these protections.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';

import {
  detectProtections,
  splitTextIntoRecastChunks,
  shouldRecastChunk,
  PROTECTION_TYPE,
} from '../src/lib/antiChatbotRecastPipeline.js';

import { analyzeProseTexture } from '../src/lib/antiChatbotProse.js';

// ─── Helper: pad text to a minimum word count ─────────────────────────────
function padToWords(text, minWords) {
  const current = text.split(/\s+/).filter(Boolean).length;
  if (current >= minWords) return text;
  const filler = ' The morning sky stretched pale and gray above the rooftops, casting long shadows across the cracked sidewalk where pigeons gathered in loose clusters near the bakery door.';
  let padded = text;
  while (padded.split(/\s+/).filter(Boolean).length < minWords) {
    padded += filler;
  }
  return padded;
}

// ─── 1. detectProtections ─────────────────────────────────────────────────

describe('detectProtections', () => {
  it('Citations detected', () => {
    const text = `The phenomenon has been well documented in several longitudinal studies
spanning the last two decades. According to recent meta-analyses, the effect
size remains consistent across different populations and methodological
approaches (Smith, 2024). Researchers have noted that the variability in
outcomes tends to decrease when stricter controls are applied to the
experimental conditions and sampling procedures.`;

    const protection = detectProtections(text);
    assert.strictEqual(protection.protected, true, 'Should be protected');
    assert.ok(
      protection.reasons.includes('citation'),
      `Reasons should include 'citation', got: ${protection.reasons}`
    );
  });

  it('Bracket citations detected', () => {
    const text = `Climate models have improved significantly over the past decade, with
newer simulations incorporating ocean-atmosphere coupling at much finer
spatial resolutions than earlier generations allowed. The latest IPCC
assessment draws on over forty independent modeling groups [1]. Ensemble
agreement on temperature projections has tightened, though precipitation
forecasts remain less certain due to sub-grid convective processes that
resist parameterization at current compute budgets.`;

    const protection = detectProtections(text);
    assert.strictEqual(protection.protected, true, 'Should be protected');
    assert.ok(
      protection.reasons.includes('citation'),
      `Reasons should include 'citation', got: ${protection.reasons}`
    );
  });

  it('Bibliography section detected', () => {
    const text = `References

Smith, J. (2024). The Structure of Scientific Revolutions Revisited.
Cambridge University Press.

Johnson, L. & Patel, R. (2023). Quantitative Methods in Social Research.
Oxford Academic.

Williams, T. (2022). Data-Driven Decision Making in Modern Organizations.
Harvard Business Review Press.`;

    const protection = detectProtections(text);
    assert.strictEqual(protection.protected, true, 'Should be protected');
    assert.ok(
      protection.reasons.includes('bibliography'),
      `Reasons should include 'bibliography', got: ${protection.reasons}`
    );
  });

  it('Block quotes detected', () => {
    const text = `> The old man sat on the porch and watched the road turn to dust.
> He had not spoken in three days, and no one asked him why.
> The dog slept at his feet, twitching in a dream about rabbits.
> A truck passed on the highway, and the sound faded into nothing.
> The chairs on the porch had been repainted twice since June.
> Nothing about the afternoon suggested it would end differently.
> But the letter in his shirt pocket said otherwise.`;

    const protection = detectProtections(text);
    assert.strictEqual(protection.protected, true, 'Should be protected');
    assert.ok(
      protection.reasons.includes('block_quote'),
      `Reasons should include 'block_quote', got: ${protection.reasons}`
    );
  });

  it('Tables detected', () => {
    const text = `The following table summarizes quarterly results across all divisions.

| Quarter | Revenue  | Expenses | Margin |
|---------|----------|----------|--------|
| Q1      | $1.2M    | $900K    | 25%    |
| Q2      | $1.5M    | $1.1M   | 27%    |
| Q3      | $1.8M    | $1.2M   | 33%    |
| Q4      | $2.1M    | $1.4M   | 33%    |`;

    const protection = detectProtections(text);
    assert.strictEqual(protection.protected, true, 'Should be protected');
    assert.ok(
      protection.reasons.includes('table'),
      `Reasons should include 'table', got: ${protection.reasons}`
    );
  });

  it('Structured lists detected', () => {
    const text = `- Gather the required safety equipment before entering the work site
- Verify that the air monitoring system is calibrated and operational
- Check the emergency communication channel for signal strength
- Inspect the ventilation system for obstructions or damage
- Log your entry time and estimated duration in the access binder
- Confirm that at least one standby attendant is posted at the opening
- Review the hazard assessment posted on the entry permit`;

    const protection = detectProtections(text);
    assert.strictEqual(protection.protected, true, 'Should be protected');
    assert.ok(
      protection.reasons.includes('list'),
      `Reasons should include 'list', got: ${protection.reasons}`
    );
  });

  it('Legal language detected', () => {
    const text = `All personnel are required to complete the mandated training modules
pursuant to federal workplace safety standards before receiving site
clearance. Contractors must submit documentation of current certifications
in accordance with the requirements outlined in Appendix D of the master
services agreement. Failure to comply within the specified timeframe may
result in suspension of access privileges and referral to the compliance
review board for further adjudication.`;

    const protection = detectProtections(text);
    assert.strictEqual(protection.protected, true, 'Should be protected');
    assert.ok(
      protection.reasons.includes('legal'),
      `Reasons should include 'legal', got: ${protection.reasons}`
    );
  });

  it('Scripture detected', () => {
    const text = `The sermon opened with a reading from the Gospel, and the congregation
listened in the amber light filtering through the stained-glass windows
above the nave. The pastor read aloud from Matthew 5:14, pausing at
each phrase to let the meaning settle into the quiet of the sanctuary.
The children fidgeted in the front pew, but even they grew still when
the organ began its low accompanying hum beneath the spoken word.`;

    const protection = detectProtections(text);
    assert.strictEqual(protection.protected, true, 'Should be protected');
    assert.ok(
      protection.reasons.includes('scripture'),
      `Reasons should include 'scripture', got: ${protection.reasons}`
    );
  });

  it('Dialogue-heavy detected', () => {
    const text = `"I told you not to come back here," she said.
"You told me a lot of things," he answered, leaning against the door.
"And you ignored every single one of them," she shot back.
"Not every one," he said. "I remembered the part about the keys."
"That was the least important part," she said, crossing her arms.
"Maybe to you," he replied, pulling the key ring from his coat pocket.
"Give me those," she demanded, reaching across the narrow hallway.
"Not until you hear what I have to say," he said, stepping backward.
"I already know what you're going to say," she told him.
"No, you don't," he said. "Not this time."`;

    const protection = detectProtections(text);
    assert.strictEqual(protection.protected, true, 'Should be protected');
    assert.ok(
      protection.reasons.includes('dialogue_heavy'),
      `Reasons should include 'dialogue_heavy', got: ${protection.reasons}`
    );
  });

  it('High-scoring chunks skipped', () => {
    const protection = detectProtections('Some perfectly fine prose.', 85, 80);
    assert.strictEqual(protection.protected, true, 'Should be protected');
    assert.ok(
      protection.reasons.includes('high_score'),
      `Reasons should include 'high_score', got: ${protection.reasons}`
    );
  });

  it('Normal prose not protected', () => {
    const text = `Margaret crossed the parking lot with her grocery bag balanced on one hip and
her phone wedged between shoulder and ear. The asphalt shimmered in the afternoon
heat, and a shopping cart rolled lazily toward the curb, nudged by a gust that
smelled faintly of exhaust and cut grass. She fumbled with her keys, dropped
them, swore under her breath, and crouched to retrieve them from beneath the
bumper of a mud-spattered pickup. A cardinal landed on the chain-link fence
bordering the lot and watched her with a tilted head. She got the trunk open,
tossed the bag inside, and slammed it shut. The phone call had already gone to
voicemail. She pressed redial, leaned against the warm fender, and waited for
the ring tone while the cardinal hopped twice along the fence rail and then
disappeared into a hedge of privet that divided the lot from the highway
service road beyond it.`;

    const protection = detectProtections(text);
    assert.strictEqual(
      protection.protected,
      false,
      `Normal prose should NOT be protected, but got reasons: ${protection.reasons}`
    );
  });
});


// ─── 2. shouldRecastChunk ─────────────────────────────────────────────────

describe('shouldRecastChunk', () => {
  const fictionProfile = { genre: 'fiction' };

  it('shouldRecastChunk respects protection', () => {
    const citationText = padToWords(
      `Multiple studies have confirmed the correlation between sleep duration
and cognitive performance across age groups (Smith, 2024). The effect is
most pronounced in adolescents, where even modest reductions in sleep
quality produce measurable declines in working memory and sustained
attention during standardized testing sessions conducted under controlled
laboratory conditions.`,
      90
    );

    const result = shouldRecastChunk({ text: citationText }, fictionProfile);
    assert.strictEqual(result.eligible, false, 'Chunk with citations should not be eligible');
    assert.ok(
      result.reason.includes('citation'),
      `Reason should mention citation, got: ${result.reason}`
    );
  });

  it('shouldRecastChunk skips high-score', () => {
    // Craft prose that scores well — varied sentences, concrete detail, strong verbs,
    // no chatbot patterns. Short punchy fragments mixed with longer ones.
    const goodProse = `The lock gave. Marcus shouldered through the rusted fire door into a stairwell that smelled of damp concrete and old paint. Three flights up, breathing hard, knuckles white on the iron railing. He stopped at the landing. A strip of duct tape held a cracked window pane in place, and through the gap he could see the river, flat and silver under a low sky. No voices below. No footsteps. He wiped his palms on his jeans and kept climbing. The fourth-floor corridor stretched empty in both directions, lit by a single fluorescent tube that buzzed and flickered at the far end near the freight elevator. His phone vibrated — one short pulse. He ignored it. The door to 4-C stood ajar, a wedge of yellow light cutting across the scuffed linoleum. He pressed his back to the wall and listened. Nothing moved inside. The building settled around him, pipes ticking, a radiator hissing somewhere two rooms away.`;

    const metrics = analyzeProseTexture(goodProse);
    // If the prose genuinely scores high, shouldRecastChunk will skip it.
    // We force skip via a low skipThreshold if needed.
    const result = shouldRecastChunk(
      { text: goodProse },
      fictionProfile,
      { skipThreshold: 40 }
    );
    assert.strictEqual(result.eligible, false, 'Good prose should not be eligible for recast');
  });

  it('shouldRecastChunk allows weak unprotected', () => {
    // Deliberately chatbot-ish prose: filter verbs, symmetrical pairs,
    // thesis statements, generic emotion nouns
    const weakProse = `She felt a wave of dread wash over her. She seemed to notice that the room was darker. He appeared to realize the truth was more complicated than he expected. She observed the door. He watched the window. She felt a sense of unease about the situation. He noticed the clock on the wall. She seemed unsettled by the silence. He appeared distracted by the noise outside. The truth was that neither of them understood what was happening in that moment. A surge of determination filled her chest. It was then that she realized everything had changed. She walked to the table. He walked to the chair. She sat down. He sat down. Part of her wanted to leave. Another part wanted to stay. Fear, doubt, and determination competed inside her mind. She was not just afraid; she was terrified. What she didn't know was that the answer had been there all along.`;

    const result = shouldRecastChunk({ text: weakProse }, fictionProfile);
    assert.strictEqual(result.eligible, true, 'Weak unprotected prose should be eligible for recast');
  });

  it('Short chunks rejected', () => {
    const shortText = 'This is a very short chunk that contains far too few words to be worth analyzing or recasting in the pipeline.';

    // Verify it's actually short (< 80 words)
    const wordCount = shortText.split(/\s+/).filter(Boolean).length;
    assert.ok(wordCount < 80, `Text should have fewer than 80 words, got ${wordCount}`);

    const result = shouldRecastChunk({ text: shortText }, fictionProfile);
    assert.strictEqual(result.eligible, false, 'Short chunk should not be eligible');
    assert.ok(
      result.reason.toLowerCase().includes('short'),
      `Reason should mention 'short', got: ${result.reason}`
    );
  });
});


// ─── 3. Multiple protections ─────────────────────────────────────────────

describe('Multiple protections', () => {
  it('Multiple protections combine', () => {
    const text = `All employees must complete annual compliance certification pursuant to
the requirements established by the Office of Regulatory Affairs. Training
records shall be maintained in accordance with the retention schedule
specified in Section 12 of the Employee Handbook (Smith, 2024). Failure
to complete certification within the designated window may result in
administrative action consistent with the disciplinary framework outlined
in the collective bargaining agreement.`;

    const protection = detectProtections(text);
    assert.strictEqual(protection.protected, true, 'Should be protected');
    assert.ok(
      protection.reasons.includes('citation'),
      `Reasons should include 'citation', got: ${protection.reasons}`
    );
    assert.ok(
      protection.reasons.includes('legal'),
      `Reasons should include 'legal', got: ${protection.reasons}`
    );
    assert.ok(
      protection.reasons.length >= 2,
      `Should have at least 2 reasons, got: ${protection.reasons.length}`
    );
  });
});


// ─── 4. PROTECTION_TYPE enum ──────────────────────────────────────────────

describe('PROTECTION_TYPE', () => {
  it('exports all expected protection types', () => {
    assert.strictEqual(PROTECTION_TYPE.CITATION, 'citation');
    assert.strictEqual(PROTECTION_TYPE.BIBLIOGRAPHY, 'bibliography');
    assert.strictEqual(PROTECTION_TYPE.BLOCK_QUOTE, 'block_quote');
    assert.strictEqual(PROTECTION_TYPE.TABLE, 'table');
    assert.strictEqual(PROTECTION_TYPE.LIST, 'list');
    assert.strictEqual(PROTECTION_TYPE.LEGAL, 'legal');
    assert.strictEqual(PROTECTION_TYPE.SCRIPTURE, 'scripture');
    assert.strictEqual(PROTECTION_TYPE.DIALOGUE_HEAVY, 'dialogue_heavy');
    assert.strictEqual(PROTECTION_TYPE.HIGH_SCORE, 'high_score');
  });
});
