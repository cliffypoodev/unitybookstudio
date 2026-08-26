// src/lib/subjectRepair.js — SUBJECTREPAIR-1
//
// The defect: subjectless narration sentences — "Was wearing his signature
// leather jacket…", "Were a mess.", "Looked at Ludo. Looked back.", and
// bare-verb clauses — "A strange sense of relief wash over her." An external
// audit quoted these as "generation corruption"; measured in one shipped
// 81k-word manuscript: 290 sentence-initial dropped subjects. Two polish caps
// manufactured them by DELETING pronouns and "felt/thought" tags (retired in
// POLISHSAFE-2). This module repairs what already shipped, and guards new
// drafts.
//
// Design (closed-world, like every recast pass in this app):
// - The finder is deterministic: narration only; sentence-initial
//   Was/Were/Had/Looked/Felt/Seemed/Didn't/Wasn't/Weren't (+ a few) followed by
//   a lowercase word; and the bare-verb shape "(A|An|The) <noun phrase>
//   <sensation verb> (over|in|at|through|…)".
// - The MODEL chooses ONLY the missing subject, from a fixed set: He / She /
//   They / It / a cast name — plus, for the bare-verb shape, an optional
//   "<Subject> felt". It sees the surrounding paragraph so it can pick the
//   right actor.
// - The VERIFIER accepts a repair only when candidate === "<Subject> " +
//   [felt ] + original-with-first-letter-lowercased. Anything else — a rewrite,
//   a new word, a different sentence — is rejected and the original stays.
// - Sequential LLM calls; fail-open; LLM off → report only.
import { splitSentencesForDedupe } from './crossChapterDedupe.js';
import { buildPronounCanon, subjectBoundGender, leadingCastName, POSSESSIVE_INITIAL_RX } from './pronounLock.js'; // SUBJECTGUARD-1 / SUBJECTGUARD-2

export const SUBJECT_REPAIR_VERSION = 'subject-repair-v2';

// Openers that a deleted pronoun leaves behind. Sentence-initial, capitalized,
// followed by a lowercase word (so "Had Ludo…" — a real inversion — is
// excluded).
const OPENERS = ['Was', 'Were', 'Had', 'Looked', 'Felt', 'Seemed', 'Didn’t', "Didn't", 'Wasn’t', "Wasn't", 'Weren’t', "Weren't", 'Hadn’t', "Hadn't", 'Kept', 'Stood', 'Sat', 'Turned', 'Nodded', 'Shook', 'Reached', 'Leaned', 'Glanced', 'Stared', 'Smiled', 'Grinned', 'Shrugged', 'Sighed', 'Laughed', 'Frowned', 'Blinked', 'Paused', 'Waited', 'Watched', 'Followed', 'Stepped', 'Walked', 'Moved', 'Pulled', 'Pushed', 'Held', 'Took', 'Gave', 'Made', 'Went', 'Came', 'Ran', 'Knew', 'Thought', 'Wanted', 'Needed', 'Tried', 'Started', 'Began', 'Stopped', 'Opened', 'Closed', 'Dropped', 'Grabbed', 'Pressed', 'Rubbed', 'Wiped', 'Tapped', 'Pointed', 'Whispered', 'Muttered', 'Snorted', 'Chuckled', 'Swallowed', 'Exhaled', 'Inhaled', 'Breathed', 'Hesitated', 'Studied', 'Considered', 'Remembered', 'Realized', 'Understood', 'Wondered', 'Hoped', 'Feared', 'Managed', 'Refused', 'Agreed', 'Answered', 'Replied', 'Added', 'Continued', 'Finished', 'Lifted', 'Lowered', 'Raised', 'Set', 'Put', 'Let', 'Got', 'Threw', 'Caught', 'Slid', 'Slipped', 'Climbed', 'Jumped', 'Crossed', 'Entered', 'Left', 'Returned', 'Arrived'];
const OPENER_RX = new RegExp(`^(?:${OPENERS.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\s+[a-z]`);
// Real English sentences that legitimately start with these words are
// questions ("Was he there?") — those end with "?" and are excluded below —
// or imperatives ("Stop." / "Wait."), which are one word: also excluded.

// SUBJECTREPAIR-1B: verb-ONLY forms. The v1 list carried adjective/noun
// homographs ("cool", "warm", "hum", "pulse", "still"…) and flagged healthy
// sentences ("The metal was cool against her palm.", "The night was cool.");
// the closed-world verifier rejected every bogus repair, but the model calls
// were wasted. A copula guard below also refuses "was/were/felt <verb>".
const SENSATION_VERBS = ['wash', 'lighten', 'prickle', 'tighten', 'settle', 'flood', 'creep', 'rise', 'spread', 'surge', 'curl', 'twist', 'sink', 'bloom', 'crawl', 'slide', 'ripple', 'swell', 'drain', 'loosen', 'ease', 'churn', 'flutter', 'thrum', 'throb', 'flicker', 'hammer', 'pound', 'lodge', 'seep', 'trickle', 'squeeze', 'clench', 'unclench', 'relax', 'coil', 'knot', 'stir', 'melt', 'fade'];
// The bare verb is followed by a preposition ("wash over her") or ends the
// clause ("The weight in her chest lighten.").
const BARE_VERB_RX = new RegExp(`^(?:A|An|The)\\s+[^.!?\\n]{2,70}?(?<!\\b(?:was|were|is|are|be|been|being|felt|feels|seemed|seems|looked|looks|became|grew|got|had|has|have)\\s)\\s(?:${SENSATION_VERBS.join('|')})(?:\\s+(?:over|in|at|through|down|up|into|across|along|inside|behind|beneath|under|around|out|away|off|from|to|against|between)\\b|[,.!?…]|$)`);

function inDialogue(paragraph, offset) {
  const before = paragraph.slice(0, offset);
  const o = (before.match(/[“"]/g) || []).length;
  const c = (before.match(/[”"]/g) || []).length;
  return o > c;
}

/**
 * Find repair targets. Returns [{ sentence, paragraph, kind }] in document
 * order; `kind` is 'opener' or 'bare-verb'.
 */
export function findDroppedSubjectSentences(text) {
  const out = [];
  for (const para of String(text || '').split(/\n{2,}/)) {
    if (!para.trim() || /^\s*\*\s*\*\s*\*\s*$/.test(para)) continue;
    let cursor = 0;
    for (const raw of splitSentencesForDedupe(para)) {
      const s = String(raw || '').trim();
      const at = para.indexOf(s, cursor);
      cursor = at >= 0 ? at + s.length : cursor;
      if (!s || /[“”"]/.test(s) || /\?$/.test(s)) continue;
      if (at >= 0 && inDialogue(para, at)) continue;
      if (s.split(/\s+/).length < 2) continue;
      if (OPENER_RX.test(s)) out.push({ sentence: s, paragraph: para, kind: 'opener' });
      else if (BARE_VERB_RX.test(s)) out.push({ sentence: s, paragraph: para, kind: 'bare-verb' });
    }
  }
  return out;
}

const SUBJECT_PRONOUNS = ['He', 'She', 'They', 'It'];

/**
 * Deterministic verdict: the candidate must be exactly the original with a
 * subject prepended (and, for the bare-verb shape, optionally "felt").
 * Returns { ok, reason, subject }.
 */
// SUBJECTREPAIR-1B: compare with typography normalized — the model returns
// straight quotes/apostrophes where the book has curly ones ("Yusra's" vs
// "Yusra’s"); that is not a content change. The APPLIED text is always built
// from the ORIGINAL sentence, so the book's typography is preserved.
const normTypo = (s) => String(s || '').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();

// SUBJECTGUARD-1: deterministic sanity checks on a repair that DID prepend a
// subject. The old verifier accepted any prefix match and shipped "Ottie were
// ridiculous" (agreement) and "Ottilie was wearing … his hat" (wrong name —
// the wearer is Idris). A prefix that is grammatically or referentially wrong is
// worse than the dropped subject it "fixed"; reject it and leave the sentence
// flagged instead. Fail toward SKIP.
function subjectRepairGuard(subj, applied, { castNames = [], subjectGender = {} }) {
  // (a) number agreement — only "They" legitimately takes "were"; a singular
  //     subject before "were"/"weren't" is the corruption.
  const after = applied.slice(subj.length).replace(/^\s+/, '');
  if (subj !== 'They' && /^(?:were|weren['’]t)\b/i.test(after)) {
    return { ok: false, reason: 'agreement' };
  }
  // (b) gender clash — a NAMED subject whose canon gender is known must not carry
  //     a subject-bound pronoun of the OTHER gender (that means the wrong name
  //     was chosen). Pronoun subjects are exempt: the pronoun IS the gender.
  const isPronoun = SUBJECT_PRONOUNS.includes(subj) || /\sfelt$/.test(subj);
  if (!isPronoun) {
    const bare = subj.replace(/^(?:Mr|Mrs|Ms|Dr)\.\s+/, '');
    const g = subjectGender[bare] || subjectGender[subj];
    if (g === 'she' || g === 'he') {
      const counts = subjectBoundGender(applied, subj, castNames);
      if (g === 'she' && counts.he > 0) return { ok: false, reason: 'gender-clash' };
      if (g === 'he' && counts.she > 0) return { ok: false, reason: 'gender-clash' };
    }
  }
  return { ok: true };
}

// SUBJECTGUARD-2 (live-proof finding 1, 2026-08-24): guard (a)/(b) above
// caught agreement and gender clashes WITHIN the repaired sentence itself,
// but a wrong cast NAME that carries no gender-bound pronoun sailed through
// — live on REDUX Ch.10, "Thompson stopped wiping. His gaze fell on the
// notebook. His eyes met Yusra's. Looked back at the notebook." repaired to
// "Ottilie looked back at the notebook." (the actor is Thompson).
//
// establishedActor walks the sentences BEFORE the target, in order: a
// sentence-initial cast name becomes the current actor; a sentence leading
// with a possessive/reflexive pronoun (His/Her/Hers/Himself/Herself)
// continues that actor — even when another cast member is named elsewhere
// in the same sentence as an OBJECT ("His eyes met Yusra's" stays
// Thompson's, Yusra is not the subject); any OTHER cast name taking the
// lead position makes the actor ambiguous (two actors are legitimately in
// play) and the guard does not fire. Any other sentence shape (dialogue,
// description) neither confirms nor breaks the chain.
function establishedActor(precedingText, castNames) {
  const names = Array.isArray(castNames) ? castNames.filter(Boolean) : [];
  if (!names.length) return null;
  let current = null;
  let ambiguous = false;
  for (const raw of splitSentencesForDedupe(precedingText)) {
    const sentence = String(raw || '').trim();
    if (!sentence) continue;
    const lead = leadingCastName(sentence, names);
    if (lead) {
      if (current && current !== lead) ambiguous = true;
      current = lead;
    }
    // A possessive-initial sentence continues whatever actor is already
    // established; any other shape neither confirms nor breaks the chain.
  }
  return ambiguous ? null : current;
}

export function verifySubjectRepair(original, candidate, { castNames = [], kind = 'opener', subjectGender = {}, paragraph = '' } = {}) {
  const orig = String(original || '').trim();
  const cand = normTypo(candidate);
  if (!cand) return { ok: false, reason: 'empty' };
  const decap = orig.charAt(0).toLowerCase() + orig.slice(1);
  const decapN = normTypo(decap);
  const names = castNames.filter(Boolean);
  // "Mr. Thompson" / "Mrs. Henderson" are legal when the surname is cast.
  const honorifics = names.flatMap((n) => [`Mr. ${n}`, `Mrs. ${n}`, `Ms. ${n}`, `Dr. ${n}`]);
  const subjects = [...SUBJECT_PRONOUNS, ...names, ...honorifics];
  // SUBJECTGUARD-2: computed once — independent of which candidate subject
  // is being checked. Pronoun subjects (He/She/They/It) are exempt.
  const precedingIdx = paragraph ? String(paragraph).indexOf(orig) : -1;
  const precedingText = precedingIdx > 0 ? String(paragraph).slice(0, precedingIdx) : '';
  const actor = precedingText ? establishedActor(precedingText, names) : null;
  for (const subj of subjects) {
    let applied = null;
    let subject = subj;
    if (cand === normTypo(`${subj} ${decap}`) || cand === `${subj} ${decapN}`) {
      applied = `${subj} ${decap}`;
    } else if (kind === 'bare-verb' && cand === normTypo(`${subj} felt ${decap}`)) {
      // "She felt a strange sense of relief wash over her." — the tag restored.
      applied = `${subj} felt ${decap}`;
      subject = `${subj} felt`;
    }
    if (applied === null) continue;
    const guard = subjectRepairGuard(subj, applied, { castNames: names, subjectGender });
    if (!guard.ok) return { ok: false, reason: guard.reason };
    // SUBJECTGUARD-2: a NAMED subject that contradicts the one actor the
    // preceding sentences of this paragraph established is rejected — a
    // pronoun subject is exempt (the pronoun IS the referent, not a name
    // choice that can be "wrong").
    if (!SUBJECT_PRONOUNS.includes(subj) && actor) {
      const bareSubj = subj.replace(/^(?:Mr|Mrs|Ms|Dr)\.\s+/, '');
      if (actor !== bareSubj) return { ok: false, reason: 'actor-mismatch' };
    }
    return { ok: true, reason: '', subject, applied };
  }
  return { ok: false, reason: 'not-a-subject-prefix' };
}

let _callAgent = null;
async function getCallAgent() {
  if (!_callAgent) {
    const mod = await import(/* @vite-ignore */ '@/lib/localLLM');
    _callAgent = mod.callAgent;
  }
  return _callAgent;
}

function cleanLLM(raw) {
  let s = typeof raw === 'string' ? raw : raw?.text || raw?.content || String(raw || '');
  s = s.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  s = s.replace(/^(?:here(?:'s| is)[^:]*:|repaired sentence:|fixed:|answer:)\s*/i, '');
  s = s.replace(/^```[a-z]*\n?|\n?```$/g, '').trim();
  s = s.split('\n')[0].trim();
  s = s.replace(/^["“]|["”]$/g, '');
  return s;
}

/**
 * Repair dropped subjects in one text.
 * @param {string} text
 * @param {object} opts { callLLM?, project?, castNames?, label?, onProgress?, maxRepairs?, timeoutMs? }
 * @returns {{ text, repaired, skipped, found }}
 */
export async function repairDroppedSubjects(text, opts = {}) {
  const { callLLM = null, project = null, castNames = [], label = 'text', onProgress = () => {}, maxRepairs = 80, timeoutMs = 60000 } = opts;
  let out = String(text || '');
  const targets = findDroppedSubjectSentences(out);
  const skipped = [];
  if (!targets.length) {
    console.log(`[SUBJECTREPAIR-1] ${label}: found 0, repaired 0, skipped 0`);
    return { text: out, repaired: 0, skipped, found: 0 };
  }

  const callOne = callLLM || (async (userPrompt, systemPrompt, maxTokens) => {
    const agent = await getCallAgent();
    return agent({ prompt: userPrompt, taskType: 'polish', project, temperature: 0.1, maxTokens, systemPromptOverride: systemPrompt });
  });
  const cast = castNames.filter(Boolean);
  // SUBJECTGUARD-1: canon gender for the verifier's wrong-name check.
  let subjectGender = {};
  try { subjectGender = buildPronounCanon(project, [out], cast).canon || {}; } catch { subjectGender = {}; }
  const SYSTEM = [
    'You are a copy editor. One sentence in a paragraph is missing its grammatical subject (a pronoun or a character name was accidentally deleted).',
    'Your ONLY job: return the same sentence with the missing subject restored at the front. Change nothing else — same words, same order, same punctuation.',
    `Allowed subjects: He, She, They, It${cast.length ? ', ' + cast.join(', ') : ''}. If the sentence describes a feeling and reads like "<subject> felt …" was cut, you may restore "<Subject> felt".`,
    'Use the paragraph to decide WHO the subject is. Return ONLY the repaired sentence. No quotes, no explanation.',
  ].join('\n');

  let repaired = 0;
  let lastNamedSubject = null; // SUBJECTGUARD-1 repeat guard
  let lastParaAfter = null;
  for (const t of targets) {
    if (repaired >= maxRepairs) { skipped.push({ sentence: t.sentence.slice(0, 80), reason: 'repair-budget-exhausted' }); continue; }
    if (!out.includes(t.sentence)) { skipped.push({ sentence: t.sentence.slice(0, 80), reason: 'sentence-not-found-verbatim' }); continue; }
    onProgress(`Repair: restoring a dropped subject (${label})…`);
    let raw = null;
    try {
      let timer = null;
      const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), timeoutMs); });
      const userPrompt = `Paragraph:\n${t.paragraph}\n\nSentence missing its subject:\n${t.sentence}\n\nReturn the sentence with the subject restored:`;
      raw = await Promise.race([callOne(userPrompt, SYSTEM, 160), timeout]).finally(() => timer && clearTimeout(timer));
    } catch (err) {
      skipped.push({ sentence: t.sentence.slice(0, 80), reason: `llm-error:${err?.message || 'unknown'}` });
      continue;
    }
    const candidate = cleanLLM(raw);
    const verdict = verifySubjectRepair(t.sentence, candidate, { castNames: cast, kind: t.kind, subjectGender, paragraph: t.paragraph });
    if (!verdict.ok) {
      console.warn(`[SUBJECTREPAIR-1] ${label}: rejected (${verdict.reason}) for "${t.sentence.slice(0, 60)}" → "${candidate.slice(0, 60)}"`);
      skipped.push({ sentence: t.sentence.slice(0, 80), reason: `verify-failed:${verdict.reason}` });
      continue;
    }
    // SUBJECTGUARD-1: reject a NAMED subject prepended to consecutive sentences
    // in the same paragraph — the mechanical "Thompson looked at Ottie. Thompson
    // looked at the door. Thompson looked back…" run. Pronoun subjects are fine.
    const baseSubj = String(verdict.subject).replace(/\s+felt$/, '');
    const named = !SUBJECT_PRONOUNS.includes(baseSubj);
    if (named && baseSubj === lastNamedSubject && t.paragraph === lastParaAfter) {
      skipped.push({ sentence: t.sentence.slice(0, 80), reason: 'repeat-subject' });
      continue;
    }
    // Replace only THIS occurrence (the sentence text may recur); anchor on the
    // paragraph to keep it local.
    const pIdx = out.indexOf(t.paragraph);
    if (pIdx < 0) { skipped.push({ sentence: t.sentence.slice(0, 80), reason: 'paragraph-not-found' }); continue; }
    const oldPara = t.paragraph;
    const newPara = oldPara.replace(t.sentence, verdict.applied); // SUBJECTREPAIR-1B: book typography preserved
    out = out.slice(0, pIdx) + newPara + out.slice(pIdx + oldPara.length);
    // Later targets in the same paragraph must see the updated paragraph.
    for (const later of targets) if (later.paragraph === oldPara) later.paragraph = newPara;
    lastNamedSubject = named ? baseSubj : null;
    lastParaAfter = newPara;
    repaired += 1;
  }
  console.log(`[SUBJECTREPAIR-1] ${label}: found ${targets.length}, repaired ${repaired}, skipped ${skipped.length}`);
  return { text: out, repaired, skipped, found: targets.length };
}
