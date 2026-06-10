/**
 * Cover Layout Templates
 *
 * A small curated set of starting-point layouts for the front-cover editor.
 * Each template produces an array of Fabric.js object definitions, computed
 * from the canvas dimensions and project metadata (title, author, subtitle).
 *
 * Templates assume a 1200×1800 canvas (the editor's internal resolution).
 * They're designed to work atop ANY background — bands provide legibility
 * for bright artwork, and pure typography works when the art has negative
 * space built in.
 *
 * Applying a template:
 *   - Removes all current user-editable text/shape objects
 *   - Keeps the background image
 *   - Adds the template's new objects
 *   - User edits from there
 *
 * IDs:
 *   Template objects use the canonical ids 'title', 'subtitle', 'author'
 *   (plus 'title-band', 'author-band', 'accent-line' etc). This lets
 *   downstream code (exports, save state) recognize them.
 */

import * as fabric from 'fabric';

const CANVAS_W = 1200;
const CANVAS_H = 1800;

export const TEMPLATES = [
  {
    id: 'centered_classic',
    label: 'Centered Classic',
    emoji: '📖',
    description: 'Title top, author bottom, both centered with subtle dark bands.',
    genres: ['literary', 'historical', 'drama'],
  },
  {
    id: 'top_heavy',
    label: 'Top Heavy',
    emoji: '⬆️',
    description: 'Dominant title taking the top third. Author small at bottom.',
    genres: ['thriller', 'horror', 'mystery'],
  },
  {
    id: 'minimalist',
    label: 'Minimalist',
    emoji: '⚪',
    description: 'Pure typography, no bands. Works best with artwork that has built-in space.',
    genres: ['literary', 'memoir', 'self-help'],
  },
  {
    id: 'name_in_band',
    label: 'Author Band',
    emoji: '🏷️',
    description: 'Author name in a prominent band — title above the band.',
    genres: ['thriller', 'romance', 'nonfiction'],
  },
  {
    id: 'full_bleed_band',
    label: 'Full Bleed Band',
    emoji: '▬',
    description: 'Title in a wide color-bleed band at the top, author at bottom.',
    genres: ['romance', 'YA', 'historical'],
  },
];

export function getTemplate(id) {
  return TEMPLATES.find((t) => t.id === id);
}

/**
 * Build the objects that a template needs. Returns an array of
 * ready-to-add Fabric objects. The caller adds them to the canvas.
 */
export function buildTemplateObjects(templateId, project) {
  const title = (project?.title || 'TITLE').toUpperCase();
  const subtitle = project?.tagline || 'A NOVEL';
  const author = (project?.author_name || 'AUTHOR NAME').toUpperCase();

  switch (templateId) {
    case 'centered_classic':
      return centeredClassic(title, subtitle, author);
    case 'top_heavy':
      return topHeavy(title, subtitle, author);
    case 'minimalist':
      return minimalist(title, subtitle, author);
    case 'name_in_band':
      return nameInBand(title, subtitle, author);
    case 'full_bleed_band':
      return fullBleedBand(title, subtitle, author);
    default:
      return centeredClassic(title, subtitle, author);
  }
}

/* =============================================================================
 * INDIVIDUAL TEMPLATE CONSTRUCTORS
 * ========================================================================== */

function mkTitleBand(y, h) {
  const r = new fabric.Rect({
    left: 0, top: y, width: CANVAS_W, height: h,
    fill: 'rgba(0,0,0,0.45)',
    selectable: true, evented: true,
  });
  r._fabricEditorId = 'title-band';
  r._fabricEditorName = 'Title Band';
  return r;
}

function mkAuthorBand(y, h) {
  const r = new fabric.Rect({
    left: 0, top: y, width: CANVAS_W, height: h,
    fill: 'rgba(0,0,0,0.45)',
    selectable: true, evented: true,
  });
  r._fabricEditorId = 'author-band';
  r._fabricEditorName = 'Author Band';
  return r;
}

function mkTitleText(str, y, opts = {}) {
  const tb = new fabric.Textbox(str, {
    left: CANVAS_W / 2, top: y,
    originX: 'center', originY: 'center',
    width: opts.width || CANVAS_W * 0.85,
    fontFamily: opts.fontFamily || 'Cormorant Garamond',
    fontSize: opts.fontSize || 76,
    fontWeight: opts.fontWeight || '700',
    fill: opts.fill || '#fffaf0',
    textAlign: 'center',
    lineHeight: opts.lineHeight || 1.1,
    shadow: new fabric.Shadow({ color: 'rgba(0,0,0,0.7)', blur: 8, offsetX: 3, offsetY: 3 }),
  });
  tb._fabricEditorId = 'title';
  tb._fabricEditorName = 'Title';
  return tb;
}

function mkSubtitleText(str, y, opts = {}) {
  const tb = new fabric.Textbox(str, {
    left: CANVAS_W / 2, top: y,
    originX: 'center', originY: 'center',
    width: opts.width || CANVAS_W * 0.6,
    fontFamily: opts.fontFamily || 'Cormorant Garamond',
    fontSize: opts.fontSize || 36,
    fontWeight: opts.fontWeight || '500',
    fontStyle: opts.fontStyle || 'normal',
    fill: opts.fill || '#fffaf0',
    textAlign: 'center',
    shadow: new fabric.Shadow({ color: 'rgba(0,0,0,0.6)', blur: 4, offsetX: 1, offsetY: 1 }),
  });
  tb._fabricEditorId = 'subtitle';
  tb._fabricEditorName = 'Subtitle';
  return tb;
}

function mkAuthorText(str, y, opts = {}) {
  const tb = new fabric.Textbox(str, {
    left: CANVAS_W / 2, top: y,
    originX: 'center', originY: 'center',
    width: opts.width || CANVAS_W * 0.6,
    fontFamily: opts.fontFamily || 'Cormorant Garamond',
    fontSize: opts.fontSize || 52,
    fontWeight: opts.fontWeight || '600',
    fill: opts.fill || '#fffaf0',
    textAlign: 'center',
    shadow: new fabric.Shadow({ color: 'rgba(0,0,0,0.7)', blur: 6, offsetX: 2, offsetY: 2 }),
  });
  tb._fabricEditorId = 'author';
  tb._fabricEditorName = 'Author';
  return tb;
}

// --- Template 1: Centered Classic ---
// Matches the current default layout. Title top third, author bottom.
function centeredClassic(title, subtitle, author) {
  return [
    mkTitleBand(CANVAS_H * 0.04, CANVAS_H * 0.34),
    mkAuthorBand(CANVAS_H * 0.78, CANVAS_H * 0.18),
    mkTitleText(title, CANVAS_H * 0.15),
    mkSubtitleText(subtitle, CANVAS_H * 0.82),
    mkAuthorText(author, CANVAS_H * 0.88),
  ];
}

// --- Template 2: Top Heavy ---
// Huge title dominates upper third. Author small at the very bottom.
function topHeavy(title, subtitle, author) {
  return [
    mkTitleBand(0, CANVAS_H * 0.42),
    mkTitleText(title, CANVAS_H * 0.18, { fontSize: 100, fontWeight: '900', lineHeight: 0.95, width: CANVAS_W * 0.9 }),
    mkSubtitleText(subtitle, CANVAS_H * 0.32, { fontSize: 28, fontStyle: 'italic' }),
    mkAuthorText(author, CANVAS_H * 0.94, { fontSize: 32, fontWeight: '500' }),
  ];
}

// --- Template 3: Minimalist ---
// No bands — just text. Works when the background art has quiet areas.
function minimalist(title, subtitle, author) {
  return [
    mkTitleText(title, CANVAS_H * 0.12, { fontSize: 64, fontWeight: '400', fill: '#ffffff' }),
    mkSubtitleText(subtitle, CANVAS_H * 0.22, { fontSize: 24, fontStyle: 'italic', fill: '#ffffff' }),
    mkAuthorText(author, CANVAS_H * 0.92, { fontSize: 36, fontWeight: '400', fill: '#ffffff' }),
  ];
}

// --- Template 4: Author Band ---
// Author name sits in a prominent horizontal band. Title above.
function nameInBand(title, subtitle, author) {
  // Author band takes ~15% of canvas height, positioned at ~85%
  const bandY = CANVAS_H * 0.78;
  const bandH = CANVAS_H * 0.15;

  // Solid accent band for the author name
  const authorRect = new fabric.Rect({
    left: 0, top: bandY, width: CANVAS_W, height: bandH,
    fill: 'rgba(0,0,0,0.75)',
    selectable: true, evented: true,
  });
  authorRect._fabricEditorId = 'author-band';
  authorRect._fabricEditorName = 'Author Band';

  return [
    mkTitleBand(CANVAS_H * 0.04, CANVAS_H * 0.3),
    authorRect,
    mkTitleText(title, CANVAS_H * 0.15, { fontSize: 82, lineHeight: 1.05 }),
    mkSubtitleText(subtitle, CANVAS_H * 0.28, { fontSize: 28, fontStyle: 'italic' }),
    mkAuthorText(author, bandY + bandH / 2, { fontSize: 56, fontWeight: '600', fill: '#ffffff' }),
  ];
}

// --- Template 5: Full Bleed Band ---
// Wide colored band at top holds the title. Author at bottom.
function fullBleedBand(title, subtitle, author) {
  // Wide colored band
  const bandY = 0;
  const bandH = CANVAS_H * 0.28;
  const topBand = new fabric.Rect({
    left: 0, top: bandY, width: CANVAS_W, height: bandH,
    fill: 'rgba(30,30,50,0.88)',
    selectable: true, evented: true,
  });
  topBand._fabricEditorId = 'title-band';
  topBand._fabricEditorName = 'Title Band';

  // Thin accent line at the band's bottom edge
  const accent = new fabric.Rect({
    left: 0, top: bandH, width: CANVAS_W, height: 3,
    fill: 'rgba(200,160,80,0.9)',
    selectable: true, evented: true,
  });
  accent._fabricEditorId = 'accent-line';
  accent._fabricEditorName = 'Accent Line';

  return [
    topBand,
    accent,
    mkTitleText(title, bandH / 2, { fontSize: 88, fontWeight: '700', fill: '#ffffff', width: CANVAS_W * 0.85 }),
    mkSubtitleText(subtitle, bandH - 40, { fontSize: 24, fontStyle: 'italic', fill: 'rgba(230,220,180,1)' }),
    mkAuthorText(author, CANVAS_H * 0.93, { fontSize: 44, fontWeight: '600', fill: '#ffffff' }),
  ];
}