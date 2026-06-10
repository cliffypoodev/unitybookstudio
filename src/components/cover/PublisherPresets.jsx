import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export const PUBLISHER_PRESETS = {
  kdp_6x9: {
    name: 'Amazon KDP (6" × 9")',
    trimWidth: 6, trimHeight: 9,
    bleed: 0.125, safeZone: 0.25,
    spineFormula: 'white', unit: 'inches', dpi: 300,
    notes: 'Most common KDP paperback size',
  },
  kdp_5x8: {
    name: 'Amazon KDP (5" × 8")',
    trimWidth: 5, trimHeight: 8,
    bleed: 0.125, safeZone: 0.25,
    spineFormula: 'white', unit: 'inches', dpi: 300,
    notes: 'Compact paperback',
  },
  kdp_55x85: {
    name: 'Amazon KDP (5.5" × 8.5")',
    trimWidth: 5.5, trimHeight: 8.5,
    bleed: 0.125, safeZone: 0.25,
    spineFormula: 'white', unit: 'inches', dpi: 300,
    notes: 'Standard trade paperback',
  },
  kdp_ebook: {
    name: 'Amazon Kindle Ebook',
    trimWidth: 1600, trimHeight: 2560,
    bleed: 0, safeZone: 0,
    spineFormula: null, unit: 'pixels', dpi: 72,
    notes: '1600×2560px recommended. Min 625×1000px.',
  },
  ingram_6x9: {
    name: 'IngramSpark (6" × 9")',
    trimWidth: 6, trimHeight: 9,
    bleed: 0.125, safeZone: 0.25,
    spineFormula: 'ingram_white', unit: 'inches', dpi: 300,
    notes: 'Standard IngramSpark paperback',
  },
  ingram_55x85: {
    name: 'IngramSpark (5.5" × 8.5")',
    trimWidth: 5.5, trimHeight: 8.5,
    bleed: 0.125, safeZone: 0.25,
    spineFormula: 'ingram_white', unit: 'inches', dpi: 300,
    notes: 'Standard IngramSpark trade',
  },
  lulu_6x9: {
    name: 'Lulu (6" × 9")',
    trimWidth: 6, trimHeight: 9,
    bleed: 0.125, safeZone: 0.25,
    spineFormula: 'white', unit: 'inches', dpi: 300,
    notes: 'Standard Lulu paperback',
  },
};

export default function PublisherPresets({ selectedPreset, onSelectPreset }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium">Publisher Preset</label>
      <Select value={selectedPreset || ''} onValueChange={onSelectPreset}>
        <SelectTrigger className="text-xs">
          <SelectValue placeholder="Custom dimensions" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="custom">Custom dimensions</SelectItem>
          {Object.entries(PUBLISHER_PRESETS).map(([key, preset]) => (
            <SelectItem key={key} value={key}>{preset.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selectedPreset && selectedPreset !== 'custom' && PUBLISHER_PRESETS[selectedPreset] && (
        <p className="text-[10px] text-muted-foreground">
          {PUBLISHER_PRESETS[selectedPreset].notes}
        </p>
      )}
    </div>
  );
}