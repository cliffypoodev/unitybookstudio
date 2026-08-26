/**
 * LEGACY PROSE REPAIRS - DATA, NOT LOGIC. ONE SPECIFIC BOOK, AND A DEAD ONE.
 *
 * postDraftCleanup.js is the general post-draft repair engine: every chapter of every
 * book in the library passes through it. It carried these phrase banks inline -
 * roughly 150 verbatim pattern/replacement pairs naming one old manuscript's cast by
 * name, its props ("stale coffee on his pause", "the captive still sitting on his
 * table") and its own broken sentences ("capped it set it aside", "gaze lifted found").
 * LEGACYREPAIR-1 generalized every subject-name alternation to a generic
 * he/she/they/<CapitalizedName> class (matching crossChapterDedupe.js's
 * collectProperNouns bounding) — the repaired phrases are unchanged; only the
 * subject list widened from the original cast to any name-shaped subject.
 *
 * They are moved here VERBATIM and unchanged. They are NOT the default for anything.
 * A project gets prose repairs only by declaring prose_repairs_json on its own record
 * - see resolveProseRepairs() in bookScrubRules.js. That is the difference between
 * this file and legacyBookScrubRules.data.js: the persona scrub still falls back to
 * legacy so an already-published nonfiction manuscript keeps working, whereas these
 * rewrite narrative prose and so may never run on a book that did not ask for them.
 *
 * Why they may never be the default, concretely: several are not artifact repairs at
 * all but word substitutions - "His silence hitched" becomes "His breath hitched",
 * "A stupid, wet sound." becomes "A stupid, wet sound came from him." - applied to
 * any author sentence that matches. Deterministic word-swap fixes for style are
 * banned in this codebase. These survive only so the one book they were written for
 * can still be reproduced exactly.
 *
 * DO NOT ADD TO THIS FILE.
 */

/** Micro-copyedit pass. Shape: { label, pattern, replacement }. */
export const LEGACY_MICRO_COPYEDIT_REPAIRS = Object.freeze([
    {
      label: 'missing conjunction after “moved back in”',
      pattern: /\bmoved back in\s+took\b/gi,
      replacement: 'moved back in and took',
    },
    {
      label: 'missing conjunction after “capped it”',
      pattern: /\bcapped it\s+set it aside\b/gi,
      replacement: 'capped it and set it aside',
    },
    {
      label: 'missing conjunction after “gaze lifted”',
      pattern: /\bgaze lifted\s+found\b/gi,
      replacement: 'gaze lifted and found',
    },
    {
      label: 'missing conjunction after “He reached for the cold coffee”',
      pattern: /\bHe reached for the cold coffee\s+took a sip\b/g,
      replacement: 'He reached for the cold coffee and took a sip',
    },
    {
      label: 'missing comma before “cutting”',
      pattern: /\bswung shut\s+cutting\b/gi,
      replacement: 'swung shut, cutting',
    },
    {
      label: 'missing comma before “setting”',
      pattern: /\bstraightened\s+setting\b/gi,
      replacement: 'straightened, setting',
    },
    {
      label: 'missing comma in raised-hand clause',
      pattern: /\bHis hand,\s+still raised\s+began\b/g,
      replacement: 'His hand, still raised, began',
    },
    {
      label: 'wrong noun: beat fogged → breath fogged',
      pattern: /\bHis beat fogged\b/g,
      replacement: 'His breath fogged',
    },
    {
      label: 'wrong noun: beat hitched → breath hitched',
      pattern: /\bHis beat hitched\b/g,
      replacement: 'His breath hitched',
    },
    {
      label: 'wrong noun: silence hitched → breath hitched',
      pattern: /\bHis silence hitched\b/g,
      replacement: 'His breath hitched',
    },
    {
      label: 'wrong noun: air hitched → breath hitched',
      pattern: /\bHis air hitched\b/g,
      replacement: 'His breath hitched',
    },
    {
      label: 'wrong noun: pause was warm → breath was warm',
      pattern: /\bHis pause was warm\b/g,
      replacement: 'His breath was warm',
    },
    {
      label: 'wrong noun: pause hitched → breath hitched',
      pattern: /\bHis pause hitched\b/g,
      replacement: 'His breath hitched',
    },
    {
      label: 'wrong noun: pause fogged → breath fogged',
      pattern: /\bHis pause fogged\b/g,
      replacement: 'His breath fogged',
    },
    {
      label: 'wrong noun: moment hitched → breath hitched',
      pattern: /\bHis moment hitched\b/g,
      replacement: 'His breath hitched',
    },
    {
      label: 'wrong noun: Husbandman pause → breath',
      pattern: /\bThe Husbandman’s pause was warm\b/g,
      replacement: 'The Husbandman’s breath was warm',
    },
    {
      label: 'wrong noun: stale coffee on his pause → breath',
      pattern: /\bstale coffee on his pause\b/gi,
      replacement: 'stale coffee on his breath',
    },
    {
      label: 'wrong noun: coffee on his pause → breath',
      pattern: /\bcoffee on his pause\b/gi,
      replacement: 'coffee on his breath',
    },
    {
      label: 'wrong noun: stale coffee on his silence → breath',
      pattern: /\bstale coffee on his silence\b/gi,
      replacement: 'stale coffee on his breath',
    },
    {
      label: 'wrong noun: coffee on his silence → breath',
      pattern: /\bcoffee on his silence\b/gi,
      replacement: 'coffee on his breath',
    },
    {
      label: 'wrong noun: deliberate moment → breath',
      pattern: /\bdeep,\s+deliberate moment right over\b/gi,
      replacement: 'deep, deliberate breath right over',
    },
    {
      label: 'wrong noun: deliberate beat → breath',
      pattern: /\bdeep,\s+deliberate beat right over\b/gi,
      replacement: 'deep, deliberate breath right over',
    },
    {
      label: 'wrong noun: took not a sniff but a breath',
      pattern: /\btook not a sniff,\s+but a deep,\s+deliberate (moment|beat)\b/gi,
      replacement: 'took not a sniff, but a deep, deliberate breath',
    },
    {
      label: 'missing comma after action',
      pattern: /\bshut\s+cutting off\b/gi,
      replacement: 'shut, cutting off',
    },
    {
      label: 'missing comma after action',
      pattern: /\bturned\s+cutting off\b/gi,
      replacement: 'turned, cutting off',
    },
    {
      label: 'missing comma after action',
      pattern: /\bturned\s+sealing\b/gi,
      replacement: 'turned, sealing',
    },
    {
      label: 'missing comma after action',
      pattern: /\bturned\s+leaving\b/gi,
      replacement: 'turned, leaving',
    },
    {
      label: 'missing comma after action',
      pattern: /\bstood\s+setting the\b/gi,
      replacement: 'stood, setting the',
    },
    {
      label: 'missing comma after action',
      pattern: /\bstepped forward\s+closing\b/gi,
      replacement: 'stepped forward, closing',
    },
    {
      label: 'missing comma after action',
      pattern: /\bleaned forward\s+closed his eyes\b/gi,
      replacement: 'leaned forward, closing his eyes',
    },
    {
      label: 'missing comma after dialogue setup',
      pattern: /\bHis voice,\s+when it came\s+was\b/g,
      replacement: 'His voice, when it came, was',
    },
    {
      label: 'missing comma in “noticed” clause',
      pattern: /\bthe man noticed\s+were\b/gi,
      replacement: 'the man noticed, were',
    },
    {
      label: 'minor table wording cleanup',
      pattern: /\bthe captive still sitting on his table\b/gi,
      replacement: 'the captive still sitting on the table',
    },
    {
      label: 'wrong noun: own movement sounded too loud → own breathing sounded too loud',
      pattern: /\bown movement sounded too loud\b/gi,
      replacement: 'own breathing sounded too loud',
    },
    {
      label: 'wrong noun: own quiet sounded too loud → own breathing sounded too loud',
      pattern: /\bown quiet sounded too loud\b/gi,
      replacement: 'own breathing sounded too loud',
    },
    {
      label: 'wrong noun: His own movement sounded too loud → His own breathing sounded too loud',
      pattern: /\bHis own movement sounded too loud\b/g,
      replacement: 'His own breathing sounded too loud',
    },
    {
      label: 'missing comma after groan',
      pattern: /\bHe groaned\s+doubling over\b/gi,
      replacement: 'He groaned, doubling over',
    },
    {
      label: 'missing comma after hand clause',
      pattern: /\bHis hand,\s+still raised\s*,?\s+began to tremble\b/g,
      replacement: 'His hand, still raised, began to tremble',
    },
    {
      label: 'wrong noun: boy air hitched → boy breath hitched',
      pattern: /\b(The boy’s|the boy’s|A boy’s|a boy’s)\s+air hitched\b/g,
      replacement: '$1 breath hitched',
    },
]);

/** Final hard-survivor pass. Shape: { label, pattern, replacement, fixPrefix }. */
export const LEGACY_HARD_SURVIVOR_REPAIRS = Object.freeze([
    {
      label: 'FINAL survivor: shut cutting → shut, cutting',
      pattern: /\b(shut)\s+(cutting\b)/gi,
      replacement: '$1, $2',
      fixPrefix: 'Final hard-survivor pass repaired',
    },
    {
      label: 'FINAL survivor: swung shut cutting → swung shut, cutting',
      pattern: /\b(swung shut)\s+(cutting\b)/gi,
      replacement: '$1, $2',
      fixPrefix: 'Final hard-survivor pass repaired',
    },
    {
      label: 'FINAL survivor: straightened setting → straightened, setting',
      pattern: /\b(straightened)\s+(setting\b)/gi,
      replacement: '$1, $2',
      fixPrefix: 'Final hard-survivor pass repaired',
    },
    {
      label: 'FINAL survivor: groaned doubling → groaned, doubling',
      pattern: /\b(groaned)\s+(doubling\b)/gi,
      replacement: '$1, $2',
      fixPrefix: 'Final hard-survivor pass repaired',
    },
    {
      label: 'FINAL survivor: still raised began → still raised, began',
      pattern: /\b(still raised)\s+(began\b)/gi,
      replacement: '$1, $2',
      fixPrefix: 'Final hard-survivor pass repaired',
    },
    {
      label: 'FINAL survivor: hand still raised began',
      pattern: /\b(His hand,\s+still raised)\s*,?\s+(began\b)/g,
      replacement: '$1, $2',
      fixPrefix: 'Final hard-survivor pass repaired',
    },
    {
      label: 'FINAL survivor: pause fogged → breath fogged',
      pattern: /\b(His|Her|Their|The man’s|The boy’s|The handler’s|The Husbandman’s|[A-Z][a-z]+’s)\s+pause\s+(fogged\b)/g,
      replacement: '$1 breath $2',
      fixPrefix: 'Final hard-survivor pass repaired',
    },
    {
      label: 'FINAL survivor: pause hitched → breath hitched',
      pattern: /\b(His|Her|Their|The man’s|The boy’s|The handler’s|The Husbandman’s|[A-Z][a-z]+’s)\s+pause\s+(hitched\b)/g,
      replacement: '$1 breath $2',
      fixPrefix: 'Final hard-survivor pass repaired',
    },
    {
      label: 'FINAL survivor: moment hitched → breath hitched',
      pattern: /\b(His|Her|Their|The man’s|The boy’s|The handler’s|The Husbandman’s|[A-Z][a-z]+’s)\s+moment\s+(hitched\b)/g,
      replacement: '$1 breath $2',
      fixPrefix: 'Final hard-survivor pass repaired',
    },
    {
      label: 'FINAL survivor: air hitched → breath hitched',
      pattern: /\b(His|Her|Their|The man’s|The boy’s|The handler’s|The Husbandman’s|[A-Z][a-z]+’s)\s+air\s+(hitched\b)/g,
      replacement: '$1 breath $2',
      fixPrefix: 'Final hard-survivor pass repaired',
    },
    {
      label: 'FINAL survivor: silence hitched/fogged → breath hitched/fogged',
      pattern: /\b(His|Her|Their|The man’s|The boy’s|The handler’s|The Husbandman’s|[A-Z][a-z]+’s)\s+silence\s+(hitched|fogged)\b/g,
      replacement: '$1 breath $2',
      fixPrefix: 'Final hard-survivor pass repaired',
    },
    {
      label: 'FINAL survivor: coffee on his silence/pause → coffee on his breath',
      pattern: /\b(coffee on his)\s+(silence|pause|moment|air)\b/gi,
      replacement: '$1 breath',
      fixPrefix: 'Final hard-survivor pass repaired',
    },
    {
      label: 'FINAL survivor: stale coffee on his silence/pause → stale coffee on his breath',
      pattern: /\b(stale coffee on his)\s+(silence|pause|moment|air)\b/gi,
      replacement: '$1 breath',
      fixPrefix: 'Final hard-survivor pass repaired',
    },
    {
      label: 'FINAL survivor: deliberate beat/moment → deliberate breath',
      pattern: /\b(deep,\s+deliberate)\s+(beat|moment)\s+(right over\b)/gi,
      replacement: '$1 breath $3',
      fixPrefix: 'Final hard-survivor pass repaired',
    },
    {
      label: 'FINAL survivor: took not a sniff but deliberate beat/moment',
      pattern: /\btook not a sniff,\s+but a deep,\s+deliberate\s+(beat|moment)\b/gi,
      replacement: 'took not a sniff, but a deep, deliberate breath',
      fixPrefix: 'Final hard-survivor pass repaired',
    },
    {
      label: 'FINAL survivor: moved back in took → moved back in and took',
      pattern: /\bmoved back in\s+took\b/gi,
      replacement: 'moved back in and took',
      fixPrefix: 'Final hard-survivor pass repaired',
    },
    {
      label: 'FINAL survivor: capped it set it aside → capped it and set it aside',
      pattern: /\bcapped it\s+set it aside\b/gi,
      replacement: 'capped it and set it aside',
      fixPrefix: 'Final hard-survivor pass repaired',
    },
    {
      label: 'FINAL survivor: gaze lifted found → gaze lifted and found',
      pattern: /\bgaze lifted\s+found\b/gi,
      replacement: 'gaze lifted and found',
      fixPrefix: 'Final hard-survivor pass repaired',
    },
    {
      label: 'FINAL survivor: reached for cold coffee took sip',
      pattern: /\b(He|She|They|[A-Z][a-z]+)\s+reached for the cold coffee\s+took a sip\b/g,
      replacement: '$1 reached for the cold coffee and took a sip',
      fixPrefix: 'Final hard-survivor pass repaired',
    },
    {
      label: 'FINAL survivor: noticed were → noticed, were',
      pattern: /\b(the man noticed)\s+(were\b)/gi,
      replacement: '$1, $2',
      fixPrefix: 'Final hard-survivor pass repaired',
    },
    {
      label: 'FINAL survivor: hands he noticed were → hands, he noticed, were',
      pattern: /\b(His hands)\s+he noticed\s+(were\b)/g,
      replacement: '$1, he noticed, $2',
      fixPrefix: 'Final hard-survivor pass repaired',
    },
    {
      label: 'FINAL survivor: close action comma before closing/sealing/leaving',
      pattern: /\b(stepped forward|moved forward|turned|leaned forward|stood)\s+(closing|sealing|leaving|setting)\b/gi,
      replacement: '$1, $2',
      fixPrefix: 'Final hard-survivor pass repaired',
    },
]);

/** Leading-article repairs applied per sentence. Shape: [pattern, replacement]. */
export const LEGACY_ARTICLE_REPAIRS = Object.freeze([
  [/^A air\b/, "The air"],
  [/^One air\b/, "The air"],
  [/^One silence\b/, "The silence"],
  [/^One corridor\b/, "The corridor"],
  [/^One hum\b/, "The hum"],
  [/^One walls\b/, "The walls"],
  [/^Its man\b/, "The man"],
  [/^Its door\b/, "The door"],
  [/^Its world\b/, "The world"],
  [/^That silence here\b/, "The silence here"],
]);

/** Known-broken phrase substitutions. Shape: [pattern, replacement]. */
export const LEGACY_PHRASE_REPAIRS = Object.freeze([
  [/\bwhite space on\s+\./g, "white space."],
  [/\bblank field on\s+\./g, "blank field."],
  [/\bthe familiar pull at like a lie\b/g, "the familiar pull felt like a lie"],
  [/\bThe like hands on him\b/g, "It felt like hands on him"],
  [/\bHe said softly it in\./g, "He breathed it in softly."],
  [/\bA stupid, wet sound\./g, "A stupid, wet sound came from him."],
  [/\bThe few like a mile\b/g, "The few steps felt like a mile"],
  [/\bA few like a mile\b/g, "The few steps felt like a mile"],
  [/\bHis beat was warm\b/g, "His breath was warm"],
  [/\bHis pause came shorter\b/g, "His breath came shorter"],
  [/\bHis beat fogged\b/g, "His breath fogged"],
  [/\bHis pause fogged\b/g, "His breath fogged"],
  [/\bHis air hitched\b/g, "His breath hitched"],
  [/\bHis moment hitched\b/g, "His breath hitched"],
  [/\bthe stale coffee on his pause\b/gi, "the stale coffee on his breath"],
  [/\bthe stale coffee on his silence\b/gi, "the stale coffee on his breath"],
]);

export const LEGACY_PROSE_REPAIRS = Object.freeze({
  microCopyedit: LEGACY_MICRO_COPYEDIT_REPAIRS,
  hardSurvivor: LEGACY_HARD_SURVIVOR_REPAIRS,
  articleRepairs: LEGACY_ARTICLE_REPAIRS,
  phraseRepairs: LEGACY_PHRASE_REPAIRS,
});
