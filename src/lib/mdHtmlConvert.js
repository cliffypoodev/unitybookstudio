// =============================================================
// Markdown ↔ HTML conversion for the Export editor
// Phase 2F — safer manuscript conversion
//
// Goals:
// - Preserve manuscript structure better than the old regex-only version.
// - Support headings, paragraphs, scene breaks, blockquotes, lists, links,
//   bold, italic, underline, strike, code, and line breaks.
// - Avoid destructive conversion where possible.
// - Keep output compatible with current content_md storage.
// - Avoid adding dependencies.
// =============================================================

const SCENE_BREAK_TOKEN = '---';

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function decodeHtml(value = '') {
  const text = String(value);

  if (typeof document === 'undefined') {
    return text
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#x27;/g, "'");
  }

  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  return textarea.value;
}

function looksLikeHtml(value = '') {
  const trimmed = String(value || '').trim();
  return /^<([a-z][\w:-]*)(\s|>|\/>)/i.test(trimmed);
}

function cleanText(value = '') {
  return decodeHtml(String(value || ''))
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeSceneBreakLine(line = '') {
  const trimmed = String(line || '').trim();

  if (/^([-*_])\1\1+$/.test(trimmed)) return SCENE_BREAK_TOKEN;
  if (/^—{3,}$/.test(trimmed)) return SCENE_BREAK_TOKEN;
  if (/^–{3,}$/.test(trimmed)) return SCENE_BREAK_TOKEN;
  if (/^•\s*•\s*•$/.test(trimmed)) return SCENE_BREAK_TOKEN;
  if (/^⁂$/.test(trimmed)) return SCENE_BREAK_TOKEN;

  return line;
}

function normalizeMarkdown(md = '') {
  return String(md || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map(normalizeSceneBreakLine)
    .join('\n')
    .replace(/[ \t]+$/gm, '')
    .trim();
}

function applyInlineMarkdown(text = '') {
  let html = escapeHtml(text);

  // Links: [label](url)
  html = html.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)\s]+|mailto:[^)\s]+|#[^)]+)\)/g,
    '<a href="$2">$1</a>'
  );

  // Inline code.
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Bold + italic.
  html = html.replace(/\*\*\*([\s\S]+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/___([\s\S]+?)___/g, '<strong><em>$1</em></strong>');

  // Bold.
  html = html.replace(/\*\*([\s\S]+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__([\s\S]+?)__/g, '<strong>$1</strong>');

  // Italic. Conservative so random asterisks do not destroy text.
  html = html.replace(/(^|[\s(])\*([^*\n]+?)\*(?=[\s).,!?:;]|$)/g, '$1<em>$2</em>');
  html = html.replace(/(^|[\s(])_([^_\n]+?)_(?=[\s).,!?:;]|$)/g, '$1<em>$2</em>');

  // Strikethrough.
  html = html.replace(/~~([\s\S]+?)~~/g, '<s>$1</s>');

  return html;
}

function isUnorderedListLine(line = '') {
  return /^\s*[-*+]\s+/.test(line);
}

function isOrderedListLine(line = '') {
  return /^\s*\d+[.)]\s+/.test(line);
}

function stripUnorderedMarker(line = '') {
  return line.replace(/^\s*[-*+]\s+/, '');
}

function stripOrderedMarker(line = '') {
  return line.replace(/^\s*\d+[.)]\s+/, '');
}

function isBlockquoteLine(line = '') {
  return /^\s*>\s?/.test(line);
}

function stripBlockquoteMarker(line = '') {
  return line.replace(/^\s*>\s?/, '');
}

function renderListBlock(lines, ordered = false) {
  const tag = ordered ? 'ol' : 'ul';
  const items = lines
    .map((line) => {
      const raw = ordered ? stripOrderedMarker(line) : stripUnorderedMarker(line);
      return `<li>${applyInlineMarkdown(raw.trim())}</li>`;
    })
    .join('');

  return `<${tag}>${items}</${tag}>`;
}

function renderBlockquoteBlock(lines) {
  const body = lines
    .map(stripBlockquoteMarker)
    .join('\n')
    .trim();

  const paragraphs = body
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => `<p>${applyInlineMarkdown(part).replace(/\n/g, '<br>')}</p>`)
    .join('');

  return `<blockquote>${paragraphs || '<p></p>'}</blockquote>`;
}

function renderParagraphBlock(block = '') {
  const trimmed = block.trim();
  if (!trimmed) return '';

  if (trimmed === SCENE_BREAK_TOKEN) return '<hr class="scene-break" />';

  const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
  if (heading) {
    const level = Math.min(heading[1].length, 6);
    return `<h${level}>${applyInlineMarkdown(heading[2].trim())}</h${level}>`;
  }

  return `<p>${applyInlineMarkdown(trimmed).replace(/\n/g, '<br>')}</p>`;
}

/**
 * Convert stored manuscript markdown to HTML for ReactQuill.
 *
 * This intentionally supports a manuscript-friendly subset rather than trying
 * to become a full Markdown engine. It is predictable, dependency-free, and
 * safe for the existing storage model.
 */
export function mdToHtml(md) {
  if (!md) return '';

  const input = String(md);

  // Some older saves may already be HTML. Do not wrap them in paragraphs.
  if (looksLikeHtml(input)) {
    return input.trim();
  }

  const normalized = normalizeMarkdown(input);
  if (!normalized) return '';

  const lines = normalized.split('\n');
  const blocks = [];
  let buffer = [];
  let listBuffer = [];
  let listType = null;
  let quoteBuffer = [];

  const flushParagraph = () => {
    if (!buffer.length) return;
    blocks.push(renderParagraphBlock(buffer.join('\n')));
    buffer = [];
  };

  const flushList = () => {
    if (!listBuffer.length) return;
    blocks.push(renderListBlock(listBuffer, listType === 'ol'));
    listBuffer = [];
    listType = null;
  };

  const flushQuote = () => {
    if (!quoteBuffer.length) return;
    blocks.push(renderBlockquoteBlock(quoteBuffer));
    quoteBuffer = [];
  };

  const flushAll = () => {
    flushParagraph();
    flushList();
    flushQuote();
  };

  for (const line of lines) {
    const normalizedLine = normalizeSceneBreakLine(line);
    const trimmed = normalizedLine.trim();

    if (!trimmed) {
      flushAll();
      continue;
    }

    if (trimmed === SCENE_BREAK_TOKEN) {
      flushAll();
      blocks.push('<hr class="scene-break" />');
      continue;
    }

    if (isBlockquoteLine(normalizedLine)) {
      flushParagraph();
      flushList();
      quoteBuffer.push(normalizedLine);
      continue;
    }

    if (isUnorderedListLine(normalizedLine)) {
      flushParagraph();
      flushQuote();

      if (listType && listType !== 'ul') flushList();

      listType = 'ul';
      listBuffer.push(normalizedLine);
      continue;
    }

    if (isOrderedListLine(normalizedLine)) {
      flushParagraph();
      flushQuote();

      if (listType && listType !== 'ol') flushList();

      listType = 'ol';
      listBuffer.push(normalizedLine);
      continue;
    }

    flushList();
    flushQuote();
    buffer.push(normalizedLine);
  }

  flushAll();

  return blocks.filter(Boolean).join('');
}

function nodeTextContent(node) {
  return cleanText(node?.textContent || '');
}

function inlineNodeToMd(node) {
  if (!node) return '';

  if (node.nodeType === Node.TEXT_NODE) {
    return decodeHtml(node.nodeValue || '');
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return '';
  }

  const tag = node.tagName.toLowerCase();
  const children = Array.from(node.childNodes).map(inlineNodeToMd).join('');

  switch (tag) {
    case 'strong':
    case 'b':
      return children ? `**${children}**` : '';

    case 'em':
    case 'i':
      return children ? `*${children}*` : '';

    case 'u':
      // Markdown has no native underline. Keep safe inline HTML so the text
      // does not silently lose intent in markdown exports.
      return children ? `<u>${children}</u>` : '';

    case 's':
    case 'strike':
    case 'del':
      return children ? `~~${children}~~` : '';

    case 'code':
      return children ? `\`${children.replace(/`/g, '')}\`` : '';

    case 'a': {
      const href = node.getAttribute('href') || '';
      if (!href) return children;
      return `[${children || href}](${href})`;
    }

    case 'span':
      // Preserve text from styled spans, but do not attempt to store every
      // Quill style in markdown. Rich persistence belongs in Phase 3.
      return children;

    case 'br':
      return '\n';

    default:
      return children;
  }
}

function blockNodeToMd(node) {
  if (!node || node.nodeType !== Node.ELEMENT_NODE) return '';

  const tag = node.tagName.toLowerCase();

  if (tag === 'h1') return `# ${inlineChildrenToMd(node)}`;
  if (tag === 'h2') return `## ${inlineChildrenToMd(node)}`;
  if (tag === 'h3') return `### ${inlineChildrenToMd(node)}`;
  if (tag === 'h4') return `#### ${inlineChildrenToMd(node)}`;
  if (tag === 'h5') return `##### ${inlineChildrenToMd(node)}`;
  if (tag === 'h6') return `###### ${inlineChildrenToMd(node)}`;

  if (tag === 'hr') return SCENE_BREAK_TOKEN;

  if (tag === 'blockquote') {
    const innerBlocks = childBlocksToMd(node)
      .split('\n\n')
      .map((part) => part.trim())
      .filter(Boolean);

    const quote = innerBlocks
      .map((part) =>
        part
          .split('\n')
          .map((line) => `> ${line}`.trimEnd())
          .join('\n')
      )
      .join('\n>\n');

    return quote || `> ${nodeTextContent(node)}`;
  }

  if (tag === 'ul') {
    return Array.from(node.children)
      .filter((child) => child.tagName?.toLowerCase() === 'li')
      .map((li) => `- ${inlineChildrenToMd(li).trim()}`)
      .join('\n');
  }

  if (tag === 'ol') {
    return Array.from(node.children)
      .filter((child) => child.tagName?.toLowerCase() === 'li')
      .map((li, index) => `${index + 1}. ${inlineChildrenToMd(li).trim()}`)
      .join('\n');
  }

  if (tag === 'pre') {
    return `\`\`\`\n${nodeTextContent(node)}\n\`\`\``;
  }

  if (tag === 'p') {
    const text = inlineChildrenToMd(node).trim();

    // Quill sometimes leaves empty paragraph placeholders.
    if (!text || text === '\n') return '';

    return text;
  }

  if (tag === 'div' || tag === 'section' || tag === 'article') {
    return childBlocksToMd(node);
  }

  if (tag === 'li') {
    return `- ${inlineChildrenToMd(node).trim()}`;
  }

  return inlineChildrenToMd(node).trim();
}

function inlineChildrenToMd(node) {
  return Array.from(node.childNodes).map(inlineNodeToMd).join('');
}

function childBlocksToMd(node) {
  return Array.from(node.childNodes)
    .map((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        const text = cleanText(child.nodeValue || '');
        return text;
      }

      if (child.nodeType === Node.ELEMENT_NODE) {
        const tag = child.tagName.toLowerCase();

        if (isBlockElement(tag)) {
          return blockNodeToMd(child);
        }

        return inlineNodeToMd(child);
      }

      return '';
    })
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join('\n\n');
}

function isBlockElement(tag = '') {
  return [
    'p',
    'div',
    'section',
    'article',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'blockquote',
    'ul',
    'ol',
    'li',
    'pre',
    'hr',
  ].includes(String(tag).toLowerCase());
}

function fallbackHtmlToMd(html = '') {
  return String(html || '')
    .replace(/<hr[^>]*>/gi, '\n\n---\n\n')
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n\n# $1\n\n')
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n\n## $1\n\n')
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n\n### $1\n\n')
    .replace(/<strong[^>]*><em[^>]*>([\s\S]*?)<\/em><\/strong>/gi, '***$1***')
    .replace(/<em[^>]*><strong[^>]*>([\s\S]*?)<\/strong><\/em>/gi, '***$1***')
    .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**')
    .replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**')
    .replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '*$1*')
    .replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '*$1*')
    .replace(/<s[^>]*>([\s\S]*?)<\/s>/gi, '~~$1~~')
    .replace(/<strike[^>]*>([\s\S]*?)<\/strike>/gi, '~~$1~~')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
    .replace(/<p[^>]*>/gi, '')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Convert HTML from ReactQuill back to manuscript markdown for storage.
 *
 * This keeps the existing `content_md` architecture intact. It preserves more
 * structure than the old regex pipeline, but it still intentionally treats
 * markdown as the durable fallback format. Full style persistence belongs in
 * Phase 3 with HTML/Delta fields.
 */
export function htmlToMd(html) {
  if (!html) return '';

  const source = String(html || '').trim();
  if (!source) return '';

  if (typeof DOMParser === 'undefined' || typeof Node === 'undefined') {
    return cleanText(fallbackHtmlToMd(source));
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div id="root">${source}</div>`, 'text/html');
    const root = doc.getElementById('root') || doc.body;

    const md = childBlocksToMd(root)
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/^\s+|\s+$/g, '');

    return cleanText(md);
  } catch (err) {
    console.warn('[mdHtmlConvert] DOM conversion failed; using fallback converter.', err);
    return cleanText(fallbackHtmlToMd(source));
  }
}

export function stripHtmlToText(html = '') {
  return cleanText(fallbackHtmlToMd(html));
}