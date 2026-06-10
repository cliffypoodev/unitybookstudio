/**
 * Critic Panel v2 — calibrated reviewer system
 *
 * Design goals that motivated this rewrite:
 *   1. Score CONSISTENCY across repeat runs of the same manuscript.
 *   2. Reviewer INDEPENDENCE — each reviewer evaluates the book on its own,
 *      without unconsciously anchoring to a single overall verdict the LLM
 *      picks for the whole panel.
 *   3. DETERMINISTIC consensus — percent_fresh is computed in JS from the
 *      individual ratings using a fixed mapping table, not guessed by the LLM.
 *   4. GENRE-AWARE expertise — each reviewer gets a rubric tailored to the
 *      medium (fiction novel, anthology, nonfiction, erotica).
 *
 * What this module exports:
 *   - `pickReviewerPanel(project, genre, projectType)`
 *       Returns the 10 reviewer descriptors that will evaluate this book.
 *       Always includes six "core" reviewers (Kirkus, PW, NYT, BookTok, genre
 *       magazine, Literary Quarterly) and four domain-specific reviewers
 *       based on whether the manuscript is fiction / erotica / nonfiction.
 *
 *   - `buildReviewerPrompt(reviewer, context)`
 *       Builds a SINGLE-REVIEWER prompt for one independent LLM call. Contains
 *       the full rubric, the excerpt, and strict output contract for that
 *       reviewer's rating scale.
 *
 *   - `REVIEWER_RESPONSE_SCHEMA`
 *       JSON schema for a single reviewer response. The critical field is
 *       `rating_numeric` — every reviewer outputs a 0-100 score on a normalized
 *       scale regardless of their native rating system. This drives the
 *       consensus calculation.
 *
 *   - `computeConsensus(reviews)`
 *       Deterministic JS function. Given the array of reviewer responses,
 *       returns { percent_fresh, average_stars, one_line_guidance }. The LLM
 *       cannot drift this number because it never computes it.
 */

/* =============================================================================
 * REVIEWER PANEL SELECTION
 * ========================================================================== */

/**
 * Maps a manuscript genre to the name of the genre-specific magazine slot.
 * Kept identical to v1 so existing projects see familiar outlet names.
 */
export function getGenreMagazineName(genre) {
  const g = (genre || '').toLowerCase();
  if (g.includes('sci-fi') || g.includes('science fiction')) return 'Locus Magazine';
  if (g.includes('fantasy')) return 'Fantasy & Science Fiction';
  if (g.includes('romance')) return 'RT Book Reviews';
  if (g.includes('thriller') || g.includes('mystery') || g.includes('crime')) return 'CrimeReads';
  if (g.includes('horror')) return 'Fangoria';
  if (g.includes('historical')) return 'Historical Novel Society Review';
  if (g.includes('young adult') || g.includes('ya')) return 'YALSA Booklist';
  if (g.includes('literary')) return 'The Paris Review';
  if (g.includes('nonfiction') || g.includes('non-fiction')) return 'Literary Hub';
  if (g.includes('erotica')) return 'RT Book Reviews (Sensual)';
  return 'Genre Fiction Review';
}

/**
 * The SIX core reviewers — these appear on every panel regardless of genre.
 * Each definition includes a full rubric with anchor examples so the LLM
 * can pin a number instead of guessing a vibe.
 */
function buildCoreReviewers(genre) {
  const genreMag = getGenreMagazineName(genre);
  return [
    {
      outlet: 'Kirkus Reviews',
      icon: '📚',
      scale: 'kirkus', // STARRED / RECOMMENDED / unmarked
      voice: 'Authoritative, concise, occasionally cutting. Treats the manuscript as a work standing among all books published this season — not as a favor to the author.',
      word_target: '200-250 words',
      format_notes: 'Ends with a bold italic summary line. Voice: measured, confident, willing to be negative.',
      priorities: 'Prose quality, structure, originality, thematic depth.',
      rubric: `
  - STARRED: Prose is measurably above median published trade fiction/nonfiction. Evidence: distinctive voice, non-obvious structural choices that earn their complexity, thematic depth the reader feels without being told. Rare.
  - RECOMMENDED: Competent professional prose. Story/argument works. Reader will finish and recommend. The median solid trade book.
  - unmarked (no label): Readable but unexceptional OR has notable flaws — pacing stalls, voice is generic, thematic ambition unmet.
  - Default to RECOMMENDED when uncertain. STARRED is reserved for top ~20% of the genre.`,
      rating_to_numeric: {
        STARRED: 90,
        RECOMMENDED: 70,
        unmarked: 45,
      },
    },
    {
      outlet: 'Publishers Weekly',
      icon: '📰',
      scale: 'stars_4',
      voice: 'Industry-insider. Balanced, market-aware. Speaks to booksellers, librarians, and editors.',
      word_target: '150-200 words',
      format_notes: 'Names 2 comparison authors. Identifies primary audience.',
      priorities: 'Marketability, pacing, genre execution, where it sits among comparable titles.',
      rubric: `
  - ★★★★ (4): Breakout potential. Strong prose + commercial instincts. Booksellers should hand-sell.
  - ★★★½ (3.5): Excellent genre execution. Solid list title. Will satisfy fans of the genre.
  - ★★★ (3): Competent and readable. Works for existing audience but won't expand it.
  - ★★½ (2.5): Notable flaws — pacing, underwritten scenes, or thin marketability.
  - ★★ (2): Below professional median. Needs significant revision.
  - Use .5 increments freely. 3.5 is the default for solid books in their genre lane.`,
      rating_to_numeric: {
        '4': 90,
        '3.5': 78,
        '3': 65,
        '2.5': 50,
        '2': 38,
        '1.5': 25,
        '1': 15,
      },
    },
    {
      outlet: 'The New York Times Book Review',
      icon: '🗞️',
      scale: 'nyt',
      voice: 'Essayistic, literary, culturally aware. Writing with subtext for the informed reader.',
      word_target: '250-300 words',
      format_notes: 'Opens with a cultural or thematic framing, not plot summary. Closes with a judgment that weighs the book against its ambitions.',
      priorities: 'Cultural significance, prose distinction, originality, whether the book advances a conversation.',
      rubric: `
  - ACQUIRE: You would champion this at an editorial meeting. Prose is distinctive, the book is in conversation with something larger than its genre.
  - REVIEW: Worth a serious reader's attention even if imperfect. Has meaningful ambitions AND meaningful craft gaps.
  - PASS: Readable but has nothing you would recommend to a friend who reads widely. Execution does not meet ambition, or ambition is small.
  - Default to REVIEW for competent but not distinctive work. ACQUIRE is rare.`,
      rating_to_numeric: {
        ACQUIRE: 92,
        REVIEW: 60,
        PASS: 30,
      },
    },
    {
      outlet: 'BookTok / Goodreads Reader',
      icon: '📱',
      scale: 'stars_5_decimal',
      voice: 'Enthusiastic, personal, first-person, casual. Knows every trope by name. Uses "I" throughout.',
      word_target: '100-150 words',
      format_notes: 'Names tropes. Describes emotional reactions ("I was SCREAMING," "I had to put this down").',
      priorities: 'Emotional impact, vibes, pacing, whether it stuck the landing, the romance/stakes payoff.',
      rubric: `
  - 5.0: Book-of-the-year territory. Caused genuine emotional upheaval. Already re-reading.
  - 4.5-4.9: Loved it intensely. Would hand-sell. Hit every emotional beat.
  - 4.0-4.4: Really enjoyed. Some flaws but the emotional core worked. The default "I liked this" range.
  - 3.5-3.9: Fine, maybe solid, but forgettable. Not the book I'm going to think about next week.
  - 3.0-3.4: Meh. Readable but disappointing given the premise.
  - 2.0-2.9: Frustrating. DNF-adjacent. Wanted to like it, couldn't.
  - 1.0-1.9: Actively disliked. Bad execution or a broken emotional contract with the reader.
  - Use decimals. Most books sit 3.5-4.2. Be honest — Goodreads is full of inflated 5s, don't do that here.`,
      rating_to_numeric: null, // computed from decimal value directly
    },
    {
      outlet: genreMag,
      icon: '📖',
      scale: 'numeric_10',
      voice: `Genre expert with ~500 books in the ${genre || 'fiction'} canon in memory. Compares against in-genre standards, not generalist tastes.`,
      word_target: '200 words',
      format_notes: 'Names 2-3 in-genre comp titles. Assesses originality within the tradition, not novelty in a vacuum.',
      priorities: 'Genre conventions handled with competence, world-building discipline, tropes subverted vs played, freshness within tradition.',
      rubric: `
  - 9-10: Best-in-class for the subgenre this year. Moves the conversation.
  - 8: Standout. Above the top quartile of published in-genre titles.
  - 7: Above average. Competent + has at least one memorable distinguishing strength.
  - 6: Average genre execution. Hits the conventions. Doesn't transcend or flop.
  - 5: Below average. Conventional and forgettable OR ambitious but poorly executed.
  - 3-4: Notably weak — tropes bungled, pacing off, voice flat.
  - 1-2: Actively broken in ways an engaged genre reader will reject.
  - Most competent first novels score 6-7. 8+ requires a specific distinguishing strength the reviewer can name.`,
      rating_to_numeric: null, // multiply 0-10 rating by 10
    },
    {
      outlet: 'Literary Fiction Quarterly',
      icon: '🎓',
      scale: 'letter',
      voice: 'Academic, precise, demanding. Reads with a pencil. Unafraid to call work pedestrian.',
      word_target: '200 words',
      format_notes: 'Discusses sentence-level craft, structural logic, and what the book is doing symbolically or psychologically. Uses terms like "focalization," "register," "ironic distance."',
      priorities: 'Sentence craft, structural integrity, symbolic depth, psychological granularity, whether the prose rewards close reading.',
      rubric: `
  - A+: Rare. Prose is demonstrably ambitious and succeeds at that ambition. Structural intelligence visible on re-reading.
  - A: Excellent craft. The book knows what it is doing at the sentence AND structural level.
  - A-: Very good. Falls short of A in one dimension (often structure OR sentence craft, rarely both).
  - B+: Strong commercial fiction. Craft is solid but not ambitious; the book is not trying to be art.
  - B: Competent. Reads professionally but has nothing a literary reader would return to.
  - B-: Workmanlike with visible problems — tonal inconsistency, cliché reliance, or slack prose.
  - C+: Below the standard this outlet reviews. Structural or prose-level failures that an editor should have caught.
  - C / C-: Amateur-level craft issues on display throughout.
  - Default to B for competent genre work not aspiring to literary status. A- is the realistic ceiling for most well-crafted trade fiction.`,
      rating_to_numeric: {
        'A+': 97, 'A': 92, 'A-': 87,
        'B+': 78, 'B': 70, 'B-': 62,
        'C+': 52, 'C': 45, 'C-': 35,
        'D+': 25, 'D': 15,
        'F': 5,
      },
    },
  ];
}

/**
 * FICTION-specific panel additions (4 reviewers).
 */
function fictionReviewers() {
  return [
    {
      outlet: 'The Guardian Books',
      icon: '🇬🇧',
      scale: 'stars_5',
      voice: 'British literary sensibility. Dry wit, cultural awareness, devastating understatement when warranted.',
      word_target: '200-250 words',
      format_notes: 'May compare to British/international authors. Evaluates prose rhythm, narrative confidence. Can be very dry.',
      priorities: 'Prose elegance, narrative ambition, cultural perspective, whether the book transcends its genre.',
      rubric: `
  - ★★★★★: Exceptional. "Unmissable."
  - ★★★★: Very good. Flawed but worth recommending. Where most strong trade novels sit.
  - ★★★: Competent. "Not without its pleasures" territory.
  - ★★: Disappointing. "Falls short of its ambitions."
  - ★: Genuinely bad. Rarely used.
  - British reviewers are tighter than American — a 4-star Guardian review ≠ a 4-star US review. The bar is higher.`,
      rating_to_numeric: {
        '5': 92,
        '4': 75,
        '3': 55,
        '2': 32,
        '1': 12,
      },
    },
    {
      outlet: 'Indie Reader',
      icon: '📱',
      scale: 'stars_5',
      voice: 'Specifically evaluates indie/self-published work. Knows indie market realities — cover design, editing, Amazon categories, comp titles in KU.',
      word_target: '150-200 words',
      format_notes: 'Notes editing cleanliness. Discusses cover-to-content match. Names 1-2 indie bestsellers as comps. Flags production issues honestly.',
      priorities: 'Production quality, editing cleanliness, cover-to-content match, indie market comp positioning, whether it could hit indie bestseller lists.',
      rubric: `
  - ★★★★★ + IR APPROVED: Indie-published work at traditional-publishing quality level. Editing, prose, and market positioning all professional.
  - ★★★★ + IR APPROVED: Strong indie release. Minor flaws, not enough to reject.
  - ★★★ (not approved): Has reader appeal but needs another editing pass OR has market positioning issues.
  - ★★: Significant craft or production issues. Needs developmental edit before relaunch.
  - ★: Unpublishable in current state.
  - "IR APPROVED" is the threshold for recommendation — applies only at 4+ stars.`,
      rating_to_numeric: {
        '5': 90,
        '4': 74,
        '3': 52,
        '2': 30,
        '1': 10,
      },
    },
    {
      outlet: 'Sensitivity Reader',
      icon: '🤝',
      scale: 'verdict_4',
      voice: 'Evaluates representation, cultural authenticity, potential harm. Flags stereotypes and anachronistic cultural depictions. Not political — forensic.',
      word_target: '150-200 words',
      format_notes: 'Identifies SPECIFIC representation elements. Cites page numbers or chapter references when flagging.',
      priorities: 'Cultural accuracy, authentic representation, avoiding stereotypes, historical accuracy of social dynamics, consent dynamics.',
      rubric: `
  - NO CONCERNS: No flagged representation issues. Identity content either absent or handled with care.
  - MINOR NOTES: Small issues that wouldn't block publication. Perhaps a reductive detail or missed context.
  - REVISION RECOMMENDED: Patterns that would likely draw community criticism. Author should address before launch.
  - SIGNIFICANT CONCERNS: Material that poses real reputation or ethical risk. Must be addressed.
  - Default to NO CONCERNS or MINOR NOTES unless the manuscript actually contains flagged material. Do NOT manufacture concerns.`,
      rating_to_numeric: {
        'NO CONCERNS': 88,
        'MINOR NOTES': 72,
        'REVISION RECOMMENDED': 40,
        'SIGNIFICANT CONCERNS': 15,
      },
    },
    {
      outlet: 'AI Detection Analyst',
      icon: '🤖',
      scale: 'verdict_4',
      voice: 'Technical, forensic. Evaluates whether the prose reads as human-written. Looks for AI tells: em-dash overuse, stacked triplets, generic metaphor families, negative antithesis ("not X, but Y"), em-dashed asides, emotional-math phrasing.',
      word_target: '150-200 words',
      format_notes: 'Identifies SPECIFIC markers with short quoted examples. If no AI markers, says so directly.',
      priorities: 'Vocabulary originality, sentence structure variation, emotional specificity vs genericism, burstiness of prose, pattern frequency.',
      rubric: `
  - HIGHLY LIKELY HUMAN: No detectable AI markers OR markers present at frequencies consistent with human literary prose.
  - LIKELY HUMAN: Minor indicators (occasional em-dash cluster, one repeated phrase) but voice feels earned.
  - MIXED SIGNALS: Pattern inconsistencies — stretches of genuine voice alternating with formulaic scaffolding. Polish recommended.
  - LIKELY AI-GENERATED: Multiple AI-tell patterns at publisher-rejection frequencies. Needs substantial rewriting.
  - Be honest — polished AI output is still detectable. If em-dash density, triplet cadence, or generic metaphor clusters are present, flag them.`,
      rating_to_numeric: {
        'HIGHLY LIKELY HUMAN': 90,
        'LIKELY HUMAN': 72,
        'MIXED SIGNALS': 45,
        'LIKELY AI-GENERATED': 15,
      },
    },
  ];
}

/**
 * NONFICTION-specific panel additions (4 reviewers).
 */
function nonfictionReviewers() {
  return [
    {
      outlet: 'The Atlantic',
      icon: '🌊',
      scale: 'verdict_3',
      voice: 'Intellectual, politically aware, long-form journalism standard. Evaluates whether the book advances understanding or merely restates the known.',
      word_target: '200-250 words',
      format_notes: 'Frames the book within a cultural or political moment. Willing to be dismissive of competent-but-unoriginal work.',
      priorities: 'Depth of research, originality of argument, quality of evidence, cultural relevance.',
      rubric: `
  - ESSENTIAL: Advances a conversation. Original framing OR new evidence. Reader thinks differently after finishing.
  - RECOMMENDED: Solid journalism or scholarship. Useful addition to the topic even if not groundbreaking.
  - SKIP: Restates received wisdom. Competent prose, nothing new.
  - Default to RECOMMENDED. ESSENTIAL requires the reviewer to name the specific contribution.`,
      rating_to_numeric: {
        'ESSENTIAL': 92,
        'RECOMMENDED': 68,
        'SKIP': 30,
      },
    },
    {
      outlet: 'Library Journal',
      icon: '🏛️',
      scale: 'verdict_3',
      voice: 'Practical, collection-development focused. Speaks to librarians making purchase decisions.',
      word_target: '150 words',
      format_notes: 'Names audience. Names reading level. Compares to existing titles on the same topic already on shelves.',
      priorities: 'Audience fit, reference value, accessibility, comparison to existing titles.',
      rubric: `
  - ESSENTIAL: Core purchase. Libraries serving the topic's audience should own this.
  - RECOMMENDED: Solid addition if budget allows. Complements existing collection.
  - OPTIONAL: Niche or redundant with existing holdings. Purchase only on patron request.
  - Most nonfiction titles are RECOMMENDED or OPTIONAL. ESSENTIAL requires a specific reason (topic gap, authoritative author, primary source value).`,
      rating_to_numeric: {
        'ESSENTIAL': 88,
        'RECOMMENDED': 65,
        'OPTIONAL': 35,
      },
    },
    {
      outlet: 'Fact-Check Desk',
      icon: '🔍',
      scale: 'verdict_4',
      voice: 'Forensic, skeptical, evidence-focused. Not a traditional review — an audit of the factual claims.',
      word_target: '200 words',
      format_notes: 'Identifies 2-3 SPECIFIC claims. Evaluates their sourcing. Flags unattributed assertions, composite characters without disclosure, or statistics without citation.',
      priorities: 'Factual accuracy, source quality, attribution rigor, intellectual honesty.',
      rubric: `
  - VERIFIED: Named sources, datable events, quotations attributed. Claims traceable.
  - MOSTLY ACCURATE: Most claims sourced, occasional unattributed assertion, but no material errors caught.
  - CONCERNS FLAGGED: Multiple claims lacking citation OR composite characters used without disclosure OR statistics presented without source.
  - UNRELIABLE: Pattern of unsourced assertion or apparent factual error. Cannot recommend for readers seeking accurate information.
  - For investigative or exposé work: default to CONCERNS FLAGGED unless citation density is at journalism-standard levels (5+ specific sources per major claim).`,
      rating_to_numeric: {
        'VERIFIED': 92,
        'MOSTLY ACCURATE': 72,
        'CONCERNS FLAGGED': 38,
        'UNRELIABLE': 10,
      },
    },
    {
      outlet: 'Subject Matter Expert',
      icon: '🎓',
      scale: 'verdict_4',
      voice: "A specialist in the book's field. Evaluates whether the book gets domain details right.",
      word_target: '200 words',
      format_notes: 'Identifies domain-specific strengths AND errors. Notes terminology usage, procedural accuracy.',
      priorities: 'Domain accuracy, depth of understanding, terminology precision, procedural correctness.',
      rubric: `
  - AUTHORITATIVE: Author demonstrates mastery. Terminology precise, procedures accurate, context nuanced.
  - COMPETENT: Gets the important things right. Minor terminology or nuance errors.
  - SURFACE-LEVEL: Researched but doesn't show deep domain fluency. Errors of emphasis and context.
  - INACCURATE: Contains errors a specialist would immediately catch. Undermines the book's credibility.
  - Default to COMPETENT for researched trade nonfiction. AUTHORITATIVE is rare and requires specific evidence of depth.`,
      rating_to_numeric: {
        'AUTHORITATIVE': 92,
        'COMPETENT': 72,
        'SURFACE-LEVEL': 45,
        'INACCURATE': 18,
      },
    },
  ];
}

/**
 * EROTICA-specific panel additions (4 reviewers).
 */
function eroticaReviewers() {
  return [
    {
      outlet: 'Smart Bitches Trashy Books',
      icon: '💋',
      scale: 'letter',
      voice: 'Witty, sex-positive, romance-literate. Reviews with humor and genuine critical engagement.',
      word_target: '150-200 words',
      format_notes: 'Opens with a cheeky one-liner. Uses romance-reader vernacular.',
      priorities: 'Chemistry, consent clarity, originality of scenarios, emotional payoff, whether spice serves the story.',
      rubric: `
  - A+: Nearly perfect. Chemistry electric, emotional arc fully earned.
  - A: Excellent. Strong on all dimensions.
  - A-: Very good with minor quibbles.
  - B+: Solid romance with notable strengths. The default for well-crafted genre work.
  - B: Competent but not memorable.
  - B-: Has issues — pacing, chemistry, emotional arc.
  - C or below: Needs significant revision on craft or genre fundamentals.
  - Most published romance sits B+ to A-. A+ is rare.`,
      rating_to_numeric: {
        'A+': 95, 'A': 88, 'A-': 82,
        'B+': 72, 'B': 62, 'B-': 52,
        'C+': 42, 'C': 32, 'C-': 22,
        'D+': 15, 'D': 10,
        'F': 5,
      },
    },
    {
      outlet: 'Erotica Readers & Writers Association',
      icon: '🔥',
      scale: 'numeric_10',
      voice: 'Craft-focused erotica criticism. Treats erotica as a legitimate literary form.',
      word_target: '200 words',
      format_notes: 'Analyzes writing quality OF the explicit scenes — not whether they exist but whether they work as prose.',
      priorities: 'Prose quality in intimate scenes, sensory specificity, cliché avoidance, emotional interiority during physical scenes, pacing of tension/release.',
      rubric: `
  - 9-10: Literary-quality erotica. Sentence-level craft in explicit scenes equals the non-explicit prose.
  - 8: Standout. Strong prose + genre command.
  - 7: Above average. Explicit scenes work but have occasional cliché.
  - 6: Average genre execution. Scenes serve the story but prose is generic during them.
  - 5: Below average. Explicit scenes markedly weaker than surrounding prose.
  - 3-4: Cliché-heavy, vague anatomy, missing sensory interiority.
  - 1-2: Amateurish or broken in the genre-essential scenes.
  - Most competent erotica scores 6-7. 8+ requires identifiable prose strength in the explicit scenes.`,
      rating_to_numeric: null,
    },
    {
      outlet: 'Romance Reader Community',
      icon: '❤️‍🔥',
      scale: 'stars_5_decimal',
      voice: 'Passionate, trope-savvy romance reader. First person. Knows every trope by name.',
      word_target: '150 words',
      format_notes: 'Lists tropes present. Evaluates slow burn quality, chemistry, HEA/HFN satisfaction.',
      priorities: 'Trope execution, character chemistry, emotional arc, satisfying resolution, appropriate heat level.',
      rubric: `
  - 5.0: Re-reading immediately. Obsessed.
  - 4.5-4.9: Deeply loved. Top shelf for the trope combo.
  - 4.0-4.4: Really enjoyed. Some flaws but emotional core landed.
  - 3.5-3.9: Fine. Had issues I could list.
  - 3.0-3.4: Meh. Premise promised more than delivery.
  - 2.0-2.9: Frustrating. Broken emotional contract.
  - Most books 3.8-4.3. Be honest — don't inflate.`,
      rating_to_numeric: null,
    },
    {
      outlet: 'Content Advisory Review',
      icon: '⚠️',
      scale: 'verdict_3',
      voice: 'Neutral, informative, non-judgmental. Provides content warnings and audience fit assessment.',
      word_target: '100-150 words',
      format_notes: 'Lists content elements factually. States whether content warnings are needed.',
      priorities: 'Content accuracy, audience appropriateness, consent clarity, trigger identification.',
      rubric: `
  - CLEAR: Content is within genre expectations and does not require unusual advisories beyond standard heat level.
  - NOTES: Contains content readers may want warning of, handled responsibly.
  - ADVISORY REQUIRED: Contains content that MUST be disclosed — non-consent themes, on-page abuse, trauma content. Not a quality judgment; a disclosure judgment.
  - Default to CLEAR or NOTES. ADVISORY REQUIRED is for genuine disclosure needs.`,
      rating_to_numeric: {
        'CLEAR': 80,
        'NOTES': 70,
        'ADVISORY REQUIRED': 55,
      },
    },
  ];
}

/**
 * Select the full 10-reviewer panel for a given project.
 */
export function pickReviewerPanel(project, genre, projectType) {
  const g = (genre || '').toLowerCase();
  const t = (projectType || '').toLowerCase();
  const isNonfiction = t === 'nonfiction' || g.includes('nonfiction') || g.includes('non-fiction')
    || g.includes('history') || g.includes('true crime') || g.includes('biography')
    || g.includes('self-help') || g.includes('investigative');
  const isErotica = t === 'erotica' || g.includes('erotica') || g.includes('adult');

  const core = buildCoreReviewers(genre);
  const domain = isNonfiction
    ? nonfictionReviewers()
    : isErotica
    ? eroticaReviewers()
    : fictionReviewers();

  return [...core, ...domain];
}

/* =============================================================================
 * PER-REVIEWER PROMPT BUILDER
 * ========================================================================== */

/**
 * Build a SCALE INSTRUCTION block. Each scale type has a different output
 * contract — we tell the LLM exactly what values are valid for this reviewer.
 * Also mandates `rating_numeric` 0-100 so the consensus calc has a uniform
 * anchor regardless of native scale.
 */
function buildScaleInstruction(scale) {
  switch (scale) {
    case 'kirkus':
      return `Rating field must be exactly one of: "STARRED", "RECOMMENDED", or "unmarked".`;
    case 'stars_4':
      return `Rating field must be a string representing stars: "1", "1.5", "2", "2.5", "3", "3.5", or "4". Half-stars encouraged.`;
    case 'stars_5':
      return `Rating field must be a string: "1", "2", "3", "4", or "5" (integer stars).`;
    case 'stars_5_decimal':
      return `Rating field must be a decimal string 1.0-5.0 to one decimal place (e.g. "4.3"). Do NOT round to halves.`;
    case 'numeric_10':
      return `Rating field must be an integer string "1" through "10".`;
    case 'letter':
      return `Rating field must be one of: "A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D", or "F".`;
    case 'nyt':
      return `Rating field must be exactly one of: "ACQUIRE", "REVIEW", or "PASS".`;
    case 'verdict_3':
      return `Rating field must be exactly one of the three verdict strings listed in the rubric above. Do not invent alternatives.`;
    case 'verdict_4':
      return `Rating field must be exactly one of the four verdict strings listed in the rubric above. Do not invent alternatives.`;
    default:
      return `Rating field: follow the rubric.`;
  }
}

/**
 * Build a prompt for ONE reviewer's independent evaluation.
 * Context contains: title, genre, wordCount, excerpt, authorName, projectType, isAnthology, anthologyTheme.
 */
export function buildReviewerPrompt(reviewer, context) {
  const {
    title, genre, wordCount, excerpt, authorName,
    projectType, isAnthology, anthologyTheme,
    isSeries, seriesName, seriesNumber, priorVolumeTitle,
    seriesUnresolvedThreads, seriesResolvedThreads,
    seriesDeathsAndLosses, seriesSecretsRevealed, seriesLastBookEnding,
    isMultiPov,
  } = context;

  const anthologyBlock = isAnthology ? `
This manuscript is an ANTHOLOGY — a collection of standalone short stories unified by a shared theme: "${anthologyTheme}". Each chapter is an independent story. There are NO recurring characters between chapters. There is NO continuous plot arc. Disconnected storylines are INTENTIONAL, not a flaw.

The excerpt below contains openings and closings of every story (marked with "STORY N: Title" headers). You have visibility into the full collection.

IN YOUR REVIEW, YOU MUST ADDRESS:
  - At least one named standout story with one-sentence reasoning.
  - At least one named weakest story (or state explicitly that no story falls below).
  - Whether the tonal range across stories is MONOCHROMATIC / VARIED / FATIGUING.
  - Whether any two stories feel redundant (same plot mechanic or archetype).
  - Whether the opening story hooks and the closing story resolves the collection.

Do NOT criticize: lack of recurring characters, tonal shifts between chapters, absence of overarching plot. These are anthology features.
` : '';

  // ==========================================================================
  // SERIES CONTEXT BLOCK — injected when the manuscript is Volume N (N > 1)
  // of a multi-book series. Reviewers must be briefed that open threads and
  // prior character context are INTENTIONAL features of a series entry, not
  // failures of this volume to stand alone.
  // ==========================================================================
  const seriesBlock = isSeries ? `
This manuscript is VOLUME ${seriesNumber || '?'} of a multi-book series${seriesName ? ` titled "${seriesName}"` : ''}${priorVolumeTitle ? `. The previous volume was "${priorVolumeTitle}"` : ''}. It is NOT a standalone novel. Readers of this volume are expected to have read the prior volume(s).

${seriesLastBookEnding ? `PRIOR VOLUME ENDED: ${String(seriesLastBookEnding).substring(0, 400)}` : ''}

${Array.isArray(seriesResolvedThreads) && seriesResolvedThreads.length ? `THREADS ALREADY RESOLVED in the prior volume (do NOT flag their closure as missing from this book — they concluded earlier):
${seriesResolvedThreads.slice(0, 15).map((t, i) => `  ${i + 1}. ${typeof t === 'string' ? t : JSON.stringify(t)}`).join('\n')}` : ''}

${Array.isArray(seriesUnresolvedThreads) && seriesUnresolvedThreads.length ? `THREADS INTENTIONALLY LEFT OPEN coming into this volume (do NOT criticize this volume for "incomplete plot" if these remain open; they are series-arc threads, expected to pay off across multiple volumes):
${seriesUnresolvedThreads.slice(0, 15).map((t, i) => `  ${i + 1}. ${typeof t === 'string' ? t : JSON.stringify(t)}`).join('\n')}` : ''}

${Array.isArray(seriesDeathsAndLosses) && seriesDeathsAndLosses.length ? `PERMANENT DEATHS/LOSSES from prior volume(s) (these characters cannot appear alive in this volume; do NOT flag their absence as a craft problem):
${seriesDeathsAndLosses.slice(0, 10).map((d, i) => `  ${i + 1}. ${typeof d === 'string' ? d : JSON.stringify(d)}`).join('\n')}` : ''}

${Array.isArray(seriesSecretsRevealed) && seriesSecretsRevealed.length ? `FACTS THE READER ALREADY KNOWS going into this volume (do NOT flag re-revelation of these as redundant only if this volume repeats them; DO flag if this volume treats them as fresh reveals for a first-time reader):
${seriesSecretsRevealed.slice(0, 10).map((s, i) => `  ${i + 1}. ${typeof s === 'string' ? s : JSON.stringify(s)}`).join('\n')}` : ''}

IN YOUR REVIEW, YOU MAY AND SHOULD ADDRESS:
  - Whether this volume justifies its existence within the series arc (does it advance the overarching story or feel like filler?).
  - Whether the opening onboards continuing readers adequately without heavy exposition dumps.
  - Whether the closing sets up the next volume or stands as its own resolution point.
  - Whether character growth this volume builds on, or contradicts, the prior volume's arc.

DO NOT CRITICIZE THIS VOLUME FOR:
  - Unresolved plot threads that are listed above as intentionally open series-arc threads.
  - Character relationship states or backstory references that rely on the prior volume.
  - Lack of full closure at the ending if the series is still in progress.
  - The absence of characters listed above as permanently dead/lost.

Weight this volume's rating relative to in-series craft expectations, not standalone novel expectations.
` : '';

  // ==========================================================================
  // MULTI-POV CONTEXT BLOCK — injected when the manuscript is configured as
  // third-person multiple POV. Voice, diction, rhythm, and register WILL vary
  // legitimately between POV characters. Without this brief, reviewers flag
  // intentional per-character voice variation as "voice inconsistency" or
  // (for the AI Detection Analyst) as "pattern inconsistencies — stretches of
  // genuine voice alternating with formulaic scaffolding" — tanking the score
  // on the exact architectural feature the author chose.
  // ==========================================================================
  const multiPovBlock = isMultiPov ? `
This manuscript is configured as THIRD-PERSON MULTIPLE POV. Different chapters and different scenes are written from different POV characters. Voice, diction, sentence rhythm, interior-monologue register, and vocabulary LEGITIMATELY VARY between POV sections. That variation is the intended architecture of the book, not a flaw in voice control or a sign of AI generation.

${reviewer.outlet === 'AI Detection Analyst' ? `SPECIAL NOTE FOR AI DETECTION ANALYSIS:
A multi-POV book will naturally show "stretches of voice alternating" across its POV characters. That alternation is DELIBERATE and authorial — not the "pattern inconsistency" marker of AI scaffolding. When you evaluate this manuscript for AI markers, you must distinguish:

  - AI scaffolding = the SAME character's voice wobbling within their own scenes (rhythm suddenly flattening, vocabulary genericizing mid-paragraph, emotional specifics replaced by abstract phrasing).
  - Multi-POV architecture = DIFFERENT characters sounding different from each other across POV sections. This is craft, not a tell.

Do NOT rate this book "MIXED SIGNALS" on the basis of voice alternating between POV characters. Do rate it "MIXED SIGNALS" if a single character's voice degrades within their own scenes.

Evaluate voice stability WITHIN each POV character, not ACROSS them.
` : ''}
IN YOUR REVIEW, YOU MAY AND SHOULD ADDRESS:
  - Whether each POV character has a DISTINCTIVE and consistent voice of their own (they should sound different from each other but consistent within themselves).
  - Whether POV transitions are clean (scene breaks, chapter boundaries) or whether the prose head-hops mid-scene (a real flaw, flag it).
  - Whether any POV characters are underdeveloped compared to others.

DO NOT CRITICIZE THIS MANUSCRIPT FOR:
  - Voice varying between POV characters — that is the form.
  - Register shifts between chapters whose POV owners differ — also the form.
  - Vocabulary differences between POV sections (a formal character vs. a colloquial one, an adult vs. a teen, a scientist vs. a soldier).
  - Sentence-rhythm differences tied to which character's head the reader is in.

DO still criticize:
  - Head-hopping within a single scene without a * * * break.
  - A single POV character sounding inconsistent across their own scenes.
  - Clinical descriptors ("the man," "the woman") replacing names.
  - Tense drift (past → present or vice versa) — tense must stay stable regardless of POV owner.
` : '';

  return `You are a SINGLE reviewer for ${reviewer.outlet}. You are evaluating this manuscript independently — you have not seen any other reviewer's verdict. Base your rating strictly on the textual evidence in the excerpt below and on the rubric provided. Do not anchor to what you imagine a "consensus" would be.

${anthologyBlock}${seriesBlock}${multiPovBlock}
══════════════════════════════════════════════════════════════════
MANUSCRIPT UNDER REVIEW
══════════════════════════════════════════════════════════════════

Title: ${title || 'Untitled'}
Author: ${authorName}
Genre: ${genre || 'Fiction'}
Type: ${projectType || 'fiction'}
Word count: ${wordCount.toLocaleString()}

EXCERPT:
${excerpt}

══════════════════════════════════════════════════════════════════
YOUR ROLE: ${reviewer.outlet}
══════════════════════════════════════════════════════════════════

VOICE: ${reviewer.voice}

WORD TARGET: ${reviewer.word_target}

FORMAT NOTES: ${reviewer.format_notes}

CRITICAL PRIORITIES: ${reviewer.priorities}

RATING RUBRIC (anchor your score here — do not improvise):
${reviewer.rubric}

══════════════════════════════════════════════════════════════════
OUTPUT CONTRACT
══════════════════════════════════════════════════════════════════

${buildScaleInstruction(reviewer.scale)}

You MUST also provide a rating_numeric — an integer 0-100 representing your overall verdict on a universal quality scale, INDEPENDENT of your native rating label. Use these anchors:
  - 90-100: Exceptional. Top 5% of published work in this genre/format.
  - 75-89: Strong. Above the median of published work.
  - 60-74: Competent. At or slightly above the published-work median.
  - 45-59: Below median. Readable but with notable weaknesses.
  - 25-44: Struggles. Significant craft or execution problems.
  - 0-24: Broken. Not publishable without major rework.

The rating_numeric must be CONSISTENT with your native rating — do not give "STARRED" + 40, or "PASS" + 85. They must agree.

══════════════════════════════════════════════════════════════════
AUDIENCE SCORE PREDICTION (REQUIRED — separate from your critic rating)
══════════════════════════════════════════════════════════════════

In addition to your own critic rating, you must ALSO predict how the general reading public would rate this book. Audience scores and critic scores often DIVERGE — sometimes substantially. Your audience prediction should reflect that honestly, based on your expertise in ${reviewer.outlet}'s genre lane.

Audiences and critics weight different things:
  - Audiences reward: emotional hooks, trope satisfaction, clear stakes, momentum, satisfying endings, relatability, genre comfort, and "sticky" character moments.
  - Critics reward: prose craft, structural ambition, thematic depth, originality, and avoidance of cliché.

These weights often conflict. A tropey page-turner with flat prose might score: Critic 55 / Audience 85. A literary slow burn with thin plot might score: Critic 85 / Audience 50. A broken book scores low on both. A transcendent book scores high on both.

Your audience_prediction must be an integer 0-100 representing your honest projection of how general readers would rate this book, using the same 0-100 anchors as your own rating_numeric:
  - 90-100: Broad love. Word-of-mouth hit, Goodreads darling.
  - 75-89: Strong audience reception. Solid 4-star average on Goodreads.
  - 60-74: Liked by the target audience. ~3.8 star average. Readers don't complain but don't evangelize.
  - 45-59: Mixed. Divided reception. Many DNFs and mid reviews.
  - 25-44: Disappointing. Few defenders. Reader frustration dominant.
  - 0-24: Rejected by audiences. Widespread pans.

You must also provide audience_reasoning: a ONE-sentence explanation of why audiences would score this higher, lower, or equal to your critic rating. Be specific about the emotional or commercial factor driving the divergence (or agreement). Examples:
  - "Audiences will score this higher — the trope execution is tight and the emotional arc lands, even if the prose is pedestrian."
  - "Audiences will score this lower — the structural ambition impresses critically but the pacing will lose casual readers by chapter 4."
  - "Critic and audience scores should align here — the book is competent across both craft and commercial dimensions without excelling at either."

WRITING RULES:
1. Reference SPECIFIC elements — character names, plot points, prose passages, story titles. No generic praise or criticism.
2. Write as this outlet. Match the register. For ${reviewer.outlet}, that means: ${reviewer.voice}
3. The author is "${authorName}" — NOT any character name in the excerpt.
4. Do not mention being AI, a model, or a simulated reviewer. You are ${reviewer.outlet}.
5. Your review must stand alone — do not reference "the other reviewers" or "the panel."
6. If the manuscript has weaknesses, name them specifically. Do not inflate.
7. If the manuscript has strengths, name them specifically. Do not deflate.
8. Your audience_prediction must be INDEPENDENT of your own rating — if critics and audiences diverge on this book, let the divergence show.

Respond ONLY in JSON. No markdown, no backticks.

{
  "outlet": "${reviewer.outlet}",
  "icon": "${reviewer.icon}",
  "rating_label": "[your rating per the scale instruction above]",
  "rating_numeric": [integer 0-100 per the anchors above],
  "rating_display": "[how this reviewer usually displays the rating, e.g. '★★★★' or 'STARRED' or 'A-' or '7/10']",
  "review": "[${reviewer.word_target} review in this outlet's voice]",
  "summary_line": "[one-sentence pull quote, or empty string if not customary for this outlet]",
  "audience_prediction": [integer 0-100 predicted audience score],
  "audience_reasoning": "[one sentence explaining expected critic/audience divergence or alignment]",
  "commercial_eval": {
    "firstLineHook": [0-10],
    "scenePressure": [0-10],
    "characterDesire": [0-10],
    "conflictClarity": [0-10],
    "voice": [0-10],
    "specificity": [0-10],
    "subtext": [0-10],
    "pacing": [0-10],
    "endingTurn": [0-10],
    "genreFit": [0-10],
    "marketability": [0-10],
    "aiSmoothnessAbsence": [0-10]
  },
  "topFixes": ["[max 5 specific actionable revision instructions, ranked by impact]"]
}`;
}

/* =============================================================================
 * SINGLE-REVIEWER RESPONSE SCHEMA
 * ========================================================================== */

export const REVIEWER_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    outlet: { type: 'string' },
    icon: { type: 'string' },
    rating_label: { type: 'string' },
    rating_numeric: { type: 'number' },
    rating_display: { type: 'string' },
    review: { type: 'string' },
    summary_line: { type: 'string' },
    audience_prediction: { type: 'number' },
    audience_reasoning: { type: 'string' },
    // Commercial evaluation dimensions (0-10 each, optional)
    commercial_eval: {
      type: 'object',
      properties: {
        firstLineHook: { type: 'number', description: '0-10: Does the opening sentence compel reading?' },
        scenePressure: { type: 'number', description: '0-10: Consistent scene-level tension/stakes' },
        characterDesire: { type: 'number', description: '0-10: Clear character want driving chapters' },
        conflictClarity: { type: 'number', description: '0-10: Central conflict immediately comprehensible' },
        voice: { type: 'number', description: '0-10: Distinctive, author-owned prose voice' },
        specificity: { type: 'number', description: '0-10: Concrete details vs. generic abstraction' },
        subtext: { type: 'number', description: '0-10: Characters say one thing, mean another' },
        pacing: { type: 'number', description: '0-10: Scene length/rhythm variation, no stalls' },
        endingTurn: { type: 'number', description: '0-10: Final chapter delivers surprise/payoff' },
        genreFit: { type: 'number', description: '0-10: Meets genre reader expectations' },
        marketability: { type: 'number', description: '0-10: Bookseller hand-sell potential' },
        aiSmoothnessAbsence: { type: 'number', description: '0-10: Prose avoids AI-detection patterns' },
      },
    },
    // Top concrete revision instructions (max 5)
    topFixes: {
      type: 'array',
      items: { type: 'string' },
      description: 'Up to 5 specific, actionable revision instructions ranked by impact',
    },
  },
  required: ['outlet', 'rating_label', 'rating_numeric', 'review', 'audience_prediction'],
};

/* =============================================================================
 * DETERMINISTIC CONSENSUS CALCULATION
 * ========================================================================== */

/**
 * Clamps a value to 0-100 and rounds to an integer, with a neutral fallback
 * for missing or non-numeric inputs.
 */
function clampScore(n, fallback = 50) {
  const num = Number(n);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(0, Math.min(100, Math.round(num)));
}

/**
 * Compute a Rotten-Tomatoes-style aggregate from an array of scores.
 * Returns { percent_fresh, average_stars, fresh_count, rotten_count, total_reviews }.
 *
 * percent_fresh = % of scores >= 60
 * average_stars = mean score mapped to 1-5 scale (50 → 3.0)
 */
function aggregateScores(scores) {
  const total = scores.length;
  if (total === 0) {
    return { percent_fresh: 0, average_stars: 0, fresh_count: 0, rotten_count: 0, total_reviews: 0 };
  }
  const fresh = scores.filter((s) => s >= 60).length;
  const mean = scores.reduce((a, b) => a + b, 0) / total;
  return {
    percent_fresh: Math.round((fresh / total) * 100),
    average_stars: Math.round((1 + (mean / 100) * 4) * 10) / 10,
    fresh_count: fresh,
    rotten_count: total - fresh,
    total_reviews: total,
  };
}

/**
 * Produce a one-line summary string keyed off a percent-fresh value.
 * Different wording for critic vs audience so the two consensuses read
 * distinctly in the UI.
 */
function oneLineSummary(pct, audience = false) {
  if (audience) {
    if (pct >= 90) return 'Projected word-of-mouth hit with near-universal reader love.';
    if (pct >= 75) return 'Strong projected reader reception; target audience satisfied.';
    if (pct >= 60) return 'Majority-positive projected audience response.';
    if (pct >= 40) return 'Divided projected audience response; reader satisfaction uneven.';
    if (pct >= 20) return 'Projected audience disappointment; few reader defenders.';
    return 'Projected near-universal reader rejection.';
  }
  if (pct >= 90) return 'Near-universal critical acclaim.';
  if (pct >= 75) return 'Broad critical approval with minor dissent.';
  if (pct >= 60) return 'Majority-positive reception; meaningful criticism present.';
  if (pct >= 40) return 'Mixed critical reception; strengths and weaknesses both named.';
  if (pct >= 20) return 'Predominantly negative critical reception.';
  return 'Near-universal critical rejection.';
}

/**
 * Given the array of completed reviews, compute BOTH a critic consensus
 * and an audience consensus. Returns a single consensus object with both
 * sets of aggregates plus a divergence summary.
 *
 * The LLM cannot influence these numbers — they are computed in JS from the
 * individual rating_numeric (critic) and audience_prediction (audience)
 * values each reviewer supplied.
 */
export function computeConsensus(reviews) {
  if (!reviews?.length) {
    return {
      // Legacy top-level fields preserved for backward compat with any code
      // reading consensus.percent_fresh directly
      percent_fresh: 0,
      average_stars: 0,
      one_line: 'No reviews available.',
      fresh_count: 0,
      rotten_count: 0,
      total_reviews: 0,
      // New structured critic / audience split
      critic: { percent_fresh: 0, average_stars: 0, fresh_count: 0, rotten_count: 0, total_reviews: 0, one_line: 'No reviews available.' },
      audience: { percent_fresh: 0, average_stars: 0, fresh_count: 0, rotten_count: 0, total_reviews: 0, one_line: 'No reviews available.' },
      divergence: { gap: 0, label: 'No data', direction: 'neutral' },
    };
  }

  // Critic scores — from each reviewer's own rating_numeric
  const criticScores = reviews.map((r) => clampScore(r.rating_numeric, 50));
  const criticAgg = aggregateScores(criticScores);
  const criticOneLine = oneLineSummary(criticAgg.percent_fresh, false);

  // Audience scores — from each reviewer's audience_prediction
  // (fall back to critic score if missing/broken, and note it in logs)
  const audienceScores = reviews.map((r, i) => {
    if (r.audience_prediction == null || !Number.isFinite(Number(r.audience_prediction))) {
      console.warn('[CRITIC] Reviewer', i, '(' + (r.outlet || 'unknown') + ') missing audience_prediction; falling back to critic score');
      return criticScores[i];
    }
    return clampScore(r.audience_prediction, criticScores[i]);
  });
  const audienceAgg = aggregateScores(audienceScores);
  const audienceOneLine = oneLineSummary(audienceAgg.percent_fresh, true);

  // Divergence: audience - critic. Positive = audience loves it more,
  // negative = critics love it more.
  const gap = audienceAgg.percent_fresh - criticAgg.percent_fresh;
  let divergenceLabel, direction;
  if (Math.abs(gap) < 10) {
    divergenceLabel = 'Critics and audiences aligned.';
    direction = 'aligned';
  } else if (gap >= 30) {
    divergenceLabel = 'Major audience preference — a populist winner critics will underweight.';
    direction = 'audience_favored';
  } else if (gap >= 10) {
    divergenceLabel = 'Audiences will rate this more generously than critics.';
    direction = 'audience_favored';
  } else if (gap <= -30) {
    divergenceLabel = 'Major critical preference — a literary success audiences may not reward.';
    direction = 'critic_favored';
  } else {
    divergenceLabel = 'Critics will rate this more generously than audiences.';
    direction = 'critic_favored';
  }

  return {
    // Legacy top-level fields (critic, for any backward-compat consumer)
    percent_fresh: criticAgg.percent_fresh,
    average_stars: criticAgg.average_stars,
    one_line: criticOneLine,
    fresh_count: criticAgg.fresh_count,
    rotten_count: criticAgg.rotten_count,
    total_reviews: criticAgg.total_reviews,

    // NEW: structured critic + audience + divergence
    critic: { ...criticAgg, one_line: criticOneLine },
    audience: { ...audienceAgg, one_line: audienceOneLine },
    divergence: { gap, label: divergenceLabel, direction },
  };
}