import io, sys

p = 'src/lib/pipelineValidator.js'
c = io.open(p, encoding='utf-8').read()

f1 = r'''const SCENE_SEPARATOR_RX = /^[\s*#—–-]+$/;

/** Paragraphs of actual prose - blanks and scene separators removed. */
function proseParagraphs(text) {
  return String(text || '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p && !SCENE_SEPARATOR_RX.test(p));
}'''
r1 = r'''const SCENE_SEPARATOR_RX = /^[\s*#—–-]+$/;

/** Paragraphs of actual prose - blanks and scene separators removed. */
function proseParagraphs(text) {
  return String(text || '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p && !SCENE_SEPARATOR_RX.test(p));
}

// EPISTOLARY-1 — a letter's salutation and sign-off legitimately end without
// terminal punctuation ("My dearest Elise," / "Yours, always, / Wexcombe").
// They are letter format, not truncated prose, so they must not trip the
// unterminated-paragraph hard block. Deliberately narrow: a salutation is a short
// greeting line ending in a comma; a closing STARTS with a valediction. Genuine
// mid-thought stops ("She turned the key and") match neither and stay blocked.
const SALUTATION_RX = /^(?:my\s+)?(?:dear(?:est)?|beloved)\b[^!?\n]{0,50},\s*$/i;
const VALEDICTION_RX = /^(?:yours|sincerely|faithfully|respectfully|fondly|warmly|affectionately|regards|ever(?:\s+yours)?|with\s+(?:love|affection|respect|regard|gratitude)|your\s+(?:loving|devoted|obedient|humble|ever[-\s]?faithful|friend|servant))\b/i;
function isEpistolaryLine(paragraph) {
  const text = String(paragraph || '').trim();
  const firstLine = text.split('\n')[0].trim();
  return SALUTATION_RX.test(text) || VALEDICTION_RX.test(firstLine);
}'''

f2 = r'''  const unterminated = paras
    .filter((p) => !/[.!?”"’')\]]$/.test(p))
    .map((p) => ({ excerpt: p.slice(-120) }));'''
r2 = r'''  const unterminated = paras
    .filter((p) => !/[.!?”"’')\]]$/.test(p) && !isEpistolaryLine(p))
    .map((p) => ({ excerpt: p.slice(-120) }));'''

for f, r, name in [(f1, r1, "Edit 1"), (f2, r2, "Edit 2")]:
    count = c.count(f)
    if count != 1:
        print(f"ABORT {name}: Expected 1, found {count}")
        sys.exit(1)
    c = c.replace(f, r)

io.open(p, 'w', encoding='utf-8').write(c)
print("SUCCESS: EPISTOLARY-1 applied")
