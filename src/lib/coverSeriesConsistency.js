/**
 * Cover Series Consistency — series-aware cover generation constraints.
 *
 * When generating covers for a book series, visual consistency matters:
 * same lighting, palette, typography style, composition pattern, and
 * model pipeline. This module extracts a "series cover signature" from
 * an active cover's metadata, applies it to new generation settings,
 * and validates that settings stay consistent.
 *
 * USAGE
 *   const sig = extractSeriesCoverSignature(project, activeCover);
 *   const updated = applySeriesCoverSignature(settings, sig);
 *   const result = validateSeriesCoverConsistency(settings, sig);
 *   const report = buildSeriesCoverConsistencyReport(project, covers);
 */

/**
 * Fields that constitute the series cover signature.
 * @type {string[]}
 */
const SIGNATURE_FIELDS = [
  'lighting',
  'palette',
  'compositionPattern',
  'modelPipeline',
  'exportPreset',
];

/**
 * Extract a "series cover signature" from an active cover's metadata.
 * The signature captures the visual DNA that should stay consistent
 * across all books in a series.
 *
 * @param {Object} project - The project object
 * @param {Object} activeCover - A cover variation object (from coverVariationManager)
 * @returns {{ hasSeriesSignature: boolean, lighting: string, palette: string, typographyStyle: Object, compositionPattern: string, modelPipeline: string, exportPreset: string }}
 */
export function extractSeriesCoverSignature(project, activeCover) {
  const meta = activeCover?.metadata;
  if (!meta) {
    return {
      hasSeriesSignature: false,
      lighting: '',
      palette: '',
      typographyStyle: {},
      compositionPattern: '',
      modelPipeline: '',
      exportPreset: '',
    };
  }

  // Extract typography style from either the variation's typographySettings
  // or from metadata if embedded there
  const typo = activeCover.typographySettings || meta.typographySettings || {};
  const typographyStyle = {
    fontFamily: typo.fontFamily || '',
    titleColor: typo.titleColor || '',
    subtitleColor: typo.subtitleColor || '',
    authorColor: typo.authorColor || '',
  };

  const hasContent =
    !!(meta.lighting || meta.palette || meta.compositionPattern || meta.modelPipeline);

  return {
    hasSeriesSignature: hasContent,
    lighting: meta.lighting || '',
    palette: meta.palette || '',
    typographyStyle,
    compositionPattern: meta.compositionPattern || '',
    modelPipeline: meta.modelPipeline || '',
    exportPreset: meta.exportPreset || '',
  };
}

/**
 * Apply a series signature to generation settings, overriding matching fields.
 * Fields present in the signature replace the corresponding settings values.
 * Fields not in the signature are left untouched.
 *
 * @param {Object} settings - Current generation settings
 * @param {Object} signature - From extractSeriesCoverSignature
 * @returns {Object} Updated settings with signature applied
 */
export function applySeriesCoverSignature(settings, signature) {
  if (!signature || !signature.hasSeriesSignature) {
    return { ...settings };
  }

  const updated = { ...settings };

  for (const field of SIGNATURE_FIELDS) {
    if (signature[field]) {
      updated[field] = signature[field];
    }
  }

  // Apply typography style as a nested merge
  if (signature.typographyStyle && Object.keys(signature.typographyStyle).length > 0) {
    updated.typographyStyle = {
      ...(settings.typographyStyle || {}),
      ...signature.typographyStyle,
    };
  }

  return updated;
}

/**
 * Validate that settings are consistent with the series signature.
 * Returns a list of deviations — fields where settings differ from
 * the signature.
 *
 * @param {Object} settings - Current generation settings
 * @param {Object} signature - From extractSeriesCoverSignature
 * @returns {{ consistent: boolean, deviations: Array<{ field: string, expected: any, actual: any }> }}
 */
export function validateSeriesCoverConsistency(settings, signature) {
  if (!signature || !signature.hasSeriesSignature) {
    return { consistent: true, deviations: [] };
  }

  const deviations = [];

  for (const field of SIGNATURE_FIELDS) {
    const expected = signature[field];
    const actual = settings[field];
    // Only flag if signature has a value and settings differ
    if (expected && actual !== expected) {
      deviations.push({ field, expected, actual: actual || '' });
    }
  }

  // Check typography sub-fields
  if (signature.typographyStyle) {
    const sigTypo = signature.typographyStyle;
    const setTypo = settings.typographyStyle || {};
    for (const key of Object.keys(sigTypo)) {
      if (sigTypo[key] && setTypo[key] !== sigTypo[key]) {
        deviations.push({
          field: `typographyStyle.${key}`,
          expected: sigTypo[key],
          actual: setTypo[key] || '',
        });
      }
    }
  }

  return {
    consistent: deviations.length === 0,
    deviations,
  };
}

/**
 * Build a human-readable consistency report for all covers in a project.
 * Compares each cover against the first cover's signature to find drift.
 *
 * @param {Object} project - The project object
 * @param {Array} covers - Array of cover variation objects
 * @returns {{ title: string, coverCount: number, issues: string[], recommendation: string }}
 */
export function buildSeriesCoverConsistencyReport(project, covers) {
  const title = project?.title || 'Untitled Project';
  const report = {
    title,
    coverCount: covers?.length || 0,
    issues: [],
    recommendation: '',
  };

  if (!covers || covers.length < 2) {
    report.recommendation = 'Add at least two cover variations to check consistency.';
    return report;
  }

  // Use the first cover (or the active one) as the reference
  const reference = covers.find((c) => c.isActive) || covers[0];
  const refSignature = extractSeriesCoverSignature(project, reference);

  if (!refSignature.hasSeriesSignature) {
    report.issues.push('Reference cover has no series signature metadata.');
    report.recommendation = 'Regenerate the reference cover with full metadata to enable consistency checks.';
    return report;
  }

  for (let i = 0; i < covers.length; i++) {
    const cover = covers[i];
    if (cover.id === reference.id) continue;

    const coverSig = extractSeriesCoverSignature(project, cover);
    const { deviations } = validateSeriesCoverConsistency(
      // Treat the cover's signature fields as "settings" for validation
      {
        lighting: coverSig.lighting,
        palette: coverSig.palette,
        compositionPattern: coverSig.compositionPattern,
        modelPipeline: coverSig.modelPipeline,
        exportPreset: coverSig.exportPreset,
        typographyStyle: coverSig.typographyStyle,
      },
      refSignature,
    );

    for (const d of deviations) {
      report.issues.push(
        `"${cover.name || `Cover ${i + 1}`}" deviates on ${d.field}: expected "${d.expected}", got "${d.actual}"`,
      );
    }
  }

  if (report.issues.length === 0) {
    report.recommendation = 'All covers are consistent with the series signature.';
  } else {
    report.recommendation = `Found ${report.issues.length} inconsistenc${report.issues.length === 1 ? 'y' : 'ies'}. Consider regenerating deviant covers with the series signature applied.`;
  }

  return report;
}
