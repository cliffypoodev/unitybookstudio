/**
 * Publishing Prompts Library
 *
 * Centralizes every generator used by the Publishing tab. Each item is a
 * recipe that declares:
 *   - id:          stable key used for state and persistence
 *   - label:       display name
 *   - description: short helper text (one line)
 *   - emoji:       visual tag
 *   - section:     which of the 5 sections it lives in
 *   - outputKind:  'text' | 'html' | 'json' — controls rendering
 *   - target:      optional word/char/item count target for the UI to show
 *   - schema:      optional JSON schema for structured outputs
 *   - buildPrompt: (ctx, nf) => prompt string
 *
 * FICTION vs NONFICTION BRANCHING
 *
 * Most prompts branch internally based on the `nf` flag. The caller passes
 * `nf = true` for nonfiction projects (project_type/book_type contains
 * 'non'), and the prompt constructor selects the appropriate voice,
 * structure, and vocabulary. For example, a query letter for a novel
 * leads with hook + character + stakes; a query letter for nonfiction
 * leads with thesis + evidence + audience + author platform.
 *
 * PERSISTENCE
 *
 * Most items store their output in `project.publishing_package` — a single
 * JSON object keyed by item id. This keeps schema churn to a minimum: adding
 * a new publishing item requires zero entity changes. Three legacy fields
 * are kept for backward compat: amazon_description (pre-existing), and
 * kdp_categories (pre-existing). The publishing_package entry for those
 * mirrors the legacy field so either read path works.
 *
 * See FIELD_MAP below for the item-id → project-field mapping.
 */

/* =============================================================================
 * FIELD MAPPING
 * ========================================================================== */

/**
 * For persistence: where on the NovelProject entity does this item live?
 *
 *  - 'package' items go into the shared `publishing_package` JSON object
 *  - named fields have their own top-level column (legacy or special-case)
 */
export const FIELD_MAP = {
  query_letter:      { field: 'publishing_package', key: 'query_letter' },
  synopsis:          { field: 'publishing_package', key: 'synopsis' },
  author_bio:        { field: 'publishing_package', key: 'author_bio' },
  comp_titles:       { field: 'publishing_package', key: 'comp_titles' },
  amazon_desc:       { field: 'amazon_description' }, // legacy top-level string
  kdp_categories:    { field: 'kdp_categories' },     // legacy top-level JSON string
  kdp_keywords:      { field: 'publishing_package', key: 'kdp_keywords' },
  pricing_strategy:  { field: 'publishing_package', key: 'pricing_strategy' },
  blurb:             { field: 'publishing_package', key: 'blurb' },
  media_kit:         { field: 'publishing_package', key: 'media_kit' },
  social_kit:        { field: 'publishing_package', key: 'social_kit' },
  review_request:    { field: 'publishing_package', key: 'review_request' },
  newsletter:        { field: 'publishing_package', key: 'newsletter' },
  arc_email:         { field: 'publishing_package', key: 'arc_email' },
  preorder_copy:     { field: 'publishing_package', key: 'preorder_copy' },
  launch_checklist:  { field: 'launch_checklist' },   // JSON array of {id, label, done}
  series_bible:      { field: 'publishing_package', key: 'series_bible' },
  title_brainstorm:  { field: 'publishing_package', key: 'title_brainstorm' },
  isbn_ebook:        { field: 'isbn_ebook' },
  isbn_paperback:    { field: 'isbn_paperback' },
  isbn_hardcover:    { field: 'isbn_hardcover' },
  agent_queries:     { field: 'agent_queries' },      // JSON array
};

/* =============================================================================
 * SECTIONS
 * ========================================================================== */

export const PUB_SECTIONS = [
  {
    id: 'submission',
    label: 'Submission Materials',
    emoji: '📮',
    description: 'Query letters, synopsis, author bio, and comparable titles for literary agent submissions.',
  },
  {
    id: 'kdp',
    label: 'Amazon KDP Listing',
    emoji: '🛒',
    description: 'Everything you need to publish the book on Amazon.',
  },
  {
    id: 'marketing',
    label: 'Marketing Copy',
    emoji: '📣',
    description: 'Back cover, media kit, social media, and review outreach.',
  },
  {
    id: 'launch',
    label: 'Launch Assets',
    emoji: '🚀',
    description: 'Pre-launch, launch day, and ARC distribution materials.',
  },
  {
    id: 'series',
    label: 'Series & Continuity',
    emoji: '📚',
    description: 'Series planning, ISBNs, and agent query tracking.',
  },
];

/* =============================================================================
 * HELPER: build a context block from project data
 * ========================================================================== */

/**
 * Extract the shared context string that every prompt includes. Kept compact —
 * Gemini handles long prompts fine but shorter contexts improve result
 * adherence to the format instructions that follow.
 */
export function buildProjectContext(project, chapters = [], mode = 'project', uploadSample = null) {
  if (mode === 'upload' && uploadSample) {
    return uploadSample;
  }
  if (!project) return '';
  const parts = [];
  parts.push(`Title: ${project.title || 'Untitled'}`);
  parts.push(`Genre: ${project.genre || 'General'}`);
  const projectType = (project.project_type || project.book_type || 'fiction').toLowerCase();
  parts.push(`Type: ${projectType}`);
  if (project.subgenre) parts.push(`Subgenre: ${project.subgenre}`);
  if (project.target_audience) parts.push(`Target Audience: ${project.target_audience}`);
  if (project.author_name) parts.push(`Author: ${project.author_name}`);
  if (project.tagline) parts.push(`Tagline: ${project.tagline}`);
  if (project.seed_concept) parts.push(`Premise: ${project.seed_concept}`);
  if (project.series_name) parts.push(`Series: ${project.series_name}${project.series_number ? `, Book ${project.series_number}` : ''}`);
  if (project.outline_md) parts.push(`Outline:\n${project.outline_md.substring(0, 3000)}`);
  if (project.characters_md) parts.push(`Characters:\n${project.characters_md.substring(0, 2000)}`);
  if (project.world_md) parts.push(`World/Setting:\n${project.world_md.substring(0, 2000)}`);

  const wordCount = chapters.reduce((s, c) => s + (c.word_count || 0), 0);
  parts.push(`Word Count: ~${wordCount.toLocaleString()}`);

  return parts.join('\n');
}

/* =============================================================================
 * PUBLISHING ITEMS — the full roster
 * ========================================================================== */

export const PUB_ITEMS = [
  /* ────────────────────────────────────────────────────────────────────── */
  /* SECTION 1: SUBMISSION MATERIALS                                        */
  /* ────────────────────────────────────────────────────────────────────── */

  {
    id: 'query_letter',
    label: 'Query Letter',
    emoji: '✉️',
    description: '300-word hook letter for literary agents.',
    section: 'submission',
    outputKind: 'text',
    target: { kind: 'words', max: 350 },
    buildPrompt: (ctx, nf) => nf
      ? `You are a nonfiction query letter specialist writing a 300-word query to literary agents. Produce ONLY the letter text — no preamble, no commentary.

STRUCTURE (follow in order):
1. SALUTATION: "Dear [Agent Name],"
2. HOOK (2-3 sentences): the thesis as a single provocative claim. What's at stake intellectually? Name a specific tension or gap in the existing conversation.
3. BOOK DESCRIPTION (100-125 words): core argument + structural approach (how the book is organized) + one vivid case study or piece of evidence that demonstrates the method.
4. AUDIENCE & MARKET (2 sentences): who reads this and WHY NOW. Name current events or cultural moments that make the book timely.
5. COMP TITLES (2 titles, 2-3 sentences): "My book will appeal to readers of X (AUTHOR, YEAR) and Y (AUTHOR, YEAR), but differs in..."
6. AUTHOR PLATFORM (50-75 words): credentials, prior publications, relevant experience, platform stats (newsletter subscribers, social following, affiliated institutions). This is ESSENTIAL for nonfiction.
7. CLOSING: manuscript word count, offer of full proposal on request, polite sign-off.

RULES:
- No "In my book" or "This book explores" clichés.
- Specific beats generic: name real people, places, numbers from the manuscript.
- Confident, professional tone. Never tentative.
- UNDER 350 words total.

BOOK DETAILS:
${ctx}`
      : `You are a query letter specialist writing a 300-word query to literary agents. Produce ONLY the letter text — no preamble, no commentary.

STRUCTURE (follow in order):
1. SALUTATION: "Dear [Agent Name],"
2. HOOK (2-3 sentences): the book's single most compelling tension in the protagonist's situation. Not the premise. The TENSION.
3. BOOK DESCRIPTION (100-125 words): protagonist + inciting incident + central conflict + stakes. In present tense. End on escalation, not resolution.
4. COMP TITLES (2 titles, 2-3 sentences): "My book will appeal to readers of X (AUTHOR, YEAR) and Y (AUTHOR, YEAR)." Briefly say why for each.
5. AUDIENCE LINE: genre + target reader + word count, in one sentence.
6. AUTHOR BIO (50-75 words): prior publications, relevant awards, MFA if applicable, why this author wrote this book. If nothing to list, keep it to 25 words about the author's connection to the material.
7. CLOSING: "The complete manuscript is available on request. Thank you for your consideration." Sign-off.

RULES:
- Present tense throughout the description.
- No rhetorical questions ("What happens when...?").
- No "In a world where..." openings.
- Name the protagonist by first name. Name the antagonist if there is one by nature (person, force, condition).
- Don't reveal the ending.
- UNDER 350 words total.

BOOK DETAILS:
${ctx}`,
  },

  {
    id: 'synopsis',
    label: 'Synopsis',
    emoji: '📄',
    description: '1–3 page full synopsis (reveals the ending — for agent submissions).',
    section: 'submission',
    outputKind: 'text',
    target: { kind: 'words', min: 500, max: 1200 },
    buildPrompt: (ctx, nf) => nf
      ? `You are a literary agent's assistant preparing a nonfiction book-proposal synopsis. Write in complete prose (no headers, no bullet points). 500-1000 words.

STRUCTURE:
PARAGRAPH 1 — HOOK: What is the thesis? What provocative idea or untold story drives this book? One paragraph of argumentative framing.

PARAGRAPHS 2-4 — STRUCTURE: How is the book organized? What are the major sections and arguments? What evidence, sources, or case studies does each section rely on? Walk through 3-5 key arguments the book makes, naming the evidence or story that anchors each.

PARAGRAPH 5 — AUDIENCE & MARKET: Who reads this? Name 2-3 comparable recent nonfiction titles and how this one differs in argument or method.

PARAGRAPH 6 — AUTHOR EXPERTISE: One paragraph on what makes this author positioned to write it, drawing from the tone, depth, and sourcing evident in the manuscript.

RULES:
- Present tense throughout.
- No rhetorical questions.
- State the book's CONCLUSION clearly — agents need to see the argument land.
- Confident, intellectually engaged tone.
- Do NOT include headers like "Part 1" or "Chapter 3." Prose only.

BOOK DETAILS:
${ctx}`
      : `You are a literary agent's assistant preparing a novel's synopsis. Write in complete prose (no bullet points, no section headers). 500-1000 words.

STRUCTURE:
PARAGRAPH 1 — SETUP: Who is the protagonist? Where and when are we? What's the status quo? What's the inciting incident that breaks it?

PARAGRAPHS 2-4 — RISING ACTION: Walk through the major story beats. Name the antagonist or antagonistic force. Describe the protagonist's choices and escalating complications. Focus on WHAT HAPPENS, not themes.

PARAGRAPH 5 — CLIMAX AND RESOLUTION: YES, reveal the ending in full. Agents need to see you can land the plane. Specify who lives, who dies, what changes, and how the central tension resolves.

PARAGRAPH 6 (optional) — THEMES: One paragraph on what the book ultimately argues or dramatizes. Keep brief.

RULES:
- Present tense throughout.
- Name no more than 3-4 characters by name. Use "the detective" or "his sister" for lesser characters.
- No rhetorical questions.
- No "In a world where..." openings.
- Don't tease — REVEAL the ending clearly.
- Confident, direct tone.

BOOK DETAILS:
${ctx}`,
  },

  {
    id: 'author_bio',
    label: 'Author Bio',
    emoji: '👤',
    description: '100-word professional bio in third person.',
    section: 'submission',
    outputKind: 'text',
    target: { kind: 'words', max: 130 },
    buildPrompt: (ctx, nf) => `Write a 100-word third-person professional author bio.

CONSTRUCTION RULES:
- Third person throughout ("She writes..." not "I write...").
- Use the author name exactly as given in the BOOK DETAILS.
- Open with what the author IS (profession, credentials), not what they "love" or "enjoy."
- List 1-2 prior publications if any appear in the BOOK DETAILS.
- ${nf
    ? 'Emphasize expertise, credentials, institutional affiliation, and research method. Name the topics they cover. Close with where they live or teach.'
    : 'Emphasize genre focus, publication history, and one distinctive biographical detail. Close with where they live (with a spouse, cat, or similar humanizing note is fine).'}
- 90-120 words total.
- No clichés ("passionate about storytelling", "avid reader").

BOOK DETAILS:
${ctx}

Output ONLY the bio paragraph. No commentary.`,
  },

  {
    id: 'comp_titles',
    label: 'Comp Titles',
    emoji: '📚',
    description: '5 comparable titles with reasoning for agent pitches.',
    section: 'submission',
    outputKind: 'text',
    buildPrompt: (ctx, nf) => nf
      ? `Generate 5 comparable titles (comps) for this nonfiction book. Format as a numbered list. For each comp provide: title, author, publication year, and 2-3 sentences explaining why it's a meaningful comp for pitching to agents.

SELECTION RULES:
- Pick comps published in the last 10 years (preferably last 5 unless landmark).
- Mix: 2 must be BESTSELLERS in the topic area (to show market), 2 should be critically respected mid-list (to show literary ambition), 1 should be a thought-leader / newsletter / podcast figure whose audience overlaps.
- Avoid comparing to Malcolm Gladwell unless the book is genuinely in that style — it's overused.
- For each comp, note what this book does SIMILARLY and what it does DIFFERENTLY. Agents use this to pitch to editors.

FORMAT:
1. TITLE by Author (YEAR)
   [2-3 sentences: similarity + differentiation]

2. ...

BOOK DETAILS:
${ctx}

Output ONLY the comp list.`
      : `Generate 5 comparable titles (comps) for this novel. Format as a numbered list. For each comp provide: title, author, publication year, and 2-3 sentences explaining why it's a meaningful comp for pitching to agents.

SELECTION RULES:
- Pick comps published in the last 5-10 years.
- Mix: 2 must be genre bestsellers (to show market), 2 should be critically respected within-genre titles (to show literary ambition), 1 can be cross-genre if it captures the tone or structure.
- Avoid comparing to The Girl on the Train, Gone Girl, or Gillian Flynn unless it's genuinely warranted — overused comps weaken query letters.
- For each comp, note TONE similarity and STRUCTURAL or THEMATIC differentiation. Agents want to know what shelf this sits on AND how it stands out.

FORMAT:
1. TITLE by Author (YEAR)
   [2-3 sentences: similarity + differentiation]

2. ...

BOOK DETAILS:
${ctx}

Output ONLY the comp list.`,
  },

  /* ────────────────────────────────────────────────────────────────────── */
  /* SECTION 2: AMAZON KDP LISTING                                          */
  /* ────────────────────────────────────────────────────────────────────── */

  {
    id: 'amazon_desc',
    label: 'Amazon Book Description',
    emoji: '🛍️',
    description: 'Full HTML description ready to paste into the KDP source input.',
    section: 'kdp',
    outputKind: 'html',
    target: { kind: 'chars', max: 4000 },
    postProcess: 'cleanAmazonHtml',
    buildPrompt: (ctx, nf) => `You are a professional book marketing copywriter specializing in Amazon KDP listings. Write a complete Amazon book description following the EXACT format below. This is a sales page. Your only job is to make the reader click "Buy Now."

REQUIRED STRUCTURE:
1. BOLD HOOK LINE: One powerful, evocative sentence in <b> tags that captures the core tension.
2. ${nf ? 'PROBLEM / GAP: 2-3 sentences establishing what the reader is missing, confused about, or unable to see clearly.' : 'SETTING & WORLD: 2-3 sentences establishing time, place, and atmosphere.'}
3. ${nf ? 'THE PROMISE: 3-4 sentences naming what THIS book delivers that others do not — argument, evidence, method, or untold story.' : 'PROTAGONIST: 3-4 sentences. Who they are, what they carry, why they are isolated or in conflict.'}
4. ${nf ? 'EVIDENCE / CASE STUDIES: 2-3 sentences naming 2-3 specific anecdotes, numbers, or named figures that demonstrate the book\'s method.' : 'INCITING PRESENCE: 2-3 sentences. Who or what arrives to disrupt the status quo.'}
5. ${nf ? 'STAKES FOR THE READER: 2-3 sentences on what understanding this book gives them — professional edge, personal clarity, cultural literacy, decision-making.' : 'RISING TENSION: 2-3 sentences. The world pushes back. Stakes escalate.'}
6. ${nf ? 'BOLD CLOSING QUESTION: One provocative question in <b> tags that the book answers.' : 'CRISIS POINT: 2-3 sentences. The moment everything breaks.'}
7. ${nf ? 'POSITIONING: 2-3 sentences in a new paragraph. Name the genre (popular history / investigative journalism / cultural criticism). What kind of book this is, what it is NOT.' : 'BOLD CLOSING QUESTION: One resonant question in <b> tags.'}
8. ${nf ? 'COMP AUTHORS: "Perfect for readers of <b>Author</b>, <b>Author</b>..." with context.' : 'BOOK POSITIONING: 2-3 sentences in a new paragraph. Genre positioning.'}
9. ${nf ? 'CLOSING LINE: A final memorable assertion using <i> and <b> tags.' : 'COMP AUTHORS: "Perfect for fans of <b>Author</b>, <b>Author</b>..." with genre context.'}
${!nf ? '10. CLOSING ITALIC TAGLINE: A final memorable line using <i> and <b> tags.' : ''}

FORMATTING RULES:
- Use <b>, <i>, and <br> tags ONLY. Separate paragraphs with <br><br>.
- Do NOT output any section headers or labels. The numbered structure above is invisible guidance.
- Specific, concrete details — never vague generalities.
- ${nf ? 'Direct address to the reader ("You will learn..." / "Until you read this, you cannot...").' : 'Present tense for fiction descriptions.'}
- No spoilers. Never reveal the ending.
- Never "In this book" / "This book explores" / "Join [character] as they".
- CRITICAL: UNDER 3,600 characters total (Amazon KDP limit is 4,000). Aim for 3,200-3,600.
- Output ONLY the description HTML. No markdown. No code fences. No explanation.

BOOK DETAILS:
${ctx}`,
  },

  {
    id: 'kdp_categories',
    label: 'KDP Browse Categories',
    emoji: '📂',
    description: '10 Amazon KDP browse paths for category selection (Kindle + paperback).',
    section: 'kdp',
    outputKind: 'json',
    schema: {
      type: 'object',
      properties: {
        categories: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              path: { type: 'string' },
              type: { type: 'string', enum: ['Kindle', 'Paperback', 'Both'] },
              strategy: { type: 'string' },
            },
            required: ['path', 'type', 'strategy'],
          },
        },
      },
      required: ['categories'],
    },
    buildPrompt: (ctx, nf) => `Generate Amazon KDP browse category paths for this book. Do NOT generate BISAC codes — Amazon KDP uses its own browse path system.

Amazon browse paths look like:
- Kindle Store > Kindle eBooks > Literature & Fiction > Historical Fiction
- Books > Christian Books & Bibles > Literature & Fiction > Historical
- Kindle Store > Kindle eBooks > ${nf ? 'Business & Money > Economics > Macroeconomics' : 'Mystery, Thriller & Suspense > Suspense'}

Generate EXACTLY 10 paths. Return as JSON.

Include a mix:
- 3-4 HIGH-TRAFFIC competitive categories (where the big audience is)
- 3-4 MID-TRAFFIC niche categories (where ranking is easier — smaller pond, bigger fish)
- 2-3 CROSS-GENRE categories to reach adjacent audiences
- Include BOTH Kindle Store and Books (paperback) paths — they are different trees
${nf ? '- For nonfiction, think carefully about WHICH shelf this book sits on. Topic alone is not enough — consider HOW the book approaches it (investigative, practical, academic, memoir-of-expertise).' : ''}

CRITICAL: Use ONLY real Amazon category paths. Do not invent paths. Do not use BISAC format.

BOOK DETAILS:
${ctx}`,
  },

  {
    id: 'kdp_keywords',
    label: 'KDP Keywords',
    emoji: '🔑',
    description: '7 keyword phrases, each under Amazon\'s 50-character limit.',
    section: 'kdp',
    outputKind: 'json',
    schema: {
      type: 'object',
      properties: {
        keywords: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              keyword: { type: 'string' },
              strategy: { type: 'string' },
            },
            required: ['keyword', 'strategy'],
          },
        },
      },
      required: ['keywords'],
    },
    buildPrompt: (ctx, nf) => `Generate EXACTLY 7 Amazon KDP keyword phrases for this book. Return as JSON.

AMAZON KDP RULES (CRITICAL — this is a strict platform limit):
- Each keyword STRING must be UNDER 50 CHARACTERS including spaces. Count carefully.
- A "keyword" on Amazon can be a phrase of multiple words (e.g., "psychological thriller for women").
- Keywords should be SEARCH TERMS real readers type into Amazon — not marketing descriptions.
- Do NOT repeat words that already appear in the book's title, subtitle, or category path — Amazon indexes those separately.
- Do NOT use trademarks, author names ("like Stephen King"), or "bestseller".
${nf ? `
NONFICTION KEYWORD STRATEGY:
- 2-3 keywords should name the TOPIC with qualifiers (e.g., "history of the federal reserve")
- 2-3 should name the READER JOB-TO-BE-DONE (e.g., "how money actually works")
- 1-2 should name the GENRE feel ("narrative nonfiction", "investigative journalism")
- Include year or decade if the book is historically anchored`
  : `
FICTION KEYWORD STRATEGY:
- 2-3 keywords should name the SUB-GENRE and mood (e.g., "slow burn romantic thriller")
- 2-3 should name TROPE or reader-recognized setup (e.g., "enemies to lovers", "locked room mystery")
- 1-2 should name AUDIENCE FIT ("for fans of", "women's book club fiction")
- Avoid genre names alone — "thriller" is too broad`}

For EACH keyword provide a one-sentence STRATEGY explaining why that keyword will bring the right readers.

BOOK DETAILS:
${ctx}`,
  },

  {
    id: 'pricing_strategy',
    label: 'Pricing Strategy',
    emoji: '💲',
    description: 'Suggested price points with reasoning (ebook, paperback, hardcover).',
    section: 'kdp',
    outputKind: 'text',
    buildPrompt: (ctx, nf) => `Recommend pricing strategy for this book on Amazon KDP. Consider genre norms, word count, author profile, launch vs steady state, and KDP royalty tiers.

FORMAT:
LAUNCH PRICING (first 30 days)
  Ebook: $X.XX — [reasoning — usually $0.99-$2.99 for visibility, with pre-order at lower price]
  Paperback: $XX.XX — [reasoning based on page count and genre]
  Hardcover: $XX.XX (optional) — [reasoning, skip if not recommended]

STEADY-STATE PRICING (post-launch)
  Ebook: $X.XX — [reasoning; must be $2.99-$9.99 to hit 70% KDP royalty tier]
  Paperback: $XX.XX
  Hardcover: $XX.XX

PROMOTIONAL PRICING
  Recommended: KDP Countdown Deals / Free Days / Price Pulsing cycles
  When to run: [specific cadence e.g., "quarterly 99-cent Countdown"]

COMP PRICING NOTES
  [2-3 sentences: how similar books in this genre price, recent trends]

${nf ? 'NONFICTION CONSIDERATIONS: Nonfiction buyers tolerate higher prices than fiction readers. Don\'t underprice expertise — $4.99-$7.99 steady ebook is reasonable for serious nonfiction.' : 'FICTION CONSIDERATIONS: Fiction ebook prices above $5.99 face resistance in most genres. $2.99-$4.99 is the sweet spot for indie fiction.'}

BOOK DETAILS:
${ctx}

Output ONLY the pricing recommendation. No commentary.`,
  },

  /* ────────────────────────────────────────────────────────────────────── */
  /* SECTION 3: MARKETING COPY                                              */
  /* ────────────────────────────────────────────────────────────────────── */

  {
    id: 'blurb',
    label: 'Back Cover Blurb',
    emoji: '📖',
    description: '150–200 word marketing copy for the physical back cover.',
    section: 'marketing',
    outputKind: 'text',
    target: { kind: 'words', min: 150, max: 220 },
    buildPrompt: (ctx, nf) => nf
      ? `Write 150-200 word back-cover marketing copy for a nonfiction book. This is what a reader sees when they pick up the paperback in a bookstore.

RULES:
- Open with a one-sentence provocation. Not "This book explores..." — something with teeth.
- Paragraph 2: what the reader will understand differently after reading (3-4 specific, concrete things).
- Paragraph 3: who the author is, briefly, and why they can deliver this (one sentence).
- Close with a one-line promise or a question the book answers.
- Avoid jargon, clichés, and "deeply researched" / "thought-provoking" marketing-speak.
- HARD LIMIT: 200 words. Aim for 170.

BOOK DETAILS:
${ctx}

Output ONLY the blurb text. No commentary, no section labels.`
      : `Write 150-200 word back-cover marketing copy for a novel. This is what a reader sees when they pick up the paperback in a bookstore.

RULES:
- Open with a one-sentence hook that drops the reader mid-situation. Name the protagonist by first name.
- Second beat: the inciting wound or choice.
- Third beat: the stakes — what will be lost or destroyed.
- Fourth beat: a provocative question or "but when X happens..." turn. DON'T tease the ending.
- Close with a short one-sentence promise line naming what kind of read this is.
- Present tense throughout.
- HARD LIMIT: 200 words. Aim for 170.

BOOK DETAILS:
${ctx}

Output ONLY the blurb text. No commentary, no section labels.`,
  },

  {
    id: 'media_kit',
    label: 'Media Kit',
    emoji: '📰',
    description: 'Press bio, elevator pitch, and interview Q&A for media outreach.',
    section: 'marketing',
    outputKind: 'text',
    buildPrompt: (ctx, nf) => `Generate a complete media kit for this book. This is what the author sends to podcasters, journalists, and bookstores.

FORMAT (five sections with these exact labels):

=== PRESS BIO (150 words) ===
A third-person bio suitable for a podcast show-notes page or press release. ${nf ? 'Emphasize subject-matter expertise, prior platform, institutional affiliations.' : 'Emphasize publishing history, genre focus, distinctive biographical hook.'}

=== ELEVATOR PITCH (60 words) ===
A one-paragraph pitch the author can deliver in under 30 seconds at a networking event or in a cold email intro.

=== SUGGESTED INTERVIEW QUESTIONS (6 questions) ===
Six questions a podcaster or journalist should ask. Mix: 2 foundational (what's the book, why this book), 2 substantive (specific topic dives the author can go deep on), 2 unexpected (personal, provocative, or surprising angle). Each as a complete sentence.

=== SAMPLE ANSWER (1 question, 150-200 words) ===
Pick ONE of the interview questions above and write the author's answer to it, in the author's voice as evident from the manuscript. This gives media outlets a preview of the author's speaking style.

=== CONTACT BLOCK ===
Name: [Author Name]
Email: [author@email.com]
Website: [url]
Social: [handles]
Speaking/Availability: [Available for interviews, podcasts, bookstore events, virtual or in-person]

BOOK DETAILS:
${ctx}

Output the full media kit with those exact === HEADERS ===.`,
  },

  {
    id: 'social_kit',
    label: 'Social Media Kit',
    emoji: '📱',
    description: 'Twitter/X, Instagram, and TikTok copy for book launch posts.',
    section: 'marketing',
    outputKind: 'json',
    schema: {
      type: 'object',
      properties: {
        twitter: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string' },
              text: { type: 'string' },
            },
            required: ['type', 'text'],
          },
        },
        instagram: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string' },
              caption: { type: 'string' },
              hashtags: { type: 'string' },
            },
            required: ['type', 'caption'],
          },
        },
        tiktok: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string' },
              hook: { type: 'string' },
              script: { type: 'string' },
            },
            required: ['type', 'hook', 'script'],
          },
        },
      },
      required: ['twitter', 'instagram', 'tiktok'],
    },
    buildPrompt: (ctx, nf) => `Generate a social media kit with launch-ready posts for Twitter/X, Instagram, and TikTok. Return as JSON.

TWITTER/X (generate 4 posts):
- 1 launch announcement (under 280 chars, include a hook + book link placeholder "[link]")
- 1 pull-quote style post (a key line or insight from the book)
- 1 behind-the-scenes (why I wrote this / what it took)
- 1 reader engagement post (a question that invites replies)
For each: { "type": "launch|quote|behind|engage", "text": "..." }

INSTAGRAM (generate 3 posts):
- 1 cover reveal caption (150-200 chars, emoji OK)
- 1 carousel announcement caption (3-6 slides worth of content teased in caption)
- 1 "currently reading" style caption from the author's perspective
For each: { "type": "cover|carousel|reading", "caption": "...", "hashtags": "#BookRelease #..." }
Include 8-12 hashtags relevant to ${nf ? 'the nonfiction topic and the bookstagram community' : 'the genre and bookstagram community'}.

TIKTOK (generate 3 posts):
- 1 "POV: you just read a book that..." style hook
- 1 "three things this book taught me" or "three things this book is about" list
- 1 "I wrote a book and..." behind-the-scenes story
For each: { "type": "pov|list|bts", "hook": "first 3 seconds of the video script", "script": "rest of the video script, 15-30 seconds of speech" }

${nf ? 'For nonfiction, TikTok should lean into specific claims / stats / untold stories from the book.' : 'For fiction, TikTok should lean into mood, tropes, and emotional hooks.'}

BOOK DETAILS:
${ctx}`,
  },

  {
    id: 'review_request',
    label: 'Review Request Email',
    emoji: '⭐',
    description: 'Template email to send ARC readers asking for reviews.',
    section: 'marketing',
    outputKind: 'text',
    buildPrompt: (ctx, nf) => `Write an email template asking an ARC reader to leave a review on Amazon and Goodreads after reading.

STRUCTURE:
Subject line: [specific, warm, not generic — mention the book title]

Body (150-200 words):
- Open warmly. Thank them by name placeholder "[First Name]".
- One sentence reminding them WHY you chose them as an ARC reader — specific to them.
- The ask: an honest review on Amazon AND Goodreads, ${nf ? 'ideally mentioning one insight from the book that stuck with them' : 'ideally mentioning a character or scene that stuck with them'}.
- Make it easy: include placeholder links "[Amazon review link]" and "[Goodreads review link]".
- Be clear: honest reviews only. Negative reviews are OK. No coercion.
- Close with offer: if they enjoyed the book, would they share about it on social and tag the author?
- Sign-off with warmth.

${nf ? 'For nonfiction, also mention that reviews help other readers who might benefit from the book\'s argument find it.' : 'For fiction, also mention that word-of-mouth from real readers is what drives indie fiction forward.'}

BOOK DETAILS:
${ctx}

Output ONLY the email (subject line + body). Include placeholder [bracketed fields] for personalization.`,
  },

  /* ────────────────────────────────────────────────────────────────────── */
  /* SECTION 4: LAUNCH ASSETS                                               */
  /* ────────────────────────────────────────────────────────────────────── */

  {
    id: 'newsletter',
    label: 'Newsletter Announcement',
    emoji: '📧',
    description: 'Email to the author\'s newsletter list announcing launch day.',
    section: 'launch',
    outputKind: 'text',
    buildPrompt: (ctx, nf) => `Write a launch-day email to the author's newsletter subscribers announcing the book is LIVE.

STRUCTURE:
Subject line: [specific, excited but not frantic — mention the book title]

Body (300-400 words):
- Open with a personal moment: where the author is right now, what launch day feels like.
- The announcement: the book is live. Include "[Amazon link]" placeholder.
- What this book IS: 2-3 sentences. ${nf ? 'The central argument / untold story the reader will walk away with.' : 'The emotional promise — what kind of read this is.'}
- WHY now: why did the author write this, why does it matter right now (tie to current events, cultural moment, personal moment).
- The ASK (three things, in order): 1) buy a copy if it sounds like them, 2) leave a review once they've read it, 3) share with one friend or colleague who'd love it.
- ${nf ? 'Bonus tier: mention if the author is available for podcast interviews or speaking engagements this month.' : 'Bonus tier: mention if there are launch events, book club kits, or a future book in the series.'}
- Sign off with warmth.

TONE:
- Personal, not corporate.
- Excited but grounded — readers can sense fake enthusiasm.
- Use the author's real voice: direct, not marketing-speak.

BOOK DETAILS:
${ctx}

Output ONLY the email (subject line + body).`,
  },

  {
    id: 'arc_email',
    label: 'ARC Distribution Email',
    emoji: '📨',
    description: 'Email to send ARC readers with the advance copy.',
    section: 'launch',
    outputKind: 'text',
    buildPrompt: (ctx, nf) => `Write an email to send ARC (advance reader copy) recipients that includes their free advance copy.

STRUCTURE:
Subject line: [warm, specific — something like "Your advance copy of [BOOK TITLE] is here"]

Body (200-250 words):
- Open warmly, address by "[First Name]".
- One sentence reminding them what this book is and why they signed up.
- The delivery: "Here's your advance copy. Attached as EPUB and PDF — let me know if you need another format."
- Reading timeline: "The book launches on [DATE]. I'd love for your review to be ready by then."
- What to do after: review on Amazon + Goodreads on launch day. Include "[Amazon review link]" and "[Goodreads review link]" placeholders.
- Optional permission: "If you enjoy it and want to share a quote or cover image on social, please do — tag me at [social handle]."
- Close: offer to answer any questions about the book. Sign off with warmth.

PLACEHOLDERS to include in the email for the user to fill in:
- [First Name]
- [DATE]
- [Amazon review link]
- [Goodreads review link]
- [social handle]

${nf ? 'For nonfiction, also mention that they can interview the author on their podcast/newsletter if they have one.' : ''}

BOOK DETAILS:
${ctx}

Output ONLY the email (subject line + body).`,
  },

  {
    id: 'preorder_copy',
    label: 'Pre-order Copy',
    emoji: '🎯',
    description: 'Short copy for pre-order announcements (social, website, newsletter).',
    section: 'launch',
    outputKind: 'text',
    target: { kind: 'words', max: 200 },
    buildPrompt: (ctx, nf) => `Write pre-order announcement copy for this book. Pre-order is DIFFERENT from launch — the goal is urgency ("secure your copy before release") and exclusivity, not purchase-now.

FORMAT (produce three versions):

=== SHORT (for social media, 60-80 words) ===
Two sentences hooking the book + a "pre-order now, drops [DATE]" line with a placeholder [link].

=== MEDIUM (for newsletter, 150-180 words) ===
Hook, brief setup, why pre-order matters (indie book visibility, algorithm signals), clear CTA with [link] placeholder. One sentence on what pre-order buyers get (if applicable — bonus content, ebook launch price, etc.).

=== LONG (for author website / landing page, 250-300 words) ===
Full pre-order announcement: hook + setup + stakes + what they'll get + why now + CTA + what happens after pre-order.

${nf ? 'For nonfiction, emphasize the timeliness of the argument and any affiliated programming (podcast tour, speaking dates).' : 'For fiction, emphasize mood, genre, and atmospheric hooks.'}

BOOK DETAILS:
${ctx}

Output all three versions with the exact === HEADERS === shown.`,
  },

  {
    id: 'launch_checklist',
    label: 'Launch Checklist',
    emoji: '✅',
    description: 'Interactive checkboxes for pre-publication and launch tasks.',
    section: 'launch',
    outputKind: 'json',
    schema: {
      type: 'object',
      properties: {
        checklist: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              phase: { type: 'string', enum: ['pre-launch', 'launch-week', 'launch-day', 'post-launch'] },
              label: { type: 'string' },
              details: { type: 'string' },
            },
            required: ['phase', 'label'],
          },
        },
      },
      required: ['checklist'],
    },
    buildPrompt: (ctx, nf) => `Generate a concrete launch checklist for this book. Return as JSON.

Produce 20-25 total tasks distributed across four phases:

pre-launch (6-10 weeks before launch — 6-8 tasks):
Items like: finalize ARC list, send ARCs, set up Amazon pre-order, secure cover blurbs from authors, plan podcast tour, schedule book cover reveal.

launch-week (7 days before launch — 5-7 tasks):
Items like: final newsletter prep, social media schedule, confirm launch day email sends, final Amazon listing review, schedule Goodreads giveaway.

launch-day (launch day — 4-6 tasks):
Items like: newsletter send, social media launch thread, thank early buyers, post in relevant groups, monitor Amazon ranking, thank ARC reviewers.

post-launch (first 30 days — 5-7 tasks):
Items like: monitor and respond to reviews, send review request follow-ups, run Amazon ad test, plan KDP Countdown, request additional reviews from ARC team who haven't reviewed yet, ${nf ? 'schedule podcast guest appearances' : 'engage with bookstagram / booktok posts'}.

For each task:
  - phase: one of 'pre-launch' | 'launch-week' | 'launch-day' | 'post-launch'
  - label: concrete action as imperative verb phrase (10-15 words)
  - details: one sentence of context or HOW to do it

${nf ? 'Tailor tasks to a nonfiction book: include platform-building tasks, speaking opportunities, LinkedIn / Substack activation.' : 'Tailor tasks to a fiction book: include bookstagram engagement, booktok relevance, reader community connections.'}

BOOK DETAILS:
${ctx}`,
  },

  /* ────────────────────────────────────────────────────────────────────── */
  /* SECTION 5: SERIES & CONTINUITY                                         */
  /* ────────────────────────────────────────────────────────────────────── */

  {
    id: 'series_bible',
    label: 'Series Bible',
    emoji: '📚',
    description: 'Overview document for continuity across future volumes.',
    section: 'series',
    outputKind: 'text',
    buildPrompt: (ctx, nf) => nf
      ? `Create a nonfiction series bible — the canonical reference document for continuity across future volumes.

SECTIONS (produce each with the exact header):

=== SERIES THESIS (200 words) ===
What unified claim or investigative angle ties all books in this series together? Not just topic — ARGUMENT.

=== COVERED / FORTHCOMING TERRITORY ===
Book 1: [current book's domain]
Book 2: [logical next domain — propose based on what's unexamined in Book 1]
Book 3: [possible future domain]
Book 4 (optional): [if a 4-book arc seems natural]

=== METHODOLOGY & SOURCE RULES ===
The series's standard for evidence, source types used, citation approach, interview discipline, how controversies are handled. This is the author's internal standard document for future volumes.

=== RECURRING FRAMES & VOCABULARY ===
Key concepts, terms, framing devices, and named figures that will recur across volumes. Establishes continuity of voice and analytical lens.

=== AUTHOR POSITIONING ===
How the author wants to be positioned across the series — not just topic expertise, but the meta-project. Why this series, why this author.

=== COMP SERIES (3-5 examples) ===
Other nonfiction series in adjacent space. What this series takes from them, what it does differently.

BOOK DETAILS:
${ctx}

Output the full bible with those exact === HEADERS ===.`
      : `Create a fiction series bible — the canonical reference document for continuity across future volumes.

SECTIONS (produce each with the exact header):

=== SERIES PREMISE (200 words) ===
What unified emotional or narrative engine drives the series? What keeps a reader wanting the NEXT book?

=== CHARACTER CANON ===
For each recurring character (protagonist + 3-5 others):
  - Name, age, role in the series
  - Arc so far (what they've done in Book 1)
  - Arc going forward (where they're headed across the series)
  - Locked facts (backstory that cannot be retconned)

=== WORLD-BUILDING RULES ===
Physical geography, magic/tech rules (if applicable), political structure, cultural notes, rules about what's possible vs impossible in this world. The author's reference for not contradicting themselves.

=== UNRESOLVED THREADS ===
List the open questions, unresolved relationships, unanswered mysteries from Book 1 that can be paid off in future books. 5-8 threads minimum.

=== BOOK 2 PREMISE (200 words) ===
Propose the logical next book — how it continues, what it escalates, what new element enters.

=== BOOK 3 PREMISE (100 words) ===
Propose a direction for Book 3 that builds on both 1 and 2.

=== VOICE & TONE NOTES ===
How the prose reads across the series: present tense or past, POV decisions, dialogue rhythm, what to preserve in every book.

=== COMP SERIES (3-5 examples) ===
Other series in adjacent genre/tone. What this series takes from them, what it does differently.

BOOK DETAILS:
${ctx}

Output the full bible with those exact === HEADERS ===.`,
  },

  {
    id: 'title_brainstorm',
    label: 'Title Brainstorm',
    emoji: '💡',
    description: '10 alternative title + subtitle combinations with reasoning.',
    section: 'series',
    outputKind: 'json',
    schema: {
      type: 'object',
      properties: {
        titles: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              subtitle: { type: 'string' },
              reasoning: { type: 'string' },
              style: { type: 'string' },
            },
            required: ['title', 'reasoning'],
          },
        },
      },
      required: ['titles'],
    },
    buildPrompt: (ctx, nf) => `Generate EXACTLY 10 alternative title + subtitle combinations for this book. Return as JSON.

Provide a mix of styles:
- 2 punchy / single-word / evocative
- 2 declarative statement titles (e.g., "Everything We Lost")
- 2 question titles (e.g., "Who Owns the Future?")
${nf ? `- 2 investigative / argument-forward (e.g., "The Quiet Architect: How One Memo Rewrote American Medicine")
- 2 category-clear expert titles (e.g., "The Attention Economy: A Field Guide")` : `- 2 mood / atmospheric (e.g., "The Weight of Salt")
- 2 character-name or location titles (e.g., "Kaelen", "The Long Road from Brighton")`}

For EACH option:
  - title: the main title
  - subtitle: a complementary subtitle (${nf ? 'nonfiction subtitles earn their keep — be specific about what the book delivers' : 'fiction subtitles are optional — include only if it adds clarity, otherwise leave empty string'})
  - reasoning: 1-2 sentences on what this title DOES that others don't
  - style: which style it represents (from the list above)

Titles should be:
- Memorable and easy to say aloud
- Not already used by major recent books (verify mentally)
- Searchable — not so obscure that nobody would find it

BOOK DETAILS:
${ctx}`,
  },
];

/**
 * Get an item by id.
 */
export function getPubItem(id) {
  return PUB_ITEMS.find((it) => it.id === id) || null;
}

/**
 * Get all items in a given section, in declared order.
 */
export function getItemsForSection(sectionId) {
  return PUB_ITEMS.filter((it) => it.section === sectionId);
}

/**
 * Clean up AI-generated Amazon HTML. Strips visible section labels that the
 * LLM sometimes inserts despite the prompt telling it not to, and collapses
 * excessive <br> tags.
 */
export function cleanAmazonHtml(raw) {
  let text = typeof raw === 'string' ? raw : (raw?.data || raw?.text || raw?.content || JSON.stringify(raw));
  text = text.replace(/<b>\s*(HOOK|THE WORLD|THE BREAK|THE STAKES|THE QUESTION|WHY THIS BOOK|ABOUT THE AUTHOR|POSITIONING|THE PROBLEM|THE PROMISE|EVIDENCE|STAKES|COMP AUTHORS)\s*<\/b>\s*(<br\s*\/?>)*/gi, '');
  text = text.replace(/(<br\s*\/?>[\s\n]*){3,}/gi, '<br><br>');
  return text.trim();
}

/**
 * Given an item id and any post-processing hint, run the cleanup. Returns
 * the cleaned string. Only amazon_desc currently uses post-processing.
 */
export function postProcessOutput(itemId, raw) {
  const item = getPubItem(itemId);
  if (!item) return raw;
  if (item.postProcess === 'cleanAmazonHtml') return cleanAmazonHtml(raw);
  return raw;
}