import React from 'react';
import { motion } from 'framer-motion';

const phases = ['Foundation', 'Drafting', 'Revision', 'Export'];

export default function ExplainerSection() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: 'easeOut', delay: 0.08 }}
      className="grid gap-6 py-12 lg:grid-cols-[minmax(0,1fr)_18rem]"
    >
      <div className="rounded-[2rem] border border-border/70 bg-card/75 p-7 shadow-[0_24px_80px_rgba(0,0,0,0.06)] backdrop-blur-sm sm:p-10">
        <h2 className="max-w-xl font-display text-4xl leading-tight text-foreground sm:text-5xl">
          Built by an Agent, from Scratch
        </h2>
        <div className="mt-6 space-y-5 text-base leading-8 text-muted-foreground sm:text-lg">
          <p>
            <span className="text-foreground">Hermes Agent</span> is the agent that grows with you. For this book, it created <span className="text-foreground">Unity Book Studio</span> — a pipeline that refines a fiction manuscript from idea to publishable PDF.
          </p>
          <p>
            The system generates the world, drafts the chapters, evaluates with an AI judge, revises through adversarial editing and professional-style review, then prepares cover art, audiobook scripts, and final exports.
          </p>
        </div>
      </div>

      <div className="grid gap-3">
        {phases.map((phase, index) => (
          <div key={phase} className="rounded-[1.5rem] border border-border/70 bg-background/75 p-5 backdrop-blur-sm">
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Phase 0{index + 1}</p>
            <p className="mt-2 font-display text-2xl text-foreground">{phase}</p>
          </div>
        ))}
      </div>
    </motion.section>
  );
}