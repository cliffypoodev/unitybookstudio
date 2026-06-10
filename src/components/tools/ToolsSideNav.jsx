import React from 'react';
import {
  Lightbulb,
  ShieldCheck,
  PenLine,
  Search,
  Shuffle,
  GitCompare,
  Rocket,
  BarChart3,
  Library,
  ChevronDown,
} from 'lucide-react';

const ITEMS = [
  {
    id: 'ideas',
    label: 'Ideas',
    mobileLabel: 'Ideas',
    icon: Lightbulb,
    description: 'Generate, save, and develop story concepts',
  },
  {
    id: 'proofread',
    label: 'AI Check',
    mobileLabel: 'AI Check',
    icon: ShieldCheck,
    description: 'Detect AI-like prose patterns and mechanical issues',
  },
  {
    id: 'critic',
    label: 'Critic',
    mobileLabel: 'Critic',
    icon: PenLine,
    description: 'Get editorial critique, scores, and improvement notes',
  },
  {
    id: 'research',
    label: 'Research',
    mobileLabel: 'Research',
    icon: Search,
    description: 'Build references, source notes, and research support',
  },
  {
    id: 'transform',
    label: 'Transform',
    mobileLabel: 'Transform',
    icon: Shuffle,
    description: 'Rewrite, adapt, reshape, or convert text',
  },
  {
    id: 'compare',
    label: 'Compare',
    mobileLabel: 'Compare',
    icon: GitCompare,
    description: 'Compare drafts, versions, or story directions',
  },
  {
    id: 'publishing',
    label: 'Publishing',
    mobileLabel: 'Publishing',
    icon: Rocket,
    description: 'Titles, blurbs, metadata, pen names, and launch prep',
  },
  {
    id: 'analytics',
    label: 'Analytics',
    mobileLabel: 'Analytics',
    icon: BarChart3,
    description: 'Study structure, pacing, word counts, and project data',
  },
  {
    id: 'anthology',
    label: 'Anthology',
    mobileLabel: 'Anthology',
    icon: Library,
    description: 'Anthology-specific polish and collection analysis',
    anthologyOnly: true,
  },
];

export default function ToolsSideNav({ activeTool, onSelect, isAnthology }) {
  const visibleItems = ITEMS.filter((item) => !item.anthologyOnly || isAnthology);
  const activeItem = visibleItems.find((item) => item.id === activeTool) || visibleItems[0];
  const ActiveIcon = activeItem?.icon || Lightbulb;

  return (
    <div className="w-full">
      <div className="border-b border-border/45 pb-2">
        {/* Mobile dropdown */}
        <div className="relative block sm:hidden">
          <div className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-[#8B4513]">
            <ActiveIcon className="h-4 w-4" />
          </div>

          <select
            value={activeTool}
            onChange={(event) => onSelect(event.target.value)}
            className="h-11 w-full appearance-none rounded-2xl border border-border/65 bg-card/85 pl-10 pr-10 text-sm font-bold text-foreground shadow-sm outline-none transition focus:border-[#8B4513]/70 focus:ring-2 focus:ring-[#8B4513]/15"
          >
            {visibleItems.map((item) => (
              <option key={item.id} value={item.id}>
                {item.mobileLabel}
              </option>
            ))}
          </select>

          <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            <ChevronDown className="h-4 w-4" />
          </div>

          {activeItem?.description && (
            <p className="mt-1.5 px-1 text-[10px] leading-4 text-muted-foreground">
              {activeItem.description}
            </p>
          )}
        </div>

        {/* Tablet / desktop toolbar */}
        <div className="hidden flex-wrap items-center gap-1.5 sm:flex">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const active = activeTool === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item.id)}
                title={`${item.label} — ${item.description}`}
                aria-pressed={active}
                className={`group relative flex h-8 min-w-0 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-semibold leading-none transition-all duration-150 ${
                  active
                    ? 'border-[#8B4513]/75 bg-[#8B4513] text-white shadow-sm'
                    : 'border-transparent bg-background/35 text-muted-foreground hover:border-border/60 hover:bg-secondary/55 hover:text-foreground'
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="whitespace-nowrap">{item.label}</span>

                <span className="pointer-events-none absolute left-1/2 top-[36px] z-50 hidden w-[220px] -translate-x-1/2 rounded-2xl border border-border/70 bg-popover px-3 py-2 text-left shadow-xl group-hover:block">
                  <span className="block text-xs font-bold text-foreground">{item.label}</span>
                  <span className="mt-0.5 block text-[10px] font-normal leading-4 text-muted-foreground">
                    {item.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}