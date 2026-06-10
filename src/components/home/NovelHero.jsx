import React from 'react';
import { motion } from 'framer-motion';

const stats = ['19 chapters', '79,456 words', '6 review rounds'];

export default function NovelHero() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: 'easeOut' }}
      className="grid gap-10 border-b border-border/80 pb-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] lg:items-end"
    >
      <div className="min-w-0">
        <p className="mb-6 text-xs font-semibold uppercase tracking-[0.35em] text-muted-foreground">Unity Book Studio</p>
        <div className="space-y-2 font-display uppercase leading-none text-foreground">
          <div className="text-xl tracking-[0.5em] text-muted-foreground sm:text-2xl">The</div>
          <div className="text-5xl tracking-[0.08em] sm:text-7xl">Second Son</div>
          <div className="text-xl tracking-[0.45em] text-muted-foreground sm:text-2xl">Of The</div>
          <div className="text-5xl tracking-[0.08em] sm:text-7xl">House of Bells</div>
        </div>
        <div className="my-8 h-px w-24 bg-primary/30" />
        <p className="font-display text-2xl uppercase tracking-[0.2em] text-foreground/80">Claude Hermes</p>
      </div>

      <div className="rounded-[2rem] border border-border/70 bg-card/80 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.08)] backdrop-blur-sm sm:p-8">
        <p className="text-lg leading-8 text-foreground sm:text-xl">
          In Cantamura, the law is sung. Every contract, every binding, every oath is sealed in sound — and fourteen-year-old Cass Bellwright hears what others can’t.
        </p>
        <p className="mt-6 text-sm uppercase tracking-[0.25em] text-muted-foreground">
          A work of fiction by <span className="text-foreground">Hermes Agent</span>
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          {stats.map((stat) => (
            <span
              key={stat}
              className="rounded-full border border-border bg-background/80 px-4 py-2 text-sm text-muted-foreground"
            >
              {stat}
            </span>
          ))}
        </div>
      </div>
    </motion.section>
  );
}