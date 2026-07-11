// =============================================================
// closedWorldBibliography.js — BIBFIX-1: deterministic bibliography
//
// Every entry is generated from a URL or document that exists in the
// project's own research_data. Closed world: a source is in the evidence
// or it does not appear in the bibliography. No LLM composes citations.
// Book-agnostic: institution names come from a generic domain->institution
// table (infrastructure, like the archive-priority list in research);
// everything else derives from project data at call time.
// =============================================================

const HOST_INSTITUTIONS = [
  { re: /(?:^|\.)loc\.gov$/i, name: 'Library of Congress' },
  { re: /(?:^|\.)archives\.gov$/i, name: 'National Archives and Records Administration' },
  { re: /(?:^|\.)gutenberg\.org$/i, name: 'Project Gutenberg' },
  { re: /(?:^|\.)hathitrust\.org$/i, name: 'HathiTrust Digital Library' },
  { re: /(?:^|\.)census\.gov$/i, name: 'U.S. Census Bureau' },
  { re: /(?:^|\.)senate\.gov$|(?:^|\.)house\.gov$|(?:^|\.)congress\.gov$/i, name: 'U.S. Congress' },
];

const URL_RE = /https?:\/\/[^\s"'<>\])]+/g;

function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}

function institutionFor(url) {
  const host = hostOf(url);
  for (const h of HOST_INSTITUTIONS) { if (h.re.test(host)) return h.name; }
  return host || 'Web source';
}

function normalizeUrl(u) {
  return String(u || '').trim().replace(/[.,;)\]]+$/, '').split('#')[0];
}

function urlsIn(value) {
  const s = typeof value === 'string' ? value : JSON.stringify(value || '');
  return (s.match(URL_RE) || []).map(normalizeUrl).filter(Boolean);
}

function parseResearch(project) {
  try {
    const rd = typeof project?.research_data === 'string'
      ? JSON.parse(project.research_data)
      : (project?.research_data || {});
    return rd && typeof rd === 'object' ? rd : {};
  } catch { return {}; }
}

function cleanText(s, max = 200) {
  return String(s || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

/**
 * Build a deterministic, closed-world bibliography from project research.
 * @returns {{ text, entryCount, urls: string[] }}
 */
export function buildClosedWorldBibliography(project) {
  const rd = parseResearch(project);
  const figures = Array.isArray(rd.key_figures) ? rd.key_figures : [];
  const events = Array.isArray(rd.key_events) ? rd.key_events : [];
  const docs = Array.isArray(rd.key_documents) ? rd.key_documents : [];
  const primaries = Array.isArray(rd.primary_sources) ? rd.primary_sources : [];

  const claimed = new Set();
  const primaryEntries = [];
  const webEntries = [];
  const categoryEntries = [];

  // 1) Key documents — the strongest citations the research holds.
  for (const d of docs) {
    const url = urlsIn(d.source)[0] || urlsIn(d)[0] || '';
    const name = cleanText(d.name, 160);
    const issuer = cleanText(d.issuer, 120);
    if (!name) continue;
    const bits = [];
    bits.push(issuer ? issuer + '.' : 'Unattributed.');
    bits.push('"' + name + '."');
    if (cleanText(d.date)) bits.push(cleanText(d.date, 60) + '.');
    if (url) { bits.push(url + '.'); claimed.add(url); }
    primaryEntries.push(bits.join(' '));
  }

  // 2) Testimony collections — figures grouped by source URL.
  const byUrl = new Map();
  for (const f of figures) {
    for (const url of urlsIn(f.source_types).concat(urlsIn(f.sources))) {
      if (!byUrl.has(url)) byUrl.set(url, []);
      const nm = cleanText(f.name, 80);
      if (nm && !byUrl.get(url).includes(nm)) byUrl.get(url).push(nm);
    }
  }
  for (const [url, names] of [...byUrl.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (claimed.has(url)) continue;
    claimed.add(url);
    const inst = institutionFor(url);
    const tail = url.split('/').filter(Boolean).pop() || '';
    const who = names.slice(0, 4).join(', ') + (names.length > 4 ? ', and others' : '');
    primaryEntries.push(inst + '. Archival item "' + tail + '" — first-person testimony of ' + who + '. ' + url + '.');
  }

  // 3) Event documentation URLs not already claimed.
  for (const e of events) {
    for (const url of urlsIn(e.sources)) {
      if (claimed.has(url)) continue;
      claimed.add(url);
      const inst = institutionFor(url);
      const label = cleanText(e.event, 120) || 'Documented event';
      webEntries.push(inst + '. Documentation of ' + label + (cleanText(e.date) ? ' (' + cleanText(e.date, 40) + ')' : '') + '. ' + url + '.');
    }
  }

  // 4) Any remaining URLs anywhere in the research (competing narratives, etc.).
  for (const url of urlsIn(rd)) {
    if (claimed.has(url)) continue;
    claimed.add(url);
    webEntries.push(institutionFor(url) + '. Source consulted in project research. ' + url + '.');
  }

  // 5) Source categories (no URLs) — described honestly as categories.
  for (const p of primaries) {
    const st = cleanText(p.source_type, 120);
    const desc = cleanText(p.description, 220);
    if (!st && !desc) continue;
    const line = (st ? st + '. ' : '') + (desc ? desc + (desc.endsWith('.') ? '' : '.') : '');
    if (!categoryEntries.includes(line)) categoryEntries.push(line);
  }

  const sections = ['Bibliography'];
  if (primaryEntries.length) {
    sections.push('\nPrimary Sources and Archival Records');
    sections.push([...new Set(primaryEntries)].sort().join('\n\n'));
  }
  if (webEntries.length) {
    sections.push('\nGovernment, Institutional, and Web Sources');
    sections.push([...new Set(webEntries)].sort().join('\n\n'));
  }
  if (categoryEntries.length) {
    sections.push('\nSource Categories Consulted');
    sections.push(categoryEntries.sort().join('\n\n'));
  }
  sections.push('\nSource Integrity Note');
  sections.push('Every entry above derives from a source URL or document recorded in this project’s verified research. No citation was composed from memory. Before final publication, expand archival entries with exact collection titles where the repository provides them.');

  const text = sections.join('\n\n').replace(/\n{4,}/g, '\n\n\n').trim();
  const entryCount = primaryEntries.length + webEntries.length + categoryEntries.length;
  return { text, entryCount, urls: [...claimed] };
}

/**
 * Integrity check: every URL in a bibliography text must exist in research_data.
 */
export function verifyBibliographyUrls(text, project) {
  const research = typeof project?.research_data === 'string'
    ? project.research_data
    : JSON.stringify(project?.research_data || '');
  const violations = [];
  for (const url of (String(text || '').match(URL_RE) || []).map(normalizeUrl)) {
    if (!research.includes(url)) violations.push(url);
  }
  return { ok: violations.length === 0, violations };
}

console.log('[BIBLIOGRAPHY] BIBFIX-1 loaded: closed-world deterministic bibliography');
