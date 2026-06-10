import React from 'react';
import { Trash2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function CoverArtGalleryGrid({ items, selectedArtUrl, onSelect, onDelete }) {
  if (!items.length) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        Saved Gallery
      </p>
      <div className="grid grid-cols-3 gap-2">
        {items.map((item) => (
          <div key={item.id} className="group relative overflow-hidden rounded-xl border border-border/70">
            <img
              src={item.image_url}
              alt="Cover variant"
              className="aspect-[2/3] w-full cursor-pointer object-cover"
              onClick={() => onSelect(item.image_url)}
            />
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/70 to-transparent p-2">
              <Button
                size="sm"
                onClick={() => onSelect(item.image_url)}
                variant={selectedArtUrl === item.image_url ? 'default' : 'secondary'}
                className="h-6 rounded-full px-2 text-[10px]"
              >
                {selectedArtUrl === item.image_url ? (
                  <><Check className="mr-0.5 h-2.5 w-2.5" /> Selected</>
                ) : (
                  'Use'
                )}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onDelete(item.id)}
                className="h-6 w-6 rounded-full p-0 text-white/70 hover:bg-red-500/30 hover:text-red-300"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
            {item.prompt_summary && (
              <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/50 to-transparent p-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                <p className="truncate text-[9px] text-white/80">{item.prompt_summary}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}