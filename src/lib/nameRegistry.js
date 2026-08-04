/**
 * Character name uniqueness enforcement.
 * Prevents the LLM from reusing the same "AI-favorite" names across projects.
 */

import { base44 } from '@/api/base44Client';

// Names that LLMs default to across all models — blocked unless user manually types them
export const AI_FAVORITE_NAMES = [
  // First names AI loves
  'Elara', 'Kaelen', 'Kael', 'Elias', 'Evelina', 'Aria', 'Lyra',
  'Rowan', 'Asher', 'Caspian', 'Soren', 'Theron', 'Zara', 'Seraphina',
  'Isolde', 'Elowen', 'Aiden', 'Kira', 'Riven', 'Silas', 'Orion',
  'Luna', 'Sage', 'Ember', 'Ivy', 'Wren', 'Jasper', 'Felix',
  'Aurora', 'Celeste', 'Darius', 'Ezra', 'Kai', 'Lila', 'Maren',
  'Nyx', 'Quinn', 'Rhys', 'Sable', 'Talon', 'Vale', 'Zephyr',
  'Cassian', 'Dorian', 'Evander', 'Freya', 'Gideon', 'Hadrian',
  'Isadora', 'Juno', 'Kieran', 'Leander', 'Magnus', 'Nadia',
  'Ophelia', 'Petra', 'Rafael', 'Stellan', 'Thane', 'Viktor',
  // Surnames AI loves
  'Thorne', 'Vance', 'Blackwell', 'Ashford', 'Sterling', 'Winters',
  'Nightingale', 'Graves', 'Storm', 'Drake', 'Frost', 'Cross',
  'Wolfe', 'Raven', 'Crane', 'Hart', 'Stone', 'Shaw', 'Pierce',
  'Sinclair', 'Holloway', 'Fairchild', 'Lockwood', 'Whitmore',
  'Blackwood', 'Thornton', 'Ravencroft', 'Darkmore',
];

/**
 * Collects all character names from existing projects to avoid reuse.
 * Excludes the current project (by ID) so editing doesn't flag its own names.
 */
export async function getUsedCharacterNames(excludeProjectId) {
  try {
    const allProjects = await base44.entities.NovelProject.list('-updated_date', 200);
    const usedNames = new Set();

    for (const project of allProjects) {
      if (excludeProjectId && project.id === excludeProjectId) continue;

      const charMd = project.characters_md || '';
      const namePatterns = [
        /###\s+([A-Z][a-z]+(?:\s+[A-Za-z'-]+)?)/g,
        /\*\*([A-Z][a-z]+(?:\s+[A-Za-z'-]+)?)\s*\(/g,
        /^([A-Z][a-z]+(?:\s+[A-Za-z'-]+)?)\s*\(/gm,
      ];

      for (const pattern of namePatterns) {
        let match;
        while ((match = pattern.exec(charMd)) !== null) {
          const name = match[1].trim();
          if (name.length > 2) {
            usedNames.add(name);
            const parts = name.split(/\s+/);
            for (const p of parts) {
              if (p.length > 2 && p[0] === p[0].toUpperCase()) usedNames.add(p);
            }
          }
        }
      }
    }

    return Array.from(usedNames).filter(n => n.length > 2 && !COMMON_WORDS.has(n));
  } catch (e) {
    console.warn('[NAMES] Could not load used names:', e.message);
    return [];
  }
}

/**
 * NAMEHYGIENE-1 — the names the AUTHOR chose, taken from their own premise.
 *
 * MEASURED on The Gilded Hour, 2026-08-04. The premise names the house steward
 * **Silas Bram**, and says he hands Nell the key in front of witnesses and is found
 * dead in chapter 3. "Silas" is on the Tier-1 blocked AI-default list, and
 * DEFAULT_NAME_REPLACEMENT_SUGGESTIONS offers Silas -> ["Nolan", ...] first. The
 * exclusion block below ends with "If ANY match the banned list, replace them
 * immediately", so the architect obeyed and shipped an outline starring
 * **Nolan Bram** — a character the author never wrote, carrying the first name of
 * the protagonist's colleague in a completely different book.
 *
 * The hygiene system is right in general: "Silas" IS an AI-slop name and banning it
 * for INVENTED characters is the entire point. But a name in the premise is not the
 * model's invention, it is a specification. Nothing may silently overwrite what the
 * author asked for — the same closed-world principle the gates apply to facts,
 * applied to the brief.
 *
 * Deliberately literal: a banned name is exempt only if that exact token appears,
 * capitalised, in the author's own text. No name inference, no NER, no guessing.
 */
export function extractAuthorChosenNames(authorText) {
  return new Set(String(authorText || '').match(/\b[A-Z][A-Za-z'’-]+\b/g) || []);
}

/**
 * Builds the name exclusion instruction block for story bible prompts.
 *
 * NAMEHYGIENE-1: pass the author's premise as `authorText` and any banned name they
 * used is removed from the ban list and stated positively as required instead.
 * Defaults to '' so existing callers are unaffected.
 */
export function buildNameExclusionBlock(bannedNames, authorText = '') {
  if (!bannedNames || !bannedNames.length) return '';

  const authorNames = extractAuthorChosenNames(authorText);
  const authorChose = bannedNames.filter((n) => authorNames.has(String(n)));
  const stillBanned = bannedNames.filter((n) => !authorNames.has(String(n)));
  if (authorChose.length) {
    console.warn(
      `[NAMEHYGIENE-1] ${authorChose.length} banned name(s) appear in the author's own premise `
      + `and are protected from replacement: ${authorChose.join(', ')}`,
    );
  }
  if (!stillBanned.length && !authorChose.length) return '';

  const authorBlock = authorChose.length
    ? `
AUTHOR-SPECIFIED NAMES — USE THESE EXACTLY AS WRITTEN: ${authorChose.join(', ')}
These names come from the author's own brief. They are NOT AI-default names in this
book and they are NOT subject to the ban below. Do not substitute, soften, modernise
or "improve" them. Spell them exactly as given, every time.
`
    : '';

  return `
═══ CHARACTER NAMING RULES (MANDATORY) ═══
${authorBlock}
You MUST NOT use any of the following names (first OR last) for any character. These have been used in other projects or are AI-default names that appear in machine-generated fiction:

BANNED NAMES: ${stillBanned.join(', ')}

Instead, choose names that are:
1. CULTURALLY SPECIFIC to the setting. A book set in 1869 Egypt should have Arabic, Turkish, Coptic, and English colonial names — not fantasy names.
2. PHONETICALLY DISTINCT from each other. No two main characters should share a starting letter or syllable.
3. GROUNDED AND REAL. Use names actual humans have. If it sounds like a video game character creator, pick something else.
4. VARIED IN ORIGIN. Mix naming origins based on the setting's demographics.
5. MEMORABLE BUT NOT PRECIOUS. "Tom" is forgettable. "Thalindra" is trying too hard. "Declan" is right.

Good examples by genre:
- Contemporary: Margot, Declan, Priya, Tomás, Nia, Kenji
- Historical: Adelaide, Cornelius, Fatima, Hugh, Leonie, Rashid
- Sci-Fi: Jian, Okoye, Petra, Alexei, Amara, Nils
- Fantasy: Use real-world linguistic roots. Celtic (Cormac, Niamh), Arabic (Tariq, Yasmin), Norse (Sigrid, Bjorn)
- Thriller: Short, hard-sounding. Cole, Noor, Brix, Tess, Voss, Kade

VERIFY before finalizing: scan ALL character names in your response. If ANY match the banned list, replace them immediately.

═══ END CHARACTER NAMING RULES ═══
`;
}

// Words that appear in character depth templates but are NOT character names
const COMMON_WORDS = new Set([
  'The', 'And', 'But', 'For', 'Not', 'She', 'Her', 'His', 'Him',
  'They', 'Who', 'What', 'How', 'Why', 'When', 'Where', 'Key',
  'Breaking', 'Point', 'Sacrifice', 'Dynamic', 'Wound', 'Want',
  'Need', 'Arc', 'Lie', 'Mask', 'Tell', 'Grace', 'Moment',
  'Coping', 'Mechanism', 'Humor', 'Style', 'Attachment',
  'Signature', 'Comfort', 'Ritual', 'Dialogue', 'Fingerprint',
  'Social', 'Physical', 'Emotional', 'None', 'Chapter',
  'Structural', 'Behavioral', 'Relational', 'Sensory',
  'Internal', 'Monologue', 'Space', 'Body', 'Sense',
]);

/**
 * Extracts actual character names from characters_md, ignoring section headers
 * and depth-profile labels.
 */
function extractCharacterNames(charactersMd) {
  const extracted = new Set();

  const namePatterns = [
    /###\s+([A-Z][a-z]+(?:\s+[A-Z][a-z'-]+)?)/g,
    /\*\*([A-Z][a-z]+(?:\s+[A-Z][a-z'-]+)?)\s*\(/g,
    /^([A-Z][a-z]+(?:\s+[A-Z][a-z'-]+)?)\s*\((?:protagonist|antagonist|love.interest|supporting|friend|mentor|villain|guide|sidekick)/gim,
  ];

  for (const pattern of namePatterns) {
    let match;
    while ((match = pattern.exec(charactersMd)) !== null) {
      const fullName = match[1].trim();
      if (fullName.length > 2) {
        extracted.add(fullName);
        const parts = fullName.split(/\s+/);
        for (const part of parts) {
          if (part.length > 2 && part[0] === part[0].toUpperCase()) {
            extracted.add(part);
          }
        }
      }
    }
  }

  return Array.from(extracted).filter(n => !COMMON_WORDS.has(n));
}

/**
 * Checks generated characters_md for banned names. Returns array of found names.
 * Only checks ACTUAL character names, not section headers or descriptions.
 */
export function checkForBannedNames(charactersMd, bannedNames) {
  if (!charactersMd || !bannedNames?.length) return [];

  const actualNames = extractCharacterNames(charactersMd);
  const bannedLower = bannedNames.map(n => n.toLowerCase());
  const found = [];

  for (const name of actualNames) {
    if (bannedLower.includes(name.toLowerCase())) {
      found.push(name);
    }
  }

  return found;
}