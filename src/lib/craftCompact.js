/**
 * craftCompact.js — PHASE 3 MIGRATION (PARTIAL RE-ACTIVATION)
 *
 * Most universal prose rules were moved to agent system prompts
 * (baked into llama.cpp Modelfile-derived GGUFs).
 *
 * HUMAN_PROSE_PRIORITY_BLOCK has been RE-ACTIVATED with the Signature Voice
 * rules from antiChatbotProse.js. This ensures anti-chatbot prose quality
 * is enforced in-code, portable across any LLM provider.
 *
 * Other constants remain empty to preserve the Phase 3 context savings.
 * Comedy rules and beat styles remain here (genre-specific, not universal).
 */

import { SIGNATURE_VOICE_BLOCK, getAntiChatbotRulesForProject } from '@/lib/antiChatbotProse';

// ── HUMAN_PROSE_PRIORITY_BLOCK: Re-activated with Signature Voice rules ──
// Backward compat: constant export uses fiction rules as the default.

export const HUMAN_PROSE_PRIORITY_BLOCK = SIGNATURE_VOICE_BLOCK;

// ── Project-aware resolver: returns genre-conditional voice block ──
export { getAntiChatbotRulesForProject };

// ── Universal rules: remain in agent system prompts ──

export const COMPACT_CRAFT_RULES = `
=== SCENE CRAFT RULES ===
0. AUTHOR VOICE GOVERNS: These rules SERVE the selected AUTHOR VOICE / persona dossier. Where any craft rule below conflicts with the AUTHOR VOICE's TONE, PROSE MECHANICS, ENDING RULE, or ANTI-TROPES, the AUTHOR VOICE wins.
1. Show, don't tell. Replace "She felt angry" with action: "She slammed the folder on the desk."
2. Dialogue must reveal character or advance plot. Cut small talk unless it's subtext.
3. One POV per scene. No head-hopping.
4. Vary sentence length. Follow a long sentence with a short one. Monotonous rhythm = AI detection.
5. Sensory details: at least 2 senses per scene (not just visual).
6. Avoid filter verbs: "She saw", "He felt", "She noticed", "He realized". Go direct.
7. End each chapter on the beat the selected AUTHOR VOICE and BEAT STYLE call for — tension, revelation, or decision for thrillers and suspense; warmth, hope, or earned calm for romance, faith, cozy, and feel-good genres. Match the ending to the book's promise, not a single default.
8. Beats > tags. "She crossed her arms" > "she said angrily."
9. Specificity over generality. "A 1987 Ford Ranger" > "an old truck."
10. Cut adverbs from dialogue tags. "Quietly" "angrily" "softly" — the dialogue should do this work.
11. No consecutive paragraphs starting with the same word.
12. Subtext in every conversation: what characters DON'T say matters more.
=== END SCENE CRAFT ===`;
export const COMPACT_ANTI_SLOP = '';
export const ANTI_DETECTION_PROSE_RULES = '';
export const ANTI_DETECTION_PROSE_RULES_NF = '';
export const NONFICTION_HARD_RULES = '';
export const NONFICTION_NARRATIVE_CRAFT = `=== NONFICTION NARRATIVE CRAFT ===
0. AUTHOR VOICE GOVERNS: These rules SERVE the selected AUTHOR VOICE dossier. Where any beat-mode or craft instruction conflicts with the AUTHOR VOICE, the AUTHOR VOICE wins. Apply that voice's PROSE MECHANICS, SENSORY FOCUS, and ANTI-TROPES to every paragraph of this section.
1. SCENE, NOT SUMMARY: Render events through a specific person in a specific place at a specific moment, built only from the supplied record. Do not narrate from nowhere. Put the reader in the room before you explain anything.
2. DOCUMENTS ARE OBJECTS, NOT ENTRIES: Introduce a letter, dispatch, ledger, order, or report as a physical thing someone writes, reads, signs, files, hides, or destroys — never as a catalogue line such as "The [archive] holds [document], which shows...". Show the document doing work in the world.
3. VARY EVERY ENTRANCE: Never introduce two consecutive sources, paragraphs, or sections with the same construction. If the previous paragraph opened by naming an institution or a record, this one must NOT. Rotate openings among: a person, an action, a date, a place, a consequence, a concrete sensory detail.
4. LET FACTS CARRY WEIGHT: Significance is shown, never announced. Delete editorializing tags such as "this would become one of the most important...", "in a turning point...", "what happened next would change everything." State the documented detail and stop; trust the reader to feel its weight.
5. NO VAGUE-AUTHORITY FILLER: Do not use "the evidence suggests," "the record indicates," "historians believe," "it is likely," or "sources say" as connective tissue. Name the specific source, or state the uncertainty in plain words ("no surviving record explains why").
6. CONCRETE OVER ABSTRACT: Prefer a dated, named, physical particular to a thematic abstraction. Replace figures like "the silence of the record" with the actual gap in the actual named document.
7. SENTENCE AND PARAGRAPH VARIETY: Vary sentence length and shape. Do NOT run the antithesis tic ("not just X but Y") or stacked anaphora ("They do not speak of... They do not speak of...") as a default rhythm. Use such devices at most once per section, and only where genuinely earned.
8. EVIDENCE DISCIPLINE: Build only on supplied research. Never invent a name, quote, date, or event to make a scene land. A missing fact is written around in neutral wording, never fabricated.
=== END NONFICTION NARRATIVE CRAFT ===`;


// ── Comedy rules: kept here (genre-specific, not universal) ──

export const COMEDY_CRAFT_RULES = `=== COMEDY WRITING RULES ===
1. SETUP-PUNCHLINE DISCIPLINE: Every joke needs a setup. Don't rush to the funny part. The longer the reader waits (without realizing they're waiting), the harder the punchline lands.
2. COMEDY IS SPECIFIC: "He tripped" isn't funny. "He tripped over the same crack in the sidewalk that he'd complained about in seven consecutive HOA meetings" is funny. Specificity creates humor.
3. THE RULE OF THREE: Two normal things, third thing unexpected. Use this for lists, examples, and escalation. Don't overuse it — once per scene maximum.
4. NEVER SIGNAL THE JOKE: Do not write "he joked" or "she said sarcastically" or "he quipped." If the line is funny, the reader knows. If it's not funny, tagging it won't help.
5. STRAIGHT MAN IS ESSENTIAL: Not every character can be funny. One character must react to the absurdity with genuine frustration, confusion, or horror. They're the reader's proxy.
6. COMIC TIMING IS PARAGRAPH BREAKS: A punchline at the end of a long paragraph gets buried. A punchline on its own line hits. Use white space as timing.
7. NEVER PUNCH DOWN: Humor at the expense of the powerless isn't comedy, it's cruelty. Punch up or punch sideways.
8. EARNED EMOTION HITS HARDER: The moment of genuine feeling in a comedy is more powerful than the same moment in a drama — because the reader's guard is down. Don't waste it.
9. SCENE COMPRESSION: Setup, punch, ADVANCE. Once a joke lands, move the story forward. Do NOT extend a bit with 3-4 additional riffs on the same gag.
10. JOKE EVOLUTION: If you use the same humor TYPE twice in a chapter, the second instance MUST escalate or subvert the pattern.
11. EVERY SCENE MUST ADVANCE PLOT: A funny scene that doesn't move the story forward is a sketch, not a chapter.
12. THE REAL STAKES LAYER: Underneath the comedy, something must actually matter.
=== END COMEDY RULES ===`;

export const COMEDY_BEAT_STYLES = {
  'Screwball Comedy': `BEAT STYLE: SCREWBALL COMEDY — Rapid-fire wit, escalating chaos, romantic tension through conflict.
Sentence Rhythm: Fast. Short punchy lines. Dialogue-heavy. Minimal description between exchanges.
Comedy Rules: Humor comes from CHARACTER, not jokes. Every funny moment must reveal something about who the character is.
Pacing: Open with a simple problem. Complicate it every 2-3 paragraphs. Every attempt to fix it makes it worse.
Emotional Handling: Underneath the comedy is genuine vulnerability. One moment of raw honesty per chapter — brief, then deflected with humor.
Dialogue: Overlapping. Characters talk past each other. Banter is competitive. Interruptions are frequent.
Scene Structure: 1) Manageable situation 2) First complication 3) Attempted fix backfires 4) Cascading escalation 5) Moment of truth buried in chaos.
Ending Rule: Close on a line that's both funny and emotionally true.`,

  'Dry Wit / Deadpan': `BEAT STYLE: DRY WIT / DEADPAN — Understated humor. The comedy is in what ISN'T said.
Sentence Rhythm: Measured. Clean. Short declarative sentences with devastating final clauses.
Comedy Rules: The funnier the situation, the more neutral the tone. Characters do not acknowledge absurdity.
Pacing: Slow build. The setup is 80% of the joke. Rush nothing.
Emotional Handling: Emotions exist but are never named. A devastated character says "That's unfortunate" and changes the subject.
Dialogue: Clipped. Precise. Characters say less than they mean. Subtext does all the work.
Scene Structure: 1) Mundane situation with excessive precision 2) Something slightly off 3) Escalation treated as unremarkable 4) One perfectly timed observation 5) Quiet aftermath.
Ending Rule: Close with a factual observation that is accidentally devastating.`,

  'Dark Comedy': `BEAT STYLE: DARK COMEDY — Finding humor in the terrible. Laughing because the alternative is screaming.
Sentence Rhythm: Clinical detachment followed by raw absurdity. Long analytical sentences about terrible things.
Comedy Rules: Nothing is sacred, but nothing is cheap. Humor must come from truth, not shock.
Pacing: Set up the horror straight. Play it real. Let the absurdity emerge organically. Tonal whiplash is the tool.
Emotional Handling: Real pain. Real grief. Comedy doesn't replace the emotion — it coexists with it.
Dialogue: Characters say appalling things casually. Professional language applied to inhuman situations.
Scene Structure: 1) Real stakes and danger 2) Characters respond with inappropriate normality 3) Gap widens 4) Genuine emotional impact 5) Punchline that reframes everything.
Ending Rule: Close on a line that is simultaneously the funniest and most disturbing thing in the chapter.`,

  'Absurdist / Surreal Comedy': `BEAT STYLE: ABSURDIST / SURREAL COMEDY — Reality is broken and nobody filed a report.
Sentence Rhythm: Starts normal, goes sideways mid-sentence. Matter-of-fact descriptions of impossible things.
Comedy Rules: The world is insane but the characters are trying their best. Bureaucracy applied to chaos.
Pacing: Start grounded. Introduce one wrong thing. Let it compound.
Emotional Handling: Somehow genuine. The absurdity makes the human moments MORE affecting.
Dialogue: People have normal conversations about abnormal things. Technical jargon applied to feelings.
Scene Structure: 1) Normal situation with one wrong detail 2) Characters address it normally 3) The wrong detail multiplies 4) Full absurdist escalation 5) Resolution that solves nothing.
Ending Rule: Close with a sentence that is logically perfect and completely insane.`,

  'Romantic Comedy': `BEAT STYLE: ROMANTIC COMEDY — Two people who should be together but can't get out of their own way.
Sentence Rhythm: Warm and quick. Internal monologue is self-deprecating and overanalytical.
Comedy Rules: Humor comes from recognition. Embarrassment is the primary fuel. The protagonist ALWAYS makes things worse by trying to be cool.
Pacing: Alternate between bringing the couple closer and pulling them apart.
Emotional Handling: Real feelings underneath the comedy. The moment the protagonist admits vulnerability should ache.
Dialogue: Banter that's actually flirting. Characters argue about things that don't matter because the thing that matters is too scary.
Scene Structure: 1) Characters forced into proximity 2) Tension through banter 3) Almost-moment of connection 4) Self-sabotage or interruption 5) Both pretend they don't care.
Ending Rule: Close with one character alone, replaying the interaction and realizing they're screwed.`,

  'Comic Caper / Heist Comedy': `BEAT STYLE: COMIC CAPER / HEIST COMEDY — A plan that should not work, executed by people who should not be trusted.
Sentence Rhythm: Procedural setup with casual asides.
Comedy Rules: The plan is always good on paper. Execution reveals character flaws. Every team member is the wrong person for their job.
Pacing: Explain the plan. Begin the plan. Something goes wrong immediately. Improvise.
Emotional Handling: Found family dynamics. Loyalty is never stated, only demonstrated through action.
Dialogue: Each character has a distinct verbal tic. Cross-talk. Plans explained with increasing frustration.
Scene Structure: 1) Plan laid out 2) Step one goes wrong 3) Improvisation creates new problems 4) Cascading chaos 5) Accidental success or spectacular failure.
Ending Rule: Close with someone saying "next time will be different" and nobody believing them.`,
};

export function isComedyBeatStyle(beatStyle) {
  if (!beatStyle) return false;
  return Object.keys(COMEDY_BEAT_STYLES).some(key =>
    beatStyle.toLowerCase().includes(key.toLowerCase()) ||
    key.toLowerCase().includes(beatStyle.toLowerCase())
  );
}

export function getComedyBeatInstruction(beatStyle) {
  if (!beatStyle) return '';
  for (const [key, value] of Object.entries(COMEDY_BEAT_STYLES)) {
    if (beatStyle.toLowerCase().includes(key.toLowerCase()) || key.toLowerCase().includes(beatStyle.toLowerCase())) {
      return value;
    }
  }
  return '';
}
