import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { COVER_FONTS } from '@/lib/kdpCover';

const ALL_FONTS = [
  ...COVER_FONTS,
  'Lora', 'Merriweather', 'Libre Baskerville',
  'Cinzel', 'Oswald', 'Montserrat', 'Raleway', 'Bebas Neue',
  'Palatino', 'Garamond', 'Helvetica', 'Futura', 'Gill Sans',
];

export default function PropertyPanel({ activeObject, onUpdate }) {
  if (!activeObject) {
    return (
      <div className="flex h-32 items-center justify-center text-xs text-muted-foreground">
        Select an object to edit
      </div>
    );
  }

  const isText = activeObject.type === 'textbox' || activeObject.type === 'i-text';
  const isShape = activeObject.type === 'rect' || activeObject.type === 'circle';

  return (
    <div className="space-y-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Properties</p>

      {/* Position */}
      <div className="space-y-2">
        <Label className="text-[10px]">Position</Label>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="text-[9px] text-muted-foreground">X</span>
            <Input
              type="number"
              value={Math.round(activeObject.left || 0)}
              onChange={(e) => onUpdate('left', Number(e.target.value))}
              className="h-7 text-xs"
            />
          </div>
          <div>
            <span className="text-[9px] text-muted-foreground">Y</span>
            <Input
              type="number"
              value={Math.round(activeObject.top || 0)}
              onChange={(e) => onUpdate('top', Number(e.target.value))}
              className="h-7 text-xs"
            />
          </div>
        </div>
      </div>

      {/* Rotation */}
      <div className="space-y-1">
        <Label className="text-[10px]">Rotation: {Math.round(activeObject.angle || 0)}°</Label>
        <Slider
          value={[activeObject.angle || 0]}
          onValueChange={([v]) => onUpdate('angle', v)}
          min={0}
          max={360}
          step={1}
        />
      </div>

      {/* Opacity */}
      <div className="space-y-1">
        <Label className="text-[10px]">Opacity: {Math.round((activeObject.opacity ?? 1) * 100)}%</Label>
        <Slider
          value={[(activeObject.opacity ?? 1) * 100]}
          onValueChange={([v]) => onUpdate('opacity', v / 100)}
          min={0}
          max={100}
          step={1}
        />
      </div>

      {/* Fill color */}
      {(isText || isShape) && (
        <div className="space-y-1">
          <Label className="text-[10px]">Fill Color</Label>
          <input
            type="color"
            value={rgbaToHex(activeObject.fill || '#ffffff')}
            onChange={(e) => onUpdate('fill', e.target.value)}
            className="h-7 w-full cursor-pointer rounded border border-border"
          />
        </div>
      )}

      {/* Text-specific properties */}
      {isText && (
        <>
          <div className="space-y-1">
            <Label className="text-[10px]">Font Family</Label>
            <Select value={activeObject.fontFamily || 'Cormorant Garamond'} onValueChange={(v) => onUpdate('fontFamily', v)}>
              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ALL_FONTS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-[10px]">Font Size</Label>
            <Input
              type="number"
              value={activeObject.fontSize || 48}
              onChange={(e) => onUpdate('fontSize', Number(e.target.value))}
              className="h-7 text-xs"
              min={8}
              max={300}
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[10px]">Font Weight</Label>
            <Select value={String(activeObject.fontWeight || '400')} onValueChange={(v) => onUpdate('fontWeight', v)}>
              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">Regular</SelectItem>
                <SelectItem value="500">Medium</SelectItem>
                <SelectItem value="600">Semibold</SelectItem>
                <SelectItem value="bold">Bold</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-[10px]">Font Style</Label>
            <Select value={activeObject.fontStyle || 'normal'} onValueChange={(v) => onUpdate('fontStyle', v)}>
              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="italic">Italic</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-[10px]">Letter Spacing</Label>
            <Input
              type="number"
              value={activeObject.charSpacing || 0}
              onChange={(e) => onUpdate('charSpacing', Number(e.target.value))}
              className="h-7 text-xs"
              min={-200}
              max={1000}
              step={10}
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[10px]">Text Align</Label>
            <Select value={activeObject.textAlign || 'center'} onValueChange={(v) => onUpdate('textAlign', v)}>
              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="left">Left</SelectItem>
                <SelectItem value="center">Center</SelectItem>
                <SelectItem value="right">Right</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-[10px]">Line Height</Label>
            <Slider
              value={[(activeObject.lineHeight || 1.2) * 100]}
              onValueChange={([v]) => onUpdate('lineHeight', v / 100)}
              min={80}
              max={200}
              step={5}
            />
          </div>
        </>
      )}
    </div>
  );
}

function rgbaToHex(color) {
  if (!color) return '#ffffff';
  if (color.startsWith('#')) return color.length > 7 ? color.slice(0, 7) : color;
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (match) {
    return '#' + [match[1], match[2], match[3]].map((v) => Number(v).toString(16).padStart(2, '0')).join('');
  }
  return '#ffffff';
}