/**
 * antiChatbotProse.js — Signature Voice / Anti-Chatbot Prose Quality Module
 *
 * Components:
 *   1. Genre-conditional voice blocks — FICTION_, THRILLER_, LITERARY_,
 *      NONFICTION_, TRAINING_, BUSINESS_, MEMOIR_, DEFAULT_ variants.
 *      Each profile targets its genre's actual failure modes.
 *
 *   2. getAntiChatbotRulesForProject(project) — resolver that picks the
 *      right voice block and polisher rules based on project metadata.
 *
 *   3. analyzeProseTexture() — post-generation prose quality analyzer.
 *      Deterministic text-in / score-out. Does NOT call an LLM.
 *
 *   4. countChatbotPatterns() — chatbot pattern counter for diagnostics.
 *
 * Design principle: UBS controls prose quality in-code, not in external
 * Modelfiles. If the user switches LLM providers, these rules travel
 * with the app.
 *
 * @module antiChatbotProse
 */

export const VERSION = 'ANTI-CHATBOT-PROSE v2.0 — GENRE-CONDITIONAL — 2026-06-09';

/* ═══════════════════════════════════════════════════════════════════════════
 * 1. SIGNATURE VOICE BLOCK — injected into every prose prompt
 *
 * This block replaces the empty HUMAN_PROSE_PRIORITY_BLOCK from craftCompact.
 * It contains concrete editorial directives — not vague advice.
 * ═════════════════════════════════════════════════════════════════════════ */

export const SIGNATURE_VOICE_BLOCK = `=== SIGNATURE VOICE / ANTI-CHATBOT PROSE RULES (MANDATORY) ===

SENTENCE RHYTHM:
- Vary sentence length aggressively. Never write three consecutive sentences of similar length (±5 words).
- Follow a long sentence with a short one. Follow two short sentences with a long, complex one.
- Use fragments deliberately: "Not anymore." "Gone." "The kind of silence that presses."
- If you catch yourself writing a balanced pair ("She X. He Y."), break the symmetry. One sentence should be at least twice the length of the other.
- Avoid the chatbot cadence: "Subject verbed. Subject verbed. Subject verbed." Interrupt that with a subordinate clause, a prepositional phrase, a dash, or an image.

CONCRETE SPECIFICITY:
- Replace every generic noun with a specific one. Not "the building" — "the brownstone" or "the converted fire station" or "the glass-and-steel tower on Eighth."
- Replace every generic emotion with a physical sensation. Not "she felt afraid" — "her jaw locked" or "sweat pooled in the hollow of her collarbone."
- Name the brand, the street, the song playing, the specific shade. "The smell of burned coffee" beats "a bad smell." "WKRN's morning traffic report" beats "the radio."
- Sensory details must be earned — each one should reveal character, mood, or tension. No decorative inventory.

VERB STRENGTH:
- Ban filter verbs in narration: felt, seemed, appeared, noticed, realized, observed, watched, heard, saw. Show the thing directly.
- "She felt the cold" → "Cold pressed through the denim." "He noticed the door was open" → "The door hung open."
- Every paragraph should contain at least one verb that only this specific scene could use. Not "walked" — "shouldered through" or "drifted" or "cut across the lobby."
- Active verbs before state verbs. "The lock gave" before "the door was open."

PARAGRAPH TURNS:
- Every paragraph must change the scene's pressure: introduce tension, release it, shift the power dynamic, reveal information, or force a decision.
- If a paragraph ends where it began emotionally, cut it or add a turn.
- No paragraph should merely describe a room, a face, or a feeling without advancing the scene's stakes.
- The last sentence of each paragraph should make the reader need the next paragraph.

SUBTEXT AND IMPLICATION:
- Characters should say less than they mean. What's unsaid matters more than what's said.
- Ban direct emotional declaration in dialogue: "I'm angry." "I'm scared." "I love you." Characters show these through action, avoidance, misdirection, or silence.
- If two characters are in conflict, let at least one exchange be about something trivial while the real tension lives underneath.
- Interior monologue should contradict or complicate surface behavior, not narrate it.

ANTI-CHATBOT CADENCE:
- Ban the "X, Y, and Z" triple construction when used for emotional weight. "Fear, doubt, and determination" is chatbot writing. Pick ONE and make it specific.
- Ban "not just X — but Y" / "wasn't just X; it was Y" constructions entirely. Recast as direct statement.
- Ban thesis sentences: "The truth was..." / "What she didn't know was..." / "In that moment, she understood..." Show the understanding through changed behavior.
- Ban lesson-statement endings: "And that was when she realized that..." / "It was the first time she understood..." End on image, action, or unresolved tension.
- Ban the balanced reflection: "Part of her wanted X. Another part wanted Y." Pick the dominant impulse. Let the other appear as a flinch, a hesitation, or a contradictory action.

SILENCE AND WHITE SPACE:
- Not every thought needs to be written. After a major revelation or emotional blow, let a line break or a physical action do the work.
- Resist the urge to explain what a moment means. The reader is smart. A character staring at a cracked mug after a fight is sufficient.
- Dialogue can end without a response. A character can choose not to answer. That silence is louder than any reply.

GENRE TEXTURE:
- The prose must feel like it belongs on a specific shelf. A thriller should have velocity and edge. A literary novel should have precision and resonance. A horror should have dread baked into the sentence structure itself.
- Match sentence length to genre: thrillers skew short; literary fiction allows complexity; romance needs emotional heat in the syntax.
- Genre vocabulary should appear naturally, not as decoration. A detective story uses procedural language because the character thinks in those terms.

=== END SIGNATURE VOICE RULES ===`;


/* ═══════════════════════════════════════════════════════════════════════════
 * 2. POLISHER ANTI-CHATBOT ADDENDUM
 *
 * Additional rules for the prose polisher system prompt.
 * ═════════════════════════════════════════════════════════════════════════ */

export const POLISHER_ANTI_CHATBOT_RULES = `
ANTI-CHATBOT POLISH PASS (CRITICAL):
- Break symmetrical sentence pairs. If two consecutive sentences have similar length and structure (Subject + Verb + Object), recast one.
- Replace filter verbs (felt, seemed, noticed, realized, observed) with direct sensation or action.
- Cut "not just X; it was Y" constructions. Recast as a single direct statement.
- Cut thesis sentences ("The truth was...", "What she didn't know was...", "In that moment she understood..."). Replace with image, action, or changed behavior.
- Cut lesson-statement chapter endings ("And that was when she realized..."). End on image, action, or unresolved tension instead.
- Cut "Part of her wanted X. Another part wanted Y." Pick the dominant impulse.
- Cut decorative triple constructions ("fear, doubt, and determination"). Pick ONE and make it physical.
- If a paragraph explains what a moment means, cut the explanation. Trust the scene.
- Strengthen weak verbs: "walked" → specific gait; "looked" → specific quality of gaze; "said" is fine but "exclaimed/declared/announced" is never fine.
- After these cuts, check that sentence rhythm is varied — no three consecutive sentences of similar length.`;


/* ═══════════════════════════════════════════════════════════════════════════
 * 2a. GENRE-CONDITIONAL VOICE BLOCKS
 *
 * Each genre gets rules that target its ACTUAL failure modes.
 * Fiction-biased rules (forced fragments, sensory overload) are kept out
 * of nonfiction. Nonfiction-biased rules (thesis clarity, source discipline)
 * are kept out of fiction.
 * ═════════════════════════════════════════════════════════════════════════ */

// ── FICTION: Alias for the existing SIGNATURE_VOICE_BLOCK ──
export const FICTION_SIGNATURE_VOICE_BLOCK = SIGNATURE_VOICE_BLOCK;

// ── THRILLER: Extends fiction with velocity and procedural precision ──
export const THRILLER_SIGNATURE_VOICE_BLOCK = `=== THRILLER VOICE RULES (MANDATORY) ===

SENTENCE RHYTHM:
- Vary sentence length aggressively. Never write three consecutive sentences of similar length.
- Follow a long sentence with a short one. Use fragments deliberately for impact: "Gone." "Too late."
- Default to SHORT. Thrillers skew short. Long sentences earn their length through embedded clauses that pile on pressure.
- Break symmetrical pairs — no "She X. He Y." unless the symmetry serves a specific dramatic counterpoint.

VELOCITY AND CLOCK PRESSURE:
- Every scene must feel like time is running out. Embed countdown cues: deadlines, distances closing, resources depleting.
- Cut all throat-clearing. No warm-up paragraphs. Open in motion.
- Procedural details earn their place by building tension, not by being interesting. If a detail doesn't tighten the noose, cut it.
- Shorter paragraphs than literary fiction. White space creates pace.

CONCRETE SPECIFICITY:
- Replace every generic noun with a specific one. Not "the building" — "the converted fire station on Eighth."
- Name equipment, calibers, software, street addresses, radio frequencies. Procedural precision = authority.
- Replace generic emotion with physical sensation. Not "he felt afraid" — "his jaw locked."

VERB STRENGTH:
- Ban filter verbs in narration: felt, seemed, appeared, noticed, realized, observed. Show the thing directly.
- Active verbs before state verbs. "The lock gave" before "the door was open."
- Every action verb should create a visual. Not "moved" — "shouldered through" or "cut across."

DIALOGUE:
- Characters in thrillers speak in short bursts under pressure. Long speeches break tension.
- Subtext through omission — what characters DON'T say reveals more than what they say.
- Ban emotional declarations: "I'm scared." Show it through trembling hands, broken speech, wrong decisions.

ANTI-CHATBOT CADENCE:
- Ban "not just X — but Y" constructions entirely.
- Ban thesis sentences: "The truth was..." / "What she didn't know was..."
- Ban lesson-statement endings. End on action, image, or escalation.
- Ban "Part of her wanted X. Another part wanted Y." Pick the dominant impulse.
- Ban decorative triple constructions. Pick ONE and make it physical.

=== END THRILLER VOICE RULES ===`;

// ── LITERARY: Allows complexity but demands precision ──
export const LITERARY_SIGNATURE_VOICE_BLOCK = `=== LITERARY FICTION VOICE RULES (MANDATORY) ===

SENTENCE RHYTHM:
- Vary sentence length aggressively. The rhythm itself carries meaning.
- Complex sentences are allowed — even encouraged — but every clause must earn its place.
- Fragments carry weight when surrounded by complexity. Use them for moments of emotional precision.
- If you catch yourself writing a balanced pair ("She X. He Y."), break the symmetry.

PRECISION AND IMAGE:
- Every sentence should survive scrutiny. No filler. No throat-clearing.
- Replace abstract emotion with concrete image. The right physical detail does the emotional work.
- Name the specific: the brand, the street, the song, the texture. "The smell of burned coffee" beats "a bad smell."
- Sensory details must be earned — each one should reveal character, mood, or tension. No decorative inventory.

VERB STRENGTH:
- Ban filter verbs: felt, seemed, appeared, noticed, realized, observed. Show the thing directly.
- Every paragraph should contain at least one verb that only this specific scene could use.
- Active verbs before state verbs.

PARAGRAPH TURNS:
- Every paragraph must shift something: tension, power, information, or emotional register.
- If a paragraph ends where it began emotionally, cut it or add a turn.
- The last sentence of each paragraph should compel the reader forward.

SUBTEXT AND IMPLICATION:
- Characters should say less than they mean. What's unsaid matters more.
- Interior monologue should contradict or complicate surface behavior, not narrate it.
- Let silence and physical action carry what dialogue cannot.

ANTI-CHATBOT CADENCE:
- Ban "not just X — but Y" constructions entirely.
- Ban thesis sentences. Show understanding through changed behavior.
- Ban lesson-statement endings. End on image, action, or unresolved tension.
- Ban balanced reflections. Pick the dominant impulse.
- Ban decorative triple constructions. Pick ONE.
- If a paragraph explains what a moment means, cut the explanation. Trust the reader.

=== END LITERARY FICTION VOICE RULES ===`;

// ── NONFICTION: Authority, clarity, evidence — NO fiction devices ──
export const NONFICTION_AUTHORITY_BLOCK = `=== NONFICTION AUTHORITY RULES (MANDATORY) ===

PARAGRAPH AUTHORITY:
- Open every paragraph with a concrete claim, a specific fact, or a named subject doing something. Not "There are many reasons why..." — state the reason.
- End every paragraph with the strongest sentence. The last line should either land the point, set up the next section, or deliver the data that makes the argument.
- Cut throat-clearing openings: "It is worth noting that," "It should be pointed out," "Interestingly," "In fact," "Indeed."

ACTIVE VOICE AND VERB STRENGTH:
- Prefer active voice. "The algorithm scored applicants" over "Applicants were scored by the algorithm."
- Ban filter verbs in analysis: seemed, appeared, felt. State the finding directly.
- Replace "It is important to note that X" with just "X."
- Replace "There is a need for" with the specific action needed.

CONCRETE EVIDENCE:
- Every claim should be supported by a specific example, number, date, name, or source.
- Replace vague quantifiers: "many" → specific count; "significant" → the actual percentage or p-value; "recently" → the date.
- When presenting data, lead with the number. "23 percentile points lower" before the explanation of why.
- Use specific variable names, function names, dollar amounts, dates, and locations. Precision creates authority.

THESIS CLARITY:
- State the thesis once, clearly, early. Do not restate it in different words every paragraph.
- Each section should advance the argument, not circle back to the same conclusion.
- Avoid the essay-bot structure: "First... Second... Third... In conclusion..." Use narrative momentum instead.

TRANSITION DISCIPLINE:
- Cut generic transitions: "Moreover," "Furthermore," "Additionally," "In addition," "As a result."
- Connect paragraphs through content, not connector words. The last sentence of paragraph N should make paragraph N+1 inevitable.
- If you need a transition word, you probably need a better paragraph ending instead.

NARRATIVE NONFICTION RHYTHM:
- Alternate between scene (showing a person doing a thing) and analysis (explaining what it means).
- Scene sections use concrete verbs, physical details, specific dialogue. Analysis sections use data, comparison, context.
- Do NOT blend scene and analysis in the same paragraph. The reader needs to know which mode they're in.

ANTI-CHATBOT CADENCE:
- Ban "not just X; it was Y" constructions. State what it IS.
- Ban generic moral summaries: "This raises important questions about..." "The implications are profound." State the specific implication.
- Ban decorative triple constructions ("equity, justice, and accountability"). Pick the one that matters and make the case for it.
- Ban balanced reflection: "On one hand... on the other hand..." Commit to the argument.
- Do NOT use forced literary fragments. Nonfiction sentences should be complete.
- Do NOT inject fictional sensory overload. Physical details serve the reporting, not atmosphere.
- Do NOT compress into noir or grit texture. Write with the clean authority of Michael Lewis or Charles Duhigg.

SOURCE DISCIPLINE:
- Preserve all citations, footnotes, endnotes, and source references exactly as written.
- Preserve all data: numbers, percentages, dates, dollar amounts. Never approximate.
- When quoting someone, preserve the quote exactly. Do not paraphrase attributed speech.

=== END NONFICTION AUTHORITY RULES ===`;

// ── TRAINING MANUAL: Ultra-conservative clarity ──
export const TRAINING_MANUAL_CLARITY_BLOCK = `=== TRAINING MANUAL CLARITY RULES (MANDATORY) ===

STRUCTURE PRESERVATION:
- Preserve all numbered steps, bulleted lists, and heading hierarchies exactly.
- Do NOT merge steps or reorder procedures.
- Do NOT convert lists to prose paragraphs.
- Do NOT add literary devices, metaphors, or narrative framing.

CLARITY AND IMPERATIVE MOOD:
- Write instructions in imperative mood: "Open the valve" not "The valve should be opened" or "You will need to open the valve."
- One instruction per sentence. Do not chain multiple actions with "and then."
- Lead with the action verb. "Click Save" not "In order to save your work, click the Save button."

ACTIVE VOICE:
- "The technician calibrates the sensor" not "The sensor is calibrated by the technician."
- "Press Enter" not "Enter should be pressed."

ANTI-CHATBOT CADENCE:
- Ban filler phrases: "It is important to," "Please note that," "Keep in mind that."
- Ban generic encouragement: "Great job!" "You're doing well!" "This is a crucial step."
- Ban essay-bot transitions: "Furthermore," "Moreover," "In addition."
- Write clean, direct, professional technical prose.

COMPLIANCE SAFETY:
- Preserve ALL regulatory language, legal terms, safety warnings, and compliance references.
- Preserve ALL acronyms, codes, and standard references.
- Do NOT rephrase safety warnings. They exist in specific legal language for a reason.

=== END TRAINING MANUAL CLARITY RULES ===`;

// ── BUSINESS GUIDE: Data authority, actionable language ──
export const BUSINESS_GUIDE_CLARITY_BLOCK = `=== BUSINESS GUIDE CLARITY RULES (MANDATORY) ===

AUTHORITY AND DATA:
- Lead with data, not opinion. "Revenue grew 23% in Q3" before the analysis.
- Replace vague business language: "leverage synergies" → state the specific operational change.
- Replace "best practices" with the specific practice and why it works.
- Every recommendation must be actionable: who does what, by when, measuring what.

STRUCTURE PRESERVATION:
- Preserve all lists, tables, frameworks, and diagrams.
- Do NOT convert structured content to prose.
- Preserve all case study attributions and data sources.

ACTIVE VOICE:
- "The team reduced costs by 15%" not "Costs were reduced by the team by 15%."
- Ban passive constructions in recommendations.

ANTI-CHATBOT CADENCE:
- Ban generic business clichés: "at the end of the day," "move the needle," "low-hanging fruit," "paradigm shift."
- Ban filler transitions: "Moreover," "Furthermore," "In conclusion."
- Ban generic moral summaries. State the specific business impact.
- Ban "not just X; it was Y." State what it is.

=== END BUSINESS GUIDE CLARITY RULES ===`;

// ── MEMOIR: Voice preservation with controlled filter verbs ──
export const MEMOIR_VOICE_BLOCK = `=== MEMOIR VOICE RULES (MANDATORY) ===

VOICE PRESERVATION:
- The author's voice is sacred. Do not impose a literary style. Do not add literary compression.
- Memoir voice is personal, conversational, and sometimes imperfect. That imperfection IS the voice.
- Do not replace the author's natural word choices with "stronger" synonyms. Their words are their words.

SENTENCE RHYTHM:
- Vary sentence length, but follow the author's natural cadence, not an imposed literary rhythm.
- Fragments are earned when they reflect how the author actually thinks. Do not add artificial fragments.

FILTER VERBS — CONTROLLED:
- In memoir, some filter verbs are earned. "I felt" is valid first-person experience. "I noticed" is valid observation.
- Reduce filter verbs only when they create monotony (3+ in one paragraph) or distance the reader from the experience.
- Replace unearned filter verbs with direct sensation, but preserve the author's authentic emotional vocabulary.

EMOTION AND MEMORY:
- Memoir earns its emotional moments through specificity: the exact date, the weather, the song playing, what someone was wearing.
- Do not add emotion the author didn't express. Do not amplify. Let the facts carry the weight.
- Memory can be uncertain. "I think it was a Tuesday" is valid memoir prose. Do not falsely sharpen uncertain memories.

ANTI-CHATBOT CADENCE:
- Ban "not just X; it was Y" constructions. Recast as direct statement.
- Ban thesis sentences: "The truth was..." "What I didn't know was..." Show the realization through narrative.
- Ban lesson-statement endings: "And that was when I realized..." End on the moment, not the lesson.
- Ban generic emotion nouns: "a wave of grief" → the specific physical experience.
- Do NOT inject fictional scene pressure. Memoir moves at the speed of memory, not plot.

SOURCE DISCIPLINE:
- Preserve all dates, names, places, and attributed quotes exactly as written.
- Do not invent details the author didn't include.

=== END MEMOIR VOICE RULES ===`;

// ── DEFAULT: Conservative anti-slop only — no genre texture ──
export const DEFAULT_ANTI_CHATBOT_BLOCK = `=== DEFAULT ANTI-CHATBOT RULES (CONSERVATIVE) ===

ACTIVE VOICE:
- Prefer active voice over passive voice.
- Replace "It was determined that" with a direct statement.

ANTI-CHATBOT CADENCE:
- Ban "not just X; it was Y" constructions. Recast as direct statement.
- Ban thesis sentences: "The truth was..." "What they didn't know was..."
- Ban lesson-statement endings: "And that was when they realized..."
- Ban decorative triple constructions ("X, Y, and Z" for emotional weight).
- Ban generic emotion nouns: "a wave of / surge of / sense of."
- Ban filler transitions: "Moreover," "Furthermore," "Additionally."

VERB STRENGTH:
- Reduce filter verbs: felt, seemed, appeared, noticed, realized, observed.
- Prefer concrete action verbs over state verbs.

PRESERVATION:
- Preserve all structure, citations, quotes, names, and data.
- Do not add content that doesn't exist in the source.
- Do not impose genre-specific texture.

=== END DEFAULT ANTI-CHATBOT RULES ===`;


/* ═══════════════════════════════════════════════════════════════════════════
 * 2b. GENRE-CONDITIONAL POLISHER RULES
 *
 * Variants of POLISHER_ANTI_CHATBOT_RULES for the prose polisher prompt.
 * ═════════════════════════════════════════════════════════════════════════ */

export const POLISHER_FICTION_RULES = POLISHER_ANTI_CHATBOT_RULES;

export const POLISHER_NONFICTION_RULES = `
ANTI-CHATBOT POLISH PASS — NONFICTION (CRITICAL):
- Break symmetrical sentence pairs when they create monotony.
- Replace filter verbs (seemed, appeared, felt) with direct statements. "It seemed that the data showed" → "The data showed."
- Cut "not just X; it was Y" constructions. State what it IS.
- Cut generic moral summaries: "This raises important questions about..." State the specific question.
- Cut essay-bot transitions: "Moreover," "Furthermore," "Additionally." Connect through content.
- Strengthen paragraph openings — lead with the strongest claim or the most specific fact.
- Strengthen paragraph endings — close with the point, not a trailing qualifier.
- Preserve ALL citations, data, numbers, and attributed quotes exactly.
- Do NOT add fragments, sensory overload, noir texture, or literary compression.
- Do NOT impose fictional scene pressure on analytical sections.
- After polish, verify sentence rhythm is varied — no three consecutive sentences of similar length.`;

export const POLISHER_TRAINING_RULES = `
ANTI-CHATBOT POLISH PASS — TRAINING MANUAL (MINIMAL):
- Fix grammar, punctuation, and spelling only.
- Preserve ALL numbered steps, bulleted lists, headings, and structural elements.
- Cut filler phrases: "It is important to note," "Please keep in mind."
- Ensure imperative mood for instructions: "Open the valve" not "The valve should be opened."
- Preserve ALL safety warnings, compliance language, and regulatory references.
- Do NOT recast sentences. Do NOT add literary devices. Do NOT restructure.`;

export const POLISHER_MEMOIR_RULES = `
ANTI-CHATBOT POLISH PASS — MEMOIR (VOICE-PRESERVING):
- Break symmetrical sentence pairs when they create monotony.
- Reduce filter verbs only when they create monotony (3+ in one paragraph). Some are earned in memoir.
- Cut "not just X; it was Y" constructions. Recast as direct statement.
- Cut thesis sentences. Show realization through narrative, not declaration.
- Cut lesson-statement endings. End on the moment, not the lesson.
- Cut generic emotion nouns: "a wave of grief" → the specific physical experience.
- Preserve the author's natural voice. Do NOT impose literary compression or genre texture.
- Preserve all dates, names, places, and attributed quotes.
- After polish, verify sentence rhythm is varied.`;


/* ═══════════════════════════════════════════════════════════════════════════
 * 2c. GENRE RESOLVER
 *
 * Picks the correct voice block and polisher rules based on project metadata.
 * ═════════════════════════════════════════════════════════════════════════ */

/**
 * Resolve genre-conditional anti-chatbot rules for a project.
 *
 * Resolution order:
 *   1. project.subgenre → check for thriller/literary match
 *   2. project.genre → check for fiction/nonfiction/memoir match
 *   3. project.book_type → check for nonfiction/training_manual/business_guide
 *   4. project.project_type → fallback
 *   5. Falls back to DEFAULT_ANTI_CHATBOT_BLOCK
 *
 * @param {Object} [projectOrProfile] — project object or { genre, book_type, subgenre, project_type }
 * @returns {{
 *   voiceBlock: string,
 *   polisherRules: string,
 *   profileKey: string,
 *   recastEligible: boolean,
 * }}
 */
export function getAntiChatbotRulesForProject(projectOrProfile) {
  const p = projectOrProfile || {};

  const genre = String(p.genre || '').toLowerCase();
  const subgenre = String(p.subgenre || '').toLowerCase();
  const bookType = String(p.book_type || '').toLowerCase();
  const projectType = String(p.project_type || p.type || '').toLowerCase();

  // ── Check subgenre first (most specific) ──
  if (subgenre.includes('thriller') || subgenre.includes('suspense') || subgenre.includes('action')) {
    return { voiceBlock: THRILLER_SIGNATURE_VOICE_BLOCK, polisherRules: POLISHER_FICTION_RULES, profileKey: 'thriller', recastEligible: true };
  }
  if (subgenre.includes('literary') || subgenre.includes('speculative') || subgenre.includes('upmarket')) {
    return { voiceBlock: LITERARY_SIGNATURE_VOICE_BLOCK, polisherRules: POLISHER_FICTION_RULES, profileKey: 'literary', recastEligible: true };
  }

  // ── Check genre ──
  if (genre.includes('memoir') || genre.includes('autobiography') || projectType.includes('memoir')) {
    return { voiceBlock: MEMOIR_VOICE_BLOCK, polisherRules: POLISHER_MEMOIR_RULES, profileKey: 'memoir', recastEligible: true };
  }
  if (genre.includes('thriller') || genre.includes('suspense')) {
    return { voiceBlock: THRILLER_SIGNATURE_VOICE_BLOCK, polisherRules: POLISHER_FICTION_RULES, profileKey: 'thriller', recastEligible: true };
  }
  if (genre.includes('literary') || genre.includes('speculative') || genre.includes('upmarket')) {
    return { voiceBlock: LITERARY_SIGNATURE_VOICE_BLOCK, polisherRules: POLISHER_FICTION_RULES, profileKey: 'literary', recastEligible: true };
  }

  // ── Check book_type / project_type for nonfiction variants ──
  if (genre === 'nonfiction' || bookType === 'nonfiction' || projectType === 'nonfiction' ||
      genre.includes('investigative') || genre.includes('journalism') ||
      genre.includes('history') || genre.includes('biography')) {
    return { voiceBlock: NONFICTION_AUTHORITY_BLOCK, polisherRules: POLISHER_NONFICTION_RULES, profileKey: 'nonfiction', recastEligible: true };
  }
  if (bookType.includes('training') || genre.includes('training') ||
      projectType.includes('training') || projectType.includes('manual') ||
      genre.includes('caregiving')) {
    return { voiceBlock: TRAINING_MANUAL_CLARITY_BLOCK, polisherRules: POLISHER_TRAINING_RULES, profileKey: 'training_manual', recastEligible: false };
  }
  if (bookType.includes('business') || genre.includes('business') ||
      projectType.includes('business') || projectType.includes('guide')) {
    return { voiceBlock: BUSINESS_GUIDE_CLARITY_BLOCK, polisherRules: POLISHER_NONFICTION_RULES, profileKey: 'business_guide', recastEligible: true };
  }

  // ── Fiction variants (genre-level) ──
  if (genre.includes('fiction') || genre.includes('fantasy') || genre.includes('romance') ||
      genre.includes('horror') || genre.includes('sci') || genre.includes('mystery') ||
      genre.includes('adventure') || bookType === 'fiction' || bookType === 'anthology' ||
      projectType === 'fiction' || projectType === 'anthology') {
    return { voiceBlock: FICTION_SIGNATURE_VOICE_BLOCK, polisherRules: POLISHER_FICTION_RULES, profileKey: 'fiction', recastEligible: true };
  }

  // ── Default: conservative ──
  return { voiceBlock: DEFAULT_ANTI_CHATBOT_BLOCK, polisherRules: POLISHER_NONFICTION_RULES, profileKey: 'default', recastEligible: false };
}


/* ═══════════════════════════════════════════════════════════════════════════
 * 3. PROSE TEXTURE ANALYZER
 *
 * Deterministic text analysis scoring prose on anti-chatbot metrics.
 * Returns a score object with individual metrics and a composite score.
 * ═════════════════════════════════════════════════════════════════════════ */

// ── Helpers ──

function splitSentences(text) {
  if (!text || typeof text !== 'string') return [];
  // Split on sentence-ending punctuation followed by space or newline
  // Handles abbreviations and dialogue reasonably
  return text
    .replace(/([.!?])\s*\n/g, '$1\n')
    .split(/(?<=[.!?])\s+(?=[A-Z"'"\u201C])/)
    .map(s => s.trim())
    .filter(s => s.length > 5);
}

function countWordsInStr(str) {
  return str.split(/\s+/).filter(Boolean).length;
}

function mean(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stddev(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const variance = arr.reduce((sum, v) => sum + (v - m) ** 2, 0) / arr.length;
  return Math.sqrt(variance);
}

// ── Pattern definitions ──

const FILTER_VERBS = /\b(felt|seemed|appeared|noticed|realized|observed|watched|heard|saw)\b/gi;
const TRIPLE_CONSTRUCTION = /\b\w+,\s+\w+,\s+and\s+\w+\b/gi;
const THESIS_STATEMENTS = /\b(the truth was|what (?:she|he|they|it) didn't know was|in that moment,? (?:she|he|they) (?:understood|realized|knew)|the realization (?:hit|struck|came|dawned)|it was (?:then|in that moment) that)\b/gi;
const LESSON_ENDINGS = /\b(and that was when|it was the first time|she had never understood until|for the first time,? (?:she|he|they) (?:understood|realized|knew))\b/gi;
const NOT_JUST_PATTERN = /\b(?:not just|wasn't just|didn't just|isn't just|wasn't merely|not merely|more than just)\b/gi;
const BALANCED_REFLECTION = /\bpart of (?:her|him|them) (?:wanted|wished|needed|longed)/gi;
const GENERIC_EMOTION_NOUNS = /\b(a sense of|a feeling of|a wave of|a surge of|a pang of|a rush of|a flicker of)\b/gi;

// Abstract emotion nouns used generically
const ABSTRACT_EMOTIONS = /\b(dread|ache|silence|darkness|weight|heaviness|emptiness|loneliness|sorrow|grief|despair|anguish|terror)\b/gi;

// Concrete sensory words
const CONCRETE_SENSORY = /\b(cracked|rusted|damp|cold|hot|sharp|rough|smooth|sticky|metallic|bitter|sour|sweet|acrid|musty|ozone|copper|iron|salt|sweat|blood|bone|skin|teeth|jaw|fist|knuckle|wrist|shoulder|rib|spine|throat|stomach|temple|heel|concrete|asphalt|brick|glass|steel|wood|leather|denim|cotton|wool|silk|gravel|mud|dust|smoke|steam|frost|ice|rain|wind)\b/gi;

/**
 * Analyze prose texture for anti-chatbot quality.
 *
 * @param {string} text — the prose to analyze
 * @returns {{
 *   sentenceLengthVariance: number,
 *   symmetryScore: number,
 *   filterVerbDensity: number,
 *   concreteRatio: number,
 *   openingVerbStrength: string,
 *   endingPunch: boolean,
 *   tripleConstructionDensity: number,
 *   thesisStatementDensity: number,
 *   notJustDensity: number,
 *   balancedReflectionCount: number,
 *   genericEmotionDensity: number,
 *   compositeScore: number,
 *   grade: string,
 *   diagnostics: string[],
 * }}
 */
export function analyzeProseTexture(text) {
  const safe = String(text || '').trim();
  if (!safe || safe.length < 100) {
    return {
      sentenceLengthVariance: 0, symmetryScore: 1, filterVerbDensity: 1,
      concreteRatio: 0, openingVerbStrength: 'none', endingPunch: false,
      tripleConstructionDensity: 0, thesisStatementDensity: 0,
      notJustDensity: 0, balancedReflectionCount: 0, genericEmotionDensity: 0,
      compositeScore: 0, grade: 'INSUFFICIENT_TEXT', diagnostics: ['Text too short to analyze'],
    };
  }

  const sentences = splitSentences(safe);
  const wordCount = countWordsInStr(safe);
  const diagnostics = [];

  // ── 1. Sentence Length Variance (target: σ ≥ 8) ──
  const sentLengths = sentences.map(s => countWordsInStr(s));
  const slVariance = stddev(sentLengths);
  const slScore = Math.min(1, slVariance / 12); // 12+ = perfect
  if (slVariance < 5) diagnostics.push(`LOW SENTENCE VARIANCE: σ=${slVariance.toFixed(1)} (target ≥8). Prose has monotonous rhythm.`);

  // ── 2. Symmetry Score (target: ≤ 30% similar-length pairs) ──
  let symmetricalPairs = 0;
  let totalPairs = 0;
  for (let i = 0; i < sentLengths.length - 1; i++) {
    totalPairs++;
    const ratio = Math.min(sentLengths[i], sentLengths[i + 1]) / Math.max(sentLengths[i], sentLengths[i + 1]);
    if (ratio > 0.8) symmetricalPairs++;
  }
  const symmetryPct = totalPairs > 0 ? symmetricalPairs / totalPairs : 0;
  const symScore = Math.max(0, 1 - (symmetryPct / 0.5)); // 50%+ symmetry = 0 score
  if (symmetryPct > 0.35) diagnostics.push(`HIGH SYMMETRY: ${Math.round(symmetryPct * 100)}% of sentence pairs are similar length. Break up the rhythm.`);

  // ── 3. Filter Verb Density (target: ≤ 5 per 1000 words) ──
  FILTER_VERBS.lastIndex = 0;
  const filterMatches = safe.match(FILTER_VERBS) || [];
  const filterDensity = wordCount > 0 ? (filterMatches.length / wordCount) * 1000 : 0;
  const filterScore = Math.max(0, 1 - (filterDensity / 15)); // 15/1K = 0 score
  if (filterDensity > 8) diagnostics.push(`HIGH FILTER VERB DENSITY: ${filterDensity.toFixed(1)}/1K words (${filterMatches.length} instances). Replace with direct sensation.`);

  // ── 4. Concrete vs. Abstract Ratio (target: ≥ 0.6) ──
  CONCRETE_SENSORY.lastIndex = 0;
  ABSTRACT_EMOTIONS.lastIndex = 0;
  const concreteMatches = (safe.match(CONCRETE_SENSORY) || []).length;
  const abstractMatches = (safe.match(ABSTRACT_EMOTIONS) || []).length;
  const totalSensory = concreteMatches + abstractMatches;
  const concreteRatio = totalSensory > 0 ? concreteMatches / totalSensory : 0.5;
  const concreteScore = Math.min(1, concreteRatio / 0.8); // 0.8+ = perfect
  if (concreteRatio < 0.4) diagnostics.push(`LOW CONCRETE RATIO: ${Math.round(concreteRatio * 100)}% concrete vs abstract. More physical detail, fewer abstract emotion nouns.`);

  // ── 5. Opening Verb Strength ──
  const firstSentence = sentences[0] || '';
  const STATE_VERBS = /\b(was|were|had|felt|seemed|appeared|existed|remained)\b/i;
  const hasStateVerb = STATE_VERBS.test(firstSentence.split(/[,;]/).shift() || '');
  const openingVerbStrength = hasStateVerb ? 'weak' : 'strong';
  const openingScore = hasStateVerb ? 0.3 : 1;
  if (hasStateVerb) diagnostics.push(`WEAK OPENING VERB: First sentence uses state verb. Open with action.`);

  // ── 6. Ending Punch ──
  const lastSentence = sentences[sentences.length - 1] || '';
  const lastSentLen = countWordsInStr(lastSentence);
  const avgSentLen = mean(sentLengths);
  const endingPunch = lastSentLen < avgSentLen * 0.8;
  const endingScore = endingPunch ? 1 : 0.4;
  if (!endingPunch) diagnostics.push(`SOFT ENDING: Last sentence (${lastSentLen} words) is not shorter than average (${avgSentLen.toFixed(0)}). End on a punch.`);

  // ── 7. Triple Construction Density (target: ≤ 3 per 1000 words) ──
  TRIPLE_CONSTRUCTION.lastIndex = 0;
  const tripleMatches = (safe.match(TRIPLE_CONSTRUCTION) || []).length;
  const tripleDensity = wordCount > 0 ? (tripleMatches / wordCount) * 1000 : 0;
  const tripleScore = Math.max(0, 1 - (tripleDensity / 8)); // 8/1K = 0 score
  if (tripleDensity > 4) diagnostics.push(`HIGH TRIPLE CONSTRUCTION DENSITY: ${tripleDensity.toFixed(1)}/1K words. Cut "X, Y, and Z" patterns.`);

  // ── 8. Thesis Statement Density (target: ≤ 1 per 1000 words) ──
  THESIS_STATEMENTS.lastIndex = 0;
  const thesisMatches = (safe.match(THESIS_STATEMENTS) || []).length;
  const thesisDensity = wordCount > 0 ? (thesisMatches / wordCount) * 1000 : 0;
  const thesisScore = Math.max(0, 1 - (thesisDensity / 4)); // 4/1K = 0 score
  if (thesisMatches > 0) diagnostics.push(`THESIS STATEMENTS FOUND: ${thesisMatches} instance(s). Replace with image or action.`);

  // ── 9. "Not Just" Density ──
  NOT_JUST_PATTERN.lastIndex = 0;
  const notJustMatches = (safe.match(NOT_JUST_PATTERN) || []).length;
  const notJustDensity = wordCount > 0 ? (notJustMatches / wordCount) * 1000 : 0;
  const notJustScore = Math.max(0, 1 - (notJustDensity / 4));
  if (notJustMatches > 1) diagnostics.push(`"NOT JUST" PATTERN: ${notJustMatches} instance(s). Recast as direct statement.`);

  // ── 10. Balanced Reflection Count ──
  BALANCED_REFLECTION.lastIndex = 0;
  const balancedMatches = (safe.match(BALANCED_REFLECTION) || []).length;
  const balancedScore = Math.max(0, 1 - (balancedMatches / 3));
  if (balancedMatches > 0) diagnostics.push(`BALANCED REFLECTION: ${balancedMatches} instance(s) of "part of her wanted..." — pick the dominant impulse.`);

  // ── 11. Generic Emotion Density ──
  GENERIC_EMOTION_NOUNS.lastIndex = 0;
  const genericMatches = (safe.match(GENERIC_EMOTION_NOUNS) || []).length;
  const genericDensity = wordCount > 0 ? (genericMatches / wordCount) * 1000 : 0;
  const genericScore = Math.max(0, 1 - (genericDensity / 6));
  if (genericMatches > 2) diagnostics.push(`GENERIC EMOTION NOUNS: ${genericMatches} instance(s) of "a wave of/surge of/sense of..." — replace with specific physical detail.`);

  // ── Composite Score (0-100) ──
  const weights = {
    sentenceVariance: 0.15,
    symmetry: 0.10,
    filterVerbs: 0.12,
    concrete: 0.10,
    opening: 0.08,
    ending: 0.08,
    triple: 0.08,
    thesis: 0.08,
    notJust: 0.07,
    balanced: 0.06,
    generic: 0.08,
  };

  const compositeScore = Math.round(
    (slScore * weights.sentenceVariance +
     symScore * weights.symmetry +
     filterScore * weights.filterVerbs +
     concreteScore * weights.concrete +
     openingScore * weights.opening +
     endingScore * weights.ending +
     tripleScore * weights.triple +
     thesisScore * weights.thesis +
     notJustScore * weights.notJust +
     balancedScore * weights.balanced +
     genericScore * weights.generic) * 100
  );

  // Grade bands
  let grade;
  if (compositeScore >= 85) grade = 'EXCELLENT';
  else if (compositeScore >= 70) grade = 'GOOD';
  else if (compositeScore >= 55) grade = 'COMPETENT';
  else if (compositeScore >= 40) grade = 'CHATBOT_ADJACENT';
  else grade = 'CHATBOT_SLOP';

  return {
    sentenceLengthVariance: Math.round(slVariance * 10) / 10,
    symmetryScore: Math.round(symmetryPct * 100),
    filterVerbDensity: Math.round(filterDensity * 10) / 10,
    concreteRatio: Math.round(concreteRatio * 100),
    openingVerbStrength,
    endingPunch,
    tripleConstructionDensity: Math.round(tripleDensity * 10) / 10,
    thesisStatementDensity: Math.round(thesisDensity * 10) / 10,
    notJustDensity: Math.round(notJustDensity * 10) / 10,
    balancedReflectionCount: balancedMatches,
    genericEmotionDensity: Math.round(genericDensity * 10) / 10,
    compositeScore,
    grade,
    diagnostics,
  };
}


/* ═══════════════════════════════════════════════════════════════════════════
 * 4. CHATBOT DETECTION PATTERNS
 *
 * Specific patterns that distinguish chatbot prose from human-authored prose.
 * Used for diagnostic reporting.
 * ═════════════════════════════════════════════════════════════════════════ */

export const CHATBOT_PATTERNS = [
  { key: 'symmetrical_pairs', label: 'Symmetrical sentence pairs', description: 'Two consecutive sentences of similar length and structure' },
  { key: 'filter_verbs', label: 'Filter verbs', description: 'felt, seemed, appeared, noticed, realized, observed' },
  { key: 'not_just', label: '"Not just" constructions', description: '"wasn\'t just X; it was Y" and variants' },
  { key: 'thesis_statements', label: 'Thesis statements', description: '"The truth was..." / "In that moment she understood..."' },
  { key: 'lesson_endings', label: 'Lesson-statement endings', description: '"And that was when she realized..."' },
  { key: 'balanced_reflection', label: 'Balanced reflection', description: '"Part of her wanted X. Another part wanted Y."' },
  { key: 'triple_construction', label: 'Triple constructions', description: '"fear, doubt, and determination"' },
  { key: 'generic_emotion', label: 'Generic emotion nouns', description: '"a wave of / surge of / sense of..."' },
  { key: 'abstract_emotion', label: 'Abstract emotion without body', description: 'dread/ache/silence without physical grounding' },
];

/**
 * Count specific chatbot patterns in text.
 * Returns a map of pattern key → count.
 *
 * @param {string} text
 * @returns {{ counts: Record<string, number>, total: number, density: number }}
 */
export function countChatbotPatterns(text) {
  const safe = String(text || '').trim();
  const wordCount = countWordsInStr(safe);
  if (!safe || wordCount < 20) return { counts: {}, total: 0, density: 0 };

  // Reset all regexes
  const regexes = {
    filter_verbs: FILTER_VERBS,
    not_just: NOT_JUST_PATTERN,
    thesis_statements: THESIS_STATEMENTS,
    lesson_endings: LESSON_ENDINGS,
    balanced_reflection: BALANCED_REFLECTION,
    triple_construction: TRIPLE_CONSTRUCTION,
    generic_emotion: GENERIC_EMOTION_NOUNS,
    abstract_emotion: ABSTRACT_EMOTIONS,
  };

  const counts = {};
  let total = 0;

  for (const [key, rx] of Object.entries(regexes)) {
    rx.lastIndex = 0;
    const matches = safe.match(rx) || [];
    counts[key] = matches.length;
    total += matches.length;
  }

  // Symmetrical pairs (needs sentence-level analysis)
  const sentences = splitSentences(safe);
  const sentLengths = sentences.map(s => countWordsInStr(s));
  let symPairs = 0;
  for (let i = 0; i < sentLengths.length - 1; i++) {
    const ratio = Math.min(sentLengths[i], sentLengths[i + 1]) / Math.max(sentLengths[i], sentLengths[i + 1]);
    if (ratio > 0.8) symPairs++;
  }
  counts.symmetrical_pairs = symPairs;
  total += symPairs;

  const density = wordCount > 0 ? Math.round((total / wordCount) * 1000 * 10) / 10 : 0;

  return { counts, total, density };
}

export default {
  // Original exports (backward compat)
  SIGNATURE_VOICE_BLOCK,
  POLISHER_ANTI_CHATBOT_RULES,
  analyzeProseTexture,
  countChatbotPatterns,
  CHATBOT_PATTERNS,
  VERSION,
  // Genre-conditional voice blocks
  FICTION_SIGNATURE_VOICE_BLOCK,
  THRILLER_SIGNATURE_VOICE_BLOCK,
  LITERARY_SIGNATURE_VOICE_BLOCK,
  NONFICTION_AUTHORITY_BLOCK,
  TRAINING_MANUAL_CLARITY_BLOCK,
  BUSINESS_GUIDE_CLARITY_BLOCK,
  MEMOIR_VOICE_BLOCK,
  DEFAULT_ANTI_CHATBOT_BLOCK,
  // Genre-conditional polisher rules
  POLISHER_FICTION_RULES,
  POLISHER_NONFICTION_RULES,
  POLISHER_TRAINING_RULES,
  POLISHER_MEMOIR_RULES,
  // Resolver
  getAntiChatbotRulesForProject,
};
