// Find quote issues in the extracted text
import { readFileSync } from 'fs';
const text = readFileSync('smoke-test-output/prose-polisher-effectiveness-diagnostic/extracted-full-text-v5.txt', 'utf8');
const lines = text.split('\n');

console.log('=== Missing Opening Quote Detection ===\n');

let issues = 0;
const dialogueTags = /\b(said|retorted|countered|corrected|whispered|muttered|murmured|replied|answered|asked|demanded|insisted|added|continued|snapped|growled|hissed|sighed|breathed|observed|noted|offered|suggested)\b/;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  // Find patterns like: Some text," she said  
  // where there's no opening quote before the closing ,"
  const closeQuoteMatches = [...line.matchAll(/([^""\u201c\u201d]{15,})(,"|\."|!"|\?")\s/g)];
  for (const m of closeQuoteMatches) {
    const before = m[1];
    // Check if `before` contains any opening quote
    if (!before.includes('"') && !before.includes('\u201c')) {
      const after = line.substring(m.index + m[0].length, m.index + m[0].length + 30);
      if (dialogueTags.test(after)) {
        issues++;
        const snippet = line.substring(Math.max(0, m.index - 10), m.index + m[0].length + 30);
        console.log(`  L${i + 1}: ...${snippet.substring(0, 100)}...`);
      }
    }
  }
  
  // Also find: text," at end of long speech without opening quote
  // Pattern: starts with capital, no quote, ends with ,"
  if (/^[A-Z][^""\u201c]{20,},"/.test(line)) {
    issues++;
    console.log(`  L${i + 1} (start-no-open): ${line.substring(0, 100)}...`);
  }
}

console.log(`\nTotal missing-opening-quote issues: ${issues}`);

// Also count quote imbalance per paragraph
console.log('\n=== Quote Imbalance Per Line ===\n');
let imbalanced = 0;
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const opens = (line.match(/\u201c/g) || []).length + (line.match(/(?<![\\])\"/g) || []).length;
  const smartCloses = (line.match(/\u201d/g) || []).length;
  // For straight quotes, each " could be open or close
  // Mainly look for lines with smart quotes that are mismatched
  if (line.includes('\u201d') && !line.includes('\u201c')) {
    // Has closing smart quote but no opening smart quote
    if (line.length > 50) {
      imbalanced++;
      if (imbalanced <= 10) {
        console.log(`  L${i + 1}: close\u201d without open\u201c: ${line.substring(0, 80)}...`);
      }
    }
  }
}
console.log(`\nTotal lines with smart-quote imbalance: ${imbalanced}`);
