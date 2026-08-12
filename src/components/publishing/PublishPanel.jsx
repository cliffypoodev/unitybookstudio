/* ============================================================================
 * ⚠️  DEAD CODE — DO NOT EDIT EXPECTING UI CHANGES  (WAVE5-DEADSTAMP, Aug 2026)
 *
 * Nothing imports this file. Editing it has NO effect on the running app —
 * past AI sessions repeatedly wasted hours "fixing" components like this one.
 * Live implementation: the live publish flow is inside ExportTab.
 * Kept (not deleted) at the owner's request; recoverable context only.
 * ========================================================================== */
import React from 'react';
import { Copy, Download, FileText, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BOOK_THEME_PRESETS } from '@/lib/theme-presets';

function Group({ title, children, defaultOpen = false }) {
  return (
    <details className="rounded-xl border border-border/70 bg-background/70 p-3" open={defaultOpen}>
      <summary className="cursor-pointer text-xs font-semibold uppercase tracking-widest text-muted-foreground">{title}</summary>
      <div className="mt-3 space-y-3">{children}</div>
    </details>
  );
}

function SmallSelect({ value, onValueChange, children, ...props }) {
  return (
    <Select value={value} onValueChange={onValueChange} {...props}>
      <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
      <SelectContent>{children}</SelectContent>
    </Select>
  );
}

function SmallInput({ ...props }) {
  return <Input {...props} className={`h-7 text-xs ${props.className || ''}`} />;
}

export default function PublishPanel({ theme, onThemeFieldChange, onPresetChange, onExport, onCopyAll, exportDisabled }) {
  return (
    <div className="w-56 shrink-0 space-y-3 overflow-y-auto rounded-2xl border border-border/70 bg-card/80 p-3 backdrop-blur-sm lg:w-64">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">Publishing</p>
        <h3 className="mt-1 font-display text-xl text-foreground">Theme & export</h3>
      </div>

      <Group title="Theme preset" defaultOpen>
        <Select value={theme.id} onValueChange={onPresetChange}>
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select preset" /></SelectTrigger>
          <SelectContent>
            {Object.values(BOOK_THEME_PRESETS).map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">{theme.trimSize} — {theme.bodyFont} {theme.bodySize}pt</p>
      </Group>

      <Group title="Page layout">
        <div className="space-y-2">
          <Label className="text-xs">Trim size</Label>
          <SmallSelect value={theme.trimSize} onValueChange={(v) => onThemeFieldChange('trimSize', v)}>
            {['5x8', '5.25x8', '5.5x8.5', '6x9', '7x10', '8x10', '8.5x11'].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SmallSelect>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {['top', 'bottom', 'inside', 'outside'].map((side) => (
            <div key={side} className="space-y-1">
              <Label className="text-[10px] capitalize">{side}</Label>
              <SmallInput type="number" step="0.05" min="0.3" max="1.5" value={theme.margins[side]} onChange={(e) => onThemeFieldChange(`margins.${side}`, Number(e.target.value))} />
            </div>
          ))}
        </div>
      </Group>

      <Group title="Typography">
        <div className="space-y-2">
          <div className="space-y-1">
            <Label className="text-xs">Body font</Label>
            <SmallInput value={theme.bodyFont} onChange={(e) => onThemeFieldChange('bodyFont', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Heading font</Label>
            <SmallInput value={theme.headingFont} onChange={(e) => onThemeFieldChange('headingFont', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px]">Size (pt)</Label>
              <SmallInput type="number" min="9" max="16" step="0.5" value={theme.bodySize} onChange={(e) => onThemeFieldChange('bodySize', Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">Line height</Label>
              <SmallInput type="number" min="1.0" max="2.5" step="0.05" value={theme.lineHeight} onChange={(e) => onThemeFieldChange('lineHeight', Number(e.target.value))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px]">Alignment</Label>
              <SmallSelect value={theme.textAlign || 'justify'} onValueChange={(v) => onThemeFieldChange('textAlign', v)}>
                <SelectItem value="justify">Justify</SelectItem>
                <SelectItem value="left">Left</SelectItem>
              </SmallSelect>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">Hyphens</Label>
              <SmallSelect value={theme.hyphens !== false ? 'on' : 'off'} onValueChange={(v) => onThemeFieldChange('hyphens', v === 'on')}>
                <SelectItem value="on">On</SelectItem>
                <SelectItem value="off">Off</SelectItem>
              </SmallSelect>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px]">Orphans</Label>
              <SmallInput type="number" min="1" max="5" value={theme.orphans || 2} onChange={(e) => onThemeFieldChange('orphans', Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">Widows</Label>
              <SmallInput type="number" min="1" max="5" value={theme.widows || 2} onChange={(e) => onThemeFieldChange('widows', Number(e.target.value))} />
            </div>
          </div>
        </div>
      </Group>

      <Group title="Paragraphs & scenes">
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px]">Style</Label>
              <SmallSelect value={theme.paragraphStyle} onValueChange={(v) => onThemeFieldChange('paragraphStyle', v)}>
                <SelectItem value="indented">Indented</SelectItem>
                <SelectItem value="block">Block</SelectItem>
              </SmallSelect>
            </div>
            {theme.paragraphStyle === 'indented' && (
              <div className="space-y-1">
                <Label className="text-[10px]">Indent (in)</Label>
                <SmallInput type="number" min="0.1" max="0.6" step="0.02" value={theme.indentSize || 0.22} onChange={(e) => onThemeFieldChange('indentSize', Number(e.target.value))} />
              </div>
            )}
          </div>
          <div className="space-y-1">
            <Label className="text-[10px]">Scene break glyph</Label>
            <SmallInput value={theme.sceneBreak} onChange={(e) => onThemeFieldChange('sceneBreak', e.target.value)} />
          </div>
        </div>
      </Group>

      <Group title="First line decorations">
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px]">Drop cap</Label>
              <SmallSelect value={theme.dropCapEnabled ? 'on' : 'off'} onValueChange={(v) => onThemeFieldChange('dropCapEnabled', v === 'on')}>
                <SelectItem value="on">On</SelectItem>
                <SelectItem value="off">Off</SelectItem>
              </SmallSelect>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">Lead-in</Label>
              <SmallSelect value={theme.leadInStyle || 'none'} onValueChange={(v) => onThemeFieldChange('leadInStyle', v)}>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="smallcaps">Small caps</SelectItem>
                <SelectItem value="italics">Italics</SelectItem>
              </SmallSelect>
            </div>
          </div>
          {theme.dropCapEnabled && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[10px]">Lines</Label>
                <SmallInput type="number" min="2" max="5" value={theme.dropCapLines || 3} onChange={(e) => onThemeFieldChange('dropCapLines', Number(e.target.value))} />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">Font</Label>
                <SmallInput value={theme.dropCapFont || theme.headingFont} onChange={(e) => onThemeFieldChange('dropCapFont', e.target.value)} />
              </div>
            </div>
          )}
        </div>
      </Group>

      <Group title="Headers">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-[10px]">Recto</Label>
            <SmallSelect value={theme.rectoHeader} onValueChange={(v) => onThemeFieldChange('rectoHeader', v)}>
              <SelectItem value="bookTitle">Book title</SelectItem>
              <SelectItem value="authorName">Author</SelectItem>
              <SelectItem value="chapterTitle">Chapter</SelectItem>
            </SmallSelect>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px]">Verso</Label>
            <SmallSelect value={theme.versoHeader} onValueChange={(v) => onThemeFieldChange('versoHeader', v)}>
              <SelectItem value="chapterTitle">Chapter</SelectItem>
              <SelectItem value="bookTitle">Book title</SelectItem>
              <SelectItem value="authorName">Author</SelectItem>
            </SmallSelect>
          </div>
        </div>
        <label className="flex items-center gap-2 text-xs text-foreground">
          <input type="checkbox" checked={!!theme.suppressFirstPageHeader} onChange={(e) => onThemeFieldChange('suppressFirstPageHeader', e.target.checked)} className="h-3.5 w-3.5" />
          Suppress header on first page
        </label>
      </Group>

      <Group title="Book sections">
        <div className="space-y-1.5">
          {['halfTitle', 'titlePage', 'copyright', 'dedication', 'epigraph', 'toc', 'aboutAuthor'].map((key) => (
            <label key={key} className="flex items-center gap-2 text-xs text-foreground">
              <input type="checkbox" checked={!!theme.sections[key]} onChange={(e) => onThemeFieldChange(`sections.${key}`, e.target.checked)} className="h-3.5 w-3.5" />
              {key.replace(/([A-Z])/g, ' $1').trim()}
            </label>
          ))}
        </div>
      </Group>

      <div className="space-y-1.5 pt-2">
        <Button onClick={() => onExport('print')} disabled={exportDisabled} size="sm" className="w-full justify-start rounded-full text-xs"><Printer className="mr-1.5 h-3.5 w-3.5" /> Print / PDF</Button>
        <Button onClick={() => onExport('docx')} disabled={exportDisabled} size="sm" variant="outline" className="w-full justify-start rounded-full text-xs"><Download className="mr-1.5 h-3.5 w-3.5" /> DOCX</Button>
        <Button onClick={() => onExport('markdown')} disabled={exportDisabled} size="sm" variant="outline" className="w-full justify-start rounded-full text-xs"><FileText className="mr-1.5 h-3.5 w-3.5" /> Markdown</Button>
        <Button onClick={onCopyAll} disabled={exportDisabled} size="sm" variant="outline" className="w-full justify-start rounded-full text-xs"><Copy className="mr-1.5 h-3.5 w-3.5" /> Copy All</Button>
      </div>
    </div>
  );
}