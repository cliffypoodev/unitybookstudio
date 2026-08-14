/* ============================================================================
 * ⚠️  DEAD CODE — DO NOT EDIT EXPECTING UI CHANGES  (WAVE9-DEADSTAMP2, Aug 2026)
 *
 * Nothing imports this file. Editing it has NO effect on the running app.
 * Developer tooling — static analysis of button/handler wiring. Never part of the running app.
 * Kept (not deleted) at the owner's request; recoverable context only.
 * ========================================================================== */

/**
 * uiWiringAudit.js — Static analysis utilities for verifying button/handler
 * wiring in React JSX components.
 *
 * Uses regex to scan raw source code for interactive controls (Button, button,
 * select, input), extract handler bindings, and detect potential no-op handlers.
 */

// ── Patterns ──────────────────────────────────────────────────────────────────

/** Matches <Button or <button tags (self-closing or opening) */
const BUTTON_TAG_RE = /<(?:Button|button)\b([^>]*?)(?:\/>|>)/g;

/** Matches <select tags */
const SELECT_TAG_RE = /<select\b([^>]*?)(?:\/>|>)/g;

/** Matches <input tags with onChange */
const INPUT_WITH_HANDLER_RE = /<input\b([^>]*?(?:onChange|onClick)[^>]*?)(?:\/>|>)/g;

/** Matches onClick={...} or onChange={...} or onSubmit={...} attribute */
const HANDLER_ATTR_RE = /\b(onClick|onChange|onSubmit)\s*=\s*\{([^}]*)\}/;

/** Matches id="..." or id={'...'} attribute */
const ID_ATTR_RE = /\bid\s*=\s*(?:"([^"]+)"|{?\s*['"]([^'"]+)['"])/;

/** Patterns considered no-op / placeholder handlers */
const NOOP_PATTERNS = [
  { re: /\b(?:onClick|onChange|onSubmit)\s*=\s*\{\s*\(\)\s*=>\s*\{\s*\}\s*\}/, label: '() => {}' },
  { re: /\b(?:onClick|onChange|onSubmit)\s*=\s*\{\s*\(\)\s*=>\s*null\s*\}/, label: '() => null' },
  { re: /\b(?:onClick|onChange|onSubmit)\s*=\s*\{\s*noop\s*\}/, label: '{noop}' },
  { re: /\/\/\s*TODO\b/, label: '// TODO' },
  { re: /\/\*\s*TODO\b/, label: '/* TODO' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Return the 1-based line number for a character offset in source.
 * @param {string} source
 * @param {number} offset
 * @returns {number}
 */
function lineAt(source, offset) {
  let line = 1;
  for (let i = 0; i < offset && i < source.length; i++) {
    if (source[i] === '\n') line++;
  }
  return line;
}

/**
 * Extract handler expression from attribute blob.
 * @param {string} attrs - The attribute string inside a tag
 * @returns {string}
 */
function extractHandler(attrs) {
  const m = attrs.match(HANDLER_ATTR_RE);
  return m ? m[2].trim() : '';
}

/**
 * Extract id value from attribute blob.
 * @param {string} attrs - The attribute string inside a tag
 * @returns {string|null}
 */
function extractId(attrs) {
  const m = attrs.match(ID_ATTR_RE);
  return m ? (m[1] || m[2] || null) : null;
}

// ── Exports ───────────────────────────────────────────────────────────────────

/**
 * Scan component source for buttons and interactive controls.
 * Finds: <Button, <button, onClick=, onChange=, onSubmit= on select/input tags.
 * @param {string} componentSource - Raw source code string
 * @returns {Array<{ type: string, id: string|null, handler: string, line: number }>}
 */
export function scanComponentForButtons(componentSource) {
  if (!componentSource || typeof componentSource !== 'string') return [];

  const controls = [];
  const seen = new Set();

  /**
   * Process a single regex match and push to controls if it has a handler.
   * @param {string} type
   * @param {RegExp} re
   */
  function scan(type, re) {
    const regex = new RegExp(re.source, re.flags);
    let m;
    while ((m = regex.exec(componentSource)) !== null) {
      const attrs = m[1] || '';
      const handler = extractHandler(attrs);
      if (!handler) continue;

      const id = extractId(attrs);
      const line = lineAt(componentSource, m.index);
      const key = `${type}:${id || ''}:${handler}:${line}`;
      if (seen.has(key)) continue;
      seen.add(key);

      controls.push({ type, id, handler, line });
    }
  }

  scan('Button', BUTTON_TAG_RE);
  scan('select', SELECT_TAG_RE);
  scan('input', INPUT_WITH_HANDLER_RE);

  // Also find standalone onClick/onChange/onSubmit on any element we might have
  // missed (e.g. <div onClick=...>, <Textarea onChange=...>)
  const INLINE_HANDLER_RE = /\b(onClick|onChange|onSubmit)\s*=\s*\{([^}]*)\}/g;
  let ih;
  while ((ih = INLINE_HANDLER_RE.exec(componentSource)) !== null) {
    const handlerType = ih[1];
    const handler = ih[2].trim();
    const line = lineAt(componentSource, ih.index);

    // Look backwards from match to find the closest tag and its id
    const before = componentSource.slice(Math.max(0, ih.index - 300), ih.index);
    const tagMatch = before.match(/<(\w+)\b[^>]*$/);
    const tagName = tagMatch ? tagMatch[1] : 'unknown';
    const fullTagAttrs = before.slice(tagMatch ? tagMatch.index : 0) + componentSource.slice(ih.index, ih.index + ih[0].length + 100);
    const id = extractId(fullTagAttrs);

    const key = `${tagName}:${id || ''}:${handler}:${line}`;
    if (seen.has(key)) continue;
    seen.add(key);

    controls.push({ type: tagName, id, handler, line });
  }

  // Sort by line number for stable output
  controls.sort((a, b) => a.line - b.line);
  return controls;
}

/**
 * Identify potential no-op handlers: () => {}, () => null, TODO handlers.
 * @param {string} componentSource
 * @returns {Array<{ pattern: string, line: number, context: string }>}
 */
export function identifyPotentialNoopHandlers(componentSource) {
  if (!componentSource || typeof componentSource !== 'string') return [];

  const results = [];
  const lines = componentSource.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const lineText = lines[i];
    for (const { re, label } of NOOP_PATTERNS) {
      if (re.test(lineText)) {
        results.push({
          pattern: label,
          line: i + 1,
          context: lineText.trim().slice(0, 120),
        });
      }
    }
  }

  return results;
}

/**
 * Build a structured wiring checklist.
 * @param {string} componentName
 * @param {string} source
 * @returns {{ componentName: string, totalControls: number, controls: Array, noopHandlers: Array, wiredPercentage: number }}
 */
export function buildUIWiringChecklist(componentName, source) {
  const controls = scanComponentForButtons(source);
  const noopHandlers = identifyPotentialNoopHandlers(source);

  // A control is "wired" if its handler is not empty and is not a known no-op
  const noopLines = new Set(noopHandlers.map((n) => n.line));
  const wiredControls = controls.filter((c) => {
    if (!c.handler) return false;
    if (noopLines.has(c.line)) return false;
    // Check inline no-op patterns against the handler text itself
    if (/^\s*\(\)\s*=>\s*\{\s*\}\s*$/.test(c.handler)) return false;
    if (/^\s*\(\)\s*=>\s*null\s*$/.test(c.handler)) return false;
    if (/^\s*noop\s*$/.test(c.handler)) return false;
    return true;
  });

  const totalControls = controls.length;
  const wiredPercentage = totalControls > 0
    ? Math.round((wiredControls.length / totalControls) * 100)
    : 100;

  return {
    componentName,
    totalControls,
    controls,
    noopHandlers,
    wiredPercentage,
  };
}

/**
 * Create a markdown-formatted manual wiring audit report.
 * @param {Object} results - Output from buildUIWiringChecklist
 * @returns {string} Markdown report
 */
export function createManualWiringAuditReport(results) {
  const lines = [
    `# Wiring Audit: ${results.componentName}`,
    '',
    `**Total interactive controls:** ${results.totalControls}`,
    `**Wired percentage:** ${results.wiredPercentage}%`,
    '',
  ];

  if (results.controls.length > 0) {
    lines.push('## Controls');
    lines.push('');
    lines.push('| # | Type | ID | Handler | Line |');
    lines.push('|---|------|----|---------|------|');
    results.controls.forEach((c, i) => {
      const handler = c.handler.length > 50 ? c.handler.slice(0, 47) + '…' : c.handler;
      lines.push(`| ${i + 1} | ${c.type} | ${c.id || '—'} | \`${handler}\` | ${c.line} |`);
    });
    lines.push('');
  }

  if (results.noopHandlers.length > 0) {
    lines.push('## ⚠️ Potential No-Op Handlers');
    lines.push('');
    results.noopHandlers.forEach((n) => {
      lines.push(`- **Line ${n.line}**: \`${n.pattern}\` — ${n.context}`);
    });
    lines.push('');
  }

  if (results.wiredPercentage === 100 && results.noopHandlers.length === 0) {
    lines.push('✅ All controls are properly wired.');
  }

  return lines.join('\n');
}
