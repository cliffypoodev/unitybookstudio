import { base44 } from '@/api/base44Client';
import { buildTypographyPlan, clamp } from '@/lib/coverTypography';

const GOOGLE_FONT_URL =
  'https://fonts.googleapis.com/css2?family=Anton&family=Archivo+Black&family=Barlow+Condensed:wght@400;500;600;700;800&family=Bebas+Neue&family=Cinzel:wght@400;600;700;800&family=Cormorant+Garamond:wght@400;500;600;700&family=League+Spartan:wght@600;700;800;900&family=Libre+Baskerville:wght@400;700&family=Oswald:wght@400;500;600;700&family=Playfair+Display:wght@600;700;800;900&family=Staatliches&display=swap';

let fontsPromise = null;

async function ensureCoverFontsLoaded() {
  if (typeof document === 'undefined') return;

  if (!fontsPromise) {
    fontsPromise = new Promise((resolve) => {
      const existing = document.querySelector('link[data-cover-fonts="true"]');

      if (!existing) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = GOOGLE_FONT_URL;
        link.dataset.coverFonts = 'true';
        document.head.appendChild(link);
      }

      if (document.fonts?.ready) {
        document.fonts.ready
          .then(() => resolve())
          .catch(() => resolve());
      } else {
        setTimeout(resolve, 800);
      }
    });
  }

  return fontsPromise;
}

function createCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export function dataUrlToFile(dataUrl, filename = `cover-${Date.now()}.png`) {
  const [header, base64] = dataUrl.split(',');
  const mimeMatch = header.match(/data:(.*?);base64/);
  const mime = mimeMatch?.[1] || 'image/png';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return new File([bytes], filename, { type: mime });
}

function isRemoteUrl(src) {
  return /^https?:\/\//i.test(String(src || ''));
}

function isLikelyCorsRisk(src) {
  const value = String(src || '');

  return (
    value.includes('oaidalleapiprodscus.blob.core.windows.net') ||
    value.includes('oaidalleapiprod.blob.core.windows.net')
  );
}

async function convertRemoteImageToDataUrl(src) {
  if (!isRemoteUrl(src) || String(src).startsWith('data:image/')) {
    return src;
  }

  if (!isLikelyCorsRisk(src)) {
    return src;
  }

  const response = await base44.functions.invoke('imageToDataUrl', {
    imageUrl: src,
  });

  const data = response?.data || response;

  const dataUrl =
    data?.data_url ||
    data?.url ||
    data?.image_url;

  if (!dataUrl || typeof dataUrl !== 'string') {
    throw new Error('imageToDataUrl returned no canvas-safe data URL.');
  }

  return dataUrl;
}

async function loadImage(src) {
  const safeSrc = await convertRemoteImageToDataUrl(src);

  return new Promise((resolve, reject) => {
    const image = new Image();

    if (!String(safeSrc || '').startsWith('data:')) {
      image.crossOrigin = 'anonymous';
    }

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not load cover image for composition.'));
    image.src = safeSrc;
  });
}

function luma(r, g, b) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function saturation(r, g, b) {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;

  if (max === 0) return 0;

  return (max - min) / max;
}

function getZoneAnalysis(ctx, x, y, width, height) {
  const imageData = ctx.getImageData(x, y, width, height).data;
  let brightnessTotal = 0;
  let saturationTotal = 0;
  const brightnessValues = [];

  for (let i = 0; i < imageData.length; i += 4) {
    const r = imageData[i];
    const g = imageData[i + 1];
    const b = imageData[i + 2];
    const bright = luma(r, g, b);

    brightnessTotal += bright;
    saturationTotal += saturation(r, g, b);
    brightnessValues.push(bright);
  }

  const count = brightnessValues.length || 1;
  const brightness = brightnessTotal / count;
  const sat = saturationTotal / count;
  const variance =
    brightnessValues.reduce((sum, value) => sum + Math.pow(value - brightness, 2), 0) / count;
  const stdDev = Math.sqrt(variance);

  const calmness = clamp(100 - stdDev * 1.55, 0, 100);
  const contrastPotential = clamp(Math.abs(brightness - 128) * 0.55, 0, 45);
  const freeScore = clamp(calmness + contrastPotential - sat * 7, 0, 100);

  return {
    brightness,
    saturation: sat,
    stdDev,
    freeScore,
  };
}

function analyzeImage(img) {
  const sampleWidth = 96;
  const sampleHeight = 144;
  const canvas = createCanvas(sampleWidth, sampleHeight);
  const ctx = canvas.getContext('2d');

  ctx.drawImage(img, 0, 0, sampleWidth, sampleHeight);

  return {
    zones: {
      topStrip: getZoneAnalysis(ctx, 0, 0, sampleWidth, Math.round(sampleHeight * 0.10)),
      top: getZoneAnalysis(ctx, 0, Math.round(sampleHeight * 0.07), sampleWidth, Math.round(sampleHeight * 0.29)),
      middle: getZoneAnalysis(ctx, 0, Math.round(sampleHeight * 0.33), sampleWidth, Math.round(sampleHeight * 0.31)),
      lowerMiddle: getZoneAnalysis(ctx, 0, Math.round(sampleHeight * 0.56), sampleWidth, Math.round(sampleHeight * 0.20)),
      bottom: getZoneAnalysis(ctx, 0, Math.round(sampleHeight * 0.76), sampleWidth, Math.round(sampleHeight * 0.19)),
    },
  };
}

function measureTrackedText(ctx, text, tracking = 0) {
  const value = String(text || '');

  if (!tracking) {
    return ctx.measureText(value).width;
  }

  let width = 0;

  for (let i = 0; i < value.length; i += 1) {
    width += ctx.measureText(value[i]).width;
    if (i < value.length - 1) width += tracking;
  }

  return width;
}

function drawTrackedText(ctx, text, x, y, tracking = 0, stroke = false) {
  const value = String(text || '');

  if (!tracking) {
    if (stroke) ctx.strokeText(value, x, y);
    else ctx.fillText(value, x, y);
    return;
  }

  let cursor = x;

  for (let i = 0; i < value.length; i += 1) {
    const ch = value[i];

    if (stroke) ctx.strokeText(ch, cursor, y);
    else ctx.fillText(ch, cursor, y);

    cursor += ctx.measureText(ch).width + tracking;
  }
}

function wrapText(ctx, text, maxWidth, maxLines, tracking) {
  const words = String(text || '').split(/\s+/).filter(Boolean);

  if (!words.length) return [];

  const lines = [];
  let currentLine = words[0];

  for (let i = 1; i < words.length; i += 1) {
    const candidate = `${currentLine} ${words[i]}`;

    if (measureTrackedText(ctx, candidate, tracking) <= maxWidth) {
      currentLine = candidate;
    } else {
      lines.push(currentLine);
      currentLine = words[i];
    }
  }

  lines.push(currentLine);

  while (lines.length > maxLines) {
    const last = lines.pop();
    lines[lines.length - 1] = `${lines[lines.length - 1]} ${last}`;
  }

  return lines;
}

function fitTextBlock(ctx, block) {
  let fontSize = block.maxFontSize;

  while (fontSize >= block.minFontSize) {
    ctx.font = `${block.weight} ${fontSize}px ${block.fontFamily}`;

    const lines = wrapText(ctx, block.text, block.box.width, block.maxLines, block.tracking);
    const widths = lines.map((line) => measureTrackedText(ctx, line, block.tracking));
    const maxWidth = Math.max(...widths, 0);
    const lineHeight = Math.round(fontSize * block.lineHeight);
    const totalHeight = lines.length * lineHeight;

    if (maxWidth <= block.box.width && totalHeight <= block.box.height) {
      return {
        ...block,
        fontSize,
        lines,
        lineHeightPx: lineHeight,
        totalHeight,
      };
    }

    fontSize -= 2;
  }

  fontSize = block.minFontSize;
  ctx.font = `${block.weight} ${fontSize}px ${block.fontFamily}`;

  const lines = wrapText(ctx, block.text, block.box.width, block.maxLines, block.tracking);
  const lineHeight = Math.round(fontSize * block.lineHeight);

  return {
    ...block,
    fontSize,
    lines,
    lineHeightPx: lineHeight,
    totalHeight: lines.length * lineHeight,
  };
}

function drawTemplateOverlay(ctx, width, height, template) {
  const overlay = template?.overlay || 'dark-top-bottom';

  ctx.save();

  if (overlay === 'pulp-vignette') {
    const top = ctx.createLinearGradient(0, 0, 0, height * 0.32);
    top.addColorStop(0, 'rgba(0,0,0,0.55)');
    top.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = top;
    ctx.fillRect(0, 0, width, height * 0.34);

    const bottom = ctx.createLinearGradient(0, height * 0.65, 0, height);
    bottom.addColorStop(0, 'rgba(0,0,0,0)');
    bottom.addColorStop(1, 'rgba(0,0,0,0.54)');
    ctx.fillStyle = bottom;
    ctx.fillRect(0, height * 0.62, width, height * 0.38);
  } else if (overlay === 'noir-gradient') {
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, 'rgba(0,0,0,0.58)');
    gradient.addColorStop(0.22, 'rgba(0,0,0,0.05)');
    gradient.addColorStop(0.70, 'rgba(0,0,0,0.06)');
    gradient.addColorStop(1, 'rgba(0,0,0,0.62)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  } else if (overlay === 'vhs-darken') {
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, 'rgba(0,0,0,0.62)');
    gradient.addColorStop(0.28, 'rgba(0,0,0,0.08)');
    gradient.addColorStop(0.68, 'rgba(0,0,0,0.04)');
    gradient.addColorStop(1, 'rgba(0,0,0,0.68)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    ctx.globalAlpha = 0.10;
    ctx.fillStyle = '#ffffff';
    for (let y = 0; y < height; y += 7) {
      ctx.fillRect(0, y, width, 1);
    }
  } else if (overlay === 'thriller-contrast') {
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, 'rgba(0,0,0,0.65)');
    gradient.addColorStop(0.20, 'rgba(0,0,0,0.10)');
    gradient.addColorStop(0.75, 'rgba(0,0,0,0.04)');
    gradient.addColorStop(1, 'rgba(0,0,0,0.62)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  } else if (overlay === 'prestige-soft' || overlay === 'editorial-soft') {
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, 'rgba(0,0,0,0.44)');
    gradient.addColorStop(0.35, 'rgba(0,0,0,0.03)');
    gradient.addColorStop(0.72, 'rgba(0,0,0,0.03)');
    gradient.addColorStop(1, 'rgba(0,0,0,0.44)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  } else {
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, 'rgba(0,0,0,0.52)');
    gradient.addColorStop(0.30, 'rgba(0,0,0,0)');
    gradient.addColorStop(0.75, 'rgba(0,0,0,0)');
    gradient.addColorStop(1, 'rgba(0,0,0,0.52)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }

  const vignette = ctx.createRadialGradient(
    width / 2,
    height / 2,
    Math.min(width, height) * 0.25,
    width / 2,
    height / 2,
    Math.max(width, height) * 0.75
  );

  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.18)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);

  ctx.restore();
}

function drawSubtleGrain(ctx, width, height, opacity = 0.045) {
  const grainCanvas = createCanvas(width, height);
  const grainCtx = grainCanvas.getContext('2d');
  const imageData = grainCtx.createImageData(width, height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const value = Math.floor(Math.random() * 255);
    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
    data[i + 3] = Math.floor(255 * opacity);
  }

  grainCtx.putImageData(imageData, 0, 0);

  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.drawImage(grainCanvas, 0, 0);
  ctx.restore();
}

function drawTextBlock(ctx, block, helpers) {
  const fitted = fitTextBlock(ctx, block);

  if (!fitted.lines.length) return fitted;

  const fill = helpers.resolveInk(fitted.ink);
  const stroke = helpers.resolveStroke(fitted.stroke, fitted.fontSize);
  const shadow = helpers.resolveShadow(fitted.shadow, fitted.fontSize);

  ctx.save();
  ctx.font = `${fitted.weight} ${fitted.fontSize}px ${fitted.fontFamily}`;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.fillStyle = fill;
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;

  ctx.shadowColor = shadow.color;
  ctx.shadowBlur = shadow.blur;
  ctx.shadowOffsetX = shadow.offsetX;
  ctx.shadowOffsetY = shadow.offsetY;

  const startY = fitted.box.y + (fitted.box.height - fitted.totalHeight) / 2 + fitted.fontSize;

  fitted.lines.forEach((line, index) => {
    const lineWidth = measureTrackedText(ctx, line, fitted.tracking);

    let x = fitted.box.x;

    if (fitted.align === 'center') {
      x = fitted.box.x + (fitted.box.width - lineWidth) / 2;
    } else if (fitted.align === 'right') {
      x = fitted.box.x + fitted.box.width - lineWidth;
    }

    const y = startY + index * fitted.lineHeightPx;

    if (stroke.width > 0) {
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      drawTrackedText(ctx, line, x, y, fitted.tracking, true);
    }

    ctx.fillStyle = fill;
    drawTrackedText(ctx, line, x, y, fitted.tracking, false);
  });

  ctx.restore();

  return fitted;
}

export async function scoreArtCandidateForTypography({ imageUrl }) {
  const img = await loadImage(imageUrl);
  const analysis = analyzeImage(img);

  const top = analysis.zones.top.freeScore || 0;
  const middle = analysis.zones.middle.freeScore || 0;
  const bottom = analysis.zones.bottom.freeScore || 0;

  return top * 0.46 + middle * 0.18 + bottom * 0.36;
}

export async function composeCoverWithTypography({
  imageUrl,
  title,
  subtitle,
  authorName,
  seriesText,
  genre,
  visualStyle,
  templateId,
}) {
  await ensureCoverFontsLoaded();

  const img = await loadImage(imageUrl);
  const width = img.naturalWidth || img.width || 1024;
  const height = img.naturalHeight || img.height || 1792;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  ctx.drawImage(img, 0, 0, width, height);

  const plan = buildTypographyPlan({
    width,
    height,
    genre,
    visualStyle,
    title,
    subtitle,
    authorName,
    seriesText,
    templateId,
  });

  drawTemplateOverlay(ctx, width, height, plan.template);

  if (plan.template?.grain) {
    drawSubtleGrain(ctx, width, height, 0.035);
  }

  plan.blocks.forEach((block) => drawTextBlock(ctx, block, plan));

  return {
    dataUrl: canvas.toDataURL('image/png', 1.0),
    layout: {
      titleZone: plan.titleZone,
      authorZone: plan.authorZone,
      blockCount: plan.blocks.length,
      templateId: plan.template.id,
      templateLabel: plan.template.label,
    },
  };
}