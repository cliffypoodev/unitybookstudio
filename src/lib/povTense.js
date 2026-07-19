export function suggestPovTense(bookType, genre) {
  const g = (genre || '').toLowerCase();

  if (bookType === 'nonfiction') {
    if (/memoir/.test(g)) {
      return {
        pov: 'nf-author',
        tense: 'past',
        preset: 'memoir',
        reason: 'Memoir is almost always author voice past tense — personal reflection on lived experience.',
      };
    }
    if (/self-help|business|education|health|cooking|caregiving|parenting|personal finance/.test(g)) {
      return {
        pov: 'nf-direct',
        tense: 'present',
        preset: 'selfhelp',
        reason: 'Instructional nonfiction addresses the reader directly in present tense.',
      };
    }
    if (/biography/.test(g)) {
      return {
        pov: 'nf-third',
        tense: 'past',
        preset: 'biography',
        reason: 'Biography uses third-person narrative past tense for authority and scope.',
      };
    }
    if (/true.crime|investigat/.test(g)) {
      return {
        pov: 'nf-editorial',
        tense: 'mixed',
        preset: 'truecrime',
        reason: 'Investigative nonfiction uses editorial mix — present for analysis, past for reconstructed events.',
      };
    }
    if (/history|political/.test(g)) {
      return {
        pov: 'nf-third',
        tense: 'past',
        preset: 'biography',
        reason: 'Historical nonfiction uses third-person narrative past tense for authority and scope.',
      };
    }

    return {
      pov: 'nf-editorial',
      tense: 'mixed',
      preset: 'narrative',
      reason: 'Narrative nonfiction typically uses editorial mix for authority with reader engagement.',
    };
  }

  if (/erotica|romance|dark.romance|paranormal.romance/.test(g)) {
    return {
      pov: 'third-close',
      tense: 'past',
      preset: 'intimate',
      reason: 'Romance/erotica needs deep character interiority. Third-close past is the genre standard.',
    };
  }
  if (/thriller|mystery|crime|suspense/.test(g)) {
    return {
      pov: 'third-close',
      tense: 'past',
      preset: 'intimate',
      reason: 'Thriller/mystery benefits from close POV to control information reveal.',
    };
  }
  if (/young adult|ya/.test(g)) {
    return {
      pov: 'first',
      tense: 'present',
      preset: 'urgent',
      reason: 'YA commonly uses first-person present for immediacy and teen voice.',
    };
  }
  if (/literary/.test(g)) {
    return {
      pov: 'third-close',
      tense: 'past',
      preset: 'intimate',
      reason: 'Literary fiction favors close third for interiority with narrative distance.',
    };
  }
  if (/fantasy|science fiction|dystopian/.test(g)) {
    return {
      pov: 'third-multi',
      tense: 'past',
      preset: 'epic',
      reason: 'Epic/speculative fiction often uses multiple POVs to show world scope.',
    };
  }
  if (/industrial.horror/.test(g)) {
    return {
      pov: 'third-close',
      tense: 'present',
      preset: 'horror',
      reason: 'Industrial horror demands present-tense claustrophobia and single POV physical vulnerability.',
    };
  }
  if (/horror/.test(g)) {
    return {
      pov: 'third-close',
      tense: 'present',
      preset: 'horror',
      reason: 'Horror benefits from present tense immediacy and single POV vulnerability.',
    };
  }
  if (/dystopian.techno|bureaucratic.noir/.test(g)) {
    return {
      pov: 'third-close',
      tense: 'past',
      preset: 'intimate',
      reason: 'Bureaucratic noir uses close third-past for methodical, detective-like observation of systemic horror.',
    };
  }
  if (/clean.romance|women.*fiction|faith.*fiction/.test(g)) {
    return {
      pov: 'third-close',
      tense: 'past',
      preset: 'intimate',
      reason: 'Clean romance and inspirational fiction use close third-past for emotional warmth and character depth.',
    };
  }
  if (/historical/.test(g)) {
    return {
      pov: 'third-omni',
      tense: 'past',
      preset: 'cinematic',
      reason: 'Historical fiction uses omniscient past for period authority and scope.',
    };
  }

  return {
    pov: 'third-close',
    tense: 'past',
    preset: 'intimate',
    reason: 'Third-person close past tense is the most versatile default for fiction.',
  };
}

export const SCENE_POV_RULES = {
  first: "All scenes are from the narrator's direct POV. The narrator cannot know what other characters think or feel unless told. Never break this constraint.",
  'third-close': "Each scene stays inside ONE character's perspective. Mark whose head we're in at the scene start. They cannot know what others think unless shown through behavior.",
  'third-multi': 'Each scene has a designated POV character. Mark POV shifts with scene breaks (***). Never head-hop within a scene. Specify which character owns each scene in the breakdown.',
  'third-omni': "The narrator can see into any character's mind and can editorialize. However, don't head-hop mid-paragraph — stay with one character per paragraph for clarity.",
  'deep-first': "No thought tags ('I thought', 'I wondered'). The narration IS the character's inner voice. Stream of consciousness with the character's vocabulary and speech patterns.",
  second: "All scenes address the reader as 'you'. The reader IS the protagonist. Every perception, action, and emotion is framed as the reader's experience.",
  epistolary: 'Each scene is a document: letter, diary entry, email, transcript, found footage. Specify the document type and voice for each scene.',
  'nf-author': "Scenes are the author's personal experience or observation. First person reflections grounding the argument.",
  'nf-direct': 'Scenes are instructional sequences. The reader is being guided through a process or framework.',
  'nf-third': 'Scenes are reconstructed events. The author is invisible — only the subjects and events exist.',
  'nf-editorial': "Scenes alternate between the author's analysis (present, first person) and reconstructed events (past, third person). Mark transitions clearly.",
};

export const FICTION_POV_INSTRUCTIONS = {
  first: 'Write in FIRST PERSON (I/me/my). The narrator IS the POV character. Never use "he thought" or "she felt" — use "I thought" and "I felt." The reader experiences everything through the narrator\'s direct perception.',
  'third-close': 'Write in THIRD PERSON CLOSE (he/she + character name). Stay inside ONE character\'s head per scene. Use their name and pronouns, never "the human" or "the man." Filter all observations through their perspective. Free indirect discourse permitted.',
  'third-multi': 'Write in THIRD PERSON MULTIPLE POV. Each scene stays in one character\'s perspective. Mark POV shifts with scene breaks (* * *). Use character names and pronouns, not clinical descriptors.',
  'third-omni': 'Write in THIRD PERSON OMNISCIENT. The narrator can see into any character\'s mind and can editorialize. Maintain a consistent narrative voice throughout.',
  'deep-first': 'Write in DEEP FIRST PERSON. No thought tags (never write "I thought" or "I wondered"). The narration IS the character\'s inner voice. Use their vocabulary, their sentence rhythms, their biases.',
  second: 'Write in SECOND PERSON (you/your). Address the reader directly as the protagonist. "You walk into the room. You feel the tension."',
  epistolary: 'Write in EPISTOLARY format. Each section is a document — letter, diary entry, email, transcript. Each document has its own voice matching the in-universe author.',
};

export const NONFICTION_POV_INSTRUCTIONS = {
  'nf-author': 'AUTHOR VOICE (I/we) — Write from personal experience and authority. Use "I" for personal accounts, "we" for shared experience. Reflective, opinionated, grounded.',
  'nf-direct': 'DIRECT ADDRESS (you) — Speak to the reader as "you" throughout. Instructional, prescriptive, conversational. The reader is the student; the author is the guide.',
  'nf-third': 'THIRD PERSON NARRATIVE — Maintain observational distance. Refer to subjects by name and role. No "I" or "you." The author is an invisible narrator reconstructing events.',
  'nf-editorial': 'EDITORIAL MIX (I + you + they) — Shift fluidly between personal authority ("I investigated..."), reader engagement ("you might assume..."), and third-person narrative ("the officials claimed...").',
};

export const TENSE_INSTRUCTIONS = {
  past: 'Write in PAST TENSE (walked, said, thought). This is the default narrative tense. Do NOT slip into present tense during action sequences or tense moments.',
  present: 'Write in PRESENT TENSE (walks, says, thinks). Maintain present tense consistently. Do NOT slip into past tense for backstory — use past perfect ("had walked") for flashbacks only.',
  mixed: 'MIXED TENSE — Use PRESENT TENSE for analysis, commentary, and direct address ("This pattern reveals..." / "What we see here is..."). Use PAST TENSE for reconstructed events, historical narrative, and quoted sources ("The committee met..." / "She testified that..."). Transition cleanly between the two — present for the author\'s lens, past for the story.',
};

export function buildPovTenseBlock(spec) {
  const isNF = spec.book_type === 'nonfiction';
  const povInstructions = isNF
    ? NONFICTION_POV_INSTRUCTIONS[spec.pov_mode] || NONFICTION_POV_INSTRUCTIONS['nf-editorial']
    : FICTION_POV_INSTRUCTIONS[spec.pov_mode] || FICTION_POV_INSTRUCTIONS['third-close'];
  const tenseInstructions = TENSE_INSTRUCTIONS[spec.tense] || TENSE_INSTRUCTIONS.past;

  return `=== POV & TENSE (MANDATORY — DO NOT DEVIATE) ===\n${povInstructions}\n${tenseInstructions}\nNever refer to characters/subjects as "the human," "the man," "the woman," "the subject," or similar clinical descriptors. Use their NAME or role.\n=== END POV & TENSE ===`;
}

export function stripDialogue(text = '') {
  return text
    .replace(/["\u201C\u201D][^"\u201C\u201D]*["\u201C\u201D]/g, '')
    .replace(/'[^']*'/g, '');
}

export function checkTenseConsistency(chapterText, spec) {
  const violations = [];
  const tense = spec?.tense;
  if (!tense || tense === 'mixed') return violations;

  const withoutDialogue = stripDialogue(chapterText);
  const sentences = withoutDialogue.split(/[.!?]+/).filter((s) => s.trim().length > 20);

  if (tense === 'past') {
    let presentCount = 0;
    const presentPatterns = /\b(\w+)\s+(walks|runs|says|thinks|feels|knows|sees|hears|stands|sits|looks|moves|turns|opens|closes|steps|reaches|pulls|pushes|watches|presses|asks|cuts|fills|takes|sets|picks|drops|begins|starts|stops|grabs|holds|catches|lifts|places|speaks|tells|gives|goes|comes|makes|keeps|brings|finds|puts|gets|lets|seems|appears|becomes|remains|shows|breaks|falls|grows|leads|meets|rises|sends|writes|reads|drives|flies|throws|builds|draws|fights|hides|leaves|pays|rides|rings|shakes|shuts|sings|spends|strikes|swims|teaches|wears|wins)\b/gi;

    for (const sentence of sentences) {
      const matches = sentence.match(presentPatterns) || [];
      for (const match of matches) {
        const subject = match.split(/\s+/)[0];
        if (/^(he|she|they|it|I|we)$/i.test(subject) || /^[A-Z]/.test(subject)) {
          presentCount += 1;
        }
      }
    }

    if (presentCount > 3) {
      violations.push({
        type: 'tense_drift',
        severity: 'critical',
        description: `TENSE DRIFT: Project tense is PAST but chapter has ${presentCount} present-tense narrative verbs. The prose must be rewritten in past tense. Present tense is only acceptable inside direct dialogue quotes.`,
        count: presentCount,
      });
    }
  }

  if (tense === 'present') {
    let pastCount = 0;
    const pastPatterns = /\b(\w+)\s+(walked|ran|said|thought|felt|knew|saw|heard|stood|sat|looked|moved|turned|opened|closed|stepped|reached|pulled|pushed|watched|pressed|asked|cut|filled|took|set|picked|dropped|began|started|stopped|grabbed|held|caught|lifted|placed|spoke|told|gave|went|came|made|kept|brought|found|put|got|let|seemed|appeared|became|remained|showed|broke|fell|grew|led|met|rose|sent|wrote|read|drove|flew|threw|built|drew|fought|hid|left|paid|rode|rang|shook|shut|sang|spent|struck|swam|taught|wore|won)\b/gi;

    for (const sentence of sentences) {
      const matches = sentence.match(pastPatterns) || [];
      for (const match of matches) {
        const subject = match.split(/\s+/)[0];
        if (/^(he|she|they|it|I|we)$/i.test(subject) || /^[A-Z]/.test(subject)) {
          pastCount += 1;
        }
      }
    }

    if (pastCount > 3) {
      violations.push({
        type: 'tense_drift',
        severity: 'critical',
        description: `TENSE DRIFT: Project tense is PRESENT but chapter has ${pastCount} past-tense narrative verbs. The prose must be rewritten in present tense. Past tense is only acceptable in flashback passages.`,
        count: pastCount,
      });
    }
  }

  return violations;
}

// DELETED: scanChapterTenseDrift() and PHASE4_TENSE_PATTERNS — orphaned, never called.
// checkTenseConsistency() handles all tense drift detection.

export const chapterJudgeSchema = {
  type: 'object',
  properties: {
    prose_quality: { type: 'number' },
    voice_adherence: { type: 'number' },
    character_distinctiveness: { type: 'number' },
    beat_coverage: { type: 'number' },
    narrative_contract_adherence: { type: 'number' },
    continuity_integrity: { type: 'number' },
    register_accuracy: { type: 'number' },
    overall: { type: 'number' },
    issues: {
      type: 'array',
      items: { type: 'string' }
    },
    contract_violations: {
      type: 'array',
      items: { type: 'string' }
    },
    process_leaks: {
      type: 'array',
      items: { type: 'string' }
    }
  },
  required: ['prose_quality', 'voice_adherence', 'character_distinctiveness', 'beat_coverage', 'narrative_contract_adherence', 'continuity_integrity', 'register_accuracy', 'overall', 'issues', 'contract_violations', 'process_leaks']
};

export function buildChapterJudgePrompt(spec, chapter, chapterText, tenseViolations = []) {
  const safeChapterText = typeof chapterText === 'string' ? chapterText : '';
  const violationText = tenseViolations.length
    ? tenseViolations.map((violation) => `- ${violation.description}`).join('\n')
    : '- No mechanical tense drift violations detected.';

  // MULTI-POV CARVE-OUT — in third-multi, voice legitimately varies per POV
  // character. Without this brief, the judge penalizes intentional variation
  // as "voice inconsistency" or "register drift," tanking voice_adherence
  // scores on books whose entire architecture is multi-POV.
  const isMultiPov = spec?.pov_mode === 'third-multi';
  const multiPovBlock = isMultiPov ? `\n\nMULTI-POV CARVE-OUT (CRITICAL — READ BEFORE SCORING):\nThis project is configured as third-person MULTIPLE POV. Different chapters and different scenes within chapters are written from different POV characters. Voice, diction, rhythm, vocabulary, and interior register WILL LEGITIMATELY SHIFT between POV characters — that is the intended architecture, not a flaw.\n\nDO NOT deduct voice_adherence points for:\n  - Register shifts between POV sections (a hardened detective's voice vs. a young runaway's voice — different on purpose).\n  - Vocabulary variation across POV characters (formal vs. colloquial, technical vs. sensory).\n  - Interior-monologue style differences between characters.\n  - Sentence rhythm variation tied to which character holds the scene.\n\nDO still deduct voice_adherence points for:\n  - Tense drift (past → present or vice versa) — tense must stay stable regardless of POV owner.\n  - POV breaks WITHIN a single scene (head-hopping between characters mid-scene without a * * * break).\n  - Clinical descriptors ("the man," "the woman," "the subject") in place of names.\n  - Second-person intrusion into third-person narration.\n  - A single POV character's own voice being inconsistent across their own scenes (that IS drift).\n\nScore voice_adherence on PER-CHARACTER consistency and tense stability — NOT on uniformity of voice across the whole book.` : '';

  const sceneContract = String(chapter?.scene_beats_json || chapter?.scene_beats || '').trim();

  return `Score this chapter 1-10 on each dimension.\n\n- prose_quality: Is the writing publishable? Natural rhythm, varied sentences, no AI tells.\n- voice_adherence: Does the prose match the project's POV (${spec.pov_mode}) and tense (${spec.tense})? Deduct heavily for tense drift, POV breaks, clinical descriptors, or second-person intrusions in third-person narration.${multiPovBlock}\n- character_distinctiveness: Do characters sound different from each other in dialogue?\n- beat_coverage: Does the chapter hit the planned beats from the outline?\n- narrative_contract_adherence: Does every contracted scene begin from its entry_state, perform every required_event exactly once, avoid forbidden_events, and end at its exit_state without merging or replaying another scene?\n- continuity_integrity: Are deaths, injuries, revelations, locations, object ownership, and character knowledge consistent throughout this chapter and with the supplied chapter plan?\n- register_accuracy: If erotica settings are active, does the explicitness match the target register? Otherwise score based on how faithfully the prose matches the requested tonal register.\n\nHARD NARRATIVE RULES:\n- Put every skipped, repeated, contradicted, premature, or unowned event in contract_violations.\n- Put any manuscript reference to \"the previous chapter\", \"the next chapter\", \"in Chapter N\", scene IDs, beats, outlines, prompts, or drafting instructions in process_leaks.\n- A death, amputation, reveal, archive opening, escape, collapse, climax, or object transfer may occur only in its owning scene.\n- Do not award an 8+ contract score if contract_violations is non-empty.\n\nMechanical scan results:\n${violationText}\n\nChapter title: ${chapter.title}\nChapter plan: ${chapter.beat_summary}\n\nIMMUTABLE SCENE CONTRACT:\n${sceneContract.slice(0, 9000) || 'Missing — report this as a contract violation.'}\n\nCOMPLETE CHAPTER TEXT:\n${safeChapterText.slice(0, 22000)}\n\nReturn JSON only.`;
}

/**
 * Check POV consistency: detect third-person protagonist references when spec says first person.
 * Returns an array of violations.
 */
export function checkPovConsistency(chapterText, spec, chapterNumber) {
  const violations = [];
  const pov = spec?.pov_mode;
  if (!pov || !chapterText) return violations;

  const withoutDialogue = stripDialogue(chapterText);

  // For first-person or deep-first, detect third-person protagonist references
  if (pov === 'first' || pov === 'deep-first') {
    // Look for patterns like "He [verb]" "She [verb]" that suggest third-person narration
    // outside dialogue, ignoring references to other characters in context
    const thirdPersonNarration = withoutDialogue.match(
      /\b(He|She)\s+(walks|runs|says|thinks|feels|knows|sees|hears|stands|sits|looks|moves|turns|opens|closes|steps|reaches|pulls|pushes|watches|presses|asks|takes|approaches|pauses|stops|starts|begins|continues|considers|realizes|understands|decides|notices|observes|examines|studies|stares|gazes|glances|peers|squints|narrows|nods|shakes|sighs|breathes|inhales|exhales|clenches|grips|releases|drops|lifts|raises|lowers|crosses|uncrosses|leans|shifts|adjusts|straightens|crouches|kneels|rises|falls|stumbles|staggers|limps|crawls|sprints|dashes|bolts|freezes|waits|hesitates|contemplates|wonders|muses|ponders|reflects|remembers|recalls|forgets|imagines)\b/g
    ) || [];

    if (thirdPersonNarration.length > 3) {
      violations.push({
        type: 'pov_break',
        severity: 'critical',
        description: `POV BREAK: Chapter ${chapterNumber} uses ${thirdPersonNarration.length} third-person narration patterns ("He/She [verb]") but project POV is ${pov}. All narration must use first person ("I [verb]"). Samples: ${thirdPersonNarration.slice(0, 4).join(', ')}`,
        count: thirdPersonNarration.length,
        samples: thirdPersonNarration.slice(0, 6),
      });
    }
  }

  // For third-person modes, detect accidental first-person narration (outside dialogue)
  if (pov === 'third-close' || pov === 'third-omni' || pov === 'third-multi') {
    const firstPersonNarration = withoutDialogue.match(
      /\bI\s+(walk|run|say|think|feel|know|see|hear|stand|sit|look|move|turn|open|close|step|reach|pull|push|watch|press|ask|take|approach|pause|stop|start|begin|continue|consider|realize|understand|decide|notice|observe)\b/g
    ) || [];

    if (firstPersonNarration.length > 3) {
      violations.push({
        type: 'pov_break',
        severity: 'critical',
        description: `POV BREAK: Chapter ${chapterNumber} uses ${firstPersonNarration.length} first-person narration patterns ("I [verb]") but project POV is ${pov}. All narration must use third person.`,
        count: firstPersonNarration.length,
        samples: firstPersonNarration.slice(0, 6),
      });
    }
  }

  return violations;
}
