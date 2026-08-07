import io, sys
def apply_edit(filepath, find_str, replace_str, name):
    content = io.open(filepath, encoding='utf-8').read()
    if content.count(find_str) != 1:
        print(f"ABORT {name}: Expected 1, found {content.count(find_str)}")
        sys.exit(1)
    content = content.replace(find_str, replace_str)
    io.open(filepath, 'w', encoding='utf-8').write(content)
    print(f"SUCCESS: {name} applied")

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
"COMMIT 5 Edit 1")

apply_edit('src/lib/pipelineValidator.js',
r'''    .filter((p) => !/[.!?”"’')\]]$/.test(p) && !isEpistolaryLine(p))''',
r'''    .filter((p) => !/[.!?”"’')\]]$/.test(p) && !isEpistolaryLine(p) && !isStructuralHeadingLine(p))''',
"COMMIT 5 Edit 2")
