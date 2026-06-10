import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import SourceSelector from '@/components/tools/SourceSelector';
import UploadZone from '@/components/tools/UploadZone';
import { isAnthologyProject } from '@/lib/anthologyEngine';
import { countWords } from '@/lib/autonovel';
import { invokeLLMWithRetry } from '@/lib/integrationRetry';
import { loadManuscriptChapters, getFullText } from '@/lib/manuscriptLoader';
import { base44 } from '@/api/base44Client';
import CriticConsensus from '@/components/tools/CriticConsensus';
import CriticReviewCard from '@/components/tools/CriticReviewCard';
import {
  pickReviewerPanel,
  buildReviewerPrompt,
  REVIEWER_RESPONSE_SCHEMA,
  computeConsensus,
} from '@/lib/criticPanel';

/**
 * Build a continuous-narrative excerpt: opening, middle, end blocks.
 * Used for novels and other continuous-narrative manuscripts.
 */
function buildCriticExcerpt(fullText) {
  const opening = fullText.substring(0, 40000);
  const midpoint = Math.floor(fullText.length / 2);
  const middle = fullText.substring(midpoint - 2500, midpoint + 2500);
  const ending = fullText.substring(fullText.length - 10000);
  return opening + '\n\n[...MIDDLE OF MANUSCRIPT...]\n\n' + middle + '\n\n[...END OF MANUSCRIPT...]\n\n' + ending;
}

/**
 * Build an anthology-aware excerpt: a small slice from EVERY story.
 */
function buildAnthologyExcerpt(normalizedChapters) {
  if (!normalizedChapters?.length) return '';

  const TOTAL_BUDGET = 50000;
  const numStories = normalizedChapters.length;
  const perStoryBudget = Math.floor((TOTAL_BUDGET - (numStories * 250)) / numStories);
  const openingBudget = Math.floor(perStoryBudget * 0.67);
  const closingBudget = perStoryBudget - openingBudget;

  const parts = [];
  parts.push(`[ANTHOLOGY EXCERPT — ${numStories} STORIES SAMPLED]\n\nThis excerpt contains the opening and closing of every story in the collection so you can evaluate the full range. Stories are presented in their published order. Where you see [...story continues...], assume the omitted middle developed the conflict toward the closing shown.\n`);

  for (const ch of normalizedChapters) {
    const content = ch.content || '';
    const title = ch.title || `Story ${ch.chapter_number}`;
    const wordCount = ch.word_count || 0;

    parts.push(`\n═══════════════════════════════════════════\nSTORY ${ch.chapter_number}: ${title}\n(${wordCount.toLocaleString()} words total)\n═══════════════════════════════════════════\n`);

    if (content.length <= perStoryBudget) {
      parts.push(content);
    } else {
      const opening = content.substring(0, openingBudget).trim();
      const closing = content.substring(content.length - closingBudget).trim();
      parts.push(opening);
      parts.push('\n\n[...story continues...]\n\n');
      parts.push(closing);
    }
  }

  return parts.join('');
}

/**
 * Run a single reviewer call. Returns the parsed review or a degraded-but-safe
 * fallback object if the LLM call fails. We never abort the whole panel for
 * one failed reviewer.
 */
async function runSingleReviewer(reviewer, context) {
  const prompt = buildReviewerPrompt(reviewer, context);
  try {
    const response = await invokeLLMWithRetry({
      task_type: 'critique',
      prompt,
      response_json_schema: REVIEWER_RESPONSE_SCHEMA,
      model: 'gemini_3_flash',
      fallback_model: 'gemini_3_flash',
      temperature: 0.3, // low temp = score stability across runs
    });

    // Parse defensively — LLM may return string or object
    let data = typeof response === 'string' ? response : response;
    if (typeof data === 'string') {
      // Strip markdown fences the LLM sometimes adds despite schema
      data = data.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      data = JSON.parse(data);
    }

    // Clamp rating_numeric to 0-100
    const ratingNumeric = Math.max(0, Math.min(100,
      Number.isFinite(Number(data.rating_numeric)) ? Math.round(Number(data.rating_numeric)) : 50
    ));

    return {
      outlet: data.outlet || reviewer.outlet,
      icon: data.icon || reviewer.icon,
      rating_label: data.rating_label || '—',
      rating_numeric: ratingNumeric,
      rating_display: data.rating_display || data.rating_label || '—',
      review: data.review || 'Review unavailable.',
      summary_line: data.summary_line || '',
      audience_prediction: Math.max(0, Math.min(100,
        Number.isFinite(Number(data.audience_prediction)) ? Math.round(Number(data.audience_prediction)) : ratingNumeric
      )),
      audience_reasoning: data.audience_reasoning || '',
    };
  } catch (err) {
    console.error(`[CRITIC] ${reviewer.outlet} call failed:`, err?.message || err);
    return {
      outlet: reviewer.outlet,
      icon: reviewer.icon,
      rating_label: 'N/A',
      rating_numeric: 50,
      rating_display: 'N/A',
      review: `Review generation failed for ${reviewer.outlet}. (${err?.message || 'Unknown error'}) — try re-running the panel to regenerate this reviewer.`,
      summary_line: '',
      audience_prediction: 50,
      audience_reasoning: '',
      _failed: true,
    };
  }
}

export default function CriticSubPage({ project, chapters, busyLabel, setBusyLabel }) {
  const [source, setSource] = useState(project?.id ? 'project' : 'upload');
  const [uploadedContent, setUploadedContent] = useState(null);
  const [results, setResults] = useState(null);
  const isBusy = !!busyLabel;

  const handleFileLoaded = (parsed) => {
    setUploadedContent(parsed);
    setResults(null);
  };

  const handleRunCritic = async () => {
    if (isBusy) return;
    let title = project?.title || 'Untitled';
    let genre = project?.genre || 'Fiction';
    const isAnthology = isAnthologyProject(project);

    setBusyLabel('Critic: Loading chapters…');

    const normalizedChapters = await loadManuscriptChapters(
      source,
      project,
      chapters,
      uploadedContent
    );

    if (!normalizedChapters.length) {
      toast.error(source === 'project' ? 'No chapters found.' : 'Upload a manuscript first.');
      setBusyLabel('');
      return;
    }

    if (source === 'upload' && uploadedContent?.title) {
      title = uploadedContent.title;
    }

    const fullText = getFullText(normalizedChapters);
    const wordCount = countWords(fullText);

    if (wordCount < 5000) {
      toast.error('Manuscript too short for meaningful critique (' + wordCount + ' words). Need at least 5,000.');
      setBusyLabel('');
      return;
    }

    if (source === 'project' && normalizedChapters.length < 3) {
      toast.error('Need at least 3 drafted chapters for a meaningful critique.');
      setBusyLabel('');
      return;
    }

    const excerpt = isAnthology
      ? buildAnthologyExcerpt(normalizedChapters)
      : buildCriticExcerpt(fullText);

    console.warn('[CRITIC] Excerpt mode:', isAnthology ? 'anthology (per-story sampling)' : 'continuous narrative',
      '| chapters:', normalizedChapters.length,
      '| excerpt chars:', excerpt.length,
      '| total chars:', fullText.length);

    // Resolve project type (nonfiction / fiction / erotica)
    const resolvedType = project?.project_type || project?.book_type || 'fiction';
    const authorName = project?.author_name || 'the author';

    // Pick the 10-reviewer panel based on genre and project type
    const panel = pickReviewerPanel(project, genre, resolvedType);
    console.warn('[CRITIC] Panel:', panel.map((p) => p.outlet).join(', '));

    // =========================================================================
    // SERIES CONTEXT LOAD — if this project is Volume N of a series (N > 1),
    // fetch the SeriesBible and prior volume title so reviewers can be briefed
    // that unresolved threads and character carryover are intentional.
    // Silent no-op for standalone projects or failed lookups.
    // =========================================================================
    let seriesContext = {
      isSeries: false,
      seriesName: '',
      seriesNumber: 0,
      priorVolumeTitle: '',
      seriesUnresolvedThreads: [],
      seriesResolvedThreads: [],
      seriesDeathsAndLosses: [],
      seriesSecretsRevealed: [],
      seriesLastBookEnding: '',
    };

    const seriesNumber = Number(project?.series_number || 0);
    const hasSeriesLink = !!(project?.series_bible_id && seriesNumber >= 2);

    if (hasSeriesLink) {
      try {
        setBusyLabel('Critic: Loading series bible…');
        const bibles = await base44.entities.SeriesBible.filter({ id: project.series_bible_id });
        const bible = bibles?.[0];

        if (bible) {
          const safeParse = (s) => {
            if (!s) return [];
            if (Array.isArray(s)) return s;
            try {
              const parsed = JSON.parse(s);
              return Array.isArray(parsed) ? parsed : [];
            } catch {
              return [];
            }
          };

          // Optional: fetch prior volume title for naming
          let priorVolumeTitle = bible.last_book_title || '';
          if (project?.prior_volume_id) {
            try {
              const priors = await base44.entities.NovelProject.filter({ id: project.prior_volume_id });
              if (priors?.[0]?.title) priorVolumeTitle = priors[0].title;
            } catch (_) { /* ignore */ }
          }

          seriesContext = {
            isSeries: true,
            seriesName: bible.series_name || project.series_name || '',
            seriesNumber,
            priorVolumeTitle,
            seriesUnresolvedThreads: safeParse(bible.unresolved_threads),
            seriesResolvedThreads: safeParse(bible.resolved_threads),
            seriesDeathsAndLosses: safeParse(bible.deaths_and_losses),
            seriesSecretsRevealed: safeParse(bible.secrets_revealed),
            seriesLastBookEnding: bible.last_book_ending || '',
          };

          console.warn('[CRITIC] Series mode:', {
            series: seriesContext.seriesName,
            volume: seriesContext.seriesNumber,
            prior: seriesContext.priorVolumeTitle,
            openThreads: seriesContext.seriesUnresolvedThreads.length,
            closedThreads: seriesContext.seriesResolvedThreads.length,
            deaths: seriesContext.seriesDeathsAndLosses.length,
          });
        }
      } catch (err) {
        console.warn('[CRITIC] Series bible load failed, reviewing as standalone:', err?.message);
      }
    }

    // Shared per-reviewer context
    const reviewerContext = {
      title,
      genre,
      wordCount,
      excerpt,
      authorName,
      projectType: resolvedType,
      isAnthology,
      anthologyTheme: project?.anthology_theme || project?.seed_concept || 'unspecified',
      isMultiPov: project?.pov_mode === 'third-multi',
      ...seriesContext,
    };

    if (reviewerContext.isMultiPov) {
      console.warn('[CRITIC] Multi-POV mode: reviewers briefed that per-character voice variation is intentional.');
    }

    setBusyLabel(`Critic: Generating ${panel.length} independent reviews in parallel… (45-90 seconds)`);

    try {
      // PARALLEL — each reviewer is an independent LLM call with temperature 0.3.
      // Reviewers cannot anchor to each other because they never see each other's output.
      const t0 = Date.now();
      const reviews = await Promise.all(
        panel.map((reviewer) => runSingleReviewer(reviewer, reviewerContext))
      );
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

      // Log individual ratings so Cliff can see the math in console
      console.warn('[CRITIC] All reviews returned in', elapsed + 's.');
      console.table(reviews.map((r) => ({
        outlet: r.outlet,
        rating_label: r.rating_label,
        critic: r.rating_numeric,
        audience: r.audience_prediction,
        divergence: r.audience_prediction - r.rating_numeric,
        failed: !!r._failed,
      })));

      // DETERMINISTIC consensus — computed in JS, not by LLM
      const consensus = computeConsensus(reviews);
      console.warn('[CRITIC] Critic consensus:',
        consensus.critic.percent_fresh + '% fresh',
        '| avg stars:', consensus.critic.average_stars,
        '| fresh:', consensus.critic.fresh_count + '/' + consensus.critic.total_reviews);
      console.warn('[CRITIC] Audience consensus:',
        consensus.audience.percent_fresh + '% fresh',
        '| avg stars:', consensus.audience.average_stars,
        '| fresh:', consensus.audience.fresh_count + '/' + consensus.audience.total_reviews);
      console.warn('[CRITIC] Divergence (audience - critic):', consensus.divergence.gap, '—', consensus.divergence.label);

      // Note any failed reviewers
      const failedCount = reviews.filter((r) => r._failed).length;
      if (failedCount > 0) {
        toast.warning(`Critic panel complete — ${failedCount} of ${reviews.length} reviewers failed to generate. Consensus based on ${reviews.length - failedCount} successful reviews.`);
      } else {
        toast.success(`Critic: ${consensus.critic.percent_fresh}% Fresh · Audience: ${consensus.audience.percent_fresh}% · ${consensus.divergence.label}`);
      }

      setResults({ consensus, reviews });
    } catch (err) {
      console.error('[CRITIC] Panel orchestration failed:', err);
      toast.error('Critic panel failed: ' + (err.message || 'Unknown error'));
    } finally {
      setBusyLabel('');
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-3xl text-foreground">Critic Panel</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Ten independent reviews from real-world publication voices. Each reviewer evaluates the manuscript on its own — no consensus-anchoring. Rotten Tomatoes score is computed deterministically from individual ratings.
        </p>
      </div>

      <SourceSelector source={source} setSource={setSource} project={project} />

      {source === 'upload' && (
        <UploadZone onFileLoaded={handleFileLoaded} loaded={uploadedContent} />
      )}

      <div className="text-center">
        <Button
          onClick={handleRunCritic}
          disabled={isBusy || (source === 'upload' && !uploadedContent?.text)}
          size="lg"
          className="rounded-full px-8 gap-2"
        >
          {isBusy && busyLabel?.includes('Critic') ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> {busyLabel.replace('Critic: ', '')}</>
          ) : (
            <>🎬 Run Critic Panel</>
          )}
        </Button>
        <p className="mt-2 text-xs text-muted-foreground">
          Parallel LLM calls — each reviewer runs independently at low temperature for score stability.
        </p>
      </div>

      {results && (
        <div className="space-y-4">
          <CriticConsensus consensus={results.consensus} />
          {results.reviews.map((review, i) => (
            <CriticReviewCard key={i} review={review} />
          ))}
        </div>
      )}
    </div>
  );
}