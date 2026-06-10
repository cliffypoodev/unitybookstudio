/**
 * LLM Sentence-Level Recast Engine
 * 
 * Takes flagged sentences from the deterministic AI-slop reducer and applies
 * controlled single-sentence recasts to remove filtering verbs (primarily "felt").
 * 
 * Strategies:
 *   1. "She felt a [noun]" → Invert: "A [noun] caught/hit her"
 *   2. "felt the [noun]"   → Invert: "The [noun] pressed/landed"
 *   3. "felt like [X]"     → Direct: "was [X]" or "landed like [X]"
 *   4. "felt [adjective]"  → Physical: "went cold", "turned numb"
 *   5. "felt herself [V]"  → Remove reflexive filtering
 *
 * This module does NOT call an external LLM. It applies a curated set of
 * context-aware sentence transformations that follow the same strategies
 * an LLM editor would use, but deterministically.
 *
 * @module llmSentenceRecast
 */

export const VERSION = 'LLM-SENTENCE-RECAST v1.0 — 2026-06-08';

/**
 * Apply sentence-level recasts to text that has already been through
 * the deterministic AI-slop reducer.
 *
 * @param {string} text   Text after deterministic reduction.
 * @param {object} [opts] Options.
 * @returns {{ text: string, applied: number, details: Array<{original: string, recast: string, reason: string}> }}
 */
export function applyLLMSentenceRecasts(text, opts = {}) {
  let result = text;
  const details = [];

  // Each rule: { rx: RegExp, recast: Function(match, ...groups) => string, reason: string }
  // Rules are applied in order; each rule operates on the current state of `result`.

  const RECAST_RULES = [
    // ── "Subject felt a [noun] [verb]" → "A [noun] [verb] [subject]" ──
    {
      rx: /\b(She|He|I|[A-Z][a-z]{1,15})\s+felt\s+a\s+(\w+(?:\s*,\s*\w+)*)\s+(tighten|rise|rising|wash|build|spike|spread|lurch|pull|flare|rush|stir|creep|crash)\b/gi,
      recast: (m, subj, noun, verb) => {
        const verbMap = {
          tighten: 'tightened in', rise: 'rose in', rising: 'rose in',
          wash: 'washed over', build: 'built in', spike: 'spiked through',
          spread: 'spread through', lurch: 'lurched through', pull: 'pulled at',
          flare: 'flared in', rush: 'rushed through', stir: 'stirred in',
          creep: 'crept through', crash: 'crashed through',
        };
        const v = verbMap[verb.toLowerCase()] || 'caught';
        const sub = subj === 'I' ? 'me' : subj.toLowerCase();
        return `A ${noun} ${v} ${sub}`;
      },
      reason: 'Invert: let sensation act directly',
    },

    // ── "Subject felt the [noun]" → "The [noun] pressed against [subject]" ──
    {
      rx: /\b(She|He|[A-Z][a-z]{1,15})\s+felt\s+the\s+(familiar\s+)?([\w]+(?:\s+\w+)?)\s+(building|settling|rising|tighten|pressing|radiating)/gi,
      recast: (m, subj, fam, noun, verb) => {
        const prefix = fam ? 'The familiar ' : 'The ';
        return `${prefix}${noun} ${verb === 'tighten' ? 'tightened' : verb === 'building' ? 'built' : verb === 'settling' ? 'settled' : verb === 'rising' ? 'rose' : verb === 'pressing' ? 'pressed' : verb}`;
      },
      reason: 'Invert: noun acts directly',
    },

    // ── "felt like [simile]" → "was [simile]" or "landed like" ──
    {
      rx: /\bfelt\s+like\s+(a\s+physical|an?\s+\w+|someone|the\s+\w+|being\s+\w+|trying\s+to)/gi,
      recast: (m, rest) => {
        if (/^(a physical|an accusation|someone|being)/.test(rest)) {
          return `was like ${rest}`;
        }
        return `landed like ${rest}`;
      },
      reason: 'Remove filtering hedging',
    },

    // ── "felt [past-adj]" → "was [past-adj]" (engineered, ragged, etc.) ──
    {
      rx: /\bfelt\s+(engineered|ragged|insufficient|dangerously|suddenly\s+too|different|dense|real\s+enough)/gi,
      recast: (m, adj) => `was ${adj}`,
      reason: 'Replace filtering with direct statement',
    },

    // ── "Subject felt herself/himself [verb]" → "Subject [verb]" ──
    {
      rx: /\b(She|He|[A-Z][a-z]{1,15})\s+felt\s+(?:herself|himself)\s+(\w+ing)/gi,
      recast: (m, subj, verb) => `${subj} ${verb.replace(/ing$/, 'ed').replace(/pped$/, 'ped')}`,
      reason: 'Remove reflexive filtering',
    },

    // ── "I felt [noun-phrase]" → "[noun-phrase] hit me" ──
    {
      rx: /\bI\s+felt\s+(a\s+sudden[^.;!?]{5,40})/gi,
      recast: (m, noun) => `${noun.charAt(0).toUpperCase() + noun.slice(1)} hit me`,
      reason: 'Invert: sensation acts on narrator',
    },

    // ── "I felt dizzy" → "Dizziness hit me" / "The room tilted" ──
    {
      rx: /\bI\s+felt\s+dizzy\b/gi,
      recast: () => 'Dizziness hit me',
      reason: 'Replace filtering with concrete sensation',
    },

    // ── "I felt the pressure" → "The pressure bore down" ──
    {
      rx: /\bI\s+felt\s+the\s+(pressure|weight|force|pull)\s+of/gi,
      recast: (m, noun) => `The ${noun} of`,
      reason: 'Remove filtering; let noun stand',
    },
  ];

  for (const rule of RECAST_RULES) {
    rule.rx.lastIndex = 0;
    const before = result;
    result = result.replace(rule.rx, (...args) => {
      const full = args[0];
      const recast = rule.recast(...args);
      details.push({ original: full, recast, reason: rule.reason });
      return recast;
    });
  }

  return { text: result, applied: details.length, details };
}

export default applyLLMSentenceRecasts;
