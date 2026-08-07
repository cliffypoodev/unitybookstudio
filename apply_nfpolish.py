import io, sys

def apply_edit(filepath, find_str, replace_str, name):
    content = io.open(filepath, encoding='utf-8').read()
    count = content.count(find_str)
    if count != 1:
        print(f"ABORT {name}: Expected 1, found {count}")
        sys.exit(1)
    content = content.replace(find_str, replace_str)
    io.open(filepath, 'w', encoding='utf-8').write(content)
    print(f"SUCCESS: {name} applied")

# COMMIT 1
apply_edit('src/lib/antiDetectionPolish.js',
r'''  // Step A: Triplet list detection — ALL project types
  onProgress?.('Polish: Breaking triplet sensory lists…');
  const tripletResult = detectAndFixTriplets(loaded);
  allChanges.push(...tripletResult.changes);''',
r'''  // Step A: Triplet list rewrites — RETIRED FOR ALL PROJECT TYPES (TRIPLETRETIRE-1)
  // detectAndFixTriplets deleted the middle item of factual three-item lists
  // ("the freight sheds, the firehouse, and the elevated railway trestle" lost
  // "the firehouse") and its fragment-merge rule semicolon-merged initials and
  // citation lines ("later. W. E. B. Du Bois" -> "later; w. E. B; du Bois").
  // Measured 2026-08-06 on the real pipeline. A list is content, not an AI
  // tell; deletion is not variation. Same retirement as Steps B and C.
  const tripletResult = { fixed: 0, changes: [] };
  console.log('[POLISH] Step A (triplet rewrites): RETIRED — content deletion measured 2026-08-06; flag-only via proofreader');''',
"TRIPLETRETIRE-1")

# COMMIT 2 Edit 1
apply_edit('src/lib/antiDetectionPolish.js',
r'''import { runExtraPolishChecks } from './extraPolishChecks.js';
import { ABBREVIATION_TOKENS } from './safeUppercase.js';''',
r'''import { runExtraPolishChecks } from './extraPolishChecks.js';
import { ABBREVIATION_TOKENS } from './safeUppercase.js';
import { isNonfictionProject } from './projectType.js';''',
"NFCLASS-5 Edit 1")

# COMMIT 2 Edit 2
apply_edit('src/lib/antiDetectionPolish.js',
r'''  // Determine if this is a nonfiction project (including nonfiction anthologies)
  const isNF = project.book_type === 'nonfiction';''',
r'''  // NFCLASS-5: one authority for fiction vs nonfiction — a raw book_type check
  // here read {project_type:'nonfiction'} records as fiction and ran the
  // fiction-only auto-rewrites on factual prose.
  const isNF = isNonfictionProject(project);''',
"NFCLASS-5 Edit 2")

# COMMIT 3
apply_edit('src/lib/nonfictionPolish.js',
r'''      if (smartOpen > smartClose) {
        for (let d = 0; d < smartOpen - smartClose; d++) {
          if (para.match(/[.!?]\s*$/)) para = para.replace(/([.!?])(\s*)$/, '”$1$2');
          else para = para.trimEnd() + '”';
          grammarFixed++;
        }
      } else if (smartClose > smartOpen) {''',
r'''      if (smartOpen > smartClose) {
        for (let d = 0; d < smartOpen - smartClose; d++) {
          // NFQUOTE-1: if the unquoted tail after the last opening quote is an
          // attribution ("...built, said one engineer's report."), the closer
          // goes AFTER the comma and BEFORE the attribution. Closing at the end
          // swallowed the attribution into the quote — which silently breaks
          // the verbatim-substring property the nonfiction quote gate enforces.
          // Otherwise close after the terminal punctuation (".”", not "”.").
          const lastOpenIdx = para.lastIndexOf('“');
          const tail = lastOpenIdx >= 0 ? para.slice(lastOpenIdx + 1) : '';
          const attrM = tail.match(/,\s+(said|says|wrote|writes|reported|reports|testified|argued|recalled|added|noted|according to)\b/i);
          if (lastOpenIdx >= 0 && !tail.includes('”') && attrM) {
            const insertAt = lastOpenIdx + 1 + attrM.index + 1;
            para = para.slice(0, insertAt) + '”' + para.slice(insertAt);
          } else if (para.match(/[.!?]\s*$/)) {
            para = para.replace(/([.!?])(\s*)$/, '$1”$2');
          } else {
            para = para.trimEnd() + '”';
          }
          grammarFixed++;
        }
      } else if (smartClose > smartOpen) {''',
"NFQUOTE-1")

# COMMIT 4
apply_edit('src/lib/disclaimerStripper.js',
r'''    // Pass 2: Sentence-level deletion using keyword combinations
    // Split into paragraphs, then sentences within each paragraph
    const paragraphs = f.content.split(/\n\n+/);
    const cleanedParagraphs = [];

    for (const para of paragraphs) {
      if (!para.trim()) { cleanedParagraphs.push(para); continue; }

      // Split paragraph into sentences (preserving delimiters)
      const sentences = para.split(/(?<=[.!?])\s+/);
      const kept = [];

      for (const sentence of sentences) {
        if (sentenceMatchesDisclaimerPattern(sentence)) {
          chapterRemoved++;
          // Don't keep this sentence
        } else {
          kept.push(sentence);
        }
      }

      // If all sentences in the paragraph were removed, skip the paragraph entirely
      if (kept.length > 0) {
        cleanedParagraphs.push(kept.join(' '));
      }
    }

    f.content = cleanedParagraphs.join('\n\n');''',
r'''    // Pass 2: Sentence-level deletion using keyword combinations.
    // LINEKEEP-1: processed LINE BY LINE and rejoined on '\n'. The previous
    // version split whole paragraphs into sentences and rejoined on spaces,
    // which flattened every single newline in the manuscript — bibliography
    // entries, quoted letters, and verse merged into run-on paragraphs
    // (measured 2026-08-06: four citation lines became one). Same lesson as
    // PROSEGUARD-1: repair line by line; a repair may not change layout.
    const paragraphs = f.content.split(/\n\n+/);
    const cleanedParagraphs = [];

    for (const para of paragraphs) {
      if (!para.trim()) { cleanedParagraphs.push(para); continue; }

      const lines = para.split('\n');
      const keptLines = [];
      for (const line of lines) {
        if (!line.trim()) { keptLines.push(line); continue; }
        const sentences = line.split(/(?<=[.!?])\s+/);
        const kept = [];
        for (const sentence of sentences) {
          if (sentenceMatchesDisclaimerPattern(sentence)) {
            chapterRemoved++;
            // Don't keep this sentence
          } else {
            kept.push(sentence);
          }
        }
        if (kept.length > 0) keptLines.push(kept.join(' '));
      }

      // If every line in the paragraph was removed, skip the paragraph entirely
      if (keptLines.some((l) => l.trim().length > 0)) {
        cleanedParagraphs.push(keptLines.join('\n'));
      }
    }

    f.content = cleanedParagraphs.join('\n\n');''',
"LINEKEEP-1")

# COMMIT 5 Edit 1
apply_edit('src/lib/pipelineValidator.js',
r'''function isEpistolaryLine(paragraph) {
  const text = String(paragraph || '').trim();
  const firstLine = text.split('\n')[0].trim();
  return SALUTATION_RX.test(text) || VALEDICTION_RX.test(firstLine);
}''',
r'''function isEpistolaryLine(paragraph) {
  const text = String(paragraph || '').trim();
  const firstLine = text.split('\n')[0].trim();
  return SALUTATION_RX.test(text) || VALEDICTION_RX.test(firstLine);
}

// BACKMATTER-1 — a structural heading legitimately ends without terminal
// punctuation ("Sources", "Bibliography", "Appendix B", "# Notes"). Closed
// vocabulary of structural words plus markdown headings only — genuine
// mid-thought truncation ("She turned the key and") matches neither and
// stays a hard block.
const BACKMATTER_HEADING_RX = /^(?:#{1,6}\s+.*|(?:sources|bibliography|references|works cited|further reading|notes|endnotes|acknowledgm?ents|about the author|glossary|index|appendix(?:\s+[A-Z0-9]+)?|epilogue|prologue|introduction|foreword|preface|afterword|part\s+(?:[IVXLC]+|\d+|one|two|three|four|five|six|seven|eight|nine|ten))\s*)$/i;
function isStructuralHeadingLine(paragraph) {
  return BACKMATTER_HEADING_RX.test(String(paragraph || '').trim());
}''',
"BACKMATTER-1 Edit 1")

# COMMIT 5 Edit 2
apply_edit('src/lib/pipelineValidator.js',
r'''    .filter((p) => !/[.!?”"’')\]]$/.test(p) && !isEpistolaryLine(p))''',
r'''    .filter((p) => !/[.!?”"’')\]]$/.test(p) && !isEpistolaryLine(p) && !isStructuralHeadingLine(p))''',
"BACKMATTER-1 Edit 2")

