import { unified } from 'unified';
import retextEnglish from 'retext-english';
import retextStringify from 'retext-stringify';
import retextIndefiniteArticle from 'retext-indefinite-article';
import retextRepeatedWords from 'retext-repeated-words';
import { toString } from 'nlcst-to-string';

// PROSEGATE-1D: only adjectives with NO standard noun sense. The rest of the
// original lexicon nominalizes ("a living" = livelihood, "a brief" = filing,
// "a fitting" = pipe part, "the quiet" = stillness) and produced a false
// EXPORT BLOCK on valid prose ("the extraction of the living from the
// sinking streets"). High precision beats coverage: the gate must never
// block correct English.
const ADJ_LEXICON = new Set(['silent', 'lasting', 'direct']);
const ARTICLES = new Set(['a', 'an', 'the']);
const PREPOSITIONS = new Set(['to', 'of', 'in', 'on', 'for', 'with', 'from', 'by', 'at']);
const DET_POSS = new Set(['the', 'its', 'this', 'that', 'their', 'his', 'her', 'these', 'those', 'a', 'an']);

function droppedNounPlugin() {
  return (tree, file) => {
    let paragraphIndex = 0;
    
    function visit(node) {
      if (node.type === 'ParagraphNode') {
        paragraphIndex++;
        
        // ADVISORY: paragraphs whose first 4 words repeat a previous paragraph's opener.
        // We'll handle this at the top level after processing, since we need to compare paragraphs.
      }
      
      if (node.type === 'SentenceNode') {
        // Collect words (ignoring spaces/punctuation)
        const words = [];
        for (const child of node.children) {
          if (child.type === 'WordNode') {
            words.push({
              node: child,
              text: toString(child).toLowerCase()
            });
          }
        }
        
        // ADVISORY: sentences over 60 words
        if (words.length > 60) {
          file.message('Sentence exceeds 60 words', node, 'prosegate:long-sentence');
        }

        // HARD: dropped-noun
        for (let i = 0; i < words.length - 2; i++) {
          const w1 = words[i].text;
          if (ARTICLES.has(w1)) {
            // Check for [Article] [Preposition] [Det/Poss]
            const w2 = words[i+1].text;
            const w3 = words[i+2].text;
            
            if (PREPOSITIONS.has(w2) && DET_POSS.has(w3)) {
              const m = file.message('Dropped noun (article + preposition)', words[i].node, 'prosegate:dropped-noun');
              m.paragraph = paragraphIndex;
              m.actual = words.slice(i, i+3).map(w => w.text).join(' ');
            } else if (i < words.length - 3) {
              // Check for [Article] [Adj] [Preposition] [Det/Poss]
              const w4 = words[i+3].text;
              // PROSEGATE-1D: a/an only — "the + adjective" nominalizes freely
              // in English ("the living", "the dead", "the open"), so the
              // definite-article variant cannot be decided without semantics.
              if (w1 !== 'the' && ADJ_LEXICON.has(w2) && PREPOSITIONS.has(w3) && DET_POSS.has(w4)) {
                const m = file.message('Dropped noun (article + adj + preposition)', words[i].node, 'prosegate:dropped-noun');
                m.paragraph = paragraphIndex;
                m.actual = words.slice(i, i+4).map(w => w.text).join(' ');
              }
            }
          }
        }
      }

      if (node.children) {
        for (const child of node.children) {
          visit(child);
        }
      }
    }

    visit(tree);
  };
}

function paragraphOpenerPlugin() {
  return (tree, file) => {
    const openers = [];
    let paragraphIndex = 0;
    
    for (const child of tree.children) {
      if (child.type === 'ParagraphNode') {
        paragraphIndex++;
        const words = [];
        function getWords(n) {
          if (n.type === 'WordNode') {
            words.push(toString(n).toLowerCase());
          } else if (n.children) {
            for (const c of n.children) getWords(c);
          }
        }
        getWords(child);
        
        if (words.length >= 4) {
          const opener = words.slice(0, 4).join(' ');
          if (openers.includes(opener)) {
            file.message('Paragraph starts with repeated 4-word opener', child, 'prosegate:repeated-opener');
          } else {
            openers.push(opener);
          }
        }
      }
    }
  };
}

export async function analyzeProse(text) {
  const processor = unified()
    .use(retextEnglish)
    .use(retextIndefiniteArticle)
    .use(retextRepeatedWords)
    .use(droppedNounPlugin)
    .use(paragraphOpenerPlugin)
    .use(retextStringify);

  const file = await processor.process(String(text || ''));
  
  const hard = [];
  const advisory = [];

  // Re-parse to easily find paragraph index for messages, or map positional offsets.
  // We can just count newlines in the original text up to the message offset.
  const getParagraph = (msg) => {
    if (msg.paragraph !== undefined) return msg.paragraph;
    const offset = msg.position?.start?.offset;
    if (offset === undefined || offset === null) return 1;
    const prefix = String(text || '').slice(0, offset);
    const paras = prefix.split(/\n{2,}/);
    return paras.length;
  };

  for (const msg of file.messages) {
    const ruleId = msg.ruleId || msg.source;
    const isHard = ruleId === 'retext-indefinite-article' || 
                   ruleId === 'retext-repeated-words' || 
                   ruleId === 'dropped-noun' ||
                   msg.source === 'retext-indefinite-article' ||
                   msg.source === 'retext-repeated-words' ||
                   (msg.source === 'prosegate' && msg.ruleId === 'dropped-noun');

    const finding = {
      rule: msg.source === 'prosegate' ? msg.ruleId : msg.source,
      message: msg.reason,
      snippet: msg.actual || '', 
      paragraph: getParagraph(msg)
    };

    if (!finding.snippet && msg.position && msg.position.start && msg.position.end) {
      finding.snippet = String(text || '').slice(msg.position.start.offset, msg.position.end.offset);
    }

    if (isHard) {
      hard.push(finding);
    } else {
      advisory.push(finding);
    }
  }

  return { hard, advisory };
}
