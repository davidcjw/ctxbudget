import { resolve } from 'node:path';
import { discover } from './discover.js';
import { analyze, DEFAULTS } from './analyze.js';
import { renderText, toJSON } from './report.js';

export { discover } from './discover.js';
export { analyze, DEFAULTS } from './analyze.js';
export { estimateTokens, formatTokens, formatBudget } from './tokens.js';
export { renderText, toJSON } from './report.js';

/**
 * Run a full scan: discover -> analyze.
 *
 * @param {object} [opts]
 * @param {string} [opts.path] root directory to scan (default cwd)
 * @param {boolean} [opts.global] also scan per-user global config
 * @param {number} [opts.budget] context window size, in tokens
 * @param {number} [opts.threshold] per-file bloat threshold, in tokens
 * @param {string} [opts.home] override home dir (for testing)
 * @returns {{ root: string, entries: object[], result: object }}
 */
export function run(opts = {}) {
  const root = resolve(opts.path || process.cwd());
  const entries = discover(root, { global: opts.global, home: opts.home });
  const result = analyze(entries, {
    budget: opts.budget ?? DEFAULTS.budget,
    threshold: opts.threshold ?? DEFAULTS.threshold,
  });
  return { root, entries, result };
}

/**
 * Convenience: run and render to a string.
 * @param {object} [opts] run() opts plus { json, color }
 * @returns {string}
 */
export function report(opts = {}) {
  const { root, result } = run(opts);
  if (opts.json) {
    return JSON.stringify(toJSON(result, { root }), null, 2);
  }
  return renderText(result, { root, color: opts.color });
}
