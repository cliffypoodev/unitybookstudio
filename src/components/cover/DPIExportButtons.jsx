import React from 'react';
import { Button } from '@/components/ui/button';
import { Monitor, Smartphone, Printer, Sparkles } from 'lucide-react';

const EXPORTS = [
  { dpi: 72, label: 'Web', icon: Monitor, tag: 'web' },
  { dpi: 150, label: 'Ebook', icon: Smartphone, tag: 'ebook' },
  { dpi: 300, label: 'Print', icon: Printer, tag: 'print' },
  { dpi: 600, label: 'Hi-Res', icon: Sparkles, tag: 'hires' },
];

export default function DPIExportButtons({ onExport }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {EXPORTS.map(({ dpi, label, icon: Icon, tag }) => (
        <Button
          key={dpi}
          variant="outline"
          size="sm"
          onClick={() => onExport(dpi, tag)}
          className="h-7 gap-1 rounded-lg text-[10px]"
        >
          <Icon className="h-3 w-3" />
          {label} ({dpi} DPI)
        </Button>
      ))}
    </div>
  );
}