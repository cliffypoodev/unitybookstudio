/**
 * fateEnrichment.js — RESEARCHQUALITY-2D
 *
 * Deterministic fate enrichment for nonfiction research. For each researched
 * figure, sentences that contain BOTH the figure's surname and a fate-class
 * word are COPIED from fetched source pages into that figure's own entry as
 * fate_notes, with the page URL and a cross-page source count so single-source
 * fates stay visibly weak.
 *
 * DESIGN RULES (closed-world doctrine):
 * - No LLM call anywhere in this module. Pure string work only.
 * - The corpus sentence IS the note: copied verbatim (whitespace-collapsed for
 *   hard-wrapped corpus text), never summarized into new claims.
 * - A sentence qualifies only when the surname and the fate word share the
 *   SAME sentence — the same entry-scoped principle the ARCH-1C ledger uses;
 *   proximity windows cross-contaminate adjacent material.
 * - fate_notes lands inside the figure's own key_figures entry, so
 *   buildFactLedger's own-entry attestation reads it with zero ledger changes.
 *
 * The fate vocabulary here includes the era classes (assassinated, lynched,
 * murdered, slain, hanged) ahead of the gate-side widening: enrichment only
 * decides which EVIDENCE sentences are copied. "executed" is deliberately
 * absent — in this domain it overwhelmingly means executing an order or
 * document ("executed General Order No. 3"), and a word-level fate check
 * cannot separate that from a death sense.
 */

const FATE_ENRICH_RX = /\b(?:died|dead|death|perished|drowned|killed|fatal(?:ly)?|succumbed|victims?|survived|survivor|rescued|saved|escaped?|unharmed|uninjured|injured|injur(?:y|ies)|wounded|maimed|hospitalized|assassinat(?:ed|ion)|lynch(?:ed|ing|ings)?|murder(?:ed|s)?|slain|hanged)\b/i;

const TITLE_RX = /^(?:major general|brigadier general|general|colonel|major|captain|lieutenant|reverend|president|governor|mr|mrs|ms|dr|aunt|uncle)\s+/i;

const escapeRx = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function figureSurname(name) {
  const stripped = String(name || '').trim().replace(TITLE_RX, '').trim();
  const toks = stripped.split(/\s+/).filter(Boolean);
  const surname = toks.length ? toks[toks.length - 1].replace(/[^A-Za-z'-]/g, '') : '';
  return surname.length >= 3 ? surname : '';
}

// Sentence split with the DRAFTGATE-3H-FIXUP v-dot protection.
export function splitEnrichSentences(text) {
  const PROT_V = String.fromCharCode(1);
  const work = String(text || '').replace(/\bv\.(?=\s)/g, 'v' + PROT_V);
  return work.split(/(?<=[.!?…”])\s+/).map((s) => s.split(PROT_V).join('.'));
}

const normWs = (s) => String(s || '').replace(/\s+/g, ' ').trim();

/**
 * Select up to `cap` fate-relevant sentences for one figure from fetched pages.
 * Returns [{ sentence, url, sources }] — sentence is whitespace-collapsed
 * verbatim source text; sources = number of distinct pages containing it.
 */
export function selectFateSentences({ pages, figureName, cap = 3, maxLen = 400 }) {
  const surname = figureSurname(figureName);
  if (!surname || !Array.isArray(pages)) return [];
  const surnameRx = new RegExp('\\b' + escapeRx(surname) + '\\b', 'i');
  const seen = new Set();
  const out = [];
  const normPages = pages.map((p) => normWs(p && p.content).toLowerCase());
  for (const page of pages) {
    const content = String((page && page.content) || '');
    if (!content) continue;
    for (const raw of splitEnrichSentences(content)) {
      const sentence = normWs(raw);
      if (sentence.length < 20 || sentence.length > maxLen) continue;
      if (!surnameRx.test(sentence) || !FATE_ENRICH_RX.test(sentence)) continue;
      const norm = sentence.toLowerCase();
      if (seen.has(norm)) continue;
      seen.add(norm);
      const sources = normPages.filter((np) => np.includes(norm)).length;
      out.push({ sentence, url: String((page && page.url) || ''), sources: Math.max(1, sources) });
      if (out.length >= cap) return out;
    }
  }
  return out;
}

export function formatFateNotes(notes) {
  if (!Array.isArray(notes) || !notes.length) return '';
  return notes
    .map((n) => `"${n.sentence}" [${n.url}] (sources: ${n.sources})`)
    .join(' | ');
}

/**
 * Figures whose own entry carries NO fate-class word anywhere (name, actions,
 * quote, fate_notes) — the same own-entry semantics the ledger attests with.
 * Accepts research_data as an object or JSON string. Returns figure names.
 */
export function figuresNeedingFates(researchData) {
  let rd = researchData;
  if (typeof rd === 'string') { try { rd = JSON.parse(rd); } catch { return []; } }
  const kf = rd && Array.isArray(rd.key_figures) ? rd.key_figures : [];
  const out = [];
  for (const fig of kf) {
    const name = String((fig && fig.name) || '').trim();
    if (!name || !figureSurname(name)) continue;
    let entry = '';
    try { entry = JSON.stringify(fig); } catch { entry = String((fig && fig.documented_actions) || ''); }
    if (!FATE_ENRICH_RX.test(entry)) out.push(name);
  }
  return out;
}
