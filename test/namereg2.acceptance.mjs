// NAMEREG-2 acceptance battery — the mid-sentence rule for
// extractProminentProseNames (anthologyRenamePass.js).
//
// A capitalized token that only ever OPENS a sentence ("Better.", "Nothing.",
// "Maybe") never appears lowercase either, so it survived the extractor's
// existing lowercase-elimination check and registered as a "name" — the
// "Better"-style extractor false positive. A real name appears as a
// mid-sentence subject/object constantly; a sentence adverb or interjection
// never does. Generic fixture names only (Mara, Dov, Ilse).
import { extractProminentProseNames } from '../src/lib/anthologyRenamePass.js';

let failures = 0;
const check = (name, pass, detail) => { console.log((pass ? 'PASS ' : 'FAIL ') + name + (pass || !detail ? '' : `\n      ${detail}`)); if (!pass) failures += 1; };

// ── 1. "Better." x3 at sentence starts → not a name ──
{
  const text = 'Better. He walked away without another word. Better. She stared at the empty wall for a long while. Better. He said nothing else that night.';
  const extracted = extractProminentProseNames(text, { minCount: 3 });
  check('1. a token that only ever opens a sentence is not a name', !extracted.includes('Better'), JSON.stringify(extracted));
}

// ── 2. "Mara" x3 with one mid-sentence → name ──
{
  const text = 'Mara opened the door slowly. Dov saw Mara and smiled at her. Ilse handed Mara the wrench without a word.';
  const extracted = extractProminentProseNames(text, { minCount: 3 });
  check('2. a real name with at least one mid-sentence occurrence survives', extracted.includes('Mara'), JSON.stringify(extracted));
}

// ── 3. a token after an opening quote counts as sentence-initial ──
{
  const text = '"Better," she said quietly. "Better than yesterday," he agreed. "Better still tomorrow," she added.';
  const extracted = extractProminentProseNames(text, { minCount: 3 });
  check('3. every occurrence immediately after an opening quote is sentence-initial, so the token is not a name', !extracted.includes('Better'), JSON.stringify(extracted));
}

// ── 4. existing minCount/maxNames behaviour unchanged ──
{
  const proseA = 'Dorian shut the door. The storm was loud. Dorian looked at Wren. She said nothing. Wren waited. Dorian sat. Wren poured coffee for Dorian and for the visitor named Callum. Callum smiled. Callum left early. She watched the storm.';
  const extracted = extractProminentProseNames(proseA);
  check('4a. recurring prose names with mid-sentence occurrences still extract (minCount default = 3)',
    extracted.includes('Dorian') && extracted.includes('Wren') && extracted.includes('Callum'), JSON.stringify(extracted));
  check('4b. sentence-start common words are still ignored (lowercase-elimination rule kept)',
    !extracted.some((n) => ['The', 'She', 'Storm'].includes(n)));

  // maxNames still caps the result, sorted by count descending.
  const pool = ['Aiden', 'Blair', 'Corin', 'Deshawn', 'Elowen', 'Farida', 'Grier', 'Halston'];
  const manyNames = pool.map((name) => `${name} spoke to someone about ${name} again and ${name} agreed.`).join(' ');
  const capped = extractProminentProseNames(manyNames, { minCount: 1, maxNames: 5 });
  check('4c. maxNames still caps the result at the requested count', capped.length === 5, `got ${capped.length}: ${JSON.stringify(capped)}`);
}

console.log(failures === 0 ? '\nACCEPTANCE: ALL CHECKS MATCHED' : `\nACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
