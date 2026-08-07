import io, sys
def apply_edit(filepath, find_str, replace_str, name):
    content = io.open(filepath, encoding='utf-8').read()
    if content.count(find_str) != 1:
        print(f"ABORT {name}: Expected 1, found {content.count(find_str)}")
        sys.exit(1)
    content = content.replace(find_str, replace_str)
    io.open(filepath, 'w', encoding='utf-8').write(content)
    print(f"SUCCESS: {name} applied")

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
"COMMIT 4")
