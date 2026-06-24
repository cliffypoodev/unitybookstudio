// src/lib/nameHygieneRules.js
//
// Shared universal name hygiene / AI-slop name rules.
// Purpose:
// - Prevent recycled AI-default character names during drafting.
// - Detect high-risk names during post-draft cleanup and manuscript polish.
// - Provide safe replacement suggestions.
// - Never automatically rename major characters unless an explicit replacement map is supplied.
//
// This file is intentionally genre-agnostic.
// It should be used by fiction, anthology, erotica, thriller, sci-fi, fantasy,
// nonfiction narrative, and any future writing modes.

export const NAME_HYGIENE_VERSION = "name-hygiene-rules-v1-global-ai-slop-database";

export const NAME_RISK_LEVELS = Object.freeze({
  BLOCKED: "blocked",
  HIGH: "high",
  MEDIUM: "medium",
  WATCH: "watch",
});

export const NAME_ACTIONS = Object.freeze({
  PREVENT_DRAFTING: "prevent_drafting",
  FLAG_ONLY: "flag_only",
  REPLACE_ONLY_WITH_APPROVED_MAP: "replace_only_with_approved_map",
});

/**
 * Tier 1:
 * Names that should be treated as always suspicious in generated fiction unless
 * the user explicitly provided them.
 *
 * These came from the old anthology contamination / AI-slop name behavior and
 * should now be shared globally.
 */
export const TIER_1_ALWAYS_BANNED_AI_NAMES = [
  "Kaelen",
  "Kaelan",
  "Kaelin",
  "Kalen",
  "Caelen",
  "Caelan",

  "Cassian",
  "Caspian",
  "Theron",
  "Aldric",
  "Aelric",
  "Caelum",
  "Isolde",
  "Thorne",
  "Silas",

  "Elias",
  "Vane",
  "Orin",
  "Mireille",
  "Lucien",
  "Lucian",
  "Evander",
  "Auren",
  "Aurelia",
  "Seraphina",
  "Elowen",
  "Lyra",
  "Liora",
  "Rowan",
];

/**
 * Tier 2:
 * High-risk names. These are not always forbidden in every context, but they are
 * overused by AI models and should be discouraged unless user-provided.
 */
export const TIER_2_HIGH_RISK_AI_NAMES = [
  "Aelar",
  "Aeliana",
  "Aeris",
  "Aether",
  "Alaric",
  "Alistair",
  "Amara",
  "Anara",
  "Ansel",
  "Arden",
  "Aria",
  "Ashen",
  "Aster",
  "Aurelius",
  "Azriel",

  "Briar",
  "Calder",
  "Callan",
  "Callum",
  "Caius",
  "Caiaphas",
  "Cedric",
  "Cyrus",

  "Darian",
  "Dashiell",
  "Dorian",
  "Draven",

  "Elara",
  "Eldric",
  "Elian",
  "Elion",
  "Ember",
  "Emrys",
  "Eryndor",

  "Fenris",
  "Finnian",
  "Finnegan",

  "Galen",
  "Gareth",
  "Gideon",

  "Ilaria",
  "Illyria",
  "Ione",

  "Jareth",
  "Jasper",

  "Kael",
  "Kieran",
  "Kiernan",
  "Killian",

  "Lark",
  "Lazaro",
  "Leander",
  "Lena",
  "Lysander",

  "Maelis",
  "Maelor",
  "Marcellus",
  "Marius",
  "Marek",
  "Marisol",

  "Nerys",
  "Nikolai",
  "Nova",

  "Octavia",
  "Orion",

  "Peregrine",
  "Phoenix",

  "Quentin",

  "Rafe",
  "Raven",
  "Rhys",
  "Ronan",

  "Sable",
  "Sage",
  "Selene",
  "Sera",
  "Seren",
  "Severin",
  "Soren",
  "Sylas",

  "Talon",
  "Taryn",
  "Tova",
  "Tristan",

  "Vesper",
  "Voss",

  "Wren",

  "Xander",

  "Zephyr",
];

/**
 * Tier 3:
 * Watch-list terms. These may be normal names/words in some manuscripts, but
 * when clustered with Tier 1 or Tier 2 names, they often signal AI-generated
 * fantasy/sci-fi defaults.
 */
export const TIER_3_WATCHLIST_NAMES = [
  "Vale",
  "Vance",
  "Aric",
  "Joric",
  "Gerrard",
  "Marek",
  "Brody",
  "Lev",
  "Kael",
  "Ronan",
  "Jonah",
  "Eleanor",
  "Parker",
  "Greta",
  "Lydia",
  "Clara",
  "Miguel",
  "Doyle",
  "Novak",
  "Hank",
  "Lundqvist",
  "Dubois",
];

/**
 * Suggestion pool.
 * These are not automatically applied. They are offered to the user or UI as
 * grounded alternatives when a banned/high-risk name is detected.
 */
export const GROUNDED_NAME_SUGGESTIONS = [
  "Grant",
  "Nolan",
  "Dean",
  "Dane",
  "Drew",
  "Miles",
  "Cal",
  "Reed",
  "Bennett",
  "Graham",
  "Wade",
  "Russell",
  "Harris",
  "Cole",
  "Evan",
  "Mason",
  "Troy",
  "Clark",
  "Darren",
  "Joel",
  "Shane",
  "Warren",
  "Glen",
  "Marcus",
  "Paul",
  "Victor",
  "Owen",
  "Trevor",
  "Neil",
  "Simon",
  "Patrick",
  "Ray",
  "Frank",
  "Martin",
  "Dennis",
  "Keith",
  "Alan",
  "Roger",
  "Dale",
  "Brett",
  "Clint",
  "Howard",
  "Lewis",
  "Sam",
  "Elliot",
  "Arthur",
  "Walter",
  "Julian",
  "Malcolm",
  "Gordon",

  "Mara",
  "Nora",
  "Claire",
  "Miriam",
  "Ruth",
  "Helen",
  "Grace",
  "June",
  "Audrey",
  "Lydia",
  "Margo",
  "Elaine",
  "Tessa",
  "Naomi",
  "Vera",
  "Iris",
  "Molly",
  "Beth",
  "Anne",
  "Rose",
  "Diane",
  "Sylvia",
  "Marion",
  "Paula",
  "Joan",
  "Carla",
  "Renee",
  "Sonia",
  "Leah",
  "Rachel",
  "Ellen",
  "Maureen",
  "Janet",
  "Lois",
  "Celia",
];

/**
 * Optional default suggestions for specific common offenders.
 * These are suggestions only. Do not auto-apply without user approval.
 */
export const DEFAULT_NAME_REPLACEMENT_SUGGESTIONS = Object.freeze({
  Kaelen: ["Dane", "Grant", "Reed", "Nolan", "Cal", "Wade"],
  Kaelan: ["Dane", "Grant", "Reed", "Nolan", "Cal", "Wade"],
  Kaelin: ["Dane", "Grant", "Reed", "Nolan", "Cal", "Wade"],
  Kalen: ["Dane", "Grant", "Reed", "Nolan", "Cal", "Wade"],
  Caelen: ["Dane", "Grant", "Reed", "Nolan", "Cal", "Wade"],
  Caelan: ["Dane", "Grant", "Reed", "Nolan", "Cal", "Wade"],

  Cassian: ["Grant", "Malcolm", "Julian", "Victor", "Warren", "Simon"],
  Caspian: ["Grant", "Malcolm", "Julian", "Victor", "Warren", "Simon"],
  Theron: ["Graham", "Russell", "Clark", "Martin", "Keith", "Harris"],
  Aldric: ["Walter", "Arthur", "Gordon", "Howard", "Lewis", "Frank"],
  Aelric: ["Walter", "Arthur", "Gordon", "Howard", "Lewis", "Frank"],
  Caelum: ["Cal", "Dean", "Drew", "Mason", "Joel", "Troy"],
  Isolde: ["Mara", "Claire", "Nora", "Vera", "Iris", "Ruth"],
  Thorne: ["Harris", "Reed", "Grant", "Clark", "Wade", "Bennett"],
  Silas: ["Nolan", "Dean", "Russell", "Joel", "Graham", "Simon"],
  Elias: ["Nolan", "Grant", "Evan", "Simon", "Arthur", "Darren"],
  Vane: ["Hale", "Cole", "Reed", "Brandt", "Crane", "Marsh"],
  Orin: ["Owen", "Dean", "Wade", "Paul", "Glen", "Victor"],
  Mireille: ["Mara", "Miriam", "Claire", "Vera", "Helen", "Naomi"],
  Lucien: ["Julian", "Victor", "Martin", "Simon", "Graham", "Warren"],
  Evander: ["Evan", "Grant", "Darren", "Bennett", "Marcus", "Trevor"],
  Elowen: ["Ellen", "Elaine", "Nora", "Grace", "Margo", "Beth"],
  Seraphina: ["Sylvia", "Sonia", "Renee", "Naomi", "Rachel", "Celia"],
  Auren: ["Owen", "Arthur", "Warren", "Alan", "Gordon", "Lewis"],
  Aurelia: ["Audrey", "Elaine", "Vera", "Helen", "Marion", "Diane"],
  Lyra: ["Leah", "Lydia", "Iris", "Rose", "Tessa", "June"],
  Liora: ["Leah", "Lois", "Nora", "Iris", "Ruth", "Celia"],
  Rowan: ["Reed", "Owen", "Nolan", "Grant", "Cal", "Wade"],
});

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeName(value) {
  return String(value || "")
    .trim()
    .replace(/[’]/g, "'")
    .replace(/\s+/g, " ");
}

function uniqueSorted(values) {
  return Array.from(
    new Set(
      values
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b));
}

export function getAllBlockedNames() {
  return uniqueSorted(TIER_1_ALWAYS_BANNED_AI_NAMES);
}

export function getAllHighRiskNames() {
  return uniqueSorted(TIER_2_HIGH_RISK_AI_NAMES);
}

export function getAllWatchlistNames() {
  return uniqueSorted(TIER_3_WATCHLIST_NAMES);
}

export function getAllNameHygieneTerms() {
  return uniqueSorted([
    ...TIER_1_ALWAYS_BANNED_AI_NAMES,
    ...TIER_2_HIGH_RISK_AI_NAMES,
    ...TIER_3_WATCHLIST_NAMES,
  ]);
}

export function getNameRiskLevel(name) {
  const clean = normalizeName(name).toLowerCase();

  if (TIER_1_ALWAYS_BANNED_AI_NAMES.some((item) => item.toLowerCase() === clean)) {
    return NAME_RISK_LEVELS.BLOCKED;
  }

  if (TIER_2_HIGH_RISK_AI_NAMES.some((item) => item.toLowerCase() === clean)) {
    return NAME_RISK_LEVELS.HIGH;
  }

  if (TIER_3_WATCHLIST_NAMES.some((item) => item.toLowerCase() === clean)) {
    return NAME_RISK_LEVELS.WATCH;
  }

  return null;
}

export function getReplacementSuggestionsForName(name, limit = 8) {
  const clean = normalizeName(name);
  const direct = DEFAULT_NAME_REPLACEMENT_SUGGESTIONS[clean];

  if (Array.isArray(direct) && direct.length) {
    return direct.slice(0, limit);
  }

  return GROUNDED_NAME_SUGGESTIONS.slice(0, limit);
}

function buildNameRegex(name) {
  const escaped = escapeRegex(name);
  return new RegExp(`\\b${escaped}\\b`, "gi");
}

export function countNameOccurrences(text, name) {
  const source = String(text || "");
  if (!source.trim() || !name) return 0;

  const matches = source.match(buildNameRegex(name));
  return matches ? matches.length : 0;
}

export function scanNameHygieneInText(text, options = {}) {
  const source = String(text || "");
  const {
    includeHighRisk = true,
    includeWatchlist = false,
    minimumCount = 1,
    userApprovedNames = [],
  } = options;

  const approved = new Set(
    userApprovedNames.map((name) => normalizeName(name).toLowerCase())
  );

  const candidates = [
    ...TIER_1_ALWAYS_BANNED_AI_NAMES.map((name) => ({
      name,
      tier: 1,
      risk: NAME_RISK_LEVELS.BLOCKED,
      action: NAME_ACTIONS.PREVENT_DRAFTING,
    })),
    ...(includeHighRisk
      ? TIER_2_HIGH_RISK_AI_NAMES.map((name) => ({
          name,
          tier: 2,
          risk: NAME_RISK_LEVELS.HIGH,
          action: NAME_ACTIONS.FLAG_ONLY,
        }))
      : []),
    ...(includeWatchlist
      ? TIER_3_WATCHLIST_NAMES.map((name) => ({
          name,
          tier: 3,
          risk: NAME_RISK_LEVELS.WATCH,
          action: NAME_ACTIONS.FLAG_ONLY,
        }))
      : []),
  ];

  const byName = new Map();

  for (const candidate of candidates) {
    const normalized = normalizeName(candidate.name);
    const key = normalized.toLowerCase();

    if (approved.has(key)) continue;
    if (byName.has(key)) continue;

    const count = countNameOccurrences(source, normalized);
    if (count < minimumCount) continue;

    byName.set(key, {
      name: normalized,
      count,
      tier: candidate.tier,
      risk: candidate.risk,
      action: candidate.action,
      suggestions: getReplacementSuggestionsForName(normalized),
    });
  }

  const hits = Array.from(byName.values()).sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    if (b.count !== a.count) return b.count - a.count;
    return a.name.localeCompare(b.name);
  });

  return {
    ok: hits.length === 0,
    version: NAME_HYGIENE_VERSION,
    totalHits: hits.length,
    hits,
  };
}

export function scanNameHygieneInChapters(chapters = [], options = {}) {
  const results = [];
  const aggregate = new Map();

  for (const chapter of Array.isArray(chapters) ? chapters : []) {
    const chapterNumber =
      chapter?.chapter_number ??
      chapter?.chapterNumber ??
      chapter?.number ??
      chapter?.order ??
      null;

    const title =
      chapter?.title ||
      chapter?.chapter_title ||
      chapter?.chapterTitle ||
      `Chapter ${chapterNumber || "?"}`;

    const text =
      chapter?.content ||
      chapter?.content_md ||
      chapter?.body ||
      chapter?.text ||
      "";

    const scan = scanNameHygieneInText(text, options);

    if (!scan.hits.length) continue;

    results.push({
      chapterId: chapter?.id || chapter?._id || null,
      chapterNumber,
      title,
      hits: scan.hits,
    });

    for (const hit of scan.hits) {
      const key = hit.name.toLowerCase();
      const current =
        aggregate.get(key) ||
        {
          name: hit.name,
          count: 0,
          tier: hit.tier,
          risk: hit.risk,
          action: hit.action,
          chapters: [],
          suggestions: hit.suggestions,
        };

      current.count += hit.count;
      current.chapters.push({
        chapterId: chapter?.id || chapter?._id || null,
        chapterNumber,
        title,
        count: hit.count,
      });

      aggregate.set(key, current);
    }
  }

  const aggregateHits = Array.from(aggregate.values()).sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    if (b.count !== a.count) return b.count - a.count;
    return a.name.localeCompare(b.name);
  });

  return {
    ok: aggregateHits.length === 0,
    version: NAME_HYGIENE_VERSION,
    totalUniqueNames: aggregateHits.length,
    totalChapterHits: results.length,
    aggregateHits,
    chapterResults: results,
  };
}

export function buildBannedNamePromptBlock(options = {}) {
  const {
    includeHighRisk = true,
    includeWatchlist = false,
    maxNamesPerLine = 12,
  } = options;

  const names = uniqueSorted([
    ...TIER_1_ALWAYS_BANNED_AI_NAMES,
    ...(includeHighRisk ? TIER_2_HIGH_RISK_AI_NAMES : []),
    ...(includeWatchlist ? TIER_3_WATCHLIST_NAMES : []),
  ]);

  const lines = [];

  for (let i = 0; i < names.length; i += maxNamesPerLine) {
    lines.push(names.slice(i, i + maxNamesPerLine).join(", "));
  }

  return [
    "NAME HYGIENE / AI-SLOP NAME BAN:",
    "Do not invent or use recycled AI-default character names unless the user explicitly provided them.",
    "Avoid the following names and close variants:",
    ...lines,
    "",
    "Use grounded, genre-appropriate names instead. Do not choose ornate fantasy-default names unless the project specifically requires that style and the user approved it.",
  ].join("\n");
}

export function buildNameHygieneReport(scanResult) {
  if (!scanResult || scanResult.ok) {
    return "Name hygiene scan: clean. No banned/high-risk AI-default names detected.";
  }

  const hits = scanResult.aggregateHits || scanResult.hits || [];

  if (!hits.length) {
    return "Name hygiene scan: clean. No banned/high-risk AI-default names detected.";
  }

  const lines = [
    `Name hygiene scan: ${hits.length} banned/high-risk name(s) detected.`,
    "",
  ];

  for (const hit of hits) {
    const chapterText = Array.isArray(hit.chapters)
      ? ` | chapters: ${hit.chapters
          .map((chapter) =>
            chapter.chapterNumber
              ? `Ch.${chapter.chapterNumber} (${chapter.count})`
              : `${chapter.title} (${chapter.count})`
          )
          .join(", ")}`
      : "";

    lines.push(
      `- ${hit.name}: ${hit.count} occurrence(s) | risk: ${hit.risk} | tier: ${hit.tier}${chapterText}`
    );

    if (Array.isArray(hit.suggestions) && hit.suggestions.length) {
      lines.push(`  Suggestions: ${hit.suggestions.join(", ")}`);
    }
  }

  return lines.join("\n");
}

export function buildNameReplacementPlan(scanResult, approvedReplacementMap = {}) {
  const hits = scanResult?.aggregateHits || scanResult?.hits || [];
  const replacements = [];
  const missingApproval = [];

  for (const hit of hits) {
    const approvedReplacement =
      approvedReplacementMap[hit.name] ||
      approvedReplacementMap[hit.name.toLowerCase()] ||
      null;

    if (approvedReplacement) {
      replacements.push({
        from: hit.name,
        to: approvedReplacement,
        count: hit.count,
      });
    } else {
      missingApproval.push({
        name: hit.name,
        count: hit.count,
        suggestions: hit.suggestions || getReplacementSuggestionsForName(hit.name),
      });
    }
  }

  return {
    ok: missingApproval.length === 0,
    replacements,
    missingApproval,
  };
}

export function applyApprovedNameReplacementMap(text, approvedReplacementMap = {}) {
  let output = String(text || "");
  const applied = [];

  const entries = Object.entries(approvedReplacementMap)
    .map(([from, to]) => [normalizeName(from), normalizeName(to)])
    .filter(([from, to]) => from && to && from.toLowerCase() !== to.toLowerCase());

  for (const [from, to] of entries) {
    const regex = buildNameRegex(from);
    const matches = output.match(regex) || [];

    if (!matches.length) continue;

    output = output.replace(regex, (match) => {
      if (match.toUpperCase() === match) return to.toUpperCase();
      if (match[0] === match[0]?.toUpperCase()) {
        return to.charAt(0).toUpperCase() + to.slice(1);
      }
      return to.charAt(0).toLowerCase() + to.slice(1);
    });

    applied.push({
      from,
      to,
      count: matches.length,
    });
  }

  return {
    text: output,
    changed: output !== String(text || ""),
    applied,
  };
}

export function assertNoBlockedNamesInDraft(text, options = {}) {
  const scan = scanNameHygieneInText(text, {
    includeHighRisk: false,
    includeWatchlist: false,
    minimumCount: 1,
    userApprovedNames: options.userApprovedNames || [],
  });

  if (scan.ok) {
    return {
      ok: true,
      message: "No Tier 1 blocked AI-default names detected.",
      scan,
    };
  }

  return {
    ok: false,
    message: buildNameHygieneReport(scan),
    scan,
  };
}

export default {
  NAME_HYGIENE_VERSION,
  NAME_RISK_LEVELS,
  NAME_ACTIONS,
  TIER_1_ALWAYS_BANNED_AI_NAMES,
  TIER_2_HIGH_RISK_AI_NAMES,
  TIER_3_WATCHLIST_NAMES,
  GROUNDED_NAME_SUGGESTIONS,
  DEFAULT_NAME_REPLACEMENT_SUGGESTIONS,
  getAllBlockedNames,
  getAllHighRiskNames,
  getAllWatchlistNames,
  getAllNameHygieneTerms,
  getNameRiskLevel,
  getReplacementSuggestionsForName,
  countNameOccurrences,
  scanNameHygieneInText,
  scanNameHygieneInChapters,
  buildBannedNamePromptBlock,
  buildNameHygieneReport,
  buildNameReplacementPlan,
  applyApprovedNameReplacementMap,
  assertNoBlockedNamesInDraft,
};