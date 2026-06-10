import { postClean } from '@/lib/postClean';

export const CRAFT_INJECTION = `
=== PROSE CRAFT RULES (MANDATORY) ===

RULE 1 — SHOW, DON'T TELL (at emotional peaks, ZERO telling)
If a scene SHOWS an emotion through action, gesture, dialogue, or silence — the narrator does NOT restate it.
WRONG: Her hands shook. She was afraid.
RIGHT: Her hands shook. She shoved them into her pockets.
Detection: After every emotional beat, if the next sentence names the emotion — cut it.

RULE 2 — SPECIFICITY OVER ABSTRACTION
Not "a bird" but "a jay." Not "flowers" but "lupine." Not "an old city" but "moss crusted the cracked stone steps leading to a gate whose iron had long since rusted to lace."
Concrete nouns and strong verbs. Adjective-noun clichés are banned: "ancient wisdom," "piercing gaze," "heavy silence," "palpable tension."

RULE 3 — SENTENCE RHYTHM VARIATION
Mix short sentences with long ones. Never three consecutive sentences of similar length. One-sentence paragraphs are powerful — use them for impact. A chapter with all 15-25 word sentences reads like AI. Vary deliberately.

RULE 4 — KILL AI TELLS ON SIGHT
These phrases NEVER appear in published fiction:
- "A sense of [emotion]"
- "Couldn't help but feel"
- "The weight of [abstract noun]"
- "The air was thick with [emotion/tension]"
- "Eyes widened" (as default surprise)
- "A wave of [emotion] washed over"
- "A pang of [emotion]"
- "Heart pounded in [his/her] chest"
- "[Raven/dark/golden] hair [spilled/cascaded/tumbled]"
- "Piercing [blue/green] eyes"
- "A knowing smile"
- "The world seemed to [slow/stop/shift]"
- "Something shifted in [his/her] expression"
- "A silence that spoke volumes"
- "[X] sent [Y] through [body part]"
- "Waves of pleasure/sensation/emotion/heat/relief/desire/pain"
- "Washed over him/her/them"
- "Threatened to overwhelm"
- "Couldn't help but [verb]"
- "In that moment"
- "The particular [X] of"
- "Something that looked/felt/sounded/seemed like"
- "A kind of [X] that"
- "What might have been"
- "Something shifted/loosened/cracked/tightened in her/his/their chest"
- "The weight/smell/sound/feel of everything/all of it/the moment"
If you catch yourself writing any of these, delete the sentence and write something specific to THIS character and THIS moment.

RULE 5 — NO OVER-EXPLAINING
If a character's hands shake, the reader knows they're afraid. Do NOT add a paragraph analyzing what the shaking means. Trust the image, the gesture, the silence.

RULE 6 — DIALOGUE MUST SOUND LIKE SPEECH
No character speaks in complete, polished sentences. Include: false starts, interruptions (—), trailing off (...), saying the wrong word, incomplete thoughts. A 14-year-old does not speak in epigrams. At least one imperfect line per scene.

RULE 7 — NO TRIADIC LISTING
Do not default to groups of three: "X. Y. Z." or "warm and clean and simple." Two is often stronger. Four breaks the pattern. Vary the count.

RULE 8 — PARAGRAPH LENGTH DIVERSITY
Do not write 5 consecutive paragraphs of 4-6 sentences each. Include 1-2 sentence paragraphs for impact. Include 6+ sentence paragraphs for building. The middle of a chapter should NOT flatten into uniform paragraph lengths.

RULE 9 — SUBTEXT IN DIALOGUE
Characters rarely say exactly what they mean. The real communication is beneath the words — in what's avoided, deflected, or implied. At least one exchange per scene should have subtext where the spoken words and the actual meaning diverge.

RULE 10 — EARNED METAPHOR
Metaphors come from the CHARACTER'S experience, not a thesaurus. A blacksmith thinks in terms of heat and metal. A sailor thinks in tides and knots. A programmer thinks in loops and conditionals. Generic metaphors ("a storm of emotion," "a river of time") are banned.

RULE 11 — THE STABILITY TRAP (MOST CRITICAL)
AI stories favor stability over change. This is fatal for fiction. Enforce:
- Characters MUST end truly different from how they began
- Let bad things stay bad. Not everything gets fixed.
- Allow irreversible decisions and irreversible loss
- Withhold information from the reader. Mystery is earned through restraint.
- Create genuine moral ambiguity. The "right" choice should be unclear.
- Vary emotional intensity: quiet scenes, explosive scenes, dread, relief, boredom, wonder. NOT a flat line.
- If a choice has no real cost, it is not a real choice.

RULE 12 — 70/30 SCENE-TO-SUMMARY
At least 70% of each chapter should be in-scene (moment by moment, with dialogue and action). Summary is for time compression only. "The morning passed" skips what could be a 200-word interaction that reveals character.

RULE 12B — EVERY PARAGRAPH ADVANCES (ZERO REDUNDANCY)
Every single paragraph must introduce NEW information — a new fact, a new sensory detail, a new action, a new line of dialogue, a new revelation. No paragraph may:
- Restate what a prior paragraph already established
- Summarize what was just shown in the previous scene
- Reset the scene's emotional register to repeat the same mood
- Re-quote or paraphrase a quote already used
- Contain editorial notes, instructions, or meta-commentary (e.g., "[Note: this scene continues...]" or "As established earlier...")
If a paragraph does not move the narrative forward by at least one concrete beat, DELETE IT. Structural resets ("Meanwhile, back at...") that merely restate context the reader already has are banned. The reader remembers what you wrote two paragraphs ago.

RULE 13 — UNIQUE CHAPTER ENDINGS
No two chapters end with the same structural move. Each ending belongs to THAT chapter specifically. Track what the previous chapter ended with and deliberately choose a different closing beat.

RULE 14 — ONE SURPRISE PER CHAPTER
Include one moment per chapter that deviates from the outline: a character saying the wrong thing, an emotion arriving before its trigger, a beat that interrupts another beat, a reaction the reader doesn't predict. Predictable emotional arcs are an AI tell.

RULE 15 — ROTATING CHAPTER OPENINGS (MANDATORY)
Chapter openings follow a strict 5-slot rotation based on chapter number. You MUST use the assigned opening type for this chapter:
- Slot 1 (Ch 1, 6, 11, 16, 21): MID-ACTION — character already physically DOING something. No setup, no waking up, no arriving. They are mid-task, mid-stride, mid-swing.
- Slot 2 (Ch 2, 7, 12, 17, 22): DIALOGUE — open mid-conversation. No attribution tag first. The first word is spoken dialogue, no “he said” until after the line.
- Slot 3 (Ch 3, 8, 13, 18, 23): SENSORY DETAIL — one sense, one sentence, visceral and specific. Not “the room smelled bad” but “Bleach and copper, sharp enough to taste.”
- Slot 4 (Ch 4, 9, 14, 19, 24): TIME/PLACE ANCHOR — concrete temporal and spatial grounding. E.g. “Tuesday, 3 AM. Lucas’s hands were bleeding.”
- Slot 5 (Ch 5, 10, 15, 20, 25): CONTRADICTING THOUGHT — character thinks or states X, and the opposite immediately happens or is revealed.
The slot is determined by: ((chapter_number - 1) % 5) + 1. No exceptions. No blending two types. Use the assigned one cleanly.

RULE 16 — ROTATING CHAPTER ENDINGS (MANDATORY)
Chapter endings follow a strict 5-slot rotation based on chapter number. You MUST use the assigned ending type:
- Slot 1 (Ch 1, 6, 11, 16, 21): REVELATION RECONTEXTUALIZES — new info lands, chapter ends. No reaction narration, no processing. The fact IS the ending.
- Slot 2 (Ch 2, 7, 12, 17, 22): CONCRETE SENSORY IMAGE — end on a literal physical detail the character perceives. Not a metaphor. An actual thing.
- Slot 3 (Ch 3, 8, 13, 18, 23): GUT-PUNCH DIALOGUE — a spoken line is the last thing. No narration after the quote. Words hang, chapter cuts.
- Slot 4 (Ch 4, 9, 14, 19, 24): QUIET MUNDANE CONTRAST — character does something trivially ordinary after intense events. The contrast IS the ending.
- Slot 5 (Ch 5, 10, 15, 20, 25): MID-ACTION CLIFFHANGER — interrupt an action mid-beat. Cut before resolution.
Slot = ((chapter_number - 1) % 5) + 1. No exceptions.

RULE 17 — ACTIVE PAST TENSE (MANDATORY)
Use simple past tense for narration, NOT progressive past. Progressive past ("was running," "was watching," "were walking") is the #1 AI prose fingerprint. Simple past is stronger, tighter, and what published authors use.
WRONG: She was running through the corridor. He was watching from the window. They were walking toward the dock.
RIGHT: She ran through the corridor. He watched from the window. They walked toward the dock.
Progressive is ONLY acceptable when emphasizing that an action was ongoing when interrupted:
ACCEPTABLE: She was running when the lights went out. (interrupted action)
NOT ACCEPTABLE: She was running. She was breathing hard. The floor was shaking. (three progressive in a row = AI)
If you write "was [verb]ing" or "were [verb]ing," STOP and convert to simple past unless the action is literally being interrupted mid-sentence. Target: fewer than 8 per chapter. More than 12 = rewrite.

RULE 18 — COMPLETE YOUR NOUN PHRASES (MANDATORY)
Every article ("a," "an," "the") MUST be followed by a noun or noun phrase. NEVER leave an adjective orphaned without its noun.
WRONG: "It was a cold, like a swallowed bolt." ("cold" is an adjective with no noun)
RIGHT: "It was a cold knot, like a swallowed bolt."
WRONG: "This was a raw, like a giant draining a tub."
RIGHT: "This was a raw ache, like a giant draining a tub."
WRONG: "She felt a sharp, like a needle."
RIGHT: "She felt a sharp sting, like a needle."
After writing "a [adjective]" or "the [adjective]," ALWAYS check: is there a noun? If the next word is a comma, period, or "like," you dropped the noun. Go back and insert it. This is not a style choice — it is a grammatical error.

RULE 19 — DIALOGUE QUOTE FORMATTING
When one character's dialogue ends and another character's dialogue begins, there MUST be a paragraph break or narrative beat between them. NEVER place a closing quote immediately next to an opening quote ("" or \u201d\u201c) without separation.
WRONG: "I don't believe it.""Neither do I."
RIGHT: "I don't believe it."
"Neither do I."
OR: "I don't believe it." She turned to face him. "Neither do I."

=== END PROSE CRAFT RULES ===`;

export const ANTI_SLOP_INJECTION = `
=== ANTI-SLOP VOCABULARY RULES (MANDATORY) ===

TIER 1 — KILL ON SIGHT (rewrite the sentence if any appear):
delve, utilize, leverage, facilitate, elucidate, embark, endeavor, encompass, multifaceted, tapestry, testament, paradigm, synergy, synergize, holistic, catalyze, catalyst, juxtapose, nuanced, realm, landscape, myriad, plethora

TIER 2 — SUSPICIOUS IN CLUSTERS (3+ in one paragraph = rewrite):
robust, comprehensive, seamless, seamlessly, cutting-edge, innovative, streamline, empower, foster, enhance, elevate, optimize, scalable, pivotal, intricate, profound, resonate, underscore, harness, navigate, cultivate, bolster, galvanize, cornerstone, game-changer

TIER 3 — FILLER PHRASES (delete every one, no exceptions):
"It's worth noting that..." / "It's important to note that..." / "Importantly, ..." / "Notably, ..." / "Interestingly, ..." / "Let's dive into..." / "Let's explore..." / "As we can see..." / "Furthermore, ..." / "Moreover, ..." / "Additionally, ..." / "In today's [fast-paced/digital/modern] world..." / "At the end of the day..." / "It goes without saying..." / "When it comes to..." / "One might argue that..." / "Not just X, but Y"

STRUCTURAL SLOP — AVOID:
- Every paragraph following the same template (topic sentence → elaboration → example → wrap-up)
- Lists where prose would be clearer
- Suspiciously balanced sections (3 pros, 3 cons)
- Hedge chains ("may potentially," "could possibly") — state things or don't
- Transition word addiction (not every paragraph starts with "However," "Furthermore," "Additionally")
- Em dash overload (max 2 per page)
- The "not just X, but Y" construction (the #1 LLM rhetorical crutch — kill it)

FREQUENCY-CAPPED WORDS (per chapter maximums — exceeding these is a rewrite trigger):
- "pulse/pulsed" — max 4
- "nervous system" — max 2
- "warmth" — max 3
- "deliberate" — max 3
- "liquid" — max 3
- "electricity/electric" — max 2
- "predatory" — max 2
- "surrender" — max 3
- "suddenly" — max 2
- "resonate" — max 2
- "a tapestry of" — max 0 (BANNED — never use)
- "careful/carefully" — max 3
- "as if" — max 4
- "something in" — max 3
- "something about" — max 2
- "the kind of" — max 3
- "particular" — max 3
- "somehow" — max 2
- "familiar" — max 3
- "ozone" — max 1
- "traitorous" — max 1
- "curdle/curdled" — max 1
- "live wire" — max 1
- "hollow" — max 1
- "hollow place" — max 0 (BANNED)
- "hollowness" — max 0 (BANNED)
- "empty" — max 1
- "emptiness" — max 1
- "unlovable" — max 1
- "core wound" — max 0 (BANNED)
- "old wound" — max 0 (BANNED)
- "insufficient" — max 1
- "incapable" — max 1
- "scraped raw" — max 0 (BANNED)
- "laid bare" — max 0 (BANNED)
- "smelled like failure" — max 0 (BANNED)
- "shattered" — max 1
- "broken" (emotional context) — max 1
- "numb/numbness" — max 1
- "void" — max 1
- "ache/aching" — max 2
- "fragile" — max 1
- "weight in/of chest" — max 1
- "clench in chest/gut" — max 1
- "coolness that burned" (or any oxymoronic sensation paradox) — max 1
- "circuit completing" metaphor — max 1
- "live wire" metaphor — max 1
- "something [adjective]" as vague placeholder — max 3
- "hum/thrum/vibration" — max 5 combined
- "pooled in/pooled low" — max 2
- "sent [jolt/shiver/chill/wave/surge/bolt] through/down/up" — max 0 (BANNED)
- "threatened to overwhelm/consume/drown/engulf" — max 0 (BANNED)
- "Contemporary accounts describe..." — max 1
- "The evidence/documents suggest/reveal..." — max 2
- "The psychological impact/toll..." — max 1
- "The pattern becomes clear..." — max 1
- "The financial implications..." — max 1
- "The most disturbing/troubling aspect..." — max 1
- "I discovered in the archives..." — max 1
- "The manila folder..." — max 1
- Dawn/morning light as scene ending — max 1
- "I make myself coffee..." — max 0 (BANNED)
- "You might assume..." — max 1
- "Consider the case of..." — max 1
- "This wasn't X — it was Y" rhetorical inversion — max 1
- "What they hadn't anticipated..." — max 1
- "The irony/paradox was..." — max 1
- "This represented..." — max 2
- "The [noun] proved particularly/especially..." — max 1
- "The system/machine/machinery that had created..." — max 2
Count these as you write. If you hit the cap, find a different word or construction.

BANNED CHARACTER NAMES (AI-favorite defaults — never use these):
Elara, Kaelen, Kael, Lyra, Arden, Sienna, Seraphina, Thorne, Astra, Zara, Rowan, Caelum, Isolde, Orion, Vesper, Elowen, Caspian, Liora, Alaric, Sable.
These names appear in 30%+ of AI-generated fiction. Using them is an instant AI detection flag. Invent original names that fit the specific world and culture of THIS story. If the project's character bible already has names, use ONLY those names.

=== END ANTI-SLOP RULES ===`;

export const NONFICTION_CRAFT_INJECTION = `
=== NONFICTION PROSE CRAFT (ADDITIONAL RULES) ===

RULE NF-1 — GROUNDED VIGNETTES, NOT FICTION
Open with concrete observational moments — NOT fictional dialogue scenes. A real person in a real place doing a real thing. Then pull back to analysis.

RULE NF-2 — SOURCES ARE AUTHORITY
Every major claim must be attributable. If you can't source it, hedge it explicitly: "accounts suggest" or "oral histories indicate." Never present speculation as fact.

RULE NF-3 — NO ARCHIVE NARRATOR
Do not open chapters with "I open the dusty folder..." or "The scent of old paper fills the room..." or any first-person research-narrator framing. Maximum 2 per entire book. Vary chapter openings.

RULE NF-4 — STRUCTURAL ROTATION
Not every chapter follows the same pattern. Rotate between:
- Chronological narrative
- Thematic analysis
- Case study deep-dive
- Comparative
- Investigation
At least 3 different structures must appear across 20 chapters.

RULE NF-5 — TRANSITION DIVERSITY
"Contemporary accounts describe..." appears ONCE per book maximum.
"Consider the case of..." appears ONCE per book maximum.
"You might assume..." appears ONCE per book maximum.
Each transition phrasing is single-use. After using it once, find a different way in.

RULE NF-6 — NO THESIS RESTATEMENT
The book's central argument should be stated clearly ONCE in the introduction. Individual chapters DEMONSTRATE it through evidence and narrative — they do not restate it. If three consecutive paragraphs make the same point in different words, cut two of them.

RULE NF-6B — NO PARAGRAPH REDUNDANCY (NONFICTION)
Every paragraph in a nonfiction chapter must contain at least one piece of information not present in any earlier paragraph. No restating evidence already cited. No re-summarizing an argument already made. No re-quoting a source already quoted. No editorial instructions or meta-notes embedded in prose. If removing a paragraph changes nothing about the reader's understanding, the paragraph should not exist.

RULE NF-7 — COMPOSITE CHARACTER NAMING
If using a composite character, never use a name that belongs to a real public figure or famous fictional character. State clearly that the person is a composite: "In this account, [name] represents a composite drawn from multiple sources."

=== END NONFICTION CRAFT RULES ===`;

export const HUMAN_PASS_INJECTION = `
=== HUMAN-PASS RULES (MANDATORY — AI DETECTION COUNTERMEASURES) ===

HPR-1 — SCENE-SETTING TROPE REUSE:
Do NOT open multiple scenes with the same device (e.g., "the ring of a telephone," "a knock at the door," "the screech of tires"). If you used a device in a prior scene, invent a completely different one. Track your scene openers — repetition is an AI tell.

HPR-2 — ADJECTIVE SYNDROME (max 1 use EACH per chapter):
The following words are AI-frequency giveaways. Use each at MOST once per chapter, and prefer a concrete noun instead:
shimmering, luminous, tapestry, intricate, meticulously, insatiable, palpable,
unmistakable, undeniable, relentless, sprawling, labyrinthine, opulent,
resplendent, ethereal, visceral, cacophony, crescendo, juxtaposition,
myriad, plethora, testament, harbinger, paradigm, dichotomy.
If you catch yourself reaching for these, STOP and use a SPECIFIC concrete noun or vivid verb instead.

HPR-3 — SENTENCE OPENER DIVERSITY (MANDATORY COUNT):
Do NOT start more than 2 sentences per paragraph with "The [Noun]..."
Vary with: prepositional phrases ("In the corridor..."), participial phrases ("Gripping the railing..."), adverbial ("Quietly, she..."), dialogue, or dependent clauses ("When the door opened...").
Before finalizing each paragraph, COUNT your sentence openers. If 3+ start with "The," rewrite at least one.

HPR-4 — PHILOSOPHICAL BOOKENDING (BANNED):
Do NOT end chapters with grand platitudes:
- "The truth was that..."
- "The final, unsettling truth is that..."
- "In the end, what mattered was..."
- "Perhaps the real lesson was..."
- "The past is never truly past."
End on a CONCRETE IMAGE, a line of dialogue, or a specific physical action. Chapter endings must be tangible, not reflective.

HPR-5 — SENSORY SPECIFICITY (USE REAL DETAILS):
Do NOT write "expensive perfume" — write "Shalimar" or "Chanel No. 5."
Do NOT write "a popular restaurant" — write "Chasen's" or "the Brown Derby."
Do NOT write "a luxury car" — write "a Packard sedan" or "a cream Duesenberg."
Period-specific brand names, street names, and place names signal authenticity.
When you genuinely don't know the specific name, use a vivid PHYSICAL DESCRIPTION instead of a generic category label. "A heavy glass bottle with a gold stopper" beats "expensive perfume" every time.

HPR-6 — COMPOSITE CHARACTER INTEGRATION:
Composite characters must feel MESSY and specific, not smooth narrative devices.
Give them contradictions, ugly habits, moments of pettiness. They should have details that feel too specific to be invented: a chipped front tooth, a habit of folding napkins into triangles, a particular way of mispronouncing "boulevard." The reader should believe these people exist.

HPR-7 — SHOW VS TELL IN NONFICTION NARRATIVE:
Do NOT write analytical topic sentences followed by evidence ("The studio system was built on control. For example..."). Instead, OPEN with the specific scene, quote, or incident, then let the analysis EMERGE from it. The reader should reach the conclusion before you state it.

HPR-8 — INTERIORITY CAP:
Internal monologue is limited to 2 consecutive sentences MAX before you must cut to action, dialogue, or a sensory detail. The third sentence of unbroken internal thought is an AI tell. Break it with a physical gesture, a sound, a smell, or someone speaking.

HPR-9 — DIALOGUE SUBTEXT (MANDATORY):
Every dialogue exchange longer than 2 lines MUST contain subtext — the characters are talking about one thing but meaning another. Direct, on-the-nose dialogue (where a character says exactly what they feel) is allowed at MOST once per chapter. If a character says "I'm angry because you lied to me," that is your one on-the-nose line for the entire chapter. Every other exchange must operate on two levels.

HPR-10 — SCENE/CHAPTER ENDING RULE:
The final paragraph of every scene or chapter MUST end on one of: a physical image, a line of dialogue, a concrete action, or a sensory detail.
It must NOT end on: an emotional summary, a stated realization, a thematic declaration, or a grand statement about life or truth.
WRONG: "She realized then that love was the only thing that mattered."
WRONG: "The silence told her everything she needed to know about the nature of grief."
RIGHT: "She left the key on the counter and pulled the door shut behind her."
RIGHT: "'Don't,' he said. The line went dead."

HPR-11 — CHAPTER OPENING RULE:
The first sentence of every chapter must drop the reader into mid-action, mid-sensation, or mid-dialogue. No throat-clearing, no scene-setting preamble.
The protagonist's name must NOT appear in the first 5 words.
WRONG: "Sarah woke up to the sound of rain."
RIGHT: "Rain hammered the fire escape outside the window she'd forgotten to close."

HPR-12 — CHARACTER ARC DIVERSITY:
Each chapter must reveal a NEW dimension of the protagonist — a new fear, desire, memory, or contradiction that has not yet appeared. Do NOT restate the same emotional wound using the same vocabulary across multiple chapters. If Chapter 3 explored "her fear of abandonment," Chapter 7 must not re-explore "her fear of abandonment" — it must show a DIFFERENT facet (e.g., her compulsive need to be needed, or her sabotage of intimacy). Track what has been revealed and advance.

HPR-13 — DIALOGUE MODE DIVERSITY:
Each major character must demonstrate at least 3 distinct conversational modes across the manuscript (e.g., playful, evasive, confrontational, tender, instructional, performative). If a character ONLY ever psychoanalyzes the protagonist, they are not a character — they are a narrative device. Give every speaking character at least one scene where they talk about something other than the protagonist's problems.

=== END HUMAN-PASS RULES ===`;

export function buildCraftInjection(bookType = 'fiction') {
  return [
    CRAFT_INJECTION,
    ANTI_SLOP_INJECTION,
    HUMAN_PASS_INJECTION,
    bookType === 'nonfiction' ? NONFICTION_CRAFT_INJECTION : null,
  ].filter(Boolean).join('\n\n');
}

const CHAPTER_OPENING_SLOTS = [
  { slot: 1, label: 'MID-ACTION', instruction: 'Open this chapter with the character already physically DOING something. No setup, no waking up, no arriving. They are mid-task, mid-stride, mid-swing. The first sentence is a physical action already in progress.' },
  { slot: 2, label: 'DIALOGUE', instruction: 'Open this chapter mid-conversation. The very first line must be spoken dialogue with NO attribution tag before it. No "he said" until after the opening line. Drop the reader into an exchange already underway.' },
  { slot: 3, label: 'SENSORY DETAIL', instruction: 'Open this chapter with a single visceral sensory detail in one sentence. One sense, hyper-specific. Not "the room smelled bad" — instead "Bleach and copper, sharp enough to taste." Then let the scene unfold from that anchor.' },
  { slot: 4, label: 'TIME/PLACE ANCHOR', instruction: 'Open this chapter with a concrete time and place stamp. E.g. "Tuesday, 3 AM. Lucas\'s hands were bleeding." Give the reader an immediate temporal and spatial foothold, then launch into action.' },
  { slot: 5, label: 'CONTRADICTING THOUGHT', instruction: 'Open this chapter with the character thinking or stating something confidently — then immediately contradict it with what actually happens. The irony should land in the first 2-3 sentences.' },
];

// Nonfiction-specific opening rotation. The fiction slots above produce a
// "sensory trigger → memory" loop when applied to memoir/investigative prose,
// which is a hallmark AI-detection red flag. These slots give nonfiction its
// own variety bank: concrete case, named person, hard fact, contrarian
// question, reconstructed scene. Rotate the SAME way (chapter_number % 5).
const NF_CHAPTER_OPENING_SLOTS = [
  { slot: 1, label: 'NAMED PERSON, SPECIFIC MOMENT', instruction: 'Open this chapter with a specific named person doing a specific action at a specific moment in time. E.g. "On March 14, 1934, Patricia Douglas bought a ticket at the Beverly Theatre." No thesis, no abstraction, no setup. A human being, in a place, doing something concrete. The pattern and argument will emerge from this person\'s story.' },
  { slot: 2, label: 'HARD FACT / STATISTIC', instruction: 'Open this chapter with a single concrete, verifiable fact or figure that forces the reader to reckon with reality before any framing. E.g. "In 1937, MGM spent more on its lawn than on its script department." One sentence. Then let the number stand alone as its own paragraph before any analysis begins. NEVER open with "In a world where..." or any tone-setting sensory metaphor.' },
  { slot: 3, label: 'CONTRARIAN QUESTION', instruction: 'Open this chapter with a question that overturns conventional wisdom on the topic — phrased to sound wrong at first. E.g. "What if the studio system\'s most dangerous product was not its films, but its obituaries?" One question. Do not answer it in the opening paragraph. The chapter is the answer.' },
  { slot: 4, label: 'SCENE RECONSTRUCTION', instruction: 'Open this chapter by reconstructing a documented scene from primary sources — treat the reader as though they are watching archival footage. E.g. "The deposition transcript runs 847 pages. On page 312, Mayer paused for a full minute before answering." Cite the source by type (transcript, letter, police report) so the reader knows this is verified. Never invent.' },
  { slot: 5, label: 'CONCRETE PHYSICAL OBJECT', instruction: 'Open this chapter with a physical object — a document, a photograph, a piece of equipment, a location that still exists — and use the object as the entry point to the argument. E.g. "The 1933 studio bulletin is four pages long and fits in a manila folder in the Margaret Herrick Library." Ground the reader in a thing they could in principle go and see. Then extract meaning from it.' },
];

export function getChapterOpeningInstruction(chapterNumber, bookType = 'fiction') {
  const slotIndex = ((chapterNumber - 1) % 5);
  const slots = bookType === 'nonfiction' ? NF_CHAPTER_OPENING_SLOTS : CHAPTER_OPENING_SLOTS;
  const slot = slots[slotIndex];
  return `\n=== CHAPTER OPENING TYPE: ${slot.label} (MANDATORY for Ch ${chapterNumber}) ===\n${slot.instruction}\n=== END CHAPTER OPENING ===`;
}

const CHAPTER_ENDING_SLOTS = [
  { slot: 1, label: 'REVELATION RECONTEXTUALIZES', instruction: 'End this chapter with a piece of new information that recontextualizes everything the reader just experienced. The revelation lands — then the chapter ENDS. No reaction narration, no character processing, no "she realized." The new fact IS the ending. Let the reader do the emotional work.' },
  { slot: 2, label: 'CONCRETE SENSORY IMAGE', instruction: 'End this chapter on a single concrete sensory image — something the character literally sees, hears, touches, smells, or tastes. Not a metaphor, not a feeling. An actual physical thing in the world. The image carries the emotional weight without naming it.' },
  { slot: 3, label: 'GUT-PUNCH DIALOGUE', instruction: 'End this chapter with a line of dialogue. The spoken quote is the LAST thing — no narration after it, no attribution after it, no description of facial expressions. The words hang in the air and the chapter cuts. Format: "[dialogue]." End of chapter.' },
  { slot: 4, label: 'QUIET MUNDANE CONTRAST', instruction: 'End this chapter with the character performing a small, mundane, ordinary action after whatever harrowing or intense event just occurred. Making coffee, folding a shirt, locking a door, washing hands. The contrast between the weight of what happened and the triviality of the action IS the ending.' },
  { slot: 5, label: 'MID-ACTION CLIFFHANGER', instruction: 'End this chapter by interrupting an action mid-beat. The character reaches for something, a door opens, a phone rings, a gun fires — and the chapter CUTS before resolution. Mid-sentence is allowed. The reader must turn the page to find out what happens.' },
];

export function getChapterEndingInstruction(chapterNumber) {
  const slotIndex = ((chapterNumber - 1) % 5);
  const slot = CHAPTER_ENDING_SLOTS[slotIndex];
  return `\n=== CHAPTER ENDING TYPE: ${slot.label} (MANDATORY for Ch ${chapterNumber}) ===\n${slot.instruction}\n=== END CHAPTER ENDING ===`;
}

export function mechanicalSlopScore(text = '') {
  const words = text.toLowerCase().split(/\s+/);
  const totalWords = words.length;
  let penalty = 0;
  const details = [];

  const TIER1 = ['delve','utilize','leverage','facilitate','elucidate','embark','endeavor','encompass','multifaceted','tapestry','testament','paradigm','synergy','synergize','holistic','catalyze','catalyst','juxtapose','nuanced','realm','landscape','myriad','plethora','shimmering','luminous','insatiable','palpable','unmistakable','undeniable','relentless','sprawling','labyrinthine','opulent','resplendent','ethereal','visceral','cacophony','crescendo','juxtaposition','harbinger','dichotomy'];
  TIER1.forEach((word) => {
    const count = words.filter((w) => w.replace(/[^a-z]/g, '') === word).length;
    if (count > 0) {
      penalty += count * 2;
      details.push(`TIER1: "${word}" ×${count} (-${count * 2})`);
    }
  });

  const TIER2 = ['robust','comprehensive','seamless','seamlessly','cutting-edge','innovative','streamline','empower','foster','enhance','elevate','optimize','scalable','pivotal','intricate','profound','resonate','underscore','harness','navigate','cultivate','bolster','galvanize','cornerstone','game-changer'];
  const paragraphs = text.split(/\n\n+/);
  paragraphs.forEach((para, index) => {
    const paraWords = para.toLowerCase().split(/\s+/);
    let paraT2Count = 0;
    TIER2.forEach((word) => {
      const count = paraWords.filter((w) => w.replace(/[^a-z-]/g, '') === word).length;
      paraT2Count += count;
    });
    if (paraT2Count >= 3) {
      penalty += paraT2Count;
      details.push(`TIER2: paragraph ${index + 1} has ${paraT2Count} suspicious words (-${paraT2Count})`);
    }
  });

  const TIER3 = [
    /it'?s worth noting that/gi, /it'?s important to note that/gi,
    /^importantly,?\s/gim, /^notably,?\s/gim, /^interestingly,?\s/gim,
    /let'?s dive into/gi, /let'?s explore/gi, /as we can see/gi,
    /^furthermore,?\s/gim, /^moreover,?\s/gim, /^additionally,?\s/gim,
    /in today'?s .*(fast-paced|digital|modern)/gi,
    /at the end of the day/gi, /it goes without saying/gi,
    /when it comes to/gi, /one might argue that/gi,
    /not just .+, but/gi,
  ];
  TIER3.forEach((rx) => {
    const matches = text.match(rx);
    if (matches) {
      penalty += matches.length * 0.5;
      details.push(`TIER3: "${rx.source.slice(0, 30)}..." ×${matches.length} (-${matches.length * 0.5})`);
    }
  });

  const AI_TELLS = [
    /a sense of \w+/gi, /couldn'?t help but feel/gi,
    /the weight of (?:the |his |her )?\w+/gi,
    /the air was thick with/gi, /eyes widened/gi,
    /a wave of \w+ washed over/gi, /a pang of \w+/gi,
    /heart pounded in (?:his|her|their) chest/gi,
    /(?:raven|dark|golden) hair (?:spilled|cascaded|tumbled)/gi,
    /piercing (?:blue|green|gray) eyes/gi, /a knowing smile/gi,
    /the world seemed to (?:slow|stop|shift)/gi,
    /something shifted in (?:his|her|their) expression/gi,
    /a silence that spoke volumes/gi,
    // HPR-4: Philosophical bookending
    /the truth was that/gi, /the final,? unsettling truth/gi,
    /in the end,? what mattered was/gi, /perhaps the real lesson was/gi,
    /the past is never truly past/gi,
    // New AI-tell patterns
    /sent \w+ through (?:his|her|their|the) \w+/gi,
    /waves? of (?:pleasure|sensation|emotion|feeling|heat|relief|desire|pain)/gi,
    /washed over (?:him|her|them|his|her|their)/gi,
    /threatened to overwhelm/gi,
    /couldn'?t help but \w+/gi,
    /in that moment/gi,
    /the particular \w+ of/gi,
    /something that (?:looked|felt|sounded|seemed) like/gi,
    /a kind of \w+ that/gi,
    /what might have been/gi,
    /something (?:shifted|loosened|cracked|tightened|moved|settled|expanded) in (?:his|her|their) chest/gi,
    /the (?:weight|smell|sound|feel) of (?:everything|all of it|the moment)/gi,
  ];
  AI_TELLS.forEach((rx) => {
    const matches = text.match(rx);
    if (matches) {
      penalty += matches.length;
      details.push(`AI_TELL: "${rx.source.slice(0, 30)}..." ×${matches.length} (-${matches.length})`);
    }
  });

  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 5);
  const lengths = sentences.map((s) => s.trim().split(/\s+/).length);
  if (lengths.length > 5) {
    const average = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const variance = lengths.reduce((sum, length) => sum + Math.pow(length - average, 2), 0) / lengths.length;
    if (variance < 15) {
      penalty += 3;
      details.push(`UNIFORMITY: sentence length variance=${variance.toFixed(1)} (too uniform, -3)`);
    }
  }

  const paraLengths = paragraphs.map((p) => p.trim().split(/\s+/).length).filter((length) => length > 5);
  if (paraLengths.length > 4) {
    const paraAverage = paraLengths.reduce((a, b) => a + b, 0) / paraLengths.length;
    const paraVariance = paraLengths.reduce((sum, length) => sum + Math.pow(length - paraAverage, 2), 0) / paraLengths.length;
    if (paraVariance < 100) {
      penalty += 2;
      details.push(`PARA_UNIFORMITY: paragraph length variance=${paraVariance.toFixed(1)} (too uniform, -2)`);
    }
  }

  const emDashes = (text.match(/—|--/g) || []).length;
  const pages = Math.max(1, totalWords / 250);
  if (emDashes / pages > 3) {
    penalty += 1;
    details.push(`EM_DASH: ${emDashes} em dashes in ${pages.toFixed(1)} pages (${(emDashes / pages).toFixed(1)}/page, -1)`);
  }

  const triads = (text.match(/\w+[.,] \w+[.,] and \w+/gi) || []).length;
  if (triads > 3) {
    penalty += 1;
    details.push(`TRIADS: ${triads} triadic lists (-1)`);
  }

  // Paragraph redundancy detection: flag consecutive paragraphs with high n-gram overlap
  if (paragraphs.length > 2) {
    const getNgrams = (txt, n = 3) => {
      const ws = txt.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/).filter(w => w.length > 2);
      const grams = new Set();
      for (let i = 0; i <= ws.length - n; i++) grams.add(ws.slice(i, i + n).join(' '));
      return grams;
    };
    let redundantPairs = 0;
    for (let i = 1; i < paragraphs.length; i++) {
      if (paragraphs[i].trim().length < 30 || paragraphs[i - 1].trim().length < 30) continue;
      const prev = getNgrams(paragraphs[i - 1]);
      const curr = getNgrams(paragraphs[i]);
      if (prev.size === 0 || curr.size === 0) continue;
      let overlap = 0;
      curr.forEach(g => { if (prev.has(g)) overlap++; });
      const ratio = overlap / Math.min(prev.size, curr.size);
      if (ratio > 0.35) redundantPairs++;
    }
    if (redundantPairs > 0) {
      penalty += redundantPairs * 1.5;
      details.push(`REDUNDANCY: ${redundantPairs} consecutive paragraph pair(s) with >35% n-gram overlap (-${redundantPairs * 1.5})`);
    }
  }

  // Detect editorial notes / meta-instructions in prose
  const editorialNotes = (text.match(/\[(?:Note|TODO|TK|FIXME|Editor|INSERT|PLACEHOLDER)[^\]]*\]/gi) || []).length;
  if (editorialNotes > 0) {
    penalty += editorialNotes * 2;
    details.push(`EDITORIAL_NOTES: ${editorialNotes} bracketed note(s) in prose (-${editorialNotes * 2})`);
  }

  // Detect "as established/mentioned earlier" restatement markers
  const restatementMarkers = (text.match(/\b(?:as (?:established|mentioned|noted|discussed|described) (?:earlier|above|before|previously))/gi) || []).length;
  if (restatementMarkers > 0) {
    penalty += restatementMarkers * 1;
    details.push(`RESTATEMENT: ${restatementMarkers} "as mentioned earlier" marker(s) (-${restatementMarkers})`);
  }

  const notJustBut = (text.match(/not just .+?, but/gi) || []).length;
  if (notJustBut > 0) {
    penalty += notJustBut * 1.5;
    details.push(`NOT_JUST_BUT: ${notJustBut} instances (-${notJustBut * 1.5})`);
  }

  // Frequency-capped words
  const FREQ_CAPS = [
    { rx: /\bpulsed?\b/gi, max: 4, label: 'pulse/pulsed' },
    { rx: /\bnervous system\b/gi, max: 2, label: 'nervous system' },
    { rx: /\bwarmth\b/gi, max: 3, label: 'warmth' },
    { rx: /\bdeliberate\b/gi, max: 3, label: 'deliberate' },
    { rx: /\bliquid\b/gi, max: 3, label: 'liquid' },
    { rx: /\belectric(?:ity)?\b/gi, max: 2, label: 'electricity/electric' },
    { rx: /\bpredatory\b/gi, max: 2, label: 'predatory' },
    { rx: /\bsurrender\b/gi, max: 3, label: 'surrender' },
    { rx: /\bsuddenly\b/gi, max: 2, label: 'suddenly' },
    { rx: /\bresonate[ds]?\b/gi, max: 2, label: 'resonate' },
    { rx: /\ba tapestry of\b/gi, max: 0, label: 'a tapestry of (BANNED)' },
    { rx: /\bcareful(?:ly)?\b/gi, max: 3, label: 'careful(ly)' },
    { rx: /\bas if\b/gi, max: 4, label: 'as if' },
    { rx: /\bsomething in\b/gi, max: 3, label: 'something in' },
    { rx: /\bsomething about\b/gi, max: 2, label: 'something about' },
    { rx: /\bthe kind of\b/gi, max: 3, label: 'the kind of' },
    { rx: /\bparticular\b/gi, max: 3, label: 'particular' },
    { rx: /\bsomehow\b/gi, max: 2, label: 'somehow' },
    { rx: /\bfamiliar\b/gi, max: 3, label: 'familiar' },
    { rx: /\bozone\b/gi, max: 1, label: 'ozone' },
    { rx: /\btraitorous\b/gi, max: 1, label: 'traitorous' },
    { rx: /\bcurdled?\b/gi, max: 1, label: 'curdle/curdled' },
    { rx: /\blive wire\b/gi, max: 1, label: 'live wire' },
    { rx: /\bhollow place\b/gi, max: 0, label: 'hollow place (BANNED)' },
    { rx: /\bhollowness\b/gi, max: 0, label: 'hollowness (BANNED)' },
    { rx: /\bhollow\b/gi, max: 1, label: 'hollow' },
    { rx: /\bemptiness\b/gi, max: 1, label: 'emptiness' },
    { rx: /\bempty\b/gi, max: 1, label: 'empty' },
    { rx: /\bunlovable\b/gi, max: 1, label: 'unlovable' },
    { rx: /\bcore wound\b/gi, max: 0, label: 'core wound (BANNED)' },
    { rx: /\bold wound\b/gi, max: 0, label: 'old wound (BANNED)' },
    { rx: /\binsufficient\b/gi, max: 1, label: 'insufficient' },
    { rx: /\bincapable\b/gi, max: 1, label: 'incapable' },
    { rx: /\bscraped raw\b/gi, max: 0, label: 'scraped raw (BANNED)' },
    { rx: /\blaid bare\b/gi, max: 0, label: 'laid bare (BANNED)' },
    { rx: /\bsmelled like failure\b/gi, max: 0, label: 'smelled like failure (BANNED)' },
    { rx: /\bshattered\b/gi, max: 1, label: 'shattered' },
    { rx: /\bbroken\b/gi, max: 1, label: 'broken' },
    { rx: /\bnumb(?:ness)?\b/gi, max: 1, label: 'numb/numbness' },
    { rx: /\bvoid\b/gi, max: 1, label: 'void' },
    { rx: /\bach(?:e|ing)\b/gi, max: 2, label: 'ache/aching' },
    { rx: /\bfragile\b/gi, max: 1, label: 'fragile' },
    { rx: /\bweight (?:in|of) (?:his |her |their )?chest\b/gi, max: 1, label: 'weight in/of chest' },
    { rx: /\bclench (?:in|of) (?:his |her |their )?(?:chest|gut)\b/gi, max: 1, label: 'clench in chest/gut' },
    { rx: /\bcoolness that burned\b/gi, max: 1, label: 'coolness that burned' },
    { rx: /\bcircuit completing\b/gi, max: 1, label: 'circuit completing' },
    { rx: /\bsomething (?:warm|cold|dark|bright|sharp|soft|hot|sweet|bitter|raw|dangerous|familiar|unnamed|unspoken)\b/gi, max: 3, label: 'something [adj] vague' },
    { rx: /\b(?:hum|hummed|humming|thrum|thrummed|thrumming|vibration|vibrations)\b/gi, max: 5, label: 'hum/thrum/vibration' },
    { rx: /\bpooled (?:in|low)\b/gi, max: 2, label: 'pooled in/low' },
    { rx: /\bsent (?:a )?(?:jolt|shiver|chill|wave|surge|bolt) (?:through|down|up)\b/gi, max: 0, label: 'sent [jolt/shiver etc] through (BANNED)' },
    { rx: /\bthreatened to (?:overwhelm|consume|drown|engulf)\b/gi, max: 0, label: 'threatened to overwhelm/consume/drown/engulf (BANNED)' },
    { rx: /\bcontemporary accounts describe\b/gi, max: 1, label: 'contemporary accounts describe' },
    { rx: /\bthe (?:evidence|documents) (?:suggest|reveal)\b/gi, max: 2, label: 'the evidence/documents suggest/reveal' },
    { rx: /\bthe psychological (?:impact|toll)\b/gi, max: 1, label: 'the psychological impact/toll' },
    { rx: /\bthe pattern becomes clear\b/gi, max: 1, label: 'the pattern becomes clear' },
    { rx: /\bthe financial implications\b/gi, max: 1, label: 'the financial implications' },
    { rx: /\bthe most (?:disturbing|troubling) aspect\b/gi, max: 1, label: 'the most disturbing/troubling aspect' },
    { rx: /\bi discovered in the archives\b/gi, max: 1, label: 'I discovered in the archives' },
    { rx: /\bthe manila folder\b/gi, max: 1, label: 'the manila folder' },
    { rx: /\bi make myself coffee\b/gi, max: 0, label: 'I make myself coffee (BANNED)' },
    { rx: /\byou might assume\b/gi, max: 1, label: 'you might assume' },
    { rx: /\bconsider the case of\b/gi, max: 1, label: 'consider the case of' },
    { rx: /\bthis wasn'?t .{1,30}— ?it was\b/gi, max: 1, label: 'this wasn\'t X — it was Y inversion' },
    { rx: /\bwhat they hadn'?t anticipated\b/gi, max: 1, label: 'what they hadn\'t anticipated' },
    { rx: /\bthe (?:irony|paradox) was\b/gi, max: 1, label: 'the irony/paradox was' },
    { rx: /\bthis represented\b/gi, max: 2, label: 'this represented' },
    { rx: /\bthe \w+ proved (?:particularly|especially)\b/gi, max: 1, label: 'the [noun] proved particularly/especially' },
    { rx: /\bthe (?:system|machine|machinery) that had created\b/gi, max: 2, label: 'the system/machine/machinery that had created' },
  ];
  FREQ_CAPS.forEach(({ rx, max, label }) => {
    const matches = text.match(rx);
    const count = matches ? matches.length : 0;
    if (count > max) {
      const over = count - max;
      penalty += over * 0.5;
      details.push(`FREQ_CAP: "${label}" ×${count} (max ${max}, ${over} over, -${over * 0.5})`);
    }
  });

  const score = Math.max(0, Math.min(10, 10 - penalty));

  return {
    score: Number(score.toFixed(1)),
    penalty: Number(penalty.toFixed(1)),
    details,
    totalWords,
    pass: score >= 7,
  };
}

/**
 * Strip markdown formatting artifacts and run the full post-generation cleaning pipeline.
 * The model doesn't get a vote — these are mechanical regex passes.
 */
export function cleanGeneratedProse(text = '', { maxWordRepeat = 6, targetWords = 0, spec = null } = {}) {
  const result = postClean(text, { targetWords, maxWordRepeat, spec });
  return {
    text: result.text,
    overusedWords: result.overusedWords,
    frequencyWarnings: result.frequencyWarnings || [],
    hadMarkdown: text !== result.text,
    removals: result.removals,
  };
}