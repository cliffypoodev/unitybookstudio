import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const PAPER_OPTIONS = [
  { value: 'white', label: 'White (KDP)' },
  { value: 'cream', label: 'Cream (KDP)' },
  { value: 'color', label: 'Color (KDP)' },
  { value: 'ingram_white', label: 'White (IngramSpark)' },
  { value: 'ingram_cream', label: 'Cream (IngramSpark)' },
];

const MULTIPLIERS = {
  white: 0.002252,
  cream: 0.0025,
  color: 0.0032,
  ingram_white: 0.002,
  ingram_cream: 0.0025,
};

function calculateSpineWidth(pageCount, paperType) {
  if (!pageCount || pageCount < 1) return 0;
  const mult = MULTIPLIERS[paperType] || 0.002252;
  return Math.round(pageCount * mult * 1000) / 1000;
}

export default function SpineCalculator({ pageCount: initialPages, paperType: initialPaper, onApply }) {
  const [pages, setPages] = useState(initialPages || 250);
  const [paper, setPaper] = useState(initialPaper || 'white');

  const spineWidth = calculateSpineWidth(pages, paper);
  const spineMM = (spineWidth * 25.4).toFixed(1);

  return (
    <div className="rounded-lg border border-border/60 bg-accent/20 p-3 space-y-2">
      <p className="text-xs font-bold uppercase tracking-wide text-[#8B4513]">
        Spine Width Calculator
      </p>
      <div className="flex items-end gap-2 flex-wrap">
        <div className="space-y-0.5">
          <label className="text-[10px] text-muted-foreground">Page Count</label>
          <Input
            type="number"
            value={pages}
            onChange={(e) => setPages(parseInt(e.target.value) || 0)}
            className="h-8 w-20 text-xs"
            placeholder="250"
          />
        </div>
        <div className="space-y-0.5">
          <label className="text-[10px] text-muted-foreground">Paper</label>
          <Select value={paper} onValueChange={setPaper}>
            <SelectTrigger className="h-8 w-[150px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAPER_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-0.5">
          <label className="text-[10px] text-muted-foreground">Spine Width</label>
          <div className="h-8 flex items-center px-2.5 rounded-md border border-[#8B4513] bg-white text-xs font-bold text-[#8B4513]">
            {spineWidth}" ({spineMM}mm)
          </div>
        </div>
        <Button
          size="sm"
          onClick={() => onApply?.(pages, paper)}
          className="h-8 rounded-lg text-[10px] bg-[#8B4513] hover:bg-[#6d340f]"
        >
          Apply to Canvas
        </Button>
      </div>
    </div>
  );
}