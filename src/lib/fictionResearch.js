/**
 * Fiction Research Engine — Plausibility Brief Generator
 *
 * v2 research persistence fix:
 * - Passes project.id into prepareResearchContent so external research files are project-scoped.
 * - Still saves research_md / research_md_url directly to NovelProject for Story Bible > Research.
 *
 * Identifies speculative/technical elements in the story bible,
 * researches the real-world science behind them, and produces
 * a Plausibility Brief the prose model uses for grounded fiction.
 */

import { invokeLLMWithRetry, invokeLLMForResearch } from '@/lib/integrationRetry';
import { pickModel } from '@/lib/modelRouting';

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Research call timed out after ' + (ms / 1000) + 's')), ms)),
  ]);
}
import { base44 } from '@/api/base44Client';
import { prepareResearchContent } from '@/lib/researchStorage';

// ── Step 1: Extract Researchable Topics ──────────────────────────────────

export async function extractResearchTopics(project) {
  // Resolve seed_concept from URL if needed
  let seedConcept = project.seed_concept || '';
  if (project.seed_concept_url && seedConcept.length < 600) {
    try {
      const { resolveSeedConcept } = await import('@/lib/seedConceptStorage');
      seedConcept = await resolveSeedConcept(project);
    } catch (e) { console.warn('[RESEARCH] Could not resolve seed_concept URL:', e.message); }
  }
  const bible = [
    seedConcept,
    project.world_md || '',
    project.characters_md || '',
    project.outline_md || '',
    project.canon_md || '',
    project.mystery_md || '',
  ].join('\n\n').substring(0, 15000);

  console.log('[RESEARCH] Bible length for topic extraction:', bible.length);

  const extractPrompt = `You are a research consultant for a fiction author. Read this story bible and identify every element that touches real-world science, technology, medicine, law, history, geography, military procedure, or specialized knowledge. The goal is to ensure the fiction is GROUNDED — the speculative parts should be built on real foundations.

STORY BIBLE:
${bible.substring(0, 30000)}

For each topic, determine:
1. What is the fictional/speculative element?
2. What real-world knowledge does it depend on?
3. What specific questions need to be researched to make it believable?

Respond ONLY in JSON. No markdown, no backticks.

{
  "topics": [
    {
      "category": "physics|medicine|technology|military|law|history|geography|psychology|biology|chemistry|engineering|culture|language|economics|other",
      "fictional_element": "Brief description of the speculative element in the story",
      "real_world_basis": "What real science/knowledge this is built on",
      "research_questions": [
        "Specific question 1 that needs to be answered",
        "Specific question 2",
        "Specific question 3"
      ],
      "priority": "critical|important|nice-to-have",
      "chapters_affected": "Which chapters use this element (from the outline)"
    }
  ]
}

RULES:
- "critical" = the plot depends on this being plausible (e.g., how a bomb works in a thriller, how a disease spreads in a pandemic novel)
- "important" = readers with domain knowledge will notice if it's wrong (e.g., court procedure in a legal thriller, gun mechanics in an action novel)
- "nice-to-have" = adds texture but the story works without it (e.g., what a specific city smelled like in 1920)
- Focus on elements where getting it WRONG would break immersion or insult knowledgeable readers
- Ignore pure fantasy elements that don't claim scientific basis (magic systems that are openly magical)
- DO identify sci-fi elements that claim scientific plausibility (FTL travel "using alcubierre drive" — the real physics matters)
`;

  const topicSchema = {
    type: 'object',
    properties: {
      topics: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            category: { type: 'string' },
            fictional_element: { type: 'string' },
            real_world_basis: { type: 'string' },
            research_questions: { type: 'array', items: { type: 'string' } },
            priority: { type: 'string' },
            chapters_affected: { type: 'string' },
          },
          required: ['category', 'fictional_element', 'research_questions', 'priority'],
        },
      },
    },
    required: ['topics'],
  };

  const result = await invokeLLMForResearch({
    prompt: extractPrompt,
    response_json_schema: topicSchema,
    model: pickModel('foundation'),
    fallback_model: 'gemini_3_flash',
    temperature: 0,
  });

  // With response_json_schema, the result should already be a parsed object
  let topics;
  if (result && typeof result === 'object' && result.topics) {
    topics = result;
  } else {
    try {
      let text = typeof result === 'string' ? result : result?.text || result?.content || JSON.stringify(result);
      console.log('[RESEARCH] Raw topic extraction result (first 200 chars):', String(text).substring(0, 200));
      text = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      topics = JSON.parse(text);
    } catch (e) {
      console.error('[RESEARCH] Topic extraction JSON parse failed:', e.message);
      console.error('[RESEARCH] Raw text was:', String(result).substring(0, 500));
      return { topics: [] };
    }
  }
  console.log('[RESEARCH] Extracted topics count:', topics?.topics?.length || 0);
  return topics;
}

// ── Step 2: Research Each Topic ──────────────────────────────────────────

export async function researchTopic(topic) {
  const researchPrompt = `You are a subject matter expert providing research for a fiction author. The author is writing a novel that includes a speculative element built on real-world knowledge. Your job is to provide ACCURATE, GROUNDED information the author can use to make the fiction believable.

FICTIONAL ELEMENT: ${topic.fictional_element}
REAL-WORLD BASIS: ${topic.real_world_basis}
CATEGORY: ${topic.category}

RESEARCH QUESTIONS:
${topic.research_questions.map((q, i) => (i + 1) + '. ' + q).join('\n')}

Respond ONLY in JSON. No markdown, no backticks.

{
  "topic": "${topic.fictional_element}",
  "category": "${topic.category}",
  "findings": {
    "real_science": "The actual science/knowledge behind this, explained clearly. What is genuinely true. 3-5 paragraphs.",
    "terminology": ["List of 10-15 real technical terms the characters should use when discussing this. Include brief definitions."],
    "common_mistakes": ["List of 3-5 things fiction authors commonly get wrong about this topic that would make knowledgeable readers cringe."],
    "plausible_extensions": "How the author can EXTEND the real science into the speculative without breaking plausibility. What would a real scientist say is 'unlikely but not impossible'? 2-3 paragraphs.",
    "sensory_details": "What does this look/sound/smell/feel like in reality? Specific sensory details an author can use. The hum of equipment, the smell of chemicals, the weight of tools.",
    "procedural_steps": "If this involves a process or procedure (surgery, hacking, bomb disposal, lab work), list the actual steps in order. What would a professional actually DO?",
    "constraints": "Physical, legal, or practical constraints the author should respect. What CAN'T happen, even in fiction, without breaking physics or logic?",
    "expert_dialogue": ["3-4 example phrases a real expert in this field would use in conversation. Not full dialogue — just the vocabulary and cadence of how professionals talk about this."]
  }
}

RULES:
- Be ACCURATE. Do not fabricate scientific facts.
- If something is genuinely unknown or debated in real science, say so.
- The goal is not to limit the author's imagination but to give them a FOUNDATION of truth to build on.
- The speculative parts should feel like plausible extrapolations, not magic wearing a lab coat.
`;

  const researchSchema = {
    type: 'object',
    properties: {
      topic: { type: 'string' },
      category: { type: 'string' },
      findings: {
        type: 'object',
        properties: {
          real_science: { type: 'string' },
          terminology: { type: 'array', items: { type: 'string' } },
          common_mistakes: { type: 'array', items: { type: 'string' } },
          plausible_extensions: { type: 'string' },
          sensory_details: { type: 'string' },
          procedural_steps: { type: 'string' },
          constraints: { type: 'string' },
          expert_dialogue: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    required: ['findings'],
  };

  const result = await invokeLLMForResearch({
    prompt: researchPrompt,
    response_json_schema: researchSchema,
    searchQueries: [topic.fictional_element, topic.real_world_basis].filter(Boolean),
    model: pickModel('fiction_research'),
    fallback_model: 'gemini_3_flash',
    temperature: 0,
  });

  // With response_json_schema, result should be parsed already
  if (result && typeof result === 'object' && result.findings) {
    return result;
  }

  let findings;
  try {
    let text = typeof result === 'string' ? result : result?.text || result?.content || JSON.stringify(result);
    text = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    findings = JSON.parse(text);
  } catch (e) {
    console.warn('[RESEARCH] Research failed for topic:', topic.fictional_element, e.message);
    return null;
  }

  return findings;
}

// ── Step 3: Compile the Plausibility Brief ───────────────────────────────

export async function runFictionResearch(project, onProgress) {
  // Step 1: Extract topics
  onProgress?.('Research: Analyzing story bible for researchable topics…');
  const extracted = await extractResearchTopics(project);

  if (!extracted.topics || extracted.topics.length === 0) {
    console.warn('[RESEARCH] No researchable topics found in story bible.');
    return null;
  }

  // Sort by priority
  const priorityOrder = { critical: 0, important: 1, 'nice-to-have': 2 };
  const sorted = extracted.topics.sort(
    (a, b) => (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2)
  );

  // Step 2: Research topics in parallel batches for speed
  const toResearch = sorted.filter((t) => t.priority !== 'nice-to-have');
  const results = [];
  const failed = [];
  const BATCH_SIZE = 3;

  console.log('[RESEARCH] Parallel mode: ACTIVE | Total queries:', toResearch.length, '| Batch size:', BATCH_SIZE, '| Total batches:', Math.ceil(toResearch.length / BATCH_SIZE), '| Skipped nice-to-have:', sorted.length - toResearch.length);

  const TOPIC_TIMEOUT = 120000; // 2 minutes per topic

  const researchOneTopic = async (topic) => {
    const findings = await withTimeout(researchTopic(topic), TOPIC_TIMEOUT);
    if (findings) {
      return { ...topic, findings: findings.findings || findings };
    }
    return null;
  };

  for (let i = 0; i < toResearch.length; i += BATCH_SIZE) {
    const batch = toResearch.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(toResearch.length / BATCH_SIZE);
    onProgress?.(
      `Research: Batch ${batchNum} of ${totalBatches} — researching ${batch.length} topics (${results.length} completed so far)…`
    );

    const batchResults = await Promise.allSettled(
      batch.map((topic) => researchOneTopic(topic))
    );

    for (let j = 0; j < batchResults.length; j++) {
      const r = batchResults[j];
      if (r.status === 'fulfilled' && r.value) {
        results.push(r.value);
      } else {
        const reason = r.status === 'rejected' ? r.reason?.message : 'empty result';
        console.warn('[RESEARCH] Topic failed:', batch[j].fictional_element, '—', reason);
        failed.push(batch[j]);
      }
    }

    // Small delay between batches to avoid rate limits
    if (i + BATCH_SIZE < toResearch.length) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  // Retry failed topics one at a time
  if (failed.length > 0) {
    console.log('[RESEARCH] Retrying', failed.length, 'failed topics individually…');
    onProgress?.(`Research: Retrying ${failed.length} failed topics…`);
    for (const topic of failed) {
      try {
        onProgress?.(`Research: Retrying "${topic.fictional_element.substring(0, 50)}"…`);
        const r = await researchOneTopic(topic);
        if (r) {
          results.push(r);
          console.log('[RESEARCH] Retry succeeded:', topic.fictional_element);
        }
      } catch (e) {
        console.warn('[RESEARCH] Retry also failed:', topic.fictional_element, e.message);
      }
      await new Promise(r => setTimeout(r, 1500));
    }
  }

  // Step 3: Compile into markdown
  let md = '# Plausibility Brief\n\n';
  md += `Generated for: ${project.title || 'Untitled'}\n`;
  md += `Topics researched: ${results.length} of ${extracted.topics.length} identified\n\n`;
  md += '---\n\n';

  for (const r of results) {
    md += `## ${r.fictional_element}\n`;
    md += `**Category:** ${r.category} | **Priority:** ${r.priority}\n`;
    md += `**Chapters affected:** ${r.chapters_affected || 'Multiple'}\n\n`;

    if (r.findings) {
      md += `### Real Science\n${r.findings.real_science || ''}\n\n`;

      const terms = r.findings.terminology;
      if (terms && terms.length > 0) {
        md += '### Terminology for Characters to Use\n';
        for (const t of terms) md += `- ${t}\n`;
        md += '\n';
      }

      const mistakes = r.findings.common_mistakes;
      if (mistakes && mistakes.length > 0) {
        md += '### Common Author Mistakes to Avoid\n';
        for (const m of mistakes) md += `- ${m}\n`;
        md += '\n';
      }

      md += `### Plausible Speculative Extensions\n${r.findings.plausible_extensions || ''}\n\n`;
      md += `### Sensory Details\n${r.findings.sensory_details || ''}\n\n`;

      if (r.findings.procedural_steps) {
        md += `### Procedure / Process\n${r.findings.procedural_steps}\n\n`;
      }

      md += `### Constraints (What Can't Happen)\n${r.findings.constraints || ''}\n\n`;

      const dialogue = r.findings.expert_dialogue;
      if (dialogue && dialogue.length > 0) {
        md += '### How Experts Actually Talk About This\n';
        for (const p of dialogue) md += `- "${p}"\n`;
        md += '\n';
      }
    }

    md += '---\n\n';
  }

  // Append nice-to-have topics as a "Further Research" list
  const niceToHave = sorted.filter((t) => t.priority === 'nice-to-have');
  if (niceToHave.length > 0) {
    md += '## Further Research (Nice-to-Have)\n';
    md += "These topics would add texture but aren't critical to plausibility:\n\n";
    for (const n of niceToHave) {
      md += `- **${n.fictional_element}** — ${n.research_questions[0]}\n`;
    }
  }

  // Save to project — use upload-then-URL pattern for large content
  console.log('[RESEARCH] Saving research_md. Length:', md.length);
  const researchFields = await prepareResearchContent(md, project.id);
  // Belt-and-suspenders: never let research save overwrite twist settings
  delete researchFields.num_twists;
  delete researchFields.twist_count;
  delete researchFields.twist_intensity;
  console.log('[RESEARCH] Save strategy:', researchFields.research_md_url ? 'URL (' + researchFields.research_md_url + ')' : 'inline (' + researchFields.research_md.length + ' chars)');
  await base44.entities.NovelProject.update(project.id, researchFields);
  console.log('[RESEARCH] Plausibility Brief saved —', results.length, 'topics researched, md length:', md.length);

  return md;
}

// ── Inject relevant research into prose prompt ───────────────────────────

export function getRelevantResearch(researchMd, chapterNumber, chapterBeats) {
  if (!researchMd || researchMd.length < 100) return '';

  const beatText = (chapterBeats || '').toLowerCase();

  // Extract section headers from research_md
  const sections = researchMd.split(/^## /m).filter((s) => s.trim());
  const relevant = [];

  for (const section of sections) {
    const title = section.split('\n')[0].toLowerCase();
    // Check if any words from the chapter beats appear in the research section
    const beatWords = beatText.split(/\s+/).filter((w) => w.length > 4);
    const isRelevant = beatWords.some((w) => section.toLowerCase().includes(w));

    if (isRelevant) {
      let condensed = '## ' + section.split('\n')[0] + '\n';

      const termsMatch = section.match(/### Terminology[\s\S]*?(?=###|$)/);
      if (termsMatch) condensed += termsMatch[0].substring(0, 500) + '\n';

      const sensoryMatch = section.match(/### Sensory Details[\s\S]*?(?=###|$)/);
      if (sensoryMatch) condensed += sensoryMatch[0].substring(0, 500) + '\n';

      const constraintsMatch = section.match(/### Constraints[\s\S]*?(?=###|$)/);
      if (constraintsMatch) condensed += constraintsMatch[0].substring(0, 300) + '\n';

      const dialogueMatch = section.match(/### How Experts[\s\S]*?(?=###|$)/);
      if (dialogueMatch) condensed += dialogueMatch[0].substring(0, 300) + '\n';

      const mistakesMatch = section.match(/### Common Author Mistakes[\s\S]*?(?=###|$)/);
      if (mistakesMatch) condensed += mistakesMatch[0].substring(0, 300) + '\n';

      relevant.push(condensed);
    }
  }

  if (relevant.length === 0) return '';

  return (
    '\n=== RESEARCH BRIEF (use real terminology and respect constraints) ===\n' +
    relevant.join('\n') +
    "\nRULE: Use the real terminology listed above when characters discuss these topics. Respect the constraints — do not violate physics or procedure that real experts would catch. The speculative elements should feel like plausible extrapolations of real science, not handwaving.\n===\n"
  );
}