import { estimateTokens } from './tokens.js';

export const DEFAULTS = {
  budget: 200_000,
  threshold: 1_800, // per-file "this is getting big" line, in tokens
  overlapFloor: 0.1, // ignore pairwise overlaps below 10%
};

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function scoreToGrade(score) {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

/** Normalized, "substantial" lines used for overlap detection. */
function substantialLines(content) {
  return content
    .split('\n')
    .map((l) => l.trim().toLowerCase().replace(/\s+/g, ' '))
    .filter((l) => l.length >= 24);
}

/**
 * Estimate how much of two files is duplicated, by matching normalized lines.
 * Percentage is relative to the smaller of the two files, so "80% overlap"
 * means 80% of the smaller file also appears in the larger one.
 */
function overlapBetween(aContent, bContent) {
  const aLines = substantialLines(aContent);
  const bLines = substantialLines(bContent);
  if (!aLines.length || !bLines.length) return null;

  const aSet = new Set(aLines);
  const seen = new Set();
  let sharedTokens = 0;
  let sharedCount = 0;
  for (const line of bLines) {
    if (aSet.has(line) && !seen.has(line)) {
      seen.add(line);
      sharedTokens += estimateTokens(line);
      sharedCount += 1;
    }
  }
  if (!sharedCount) return null;

  const aTokens = aLines.reduce((s, l) => s + estimateTokens(l), 0);
  const bTokens = bLines.reduce((s, l) => s + estimateTokens(l), 0);
  const smaller = Math.min(aTokens, bTokens) || 1;
  return {
    sharedTokens,
    sharedCount,
    pct: clamp(sharedTokens / smaller, 0, 1),
  };
}

/**
 * Analyze discovered entries into a budget report.
 *
 * @param {Array<object>} entries from discover()
 * @param {object} [opts]
 * @param {number} [opts.budget] context window size, in tokens
 * @param {number} [opts.threshold] per-file bloat threshold, in tokens
 * @returns {object} structured report
 */
export function analyze(entries, opts = {}) {
  const budget = opts.budget ?? DEFAULTS.budget;
  const threshold = opts.threshold ?? DEFAULTS.threshold;

  const autoLoaded = entries.filter((e) => e.autoLoaded);
  const conditional = entries.filter((e) => !e.autoLoaded);

  const totalAutoLoaded = autoLoaded.reduce((s, e) => s + e.tokens, 0);
  const totalConditional = conditional.reduce((s, e) => s + e.tokens, 0);
  const totalAll = totalAutoLoaded + totalConditional;
  const budgetPct = totalAutoLoaded / budget;

  // --- Warnings -----------------------------------------------------------
  const warnings = [];

  // Bloat: text-bearing files (not raw config) over the threshold.
  const bloated = entries
    .filter((e) => e.type !== 'config' && e.tokens > threshold)
    .sort((a, b) => b.tokens - a.tokens);
  for (const f of bloated) {
    warnings.push({
      kind: 'bloat',
      file: f.relPath,
      tokens: f.tokens,
      ratio: f.tokens / threshold,
      message: `${f.relPath} is ${(f.tokens / threshold).toFixed(1)}x the recommended size (${f.tokens} tok > ${threshold} tok)`,
    });
  }

  // Overlap: compare every pair of auto-loaded text files.
  const textEntries = autoLoaded.filter((e) => e.type !== 'config' && e.content);
  const overlaps = [];
  for (let i = 0; i < textEntries.length; i++) {
    for (let j = i + 1; j < textEntries.length; j++) {
      const a = textEntries[i];
      const b = textEntries[j];
      const ov = overlapBetween(a.content, b.content);
      if (ov && ov.pct >= DEFAULTS.overlapFloor) {
        overlaps.push({ a: a.relPath, b: b.relPath, ...ov });
      }
    }
  }
  overlaps.sort((x, y) => y.pct - x.pct);
  for (const ov of overlaps) {
    warnings.push({
      kind: 'overlap',
      a: ov.a,
      b: ov.b,
      pct: ov.pct,
      sharedTokens: ov.sharedTokens,
      message: `${Math.round(ov.pct * 100)}% overlap between ${ov.a} and ${ov.b} (~${ov.sharedTokens} tok duplicated)`,
    });
  }

  // Budget pressure note.
  if (budgetPct > 0.05) {
    warnings.push({
      kind: 'budget',
      pct: budgetPct,
      message: `auto-loaded context is ${(budgetPct * 100).toFixed(1)}% of the ${budget}-token window before any work starts`,
    });
  }

  // --- Score --------------------------------------------------------------
  let score = 100;
  // Budget pressure: every 1% of window over 5% costs 2 points (cap 20).
  if (budgetPct > 0.05) {
    score -= Math.min(20, (budgetPct - 0.05) * 100 * 2);
  }
  // Bloat: each oversized file costs up to 20.
  for (const f of bloated) {
    score -= Math.min(20, (f.tokens / threshold - 1) * 12);
  }
  // Overlap: worst pair costs up to 15.
  if (overlaps.length) {
    score -= Math.min(15, overlaps[0].pct * 100 * 0.25);
  }
  score = Math.round(clamp(score, 0, 100));

  return {
    budget,
    threshold,
    totals: {
      autoLoaded: totalAutoLoaded,
      conditional: totalConditional,
      all: totalAll,
      budgetPct,
      autoLoadedFiles: autoLoaded.length,
      conditionalFiles: conditional.length,
    },
    autoLoaded,
    conditional,
    bloated,
    overlaps,
    warnings,
    score: entries.length ? score : null,
    grade: entries.length ? scoreToGrade(score) : null,
  };
}
