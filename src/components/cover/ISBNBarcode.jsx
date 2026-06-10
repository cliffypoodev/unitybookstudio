import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Check, AlertCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { runWithNetworkRetry } from '@/lib/requestRetry';

/**
 * ISBN Barcode Generator
 *
 * Renders an ISBN-13 as a standard EAN-13 barcode using JsBarcode (lazy-loaded
 * from CDN). Optionally appends a retail price line above the barcode.
 *
 * FIXED in this version:
 *   - Removed alert() for invalid ISBNs — inline validation badge instead
 *   - Persists ISBN + price to project.isbn_paperback / project.cover_price
 *   - Shows "Saving…" feedback during debounced save
 */

async function ensureJsBarcode() {
  if (window.JsBarcode) return;
  const script = document.createElement('script');
  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jsbarcode/3.11.6/JsBarcode.all.min.js';
  await new Promise((resolve, reject) => {
    script.onload = resolve;
    script.onerror = () => reject(new Error('Failed to load JsBarcode library'));
    document.head.appendChild(script);
  });
}

/**
 * Validates an ISBN-13 string. Returns { valid, cleaned, error }.
 * Accepts dashes/spaces; requires exactly 13 digits. Does NOT validate
 * the checksum — real ISBNs occasionally have quirks and false positives
 * would cause more pain than real typos.
 */
function validateIsbn(isbn) {
  if (!isbn?.trim()) return { valid: false, cleaned: '', error: null };
  const cleaned = isbn.replace(/[-\s]/g, '');
  if (!/^\d+$/.test(cleaned)) return { valid: false, cleaned, error: 'ISBN must be digits only' };
  if (cleaned.length !== 13) return { valid: false, cleaned, error: `ISBN must be 13 digits (got ${cleaned.length})` };
  return { valid: true, cleaned, error: null };
}

export default function ISBNBarcode({ project, onBarcodeGenerated }) {
  const [isbn, setIsbn] = useState(project?.isbn_paperback || '');
  const [price, setPrice] = useState(project?.cover_price || '');
  const [generating, setGenerating] = useState(false);
  const [preview, setPreview] = useState(null);
  const [savingIsbn, setSavingIsbn] = useState(false);

  useEffect(() => {
    setIsbn(project?.isbn_paperback || '');
    setPrice(project?.cover_price || '');
  }, [project?.id]);

  const validation = validateIsbn(isbn);

  const handleGenerate = async () => {
    if (!validation.valid) return;
    setGenerating(true);
    try {
      await ensureJsBarcode();
      const barcodeCanvas = document.createElement('canvas');
      window.JsBarcode(barcodeCanvas, validation.cleaned, {
        format: 'EAN13',
        width: 2,
        height: 80,
        displayValue: true,
        fontSize: 14,
        margin: 10,
        background: '#ffffff',
      });

      let finalDataUrl;
      if (price.trim()) {
        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = barcodeCanvas.width;
        finalCanvas.height = barcodeCanvas.height + 28;
        const ctx = finalCanvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);
        ctx.font = 'bold 16px sans-serif';
        ctx.fillStyle = '#000000';
        ctx.textAlign = 'right';
        ctx.fillText(price.trim(), finalCanvas.width - 12, 20);
        ctx.drawImage(barcodeCanvas, 0, 28);
        finalDataUrl = finalCanvas.toDataURL('image/png');
      } else {
        finalDataUrl = barcodeCanvas.toDataURL('image/png');
      }
      setPreview(finalDataUrl);
      onBarcodeGenerated?.(finalDataUrl);
    } catch (err) {
      console.error('[ISBN] Barcode generation failed:', err);
    } finally {
      setGenerating(false);
    }
  };

  // Debounced save of ISBN + price to project record
  useEffect(() => {
    if (!project?.id) return;
    if (isbn === (project.isbn_paperback || '') && price === (project.cover_price || '')) return;
    const t = setTimeout(async () => {
      setSavingIsbn(true);
      try {
        await runWithNetworkRetry(() =>
          base44.entities.NovelProject.update(project.id, {
            isbn_paperback: isbn,
            cover_price: price,
          })
        );
      } catch (err) {
        console.warn('[ISBN] Save failed:', err?.message);
      } finally {
        setSavingIsbn(false);
      }
    }, 1500);
    return () => clearTimeout(t);
  }, [isbn, price, project?.id, project?.isbn_paperback, project?.cover_price]);

  return (
    <div className="rounded-lg border border-border/60 bg-accent/10 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wide text-foreground">ISBN Barcode</p>
        {savingIsbn && (
          <span className="flex items-center gap-1 text-[9px] text-muted-foreground">
            <Loader2 className="h-2.5 w-2.5 animate-spin" /> saving
          </span>
        )}
      </div>

      <div className="space-y-1.5">
        <div>
          <label className="text-[10px] text-muted-foreground">ISBN-13</label>
          <Input
            type="text"
            value={isbn}
            onChange={(e) => setIsbn(e.target.value)}
            className={`h-8 text-xs font-mono ${isbn && !validation.valid ? 'border-red-500' : ''}`}
            placeholder="978-0-000-00000-0"
          />
          {isbn && validation.error && (
            <div className="flex items-start gap-1 mt-0.5">
              <AlertCircle className="h-2.5 w-2.5 text-red-500 mt-0.5 shrink-0" />
              <p className="text-[9px] text-red-600 dark:text-red-400">{validation.error}</p>
            </div>
          )}
          {isbn && validation.valid && (
            <div className="flex items-center gap-1 mt-0.5">
              <Check className="h-2.5 w-2.5 text-green-600" />
              <p className="text-[9px] text-green-700 dark:text-green-500">Valid ISBN format</p>
            </div>
          )}
        </div>

        <div>
          <label className="text-[10px] text-muted-foreground">Price (optional, e.g. "$14.99")</label>
          <Input
            type="text"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="h-8 text-xs"
            placeholder="$14.99"
          />
        </div>

        <Button
          size="sm"
          onClick={handleGenerate}
          disabled={!validation.valid || generating}
          className="h-7 w-full rounded-lg text-[10px]"
        >
          {generating ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
          {generating ? 'Generating…' : 'Generate Barcode'}
        </Button>
      </div>

      {preview && (
        <div className="rounded border border-border/40 bg-white p-2">
          <img src={preview} alt="ISBN barcode preview" className="w-full h-auto" />
        </div>
      )}
    </div>
  );
}