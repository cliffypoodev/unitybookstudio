import React from 'react';
import { Info } from 'lucide-react';

function TomatoMeter({ score, label }) {
  const s = Number(score) || 0;
  const color = s >= 75 ? 'text-green-600' : s >= 60 ? 'text-yellow-600' : 'text-red-500';
  const bgColor = s >= 75 ? 'bg-green-500/10' : s >= 60 ? 'bg-yellow-500/10' : 'bg-red-500/10';
  const emoji = s >= 75 ? '🍅' : s >= 60 ? '🍅' : '🤢';

  return (
    <div className={`flex flex-col items-center gap-1 rounded-xl ${bgColor} p-4`}>
      <span className="text-2xl">{emoji}</span>
      <span className={`text-3xl font-bold ${color}`}>{s}%</span>
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
    </div>
  );
}

function CleanScoreMeter({ score, deductions }) {
  const s = Number(score) || 0;
  const color = s >= 85 ? 'text-green-600' : s >= 70 ? 'text-yellow-600' : 'text-red-500';
  const bgColor = s >= 85 ? 'bg-green-500/10' : s >= 70 ? 'bg-yellow-500/10' : 'bg-red-500/10';
  const emoji = s >= 85 ? '✅' : s >= 70 ? '⚠️' : '❌';
  const label = s >= 85 ? 'Clean' : s >= 70 ? 'Needs Work' : 'Issues Found';

  return (
    <div className={`flex flex-col items-center gap-1 rounded-xl ${bgColor} p-4`}>
      <span className="text-2xl">{emoji}</span>
      <span className={`text-3xl font-bold ${color}`}>{s}</span>
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Clean Score</span>
      <span className="text-[9px] text-muted-foreground">{label}</span>
    </div>
  );
}

export default function ReviewScoreCard({ review }) {
  const verdictColor = review.verdict === 'Certified Fresh'
    ? 'bg-green-500/15 text-green-700 border-green-500/30'
    : review.verdict === 'Fresh'
      ? 'bg-yellow-500/15 text-yellow-700 border-yellow-500/30'
      : 'bg-red-500/15 text-red-700 border-red-500/30';

  return (
    <div className="rounded-[1.25rem] border border-border/70 bg-background/70 p-4 space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <TomatoMeter score={review.critic_score} label="AI Critic" />
        <TomatoMeter score={review.audience_score} label="AI Audience" />
        <CleanScoreMeter score={review.clean_score} deductions={review.clean_deductions} />
      </div>
      <div className={`rounded-xl border px-3 py-2 text-center text-sm font-semibold ${verdictColor}`}>
        {review.verdict === 'Certified Fresh' ? '🏆 ' : review.verdict === 'Rotten' ? '💀 ' : '✓ '}
        {review.verdict}
      </div>
      <p className="text-sm italic text-center text-muted-foreground leading-6">"{review.one_line}"</p>

      {/* Guidance note */}
      <div className="flex items-start gap-2 rounded-lg bg-muted/50 border border-border/50 px-3 py-2.5">
        <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-[11px] leading-5 text-muted-foreground">
          <strong>Clean Score</strong> is the objective rule check — 85+ means publication-ready.
          AI Critic/Audience scores reflect the AI reviewer's opinion and may not match human quality.
          Chapters scoring 60-70 on AI metrics are often fine. Running scan/fix more than twice can degrade prose.
        </p>
      </div>
    </div>
  );
}