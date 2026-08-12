/**
 * LEGACY BOOK SCRUB RULES — DATA, NOT LOGIC. ONE SPECIFIC BOOK.
 *
 * These rules scrub fabricated personas out of ONE nonfiction manuscript. They named
 * that book's invented people (Marcus al-Rashid, Lillian Choi, Franklin Driscoll,
 * Roberta Hawkins, Eleanor Vance, Tomás Gutierrez, Jenny Switzer, Bill Green) and its
 * canned credibility paragraphs, and they lived inside manuscriptFixer.js as module
 * constants and inline arrays — which made a general repair engine specific to one
 * manuscript. The standing rule is that book specifics belong in data, never in code.
 *
 * They are moved here VERBATIM and unchanged, so the shipped book behaves exactly as
 * before. This file is data with a name that says so; manuscriptFixer.js is now the
 * mechanism only.
 *
 * DO NOT ADD TO THIS FILE. A project that needs scrub rules sets scrub_rules_json on
 * its own project record — see resolveScrubRules() in bookScrubRules.js. This set
 * exists solely so an already-published manuscript keeps working, and should shrink
 * to nothing once that book's rules are moved onto its project record.
 */

const cannedParagraphs = [
  /(?:^|\n\s*)The casualty record should be treated as an evidence problem rather than a conclusion\. The available accounts do not cleanly reconcile the count, location, and sequence of the reported deaths\. A credible reconstruction cannot solve that arithmetic by assertion; it has to compare the underlying casualty lists, newspaper accounts, institutional reports, and any surviving records that place specific men in specific locations during the riot\.\s*(?=\n|$)/gi,
  /(?:^|\n\s*)The available accounts do not cleanly reconcile the count, location, and sequence of the reported deaths\. A credible reconstruction cannot solve that arithmetic by assertion; it has to compare the underlying casualty lists, newspaper accounts, institutional reports, and any surviving records that place specific men in specific locations during the riot\.\s*(?=\n|$)/gi,
];

const personaRepairs = [
  [/\bParanormal investigator Marcus al-Rashid and his team\b/g, 'A paranormal investigation team', 'replaced invented paranormal investigator name with role-based language'],
  [/\bMarcus al-Rashid\b/g, 'the investigator', 'replaced invented paranormal investigator name'],
  [/\bDr\.\s+Lillian\s+Choi,?\s+a site investigator specializing in historic institutional buildings,?\s+was retained to examine\b/g, 'A site investigator specializing in historic institutional buildings examined', 'replaced invented expert persona with role-based language'],
  [/\bDr\.\s+Lillian\s+Choi'?s\b/g, 'the site investigator’s', 'replaced invented expert possessive'],
  [/\bDr\.\s+Lillian\s+Choi\b/g, 'the site investigator', 'replaced invented expert name'],
  [/\bFranklin\s+Driscoll'?s\b/g, 'a retired guard’s', 'replaced invented retired-guard possessive'],
  [/\bFranklin\s+Driscoll\b/g, 'a retired guard', 'replaced invented retired-guard name'],
  [/\bRoberta\s+Hawkins'?s\b/g, 'a victim’s descendant’s', 'replaced invented descendant possessive'],
  [/\bRoberta\s+Hawkins\b/g, 'a victim’s descendant', 'replaced invented descendant name'],
  [/\bBertie\s+Hawkins'?s\b/g, 'the descendant’s', 'replaced invented family nickname possessive'],
  [/\bBertie\s+Hawkins\b/g, 'the descendant', 'replaced invented family nickname'],
  [/\bEleanor\s+Vance'?s\b/g, 'a guard’s descendant’s', 'replaced invented guard-descendant possessive'],
  [/\bEleanor\s+Vance\b/g, 'a guard’s descendant', 'replaced invented guard-descendant name'],
  [/\bTomás\s+Gutierrez'?s\b/g, 'the demolition foreman’s', 'replaced invented demolition-foreman possessive'],
  [/\bTomás\s+Gutierrez\b/g, 'the demolition foreman', 'replaced invented demolition-foreman name'],
  [/\bJenny\s+Switzer\s+and\s+Bill\s+Green\b/g, 'tour guides', 'replaced invented tour-guide names'],
  [/\bJenny\s+Switzer\b/g, 'a tour guide', 'replaced invented tour-guide name'],
  [/\bBill\s+Green\b/g, 'a tour guide', 'replaced invented tour-guide name'],
  [/\bEleanor\b/g, 'she', 'replaced invented guard-descendant first name'],
  [/\bRoberta[’']s\s+grandmother\b/g, 'his wife', 'replaced invented descendant first-name family link'],
  [/\bRoberta\b/g, 'the descendant', 'replaced invented descendant first name'],
];

const surnameRepairs = [
  [/\bDriscoll[’']s\b/g, 'the retired guard’s', 'replaced invented retired-guard surname possessive'],
  [/\bDriscoll\b/g, 'the retired guard', 'replaced invented retired-guard surname'],
  [/\bHawkins[’']s\b/g, 'the descendant’s', 'replaced invented descendant surname possessive'],
  [/\bHawkins\b/g, 'the descendant', 'replaced invented descendant surname'],
  [/\bChoi[’']s\b/g, 'the site investigator’s', 'replaced invented expert surname possessive'],
  [/\bChoi\b/g, 'the site investigator', 'replaced invented expert surname'],
  [/\bGutierrez[’']s\b/g, 'the demolition foreman’s', 'replaced invented demolition-foreman surname possessive'],
  [/\bGutierrez\b/g, 'the demolition foreman', 'replaced invented demolition-foreman surname'],
  [/\bVance\s+family\b/g, 'guard family', 'replaced invented guard-family surname'],
  [/\bVance\s+inheritance\b/g, 'guard-family inheritance', 'replaced invented guard-family surname'],
  [/\bVance\b/g, 'the guard’s descendant', 'replaced invented guard-descendant surname'],
  [/\bSwitzer\b/g, 'one guide', 'replaced invented tour-guide surname'],
  [/\bGreen\b/g, 'another guide', 'replaced invented tour-guide surname'],
];

const attributionRepairs = [
  [/\bDriscoll said\b/g, 'the retired guard said'],
  [/\bDriscoll recalled\b/g, 'the retired guard recalled'],
  [/\bDriscoll remembered\b/g, 'the retired guard remembered'],
];

const personaWarningNames = /\b(?:Marcus al-Rashid|Lillian Choi|Choi|Franklin Driscoll|Driscoll|Roberta Hawkins|Bertie Hawkins|Hawkins|Eleanor Vance|Vance|Tomás Gutierrez|Gutierrez|Jenny Switzer|Switzer|Bill Green)\b/i;

const cannedParagraphWarning = /The casualty record should be treated as an evidence problem rather than a conclusion/i;

export const LEGACY_BOOK_SCRUB_RULES = Object.freeze({
  cannedParagraphs,
  personaRepairs,
  surnameRepairs,
  attributionRepairs,
  personaWarningNames,
  cannedParagraphWarning,
});
