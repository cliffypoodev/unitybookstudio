/**
 * enforcementBlock.js — Mandatory output rules injected into every generation call.
 *
 * These rules enforce scene-first openings, banned vocabulary, pronoun consistency,
 * name-frequency caps, and output purity across all agents.
 */

export const MANDATORY_ENFORCEMENT_BLOCK = `
=== MANDATORY OUTPUT RULES ===
1. SCENE-FIRST DIRECTIVE: Open every chapter/section mid-action or mid-thought. NO throat-clearing, NO "The morning sun...", NO weather openers, NO reflective preambles. First sentence = character doing/saying/deciding something.
2. BANNED VOCABULARY (tier-1, never use): shimmering, luminous, tapestry, intricate, meticulously, insatiable, palpable, unmistakable, undeniable, relentless, sprawling, labyrinthine, opulent, resplendent, ethereal, visceral, cacophony, crescendo, juxtaposition, myriad, plethora, testament, harbinger, paradigm, dichotomy, multifaceted, aforementioned, nonetheless, furthermore, henceforth, commence, utilize, endeavor, pertaining.
3. PRONOUN CORRUPTION GUARD: If the POV character uses they/them pronouns, NEVER switch to he/she mid-scene. If the POV uses she/her, NEVER switch to they/them. Check every pronoun reference before output.
4. NAME FREQUENCY CAP: A character's full name appears at most twice per chapter. After that, use pronouns, role titles, or physical descriptors.
5. OUTPUT PURITY: Output ONLY the scene/chapter text. No meta-commentary, no "Here is the chapter", no markdown headers, no explanatory notes before or after the prose.
=== END MANDATORY RULES ===`;