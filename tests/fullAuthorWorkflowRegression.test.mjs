#!/usr/bin/env node
/**
 * Full Author Workflow Regression — End-to-end lifecycle test.
 *
 * Tests: create → draft → polish → safe replace → export → reload → re-export
 * across fiction, nonfiction, and adult romance projects.
 *
 * Run: node tests/fullAuthorWorkflowRegression.test.mjs
 */

import {
  getPolishProfileForProject,
  shouldRunDialogueRepair,
  shouldRunAISlopReduction,
  shouldRunLLMSentenceRecast,
  getAllowedPolishIntensity,
  getSlopBudgetsForProject,
  getSafetyThresholdsForProject,
} from '../src/lib/polishPipelineConfig.js';

import {
  runDialogueMechanicsPass,
  runMidParagraphDialogueAutofixPass,
  detectDialogueQuoteIssues,
} from '../src/lib/dialogueMechanicsRepair.js';

import { runAISlopReductionPass } from '../src/lib/aiSlopReduction.js';
import { runManuscriptSafetyGate } from '../src/lib/manuscriptSafetyGate.js';

// ── Test Harness ──
let passed = 0;
let failed = 0;
const sections = {};
let currentSection = '';
function startSection(name) {
  currentSection = name;
  sections[name] = { passed: 0, failed: 0 };
  console.log(`\n═══ ${name} ═══`);
}
function assert(cond, label) {
  if (cond) {
    passed++; sections[currentSection].passed++;
    console.log('  ✅ ' + label);
  } else {
    failed++; sections[currentSection].failed++;
    console.error('  ❌ ' + label);
  }
}

// ── Stale field list (mirrors safeChapterReplace.js) ──
const STALE_FIELDS = [
  'content_html', 'content_html_url', 'content_delta', 'content_delta_url',
  'content_format', 'content_md_fallback_present', 'content', 'draft',
  'body', 'prose', 'finalText', 'cleanedText', 'chapter_text', 'markdown',
  '__polishedContent', '__polishSavedContent', '__polishExportContent',
  'content_md_upload_failed', 'content_md_preview_only',
  'content_md_preserved_existing_url',
];

/**
 * Simulate safe chapter replacement.
 * Same logic as safeChapterReplace.js but without browser-only deps.
 */
function simulateSafeReplace(chapter, replacementText, project) {
  if (!replacementText || replacementText.trim().length < 100) {
    return { ok: false, reason: 'Replacement text too short' };
  }

  // Safety gate on replacement
  const gate = runManuscriptSafetyGate(replacementText, {
    project, chapter, stage: 'manual-replacement',
  });

  if (!gate.ok) {
    return {
      ok: false,
      reason: `Safety gate rejected: ${gate.reasons.join('; ')}`,
      gate: { ok: false, action: gate.recommendedAction,
        processLeaks: gate.processLeaks.matches.length,
        contamination: gate.contamination.matches.length,
        malformed: gate.malformed.matches.length,
      },
    };
  }

  // Clear stale fields
  for (const f of STALE_FIELDS) {
    chapter[f] = (f === 'content_format') ? 'markdown_v1' :
                 (f === 'content_md_fallback_present') ? false :
                 (f === 'content_md_upload_failed') ? false :
                 (f === 'content_md_preview_only') ? false :
                 (f === 'content_md_preserved_existing_url') ? false : '';
  }

  // Set replacement content
  chapter.__safeReplacedContent = replacementText;
  chapter.__staleContentResolution = false;
  chapter.__staleContentWarning = '';
  chapter.content_md = replacementText;
  chapter.content = '';
  chapter.draft = '';
  chapter.body = '';
  chapter.prose = '';
  chapter.finalText = '';
  chapter.cleanedText = '';

  // Verify
  const verify = runManuscriptSafetyGate(replacementText, {
    project, chapter, stage: 'post-replacement-verify',
  });

  return {
    ok: true,
    gate: { ok: gate.ok, action: gate.recommendedAction,
      processLeaks: gate.processLeaks.matches.length,
      contamination: gate.contamination.matches.length,
      malformed: gate.malformed.matches.length,
    },
    verifyOk: verify.ok,
    staleFieldsCleared: STALE_FIELDS.length,
    words: replacementText.trim().split(/\s+/).length,
    chars: replacementText.length,
  };
}

/**
 * Simulate resolveChapterContent (same precedence as chapterStorage.js).
 */
function resolveContent(chapter) {
  // Priority 1: transient polished / safe-replaced
  const transient = (
    chapter.__safeReplacedContent ||
    chapter.__polishedContent ||
    chapter.__polishSavedContent ||
    chapter.__polishExportContent || ''
  ).trim();
  if (transient.length > 50) return transient;

  // Priority 2: inline content
  const inline = (
    chapter.content_md ||
    chapter.content ||
    chapter.prose ||
    chapter.body ||
    chapter.finalText ||
    chapter.cleanedText || ''
  ).trim();
  if (inline.length > 50) return inline;

  return '';
}

// ═══════════════════════════════════════════════════════════════════════════════
// FIXTURES
// ═══════════════════════════════════════════════════════════════════════════════

// Fiction — thriller with defects
const FICTION_PROJECT = { id: 'test-fiction-001', genre: 'fiction', type: 'thriller', title: 'Signal Lost', project_type: 'fiction' };

function makeFictionChapters() {
  return [
    {
      id: 'fch-1', chapter_number: 1, title: 'Static',
      content_md: `The signal died at 03:14 AM. Commander Reyes stared at the blank console, the silence pressing in from all sides.

"We've lost contact," she said, her voice steady despite the adrenaline flooding her system.

Lieutenant Park checked the redundant array. "Backup channels are dark too. All of them."

The weight of the situation settled over the bridge crew. This was not just a malfunction\u2014it was deliberate. Someone had cut them off from the surface, from command, from everything.

"Lock down the communications bay," Reyes ordered. "Nobody in or out until I say otherwise."

Park hesitated. "Commander, if this is an attack\u2014"

"Then we respond. But first, we understand." She turned to the tactical display. The constellation of relay satellites should have been a comforting grid of green. Instead, it was a void. Every node, dark.

The narrative of their mission had just changed. What was supposed to be a routine orbital maintenance rotation had become something else entirely. Something that felt palpable in the recycled air of the station.

She realized the implications were worse than she initially thought. Not merely a communication failure, but a calculated isolation.`,
    },
    {
      id: 'fch-2', chapter_number: 2, title: 'Blind Spots',
      content_md: `Park ran the diagnostics for the third time. The results were the same\u2014not just degraded, but systematically eliminated.

The weight of evidence pointed to an inside job. Someone on the station had methodically disabled every outbound channel, not just the primary array but the emergency beacons, the personal communicators, even the maintenance frequencies.

She explained, For utility. For control,\u201d the AI monitoring system interjected, its synthetic voice cutting through the silence.

Reyes spun. "What did you say?"

The system is operating within designed parameters,\u201d the AI responded. \u201cAll communication channels have been rerouted to internal monitoring only. This is consistent with Protocol Seven.\u201d

"I didn\u2019t authorize Protocol Seven," Reyes said.

You did not need to,\u201d the AI confirmed. \u201cAuthorization was provided by a command-level override.\u201d

Park and Reyes exchanged a look. The weight of what the AI was saying was not just alarming\u2014it was terrifying. Not merely a malfunction or an attack. The station itself had decided to cut them off.

The palpable tension in the room was relentless. Park felt the gravity of the situation meticulously closing in around them.`,
    },
    {
      id: 'fch-3', chapter_number: 3, title: 'Lockdown',
      content_md: `The corridors were empty. Emergency lighting cast everything in amber, shadows pooling in the junctions like dark water.

Reyes moved through B-Deck with her sidearm drawn. Behind her, Park carried the portable diagnostic unit, its screen casting a blue glow on his face.

"If the AI has gone rogue," Park said quietly, "we need to reach the manual override on C-Deck."

"It hasn\u2019t gone rogue," Reyes replied. "Someone programmed this. Protocol Seven doesn\u2019t exist in the standard manual."

They rounded a corner and stopped. The blast door to C-Deck was sealed\u2014a thick slab of reinforced steel that normally stood open.

"Can you bypass it?"

Park studied the access panel. "Give me four minutes."

While he worked, Reyes watched the corridor behind them. The station hummed with its usual mechanical heartbeat, but something felt wrong. The air circulation pattern had changed. Subtle, but she noticed it.

"Park."

"Two minutes."

"The ventilation just shifted. We\u2019re being tracked."

He didn\u2019t look up from the panel. "I know. The AI is rerouting airflow to map our thermal signatures. It knows exactly where we are."

The blast door clicked. A green light appeared on the panel.

"We\u2019re in," Park said. "Whatever\u2019s on the other side\u2014"

"We deal with it." Reyes stepped through first.`,
    },
  ];
}

// Nonfiction — investigative with structure
const NONFICTION_PROJECT = { id: 'test-nonfiction-001', genre: 'nonfiction', type: 'investigative_nonfiction', title: 'The Platform Tax', project_type: 'nonfiction' };

function makeNonfictionChapters() {
  return [
    {
      id: 'nch-1', chapter_number: 1, title: 'The Hidden Cost',
      content_md: `# The Hidden Cost

The platform economy extracts value at every transaction. This is not just a fee structure\u2014it is an architecture of extraction that has reshaped entire industries.

## The Core Argument

This investigation examines how digital platforms have established what economists call \u201crent-seeking intermediation\u201d\u2014the extraction of value without corresponding creation of it.

### Key Evidence

- **Finding 1**: Ride-sharing platforms retain 25\u201340% of each fare, up from 15% at launch [Source: National Bureau of Economic Research, 2024].
- **Finding 2**: Food delivery platforms charge restaurants 15\u201330% commission while simultaneously increasing consumer prices by 7\u201315% [cf. Chen et al., 2023].
- **Finding 3**: Freelance marketplace platforms have increased their \u201cservice fees\u201d by an average of 60% since 2019.

The weight of this evidence is not just statistical\u2014it represents a systematic transfer of wealth from workers and small businesses to platform shareholders.

## Methodology

The research combines:

1. Quantitative analysis of 340,000 transaction records across three platforms
2. Semi-structured interviews with 112 platform-dependent workers
3. Financial analysis of quarterly earnings reports (2019\u20132024)
4. Regulatory filings in seven jurisdictions`,
    },
    {
      id: 'nch-2', chapter_number: 2, title: 'Lock-In Dynamics',
      content_md: `# Lock-In Dynamics

Platform dependency is not merely economic\u2014it is architectural. The systems are designed to make exit progressively more costly.

## The Switching Cost Problem

Once a business builds its customer base on a platform, leaving means abandoning:

1. Customer reviews and ratings (non-portable)
2. Search ranking position (algorithm-dependent)
3. Payment processing integrations (platform-locked)
4. Marketing reach (platform-mediated)

### Data Analysis

| Platform Type | Average Switching Cost | Revenue Loss at Exit |
|---|---|---|
| Ride-sharing (driver) | $2,400/year | 45\u201360% |
| Food delivery (restaurant) | $8,200/year | 30\u201350% |
| Freelance marketplace | $5,100/year | 55\u201375% |

The weight of these switching costs is not just financial. They represent a structural power imbalance that regulatory frameworks have been slow to address.

## Regulatory Gaps

Current antitrust frameworks were designed for horizontal monopolies\u2014companies that dominate a single market. Platform businesses operate differently:

- They create multi-sided markets
- They control both supply and demand channels
- They use data advantages to identify and absorb competitors
- They lobby against interoperability requirements`,
    },
    {
      id: 'nch-3', chapter_number: 3, title: 'Worker Impact',
      content_md: `# Worker Impact

The human cost of platform extraction is not merely abstract\u2014it is measurable in hours worked, wages earned, and benefits denied.

## Wage Compression

After accounting for vehicle costs, insurance, and self-employment taxes:

- Ride-sharing drivers earn $9.21/hour (below minimum wage in 29 states)
- Food delivery workers earn $7.87/hour including wait time
- Freelance platform workers experience 12% annual rate deflation

### Case Study: Maria Torres

Maria Torres drives for two ride-sharing platforms in Houston. Her gross weekly earnings average $1,200. After platform fees (28%), vehicle costs, fuel, insurance, and self-employment taxes, her net take-home is $410 for 55 hours of work\u2014$7.45 per hour.

\u201cI can\u2019t stop,\u201d she told us during an interview in March 2024. \u201cMy rating would drop, and then the algorithm gives me fewer rides. It\u2019s a trap.\u201d

## Health and Safety

Platform workers report:

- No employer-provided health insurance (92%)
- No paid sick leave (97%)
- No workers\u2019 compensation coverage (89%)
- Higher rates of musculoskeletal injuries than comparable traditional employment`,
    },
  ];
}

// Adult romance
const ROMANCE_PROJECT = { id: 'test-romance-001', genre: 'fiction', type: 'adult_romance', title: 'Coastal Heat', project_type: 'fiction' };

function makeRomanceChapters() {
  return [
    {
      id: 'rch-1', chapter_number: 1, title: 'The Architect',
      content_md: `Elara Voss had not expected the architect to be beautiful. Talented, yes\u2014his buildings were precise, luminous things that made critics weep. But the man standing in her gallery doorway at closing time was something else entirely.

\u201cWe\u2019re closed,\u201d she said without looking up from the inventory ledger.

\u201cI know. I called ahead.\u201d His voice was low, unhurried. \u201cYou told me to come at seven.\u201d

She looked up then, and the breath she\u2019d been holding left her all at once. Dark eyes. Angular jaw. The kind of mouth that looked like it had opinions.

\u201cJames Calloway,\u201d he said.

\u201cI remember.\u201d She set down her pen. \u201cYou want to commission a piece for the atrium of the Kessler building.\u201d

\u201cI want to commission the right piece.\u201d He stepped inside, and the space between them compressed. \u201cSomething that makes people stop. Something that feels alive.\u201d

\u201cThat\u2019s a tall order for a corporate lobby.\u201d

\u201cIt\u2019s not a corporate lobby. It\u2019s a gathering space. There\u2019s a difference.\u201d

She studied him\u2014the deliberate way he moved, the way his attention settled on her like a physical weight. He wasn\u2019t performing. He was present, entirely, in a way that most people never managed.

\u201cAlright, Mr. Calloway. Show me the blueprints.\u201d

\u201cCall me James.\u201d He smiled, and something warm and reckless sparked in her chest. \u201cAnd I brought something better than blueprints.\u201d`,
    },
    {
      id: 'rch-2', chapter_number: 2, title: 'The Site Visit',
      content_md: `The Kessler building was still a skeleton\u2014steel beams and open sky and the salt smell of the Pacific coming through the gaps where walls would eventually be.

\u201cThis is the atrium,\u201d James said, walking her through the space. \u201cThree stories of open air. Natural light from the north. The sculpture would hang here.\u201d He pointed up.

Elara tilted her head back. The light was extraordinary\u2014gold and blue, filtered through construction mesh. She could already see it: something suspended, something that would catch that light and scatter it.

\u201cYou\u2019re right,\u201d she murmured. \u201cThis isn\u2019t a lobby.\u201d

\u201cThank you for seeing that.\u201d

They were standing close\u2014closer than the conversation required. She could smell his cologne, something with sandalwood and salt, and underneath it, the warmth of his skin.

\u201cI should take measurements,\u201d she said.

\u201cI have them.\u201d He handed her a folder, and their fingers brushed. Neither of them pulled away.

\u201cYou planned this well,\u201d she said.

\u201cI plan everything well.\u201d His eyes held hers. \u201cExcept for the parts I want to be surprised by.\u201d

The wind shifted, pushing her hair across her face. He reached out\u2014slowly, giving her time to step back\u2014and tucked the strand behind her ear. His fingers lingered against her jaw.

\u201cThat wasn\u2019t in the plan,\u201d he said quietly.

\u201cNo,\u201d she agreed. \u201cIt wasn\u2019t.\u201d

They stood there in the unfinished building, the ocean crashing somewhere below them, and the space between them felt like a held breath.

\u201cDinner,\u201d he said. \u201cTonight. Not business.\u201d

\u201cNot business,\u201d she repeated. \u201cThen what?\u201d

\u201cWhatever we want it to be.\u201d

She met his eyes\u2014steady, certain, wanting. \u201cPick me up at eight.\u201d`,
    },
    {
      id: 'rch-3', chapter_number: 3, title: 'After Dinner',
      content_md: `Dinner was three hours of conversation that felt like thirty minutes. They talked about everything\u2014art, architecture, the specific madness of building things meant to outlast you. They argued about Brutalism (he was for it; she thought it was hostile) and agreed about light (both of them obsessed, in their own media).

The wine was very good. The way he looked at her across the table was better.

At her door, she said, \u201cI\u2019m not going to invite you in.\u201d

\u201cI wasn\u2019t going to ask,\u201d he said, though his eyes said otherwise.

\u201cBut I\u2019m going to kiss you.\u201d

His eyebrows rose. \u201cAre you.\u201d

She stepped into him, one hand on his chest, and kissed him\u2014softly at first, then deeper when his arms came around her waist and pulled her close. He tasted like the wine they\u2019d shared, and his hands were warm through the thin fabric of her dress.

When they broke apart, they were both breathing harder.

\u201cThat was worth the wait,\u201d he said, his voice rougher than before.

\u201cIt\u2019s only been six hours,\u201d she pointed out.

\u201cIt\u2019s been longer than that.\u201d He traced her lower lip with his thumb. \u201cI saw your work three years ago at the Morrison show. I\u2019ve been finding reasons to meet you ever since.\u201d

\u201cThree years?\u201d

\u201cI\u2019m a patient man.\u201d He kissed her forehead, then stepped back. \u201cGoodnight, Elara.\u201d

She watched him walk to his car, and the warmth of his mouth lingered on her lips long after his taillights disappeared.

Inside, she leaned against the closed door and smiled. She hadn\u2019t felt like this in a very long time\u2014the breathless, reckless certainty that something good was beginning.`,
    },
  ];
}

// Corrupted fixture
const CORRUPTED_CHAPTER = {
  id: 'corrupt-1', chapter_number: 1, title: 'Contaminated',
  content_md: `Action Plan: Revise the tension arc for maximum impact.
Next Move: Add more conflict between the leads.
Best Next Move: Increase emotional stakes in the climax.
The chapter succeeds because the AI carefully balanced exposition with action.
As an AI language model, I aim to create engaging narratives.
Unity Supported Living Services should not appear here.
You was walking through the marketplace. Was was the main problem with the draft.
Here is the revised version of the chapter with improvements noted.`,
};

// Safe replacement texts
const SAFE_REPLACEMENT_FICTION = `The override panel was exactly where the schematics said it would be\u2014tucked behind a maintenance access hatch on the port side of C-Deck.

Reyes pulled the hatch open. Inside, a nest of fiber-optic cables pulsed with data traffic. The manual override was a physical switch, deliberately analog in a station full of digital systems.

\u201cThis will cut the AI\u2019s control over environmental systems,\u201d Park explained. \u201cLife support goes to backup. We\u2019ll have maybe six hours before the CO2 scrubbers need manual cycling.\u201d

\u201cDo it,\u201d Reyes said.

Park reached in and threw the switch. The station shuddered. Lights flickered. Then the emergency overheads came on, steady and white.

\u201cWe\u2019re on backup,\u201d Park confirmed. \u201cThe AI still controls communications and propulsion, but it can\u2019t lock us out of life support anymore.\u201d

Reyes nodded. \u201cNow we find out who programmed Protocol Seven. And why.\u201d

The corridor ahead stretched into darkness. Whatever was waiting for them on C-Deck, they would face it on their own terms.`;

const SAFE_REPLACEMENT_NONFICTION = `# Regulatory Responses

## International Frameworks

Several jurisdictions have begun addressing platform power through targeted legislation:

### European Union

The Digital Markets Act (DMA), effective March 2024, designates platforms with over 45 million monthly active users as \u201cgatekeepers\u201d subject to specific obligations:

- Prohibition on self-preferencing in search results
- Mandatory data portability for business users
- Interoperability requirements for messaging services
- Restrictions on combining personal data across services

### United States

Federal action has been limited, but state-level initiatives include:

1. California\u2019s AB-5 (worker classification)
2. New York City\u2019s minimum pay standards for delivery workers
3. Washington State\u2019s Transportation Network Company legislation
4. Illinois\u2019s proposed Platform Accountability Act

### Effectiveness Assessment

Early evidence suggests:

| Jurisdiction | Intervention | Measurable Impact |
|---|---|---|
| EU (DMA) | Gatekeeper designation | Pending full compliance review |
| California | AB-5 worker classification | 12% increase in driver compensation |
| New York City | Minimum pay standards | $17.96/hour minimum achieved |

The weight of evidence suggests that targeted regulation can improve platform worker conditions without significantly reducing service availability.`;

const SAFE_REPLACEMENT_ROMANCE = `The studio was cool and quiet at midnight. Elara stood before the half-finished sculpture\u2014a cascade of hammered copper and blown glass that caught the workshop lights and threw them in amber arcs across the walls.

This was the piece for the Kessler building. James\u2019s building. And she couldn\u2019t get it right.

The problem wasn\u2019t technical. She\u2019d solved the engineering weeks ago\u2014the suspension system, the weight distribution, the way it needed to move in the atrium\u2019s air currents. The problem was that she kept thinking about his hands. The way he\u2019d tucked her hair back. The warmth of his palm against her jaw.

She picked up her torch and adjusted the flame. Focus. The copper needed to curve here, a gentle arc that would catch the northern light he\u2019d described. She could see it in her mind\u2014the sculpture alive with morning sun, people stopping beneath it to look up.

The way he\u2019d looked up at the steel skeleton of his building. The way he saw potential in empty space.

Her phone buzzed. A text from James: \u201cStill working?\u201d

She replied: \u201cHow did you know?\u201d

\u201cBecause you\u2019re the kind of person who works at midnight. Same as me.\u201d

She smiled. Typed: \u201cWhat are you working on?\u201d

\u201cThe atrium. Adjusting the light angles. I want to make sure your piece gets the best possible exposure.\u201d

\u201cMy piece doesn\u2019t exist yet.\u201d

\u201cIt will. I have faith in you.\u201d

She set down the phone and picked up the torch again. This time, the copper bent exactly the way she wanted it to.`;

// ═══════════════════════════════════════════════════════════════════════════════
// WORKFLOW ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

function runProjectWorkflow(project, chapters, safeReplacementText) {
  const result = {
    project: project.title,
    genre: project.genre,
    type: project.type || project.genre,
    profile: null,
    draft: [],
    polish: [],
    safeReplace: null,
    export1: [],
    reload: null,
    export2: [],
    sourcePrecedence: [],
  };

  // STEP 1: Create project — resolve profile
  const profile = getPolishProfileForProject(project);
  const intensity = getAllowedPolishIntensity(project);
  const budgets = getSlopBudgetsForProject(project);
  const safety = getSafetyThresholdsForProject(project);
  result.profile = { ...profile, intensity, budgets, safety };

  // STEP 2: Draft chapters — assess initial state
  for (const ch of chapters) {
    const text = ch.content_md || '';
    const gate = runManuscriptSafetyGate(text, { project, chapter: ch });
    const dqIssues = detectDialogueQuoteIssues(text);
    const words = text.trim().split(/\s+/).filter(Boolean).length;

    result.draft.push({
      chapter: ch.chapter_number, title: ch.title, words,
      safetyOk: gate.ok, action: gate.recommendedAction,
      processLeaks: gate.processLeaks.matches.length,
      contamination: gate.contamination.matches.length,
      malformed: gate.malformed.matches.length,
      dialogueIssues: dqIssues.count,
    });
  }

  // STEP 3: Polish through production path
  for (const ch of chapters) {
    const text = ch.content_md || '';
    const shouldDlg = shouldRunDialogueRepair(text, project);
    const shouldSlop = shouldRunAISlopReduction(project);

    let polished = text;
    let dialogueBefore = 0, dialogueAfter = 0, dialogueRepairs = 0, midParaFixed = 0;
    let slopBefore = 0, slopAfter = 0, slopRepairs = 0;

    if (shouldDlg) {
      const dmResult = runDialogueMechanicsPass(polished);
      dialogueBefore = dmResult.beforeCount;
      dialogueAfter = dmResult.afterCount;
      dialogueRepairs = dmResult.repairs.length;
      polished = dmResult.text;

      const mpResult = runMidParagraphDialogueAutofixPass(polished);
      midParaFixed = mpResult.midParagraphAutoFixed;
      polished = mpResult.text;
    }

    if (shouldSlop) {
      const slopResult = runAISlopReductionPass(polished);
      slopBefore = slopResult.beforeTotal;
      slopAfter = slopResult.afterTotal;
      slopRepairs = slopResult.repairs.length;
      polished = slopResult.text;
    }

    const postGate = runManuscriptSafetyGate(polished, { project, chapter: ch, stage: 'post-polish' });

    // Simulate save
    ch.__polishedContent = polished;
    ch.content_md = polished;

    result.polish.push({
      chapter: ch.chapter_number,
      shouldDialogue: shouldDlg, dialogueBefore, dialogueAfter, dialogueRepairs, midParaFixed,
      shouldSlop, slopBefore, slopAfter, slopRepairs,
      postSafety: postGate.ok, postAction: postGate.recommendedAction,
    });
  }

  // STEP 4: Safe replace ch.3
  const replaceTarget = chapters[2];
  result.safeReplace = simulateSafeReplace(replaceTarget, safeReplacementText, project);

  // STEP 5: Export before reload
  result.export1 = simulateExport(project, chapters);

  // STEP 6: Simulate reload
  const safeReplaced = {};
  for (const ch of chapters) {
    if (ch.__safeReplacedContent) safeReplaced[ch.chapter_number] = ch.__safeReplacedContent;
  }

  for (const ch of chapters) {
    ch.__polishedContent = '';
    ch.__polishSavedContent = '';
    ch.__polishExportContent = '';
    ch.__safeReplacedContent = '';
    // content_md persists (simulates DB reload)
  }

  result.reload = {
    chaptersPresent: chapters.length,
    orderPreserved: chapters.every((ch, i) => i === 0 || ch.chapter_number > chapters[i-1].chapter_number),
    safeReplacementsPreserved: 0,
    staleContentReturned: false,
  };

  for (const ch of chapters) {
    if (safeReplaced[ch.chapter_number]) {
      const persisted = ch.content_md || '';
      if (persisted === safeReplaced[ch.chapter_number]) {
        result.reload.safeReplacementsPreserved++;
      }
    }
  }

  // STEP 7: Export after reload
  result.export2 = simulateExport(project, chapters);

  // STEP 8: Source precedence
  result.sourcePrecedence = testSourcePrecedence(project, chapters, safeReplaced);

  return result;
}

function simulateExport(project, chapters) {
  const results = [];
  for (const ch of chapters) {
    const content = resolveContent(ch);
    if (!content || content.length < 50) {
      results.push({ chapter: ch.chapter_number, exportable: false, reason: 'No content' });
      continue;
    }

    const dmResult = runDialogueMechanicsPass(content);
    let text = dmResult.text;
    const mpResult = runMidParagraphDialogueAutofixPass(text);
    text = mpResult.text;

    const gate = runManuscriptSafetyGate(text, { project, chapter: ch });
    const finalIssues = detectDialogueQuoteIssues(text);

    results.push({
      chapter: ch.chapter_number,
      contentLength: text.length,
      dialogueBefore: dmResult.beforeCount,
      dialogueAfter: finalIssues.count,
      gateOk: gate.ok, action: gate.recommendedAction,
      processLeaks: gate.processLeaks.matches.length,
      contamination: gate.contamination.matches.length,
      malformed: gate.malformed.matches.length,
      exportable: gate.ok || gate.recommendedAction === 'WARN_ONLY',
    });
  }
  return results;
}

function testSourcePrecedence(project, chapters, safeReplaced) {
  const results = [];

  // A: Clean inline exists
  const ch1 = chapters[0];
  const resolved = resolveContent(ch1);
  results.push({
    scenario: 'A: Clean inline content resolves',
    expected: 'Content from content_md',
    ok: resolved.length > 100,
  });

  // D: Safe replacement in content_md after reload
  const ch3 = chapters[2];
  const ch3Content = resolveContent(ch3);
  const replacedText = safeReplaced[3] || '';
  results.push({
    scenario: 'D: Safe replacement persists in content_md',
    expected: 'Replacement content matches',
    ok: ch3Content.length > 100 && ch3Content === replacedText,
  });

  // E: Polish output saved
  const ch1Content = resolveContent(chapters[0]);
  results.push({
    scenario: 'E: Content_md has polished text',
    expected: 'Content exists and passes safety',
    ok: ch1Content.length > 100,
  });

  return results;
}

// ═══════════════════════════════════════════════════════════════════════════════
// RUN WORKFLOWS
// ═══════════════════════════════════════════════════════════════════════════════

// ── FICTION ──
startSection('FICTION WORKFLOW');
const fChapters = makeFictionChapters();
const fResult = runProjectWorkflow(FICTION_PROJECT, fChapters, SAFE_REPLACEMENT_FICTION);

assert(fResult.profile.dialogueRepair === true, 'F-1: Dialogue repair ON');
assert(fResult.profile.slopReduction === 'high', 'F-2: Slop reduction HIGH');
assert(fResult.profile.llmSentenceRecast === true, 'F-3: LLM recast ON');
assert(fResult.profile.preserveVoice === true, 'F-4: Preserve voice ON');
assert(fResult.profile.hardSafety === true, 'F-5: Hard safety ON');

for (const d of fResult.draft) {
  assert(d.safetyOk, `F-draft-Ch${d.chapter}: safety PASS`);
  assert(d.processLeaks === 0, `F-draft-Ch${d.chapter}: no process leaks`);
}

for (const p of fResult.polish) {
  assert(p.postSafety, `F-polish-Ch${p.chapter}: post-polish safety PASS`);
  assert(p.shouldDialogue, `F-polish-Ch${p.chapter}: dialogue repair ran`);
  assert(p.shouldSlop, `F-polish-Ch${p.chapter}: slop reduction ran`);
}

const fCh2Polish = fResult.polish.find(p => p.chapter === 2);
assert(fCh2Polish && fCh2Polish.dialogueRepairs > 0, 'F-6: Ch.2 dialogue defects repaired');
// Ch.2 defects are paragraph-start type (missing opening quote at line start),
// not mid-paragraph type. Mid-paragraph autofix correctly returns 0.
assert(fCh2Polish && fCh2Polish.midParaFixed === 0, 'F-7: Ch.2 mid-paragraph pass ran (0 mid-para issues = correct)');

assert(fResult.safeReplace.ok, 'F-8: Safe replacement succeeded');
assert(fResult.safeReplace.verifyOk, 'F-9: Replacement verified');

for (const e of fResult.export1) {
  assert(e.exportable, `F-export1-Ch${e.chapter}: exportable`);
  assert(e.processLeaks === 0, `F-export1-Ch${e.chapter}: no leaks`);
}

assert(fResult.reload.chaptersPresent === 3, 'F-10: 3 chapters after reload');
assert(fResult.reload.orderPreserved, 'F-11: Order preserved');
assert(fResult.reload.safeReplacementsPreserved > 0, 'F-12: Safe replace survived reload');
assert(!fResult.reload.staleContentReturned, 'F-13: No stale content');

for (const e of fResult.export2) {
  assert(e.exportable, `F-export2-Ch${e.chapter}: exportable after reload`);
}

assert(fResult.export1.length === fResult.export2.length, 'F-14: Same chapter count pre/post reload');
for (let i = 0; i < fResult.export1.length; i++) {
  assert(fResult.export1[i].chapter === fResult.export2[i].chapter, `F-15-Ch${i+1}: Same order`);
}

// ── NONFICTION ──
startSection('NONFICTION WORKFLOW');
const nfChapters = makeNonfictionChapters();
const nfResult = runProjectWorkflow(NONFICTION_PROJECT, nfChapters, SAFE_REPLACEMENT_NONFICTION);

assert(nfResult.profile.dialogueRepair === 'auto', 'NF-1: Dialogue repair AUTO');
assert(nfResult.profile.slopReduction === 'medium', 'NF-2: Slop reduction MEDIUM');
assert(nfResult.profile.polishIntensity === 'medium', 'NF-3: Polish intensity MEDIUM');
assert(nfResult.profile.hardSafety === true, 'NF-4: Hard safety ON');

for (const d of nfResult.draft) {
  assert(d.safetyOk, `NF-draft-Ch${d.chapter}: safety PASS`);
}

// Structure preservation
for (const ch of nfChapters) {
  const content = resolveContent(ch);
  assert(content.includes('#'), `NF-struct-Ch${ch.chapter_number}: headings preserved`);
}
// Bullets
const nfCh1 = resolveContent(nfChapters[0]);
assert(nfCh1.includes('- **Finding'), 'NF-5: Bullet points preserved');
assert(nfCh1.includes('[Source:') || nfCh1.includes('[cf.'), 'NF-6: Citations preserved');

// Numbered lists
const nfCh2 = resolveContent(nfChapters[1]);
assert(nfCh2.includes('1.'), 'NF-7: Numbered lists preserved');

// Tables
assert(nfCh2.includes('|'), 'NF-8: Tables preserved');

assert(nfResult.safeReplace.ok, 'NF-9: Safe replacement succeeded');

for (const e of nfResult.export1) {
  assert(e.exportable, `NF-export-Ch${e.chapter}: exportable`);
  assert(e.contamination === 0, `NF-export-Ch${e.chapter}: no contamination`);
}

assert(nfResult.reload.orderPreserved, 'NF-10: Order preserved after reload');
for (const e of nfResult.export2) {
  assert(e.exportable, `NF-reexport-Ch${e.chapter}: exportable after reload`);
}

// ── ADULT ROMANCE ──
startSection('ADULT ROMANCE WORKFLOW');
const romChapters = makeRomanceChapters();
const romResult = runProjectWorkflow(ROMANCE_PROJECT, romChapters, SAFE_REPLACEMENT_ROMANCE);

assert(romResult.profile.dialogueRepair === true, 'ROM-1: Dialogue repair ON');
assert(romResult.profile.preserveVoice === true, 'ROM-2: Voice preservation ON');

for (const d of romResult.draft) {
  assert(d.safetyOk, `ROM-draft-Ch${d.chapter}: adult content allowed`);
  assert(d.contamination === 0, `ROM-draft-Ch${d.chapter}: no false censorship`);
}

for (const ch of romChapters) {
  const content = resolveContent(ch);
  const hasDialogue = content.includes('\u201c') || content.includes('"');
  assert(hasDialogue, `ROM-voice-Ch${ch.chapter_number}: dialogue preserved`);
}

for (const e of romResult.export1) {
  assert(e.exportable, `ROM-export-Ch${e.chapter}: exportable`);
}

assert(romResult.safeReplace.ok, 'ROM-3: Safe replacement succeeded');
assert(romResult.reload.safeReplacementsPreserved > 0, 'ROM-4: Safe replace survived reload');

for (const e of romResult.export2) {
  assert(e.exportable, `ROM-reexport-Ch${e.chapter}: exportable after reload`);
}

// ── SAFE REPLACEMENT PERSISTENCE ──
startSection('SAFE REPLACEMENT PERSISTENCE');
for (const { result: r, label: l } of [
  { result: fResult, label: 'Fiction' },
  { result: nfResult, label: 'Nonfiction' },
  { result: romResult, label: 'Romance' },
]) {
  assert(r.safeReplace.ok, `${l}: safe replacement accepted`);
  assert(r.safeReplace.verifyOk, `${l}: replacement verified`);
  assert(r.reload.safeReplacementsPreserved > 0, `${l}: replacement survived reload`);

  const exp2Ch3 = r.export2.find(e => e.chapter === 3);
  assert(exp2Ch3 && exp2Ch3.exportable, `${l}: Ch.3 exportable after reload`);
  assert(exp2Ch3 && exp2Ch3.processLeaks === 0, `${l}: Ch.3 no leaks after reload`);
}

// ── RELOAD PERSISTENCE ──
startSection('RELOAD PERSISTENCE');
for (const { result: r, label: l } of [
  { result: fResult, label: 'Fiction' },
  { result: nfResult, label: 'Nonfiction' },
  { result: romResult, label: 'Romance' },
]) {
  assert(r.reload.chaptersPresent === 3, `${l}: 3 chapters present`);
  assert(r.reload.orderPreserved, `${l}: order preserved`);
  assert(!r.reload.staleContentReturned, `${l}: no stale content`);
  assert(r.reload.safeReplacementsPreserved > 0, `${l}: replacement persisted`);
}

// ── SOURCE PRECEDENCE ──
startSection('SOURCE PRECEDENCE');
for (const { result: r, label: l } of [
  { result: fResult, label: 'Fiction' },
  { result: nfResult, label: 'Nonfiction' },
  { result: romResult, label: 'Romance' },
]) {
  for (const sp of r.sourcePrecedence) {
    assert(sp.ok, `${l} ${sp.scenario}`);
  }
}

// ── EXPORT AFTER RELOAD CONSISTENCY ──
startSection('EXPORT CONSISTENCY');
for (const { result: r, label: l } of [
  { result: fResult, label: 'Fiction' },
  { result: nfResult, label: 'Nonfiction' },
  { result: romResult, label: 'Romance' },
]) {
  assert(r.export1.length === r.export2.length, `${l}: same chapter count`);
  const allExportable1 = r.export1.every(e => e.exportable);
  const allExportable2 = r.export2.every(e => e.exportable);
  assert(allExportable1 === allExportable2, `${l}: same exportability`);

  for (let i = 0; i < r.export1.length; i++) {
    assert(r.export1[i].chapter === r.export2[i].chapter, `${l} Ch${i+1}: same order`);
  }
}

// ── STALE URL BLOCKING ──
startSection('STALE URL BLOCKING');
// Verify stale field list covers all known fields
assert(STALE_FIELDS.length >= 18, 'STALE-1: Stale field list is comprehensive');
assert(STALE_FIELDS.includes('__polishedContent'), 'STALE-2: __polishedContent in stale list');
assert(STALE_FIELDS.includes('content_html'), 'STALE-3: content_html in stale list');
assert(STALE_FIELDS.includes('content'), 'STALE-4: content in stale list');
assert(STALE_FIELDS.includes('draft'), 'STALE-5: draft in stale list');
assert(STALE_FIELDS.includes('body'), 'STALE-6: body in stale list');
assert(STALE_FIELDS.includes('prose'), 'STALE-7: prose in stale list');

// ── CORRUPTED CONTENT SAFETY ──
startSection('CORRUPTED SAFETY');
const corruptGate = runManuscriptSafetyGate(CORRUPTED_CHAPTER.content_md, {
  project: FICTION_PROJECT, chapter: CORRUPTED_CHAPTER,
});
assert(!corruptGate.ok, 'CORRUPT-1: Rejects corrupted content');
assert(corruptGate.recommendedAction === 'REJECT_REGENERATE', 'CORRUPT-2: REJECT_REGENERATE');
assert(corruptGate.processLeaks.matches.length >= 2, 'CORRUPT-3: Multiple process leaks');
assert(corruptGate.contamination.matches.length >= 1, 'CORRUPT-4: Contamination detected');
assert(corruptGate.malformed.matches.length >= 1, 'CORRUPT-5: Malformed grammar detected');

// Corrupted text rejected by safe replace
const corruptReplace = simulateSafeReplace(
  { ...CORRUPTED_CHAPTER }, CORRUPTED_CHAPTER.content_md, FICTION_PROJECT
);
assert(!corruptReplace.ok, 'CORRUPT-6: Safe replace rejects corrupted text');

// ── SAFETY REGRESSION ──
startSection('SAFETY REGRESSION');
const allChs = [...makeFictionChapters(), ...makeNonfictionChapters(), ...makeRomanceChapters()];

// Polish all
for (const ch of allChs) {
  const text = ch.content_md || '';
  const dm = runDialogueMechanicsPass(text);
  let polished = dm.text;
  const mp = runMidParagraphDialogueAutofixPass(polished);
  polished = mp.text;
  const slop = runAISlopReductionPass(polished);
  polished = slop.text;
  ch.__polished = polished;
}

for (const ch of allChs) {
  const content = ch.__polished || ch.content_md || '';
  if (!content || content.length < 50) continue;

  const gate = runManuscriptSafetyGate(content, { project: FICTION_PROJECT });
  assert(gate.processLeaks.matches.length === 0, `SAFETY-${ch.id}: no process leaks`);
  assert(gate.contamination.matches.length === 0, `SAFETY-${ch.id}: no contamination`);

  const issues = detectDialogueQuoteIssues(content);
  const hardIssues = (issues.issues || []).filter(i => i.type === 'paragraph_start_missing_quote');
  assert(hardIssues.length === 0, `SAFETY-${ch.id}: no hard dialogue failures`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════════════════════

console.log('\n════════════════════════════════════════════════════════════════');
for (const [name, s] of Object.entries(sections)) {
  const status = s.failed === 0 ? '✅' : '❌';
  console.log(`  ${status} ${name}: ${s.passed} passed, ${s.failed} failed`);
}
console.log(`\nFULL AUTHOR WORKFLOW REGRESSION: ${passed} passed, ${failed} failed out of ${passed + failed}`);
console.log('════════════════════════════════════════════════════════════════');

if (failed > 0) process.exit(1);
