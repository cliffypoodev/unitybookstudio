import io, sys

p1 = 'src/lib/nonfictionPolish.js'
c1 = io.open(p1, encoding='utf-8').read()

f1 = r'''      if (smartOpen > smartClose) {
        for (let d = 0; d < smartOpen - smartClose; d++) {
          if (para.match(/[.!?]\s*$/)) para = para.replace(/([.!?])(\s*)$/, '\u201d$1$2');
          else para = para.trimEnd() + '\u201d';
          grammarFixed++;
        }
      } else if (smartClose > smartOpen) {'''
r1 = r'''      if (smartOpen > smartClose) {
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
      } else if (smartClose > smartOpen) {'''

step3b_idx = c1.find('// Step 3b: NF grammar fixes')
if step3b_idx == -1:
    print("ABORT NFQUOTE-1: Could not find Step 3b")
    sys.exit(1)

target_idx = c1.find(f1, step3b_idx)
if target_idx == -1:
    print("ABORT NFQUOTE-1: Could not find target in Step 3b")
    sys.exit(1)

c1 = c1[:target_idx] + r1 + c1[target_idx + len(f1):]

io.open(p1, 'w', encoding='utf-8').write(c1)
print("SUCCESS: NFQUOTE-1 applied")
