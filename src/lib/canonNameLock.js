/**
 * Canon Name Lock v5
 *
 * Hard deterministic name-drift prevention and repair.
 *
 * Why v4 exists:
 * - v2 still allowed polluted manuscripts to keep both names when both appeared a lot.
 * - Songbird exposed the exact failure: Arthur/Langston and Cora/Clara coexisted.
 * - This version broadens project detection for hard project alias overrides and applies them aggressively
 *   once a project is recognized or a manual alias map is present.
 *
 * Public API is unchanged:
 * - buildCanonNameLockBlock(project, chapter, chapters)
 * - repairCanonNameDrift(text, { project, chapter, chapters })
 * - detectCanonNameDrift(text, { project, chapter, chapters })
 */

const COMMON_NON_CHARACTER_NAMES = new Set([
  'Chapter', 'Part', 'Scene', 'Story', 'The', 'This', 'That', 'These', 'Those',
  'American', 'America', 'Paris', 'New', 'York', 'Harlem', 'Broadway', 'Committee',
  'Washington', 'February', 'March', 'April', 'Monday', 'Tuesday', 'Wednesday',
  'Thursday', 'Friday', 'Saturday', 'Sunday', 'Act', 'Port', 'Chicago', 'Glass',
  'Menagerie', 'Children', 'Hour', 'Navy', 'Federal', 'Theatre', 'Institute',
  'Dramatic', 'Arts', 'Songbird', 'Love', 'Story',
]);

const PROJECT_ALIAS_OVERRIDES = [
  {
    id: 'songbird',
    test: (blob = '') => /\bSongbird\b/i.test(blob)
      || (/\bIris\b/.test(blob) && /\bPauline\b/.test(blob))
      || (/\bIris Finch\b/.test(blob) && /\bPauline Carter\b/.test(blob))
      || (/\bLangston Finch\b/.test(blob) && /\bIris\b/.test(blob))
      || /Harlem Institute|HIDA|Children.?s Hour|Glass Menagerie|Port Chicago|The Last Goodbye|Scoring the Silence/i.test(blob),
    aliases: [
      {
        from: 'Arthur',
        to: 'Langston',
        reason: 'Songbird hard canon: current husband/manager is Langston Finch',
        protectedPhrases: [
          'Arthur Miller',
          'Arthurian',
          'King Arthur',
          'Arthur Murray',
          'Arthurian legend',
        ],
      },
      {
        from: 'Arthur Finch',
        to: 'Langston Finch',
        reason: 'Songbird hard canon: current husband/manager is Langston Finch',
        protectedPhrases: [],
      },
      {
        from: 'Cora',
        to: 'Clara',
        reason: 'Songbird hard canon: daughter/stage manager is Clara',
        protectedPhrases: [],
      },
    ],
  },
];

function escapeRx(s = '') {
  return String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getProjectText(project = {}, chapter = {}, chapters = []) {
  const fields = [
    project.title,
    project.name,
    project.genre,
    project.subgenre,
    project.description,
    project.logline,
    project.setup_md,
    project.story_bible_md,
    project.character_bible_md,
    project.characters_md,
    project.world_bible_md,
    project.world_md,
    project.canon_md,
    project.outline_md,
    project.voice_md,
    project.draft_profile_snapshot && JSON.stringify(project.draft_profile_snapshot),
    project.canon_name_map_md,
    project.name_alias_map_md,
    project.forbidden_aliases_md,
    project.canon_alias_map_md,
    project.hard_alias_map_md,
    chapter?.title,
    chapter?.summary,
    chapter?.description,
    chapter?.outline,
    chapter?.beats,
    ...(Array.isArray(chapters) ? chapters.flatMap(ch => [
      ch?.title,
      ch?.summary,
      ch?.description,
      ch?.outline,
      ch?.beats,
    ]) : []),
  ];
  return fields.filter(Boolean).join('\n');
}

function countName(text = '', name = '') {
  if (!name) return 0;
  return (String(text || '').match(new RegExp('\\b' + escapeRx(name) + '\\b', 'g')) || []).length;
}

function countFullName(text = '', first = '', last = '') {
  if (!first || !last) return 0;
  return (String(text || '').match(new RegExp('\\b' + escapeRx(first) + '\\s+' + escapeRx(last) + '\\b', 'g')) || []).length;
}

function parseManualNameMap(project = {}) {
  const raw = [
    project.canon_name_map_md,
    project.name_alias_map_md,
    project.forbidden_aliases_md,
    project.canon_alias_map_md,
    project.hard_alias_map_md,
  ].filter(Boolean).join('\n');

  const pairs = [];
  const lines = String(raw || '').split(/\n+/).map(s => s.trim()).filter(Boolean);

  for (const line of lines) {
    let m = line.match(/(?:never use|forbidden|alias|replace)\s+([A-Z][A-Za-z'’.-]+(?:\s+[A-Z][A-Za-z'’.-]+)?)\s*(?:->|→|with|; use|, use|as)\s*([A-Z][A-Za-z'’.-]+(?:\s+[A-Z][A-Za-z'’.-]+)?)/i);
    if (m) {
      pairs.push({ from: m[1].replace(/[’']/g, "'"), to: m[2].replace(/[’']/g, "'"), reason: 'manual alias map', protectedPhrases: [] });
      continue;
    }
    m = line.match(/^([A-Z][A-Za-z'’.-]+(?:\s+[A-Z][A-Za-z'’.-]+)?)\s*(?:->|→|=)\s*([A-Z][A-Za-z'’.-]+(?:\s+[A-Z][A-Za-z'’.-]+)?)$/);
    if (m) pairs.push({ from: m[1].replace(/[’']/g, "'"), to: m[2].replace(/[’']/g, "'"), reason: 'manual alias map', protectedPhrases: [] });
  }
  return pairs;
}

function inferHardProjectOverrides(projectText = '', content = '') {
  const blob = `${projectText}\n${content || ''}`;
  const pairs = [];
  for (const projectRule of PROJECT_ALIAS_OVERRIDES) {
    if (!projectRule.test(blob)) continue;
    for (const alias of projectRule.aliases) pairs.push({ ...alias, reason: `${alias.reason} [${projectRule.id}]`, hard: true });
  }
  return pairs;
}

function inferAliasPairs(projectText = '', content = '') {
  const pairs = [];

  const checks = [
    { a: 'Langston', b: 'Arthur', surname: 'Finch' },
    { a: 'Nikolai', b: 'Halvard' },
    { a: 'Clara', b: 'Cora' },
    { a: 'Pauline', b: 'Paula' },
  ];

  for (const { a, b, surname } of checks) {
    const aCanon = surname ? countFullName(projectText, a, surname) : countName(projectText, a);
    const bCanon = surname ? countFullName(projectText, b, surname) : countName(projectText, b);
    const aIn = countName(content, a);
    const bIn = countName(content, b);

    if (aIn && bIn && aCanon > 0 && bCanon === 0) {
      pairs.push({ from: b, to: a, reason: `${a} is canonical; ${b} appears to be drift`, protectedPhrases: [] });
    } else if (aIn && bIn && bCanon > 0 && aCanon === 0) {
      pairs.push({ from: a, to: b, reason: `${b} is canonical; ${a} appears to be drift`, protectedPhrases: [] });
    } else if (aIn && bIn && surname && countFullName(content, a, surname) > 0 && countFullName(content, b, surname) > 0) {
      const aScore = countName(projectText, a) + countName(content, a);
      const bScore = countName(projectText, b) + countName(content, b);
      if (aScore >= bScore) pairs.push({ from: b, to: a, reason: `${a} is dominant full-name canon`, protectedPhrases: [] });
      else pairs.push({ from: a, to: b, reason: `${b} is dominant full-name canon`, protectedPhrases: [] });
    }
  }

  return pairs;
}

function uniquePairs(pairs = []) {
  const seen = new Set();
  return pairs.filter(p => {
    if (!p?.from || !p?.to || p.from === p.to) return false;
    const key = `${p.from}=>${p.to}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function preservePlaceholders(text = '', protectedPhrases = []) {
  let out = String(text || '');
  const placeholders = [];
  protectedPhrases.filter(Boolean).forEach((phrase, index) => {
    const token = `__CANON_NAME_LOCK_PROTECTED_${index}_${Math.random().toString(36).slice(2)}__`;
    const rx = new RegExp('\\b' + escapeRx(phrase) + '\\b', 'g');
    out = out.replace(rx, token);
    placeholders.push({ token, phrase });
  });
  return { text: out, placeholders };
}

function restorePlaceholders(text = '', placeholders = []) {
  let out = String(text || '');
  for (const { token, phrase } of placeholders) out = out.split(token).join(phrase);
  return out;
}

function replaceNameSafely(text = '', pair = {}) {
  const from = pair.from || '';
  const to = pair.to || '';
  let out = String(text || '');
  let count = 0;
  if (!from || !to || from === to) return { text: out, count };

  const protectedState = preservePlaceholders(out, pair.protectedPhrases || []);
  out = protectedState.text;

  const fromParts = from.split(/\s+/).filter(Boolean);
  const toParts = to.split(/\s+/).filter(Boolean);
  const fromFirst = fromParts[0];
  const toFirst = toParts[0];
  const escapedFrom = escapeRx(from);
  const escapedFirst = escapeRx(fromFirst);

  // Full phrase first: Arthur Finch -> Langston Finch.
  out = out.replace(new RegExp('\\b' + escapedFrom + '\\b', 'g'), (match) => {
    count += 1;
    return match === match.toUpperCase() ? to.toUpperCase() : to;
  });

  // If the alias is a full name, also repair possessive full-name usage.
  out = out.replace(new RegExp('\\b' + escapedFrom + "(['’])s\\b", 'g'), (_m, apos) => {
    count += 1;
    return `${to}${apos}s`;
  });

  // If this is a first-name-level alias, repair standalone and possessive first names.
  if (fromParts.length === 1 && toParts.length >= 1) {
    out = out.replace(new RegExp('\\b' + escapedFirst + "(['’])s\\b", 'g'), (_m, apos) => {
      count += 1;
      return `${toFirst}${apos}s`;
    });

    out = out.replace(new RegExp('\\b' + escapedFirst + '\\b(?!\\s+Miller\\b)(?!\\s+Street\\b)(?!ian\\b)', 'g'), (match) => {
      count += 1;
      if (match === match.toUpperCase()) return toFirst.toUpperCase();
      return toFirst;
    });
  }

  out = restorePlaceholders(out, protectedState.placeholders);
  return { text: out, count };
}

function extractLikelyCanonNames(project = {}, chapter = {}, chapters = []) {
  const text = getProjectText(project, chapter, chapters);
  const matches = text.match(/\b[A-Z][a-zA-Z’'-]{2,}(?:\s+[A-Z][a-zA-Z’'-]{2,})?\b/g) || [];
  const map = new Map();
  for (const m of matches) {
    const first = m.split(/\s+/)[0].replace(/[’']/g, '');
    if (!first || COMMON_NON_CHARACTER_NAMES.has(first)) continue;
    map.set(first, (map.get(first) || 0) + 1);
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

function getAllAliasPairs(projectText = '', content = '', project = {}) {
  return uniquePairs([
    ...parseManualNameMap(project),
    ...inferHardProjectOverrides(projectText, content),
    ...inferAliasPairs(projectText, content),
  ]);
}

export function buildCanonNameLockBlock(project = {}, chapter = {}, chapters = []) {
  const projectText = getProjectText(project, chapter, chapters);
  const canonNames = extractLikelyCanonNames(project, chapter, chapters)
    .filter(([, count]) => count >= 2)
    .slice(0, 40)
    .map(([name]) => name);

  const pairs = getAllAliasPairs(projectText, '', project);
  const aliasLines = pairs
    .map(x => `- HARD LOCK: Never use ${x.from}; use ${x.to}. Reason: ${x.reason}.`)
    .join('\n');

  return `\nCANON NAME LOCK:\n- Use the established character names from this project only.\n- Do not rename, substitute, or alternate names for existing roles.\n- If the husband/manager is established as Langston Finch, never call him Arthur.\n- If the daughter/stage manager is established as Clara, never call her Cora.\n- If an antagonist, patron, handler, director, lover, or family member has an established name, keep that exact name.\n- Do not import names from other projects or earlier drafts.\n${canonNames.length ? `- Current likely canon roster: ${canonNames.join(', ')}.\n` : ''}${aliasLines ? aliasLines + '\n' : ''}`;
}

export function repairCanonNameDrift(text, { project = {}, chapter = {}, chapters = [] } = {}) {
  let out = String(text || '');
  const before = out;
  const projectText = getProjectText(project, chapter, chapters);
  const repairs = [];

  const pairs = getAllAliasPairs(projectText, out, project);
  for (const pair of pairs) {
    const r = replaceNameSafely(out, pair);
    if (r.count) {
      out = r.text;
      repairs.push(`${pair.from} → ${pair.to} (${r.count}; ${pair.reason})`);
    }
  }

  return { text: out, changed: out !== before, repairs };
}

export function detectCanonNameDrift(text, { project = {}, chapter = {}, chapters = [] } = {}) {
  const projectText = getProjectText(project, chapter, chapters);
  const content = String(text || '');
  const warnings = [];
  const pairs = getAllAliasPairs(projectText, content, project);

  for (const pair of pairs) {
    const protectedState = preservePlaceholders(content, pair.protectedPhrases || []);
    const n = countName(protectedState.text, pair.from);
    if (n > 0) warnings.push(`${pair.from} appears ${n} time(s), but canon prefers ${pair.to} (${pair.reason})`);
  }

  return { warnings, hasDrift: warnings.length > 0 };
}

export default {
  buildCanonNameLockBlock,
  repairCanonNameDrift,
  detectCanonNameDrift,
};
