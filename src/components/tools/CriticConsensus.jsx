import React from 'react';

/**
 * Given a percent-fresh (0-100), produce the Rotten-Tomatoes-style label
 * and color palette for the meter display.
 */
function paletteFor(pct) {
  if (pct >= 75) {
    return {
      label: 'Certified Fresh',
      bg: '#e8f5e9',
      border: '#a5d6a7',
      text: '#1b5e20',
    };
  }
  if (pct >= 60) {
    return {
      label: 'Fresh',
      bg: '#fff8e1',
      border: '#ffe082',
      text: '#8a6d3b',
    };
  }
  return {
    label: 'Rotten',
    bg: '#fce4ec',
    border: '#ef9a9a',
    text: '#8a2a2a',
  };
}

/**
 * Divergence badge color — visual signal for the audience-vs-critic gap.
 */
function divergenceColor(direction) {
  if (direction === 'audience_favored') return { bg: '#fff3e0', border: '#ffb74d', text: '#e65100' };
  if (direction === 'critic_favored') return { bg: '#e3f2fd', border: '#90caf9', text: '#0d47a1' };
  return { bg: '#f5f5f5', border: '#bdbdbd', text: '#424242' };
}

/**
 * Single RT-style meter card: label + big percentage + star average +
 * reviewer count + one-line summary.
 *
 * Used twice — once for critics (🍅), once for audience (🍿).
 */
function Meter({ icon, title, pct, stars, freshCount, totalReviews, oneLine }) {
  const p = paletteFor(pct);
  return (
    <div
      className="rounded-2xl border-2 p-4 text-center flex-1 min-w-[220px]"
      style={{ background: p.bg, borderColor: p.border }}
    >
      <p className="text-[10px] uppercase tracking-widest font-bold" style={{ color: p.text }}>
        {title}
      </p>
      <div className="text-3xl font-extrabold mt-1" style={{ color: p.text }}>
        {icon} {pct}%
      </div>
      <div className="text-xs font-semibold uppercase tracking-wider mt-0.5" style={{ color: p.text }}>
        {p.label}
      </div>
      <div className="text-xs text-muted-foreground mt-2">
        ★ {(stars || 0).toFixed(1)} / 5
        {typeof freshCount === 'number' && typeof totalReviews === 'number' && (
          <span className="ml-1.5">· {freshCount}/{totalReviews}</span>
        )}
      </div>
      {oneLine && (
        <p className="text-[11px] italic text-muted-foreground mt-2 leading-snug">
          "{oneLine}"
        </p>
      )}
    </div>
  );
}

/**
 * Two-meter consensus panel: critic tomato + audience popcorn, side by side,
 * with a divergence summary below showing when the two diverge meaningfully.
 *
 * Gracefully degrades: if the consensus object only has the legacy flat shape
 * (no `critic` / `audience` subobjects), renders just the single meter.
 */
export default function CriticConsensus({ consensus }) {
  if (!consensus) return null;

  // New shape (with audience split) vs legacy shape (flat only)
  const hasAudience = !!(consensus.critic && consensus.audience);

  if (!hasAudience) {
    // Legacy single-meter render — preserves backward compatibility
    const pct = consensus.percent_fresh || 0;
    return (
      <Meter
        icon="🍅"
        title="Critic Score"
        pct={pct}
        stars={consensus.average_stars}
        freshCount={consensus.fresh_count}
        totalReviews={consensus.total_reviews}
        oneLine={consensus.one_line}
      />
    );
  }

  // New dual-meter render
  const div = consensus.divergence || { gap: 0, label: '', direction: 'aligned' };
  const divColors = divergenceColor(div.direction);

  return (
    <div className="space-y-3">
      {/* Side-by-side meters */}
      <div className="flex gap-3 flex-wrap">
        <Meter
          icon="🍅"
          title="Critic Score"
          pct={consensus.critic.percent_fresh}
          stars={consensus.critic.average_stars}
          freshCount={consensus.critic.fresh_count}
          totalReviews={consensus.critic.total_reviews}
          oneLine={consensus.critic.one_line}
        />
        <Meter
          icon="🍿"
          title="Audience Score"
          pct={consensus.audience.percent_fresh}
          stars={consensus.audience.average_stars}
          freshCount={consensus.audience.fresh_count}
          totalReviews={consensus.audience.total_reviews}
          oneLine={consensus.audience.one_line}
        />
      </div>

      {/* Divergence pill */}
      {div.label && (
        <div
          className="rounded-xl border px-3 py-2 flex items-center justify-between gap-3 flex-wrap"
          style={{ background: divColors.bg, borderColor: divColors.border }}
        >
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-widest font-bold" style={{ color: divColors.text }}>
              Divergence
            </span>
            <span className="text-xs font-medium" style={{ color: divColors.text }}>
              {div.gap > 0 ? '+' : ''}{div.gap} pts {div.direction === 'audience_favored' ? '(audience > critics)' : div.direction === 'critic_favored' ? '(critics > audience)' : '(aligned)'}
            </span>
          </div>
          <p className="text-[11px] italic flex-1 text-right" style={{ color: divColors.text }}>
            {div.label}
          </p>
        </div>
      )}
    </div>
  );
}