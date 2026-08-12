import React from 'react';

function ratingColor(label) {
  const l = (label || '').toUpperCase();
  if (l === 'STARRED' || l === 'ACQUIRE') return { text: '#2e7d32', bg: '#e8f5e9' };
  if (l === 'PASS' || l === 'UNMARKED' || l === '—') return { text: '#c62828', bg: '#fce4ec' };
  return { text: '#8B4513', bg: '#fdf6ec' };
}

/**
 * Color for an audience prediction (0-100), used both for the badge
 * background and the divergence arrow.
 */
function audienceColor(pct) {
  if (pct >= 75) return { text: '#1b5e20', bg: '#e8f5e9' };
  if (pct >= 60) return { text: '#8a6d3b', bg: '#fff8e1' };
  return { text: '#8a2a2a', bg: '#fce4ec' };
}

export default function CriticReviewCard({ review }) {
  if (!review) return null;
  const colors = ratingColor(review.rating_label);

  // Audience prediction — only render when the reviewer returned one.
  const hasAudience = typeof review.audience_prediction === 'number';
  const aud = hasAudience ? review.audience_prediction : null;
  const crit = typeof review.rating_numeric === 'number' ? review.rating_numeric : null;
  const gap = hasAudience && crit !== null ? aud - crit : null;
  const audColors = hasAudience ? audienceColor(aud) : null;

  return (
    <div className="rounded-2xl border border-border/70 bg-card/90 p-5 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <div className="text-base font-bold text-foreground">
          {review.icon} {review.outlet}
        </div>
        <div className="flex items-center gap-2">
          <span
            className="text-sm font-bold rounded-full px-3 py-1"
            style={{ color: colors.text, background: colors.bg }}
            title="Critic rating"
          >
            🍅 {review.rating_display}
          </span>
          {hasAudience && (
            <span
              className="text-sm font-bold rounded-full px-3 py-1"
              style={{ color: audColors.text, background: audColors.bg }}
              title="Projected audience score"
            >
              🍿 {aud}%
            </span>
          )}
          {gap !== null && Math.abs(gap) >= 10 && (
            <span
              className="text-[10px] font-bold rounded-full px-2 py-0.5"
              style={{
                color: gap > 0 ? '#e65100' : '#0d47a1',
                background: gap > 0 ? '#fff3e0' : '#e3f2fd',
              }}
              title={gap > 0 ? 'Audience expected to rate higher' : 'Critics expected to rate higher'}
            >
              {gap > 0 ? '+' : ''}{gap} pts
            </span>
          )}
        </div>
      </div>
      <div className="text-sm text-foreground/80 leading-7 whitespace-pre-line">
        {review.review}
      </div>
      {review.summary_line && (
        <div className="mt-3 pt-3 border-t border-border/50 text-sm font-semibold italic text-muted-foreground">
          {review.summary_line}
        </div>
      )}
      {review.audience_reasoning && (
        <div className="mt-3 pt-3 border-t border-border/50 text-[11px] text-muted-foreground">
          <span className="font-semibold uppercase tracking-widest text-[9px] mr-2">Audience projection</span>
          {review.audience_reasoning}
        </div>
      )}
      {/* WAVE7-TOPFIXES: every reviewer is asked for up to 5 ranked, actionable
          revision instructions. They were generated on every run and never shown —
          the most useful output of the panel. */}
      {review.topFixes?.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border/50">
          <div className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">
            What this reviewer would fix
          </div>
          <ol className="space-y-1 list-decimal list-inside">
            {review.topFixes.map((fix, i) => (
              <li key={i} className="text-[11px] leading-relaxed text-foreground/80">{fix}</li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}