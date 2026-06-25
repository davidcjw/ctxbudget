import { formatTokens, formatBudget } from './tokens.js';

const RESET = '\x1b[0m';
const STYLES = {
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

function makeColor(enabled) {
  return (style, text) =>
    enabled && STYLES[style] ? `${STYLES[style]}${text}${RESET}` : String(text);
}

const RULE = '─'.repeat(48);

const GRADE_STYLE = { A: 'green', B: 'green', C: 'yellow', D: 'yellow', F: 'red' };

function tokenCol(entry) {
  return `${formatTokens(entry.tokens)} tok`;
}

function padEndVisible(str, width) {
  // str here is plain (uncolored) — safe to use .length.
  return str.length >= width ? str : str + ' '.repeat(width - str.length);
}

/**
 * Render a human-readable terminal report.
 * @param {object} result analyze() output
 * @param {object} ctx { root, color }
 * @returns {string}
 */
export function renderText(result, ctx = {}) {
  const c = makeColor(ctx.color !== false);
  const out = [];
  const line = (s = '') => out.push(s);

  line();
  line(`  ${c('bold', 'ctxbudget')} ${c('dim', '· context budget report')}`);
  if (ctx.root) line(`  ${c('gray', ctx.root)}`);
  line();

  if (!result.autoLoaded.length && !result.conditional.length) {
    line(`  ${c('yellow', 'No agent context files found.')}`);
    line(
      `  ${c('dim', 'Looked for CLAUDE.md, AGENTS.md, .cursor/rules, copilot-instructions, .windsurfrules, .clinerules, .mcp.json')}`
    );
    line();
    return out.join('\n');
  }

  // --- Auto-loaded section ------------------------------------------------
  if (result.autoLoaded.length) {
    line(`  ${c('bold', 'Auto-loaded every turn')}`);
    line(`  ${c('gray', RULE)}`);
    for (const e of result.autoLoaded) {
      renderEntry(line, c, e);
    }
    line(`  ${c('gray', RULE)}`);
    const pct = (result.totals.budgetPct * 100).toFixed(1);
    const totalLabel = padEndVisible('TOTAL auto-loaded', 32);
    line(
      `  ${c('bold', totalLabel)}${c('bold', padEndVisible(formatTokens(result.totals.autoLoaded) + ' tok', 12))}${c('dim', `${pct}% of ${formatBudget(result.budget)}`)}`
    );
    line();
  }

  // --- Conditional / also-present section --------------------------------
  if (result.conditional.length) {
    line(`  ${c('bold', 'Also present')} ${c('dim', '(loaded conditionally / tool schemas)')}`);
    line(`  ${c('gray', RULE)}`);
    for (const e of result.conditional) {
      renderEntry(line, c, e);
    }
    line();
  }

  // --- Warnings -----------------------------------------------------------
  if (result.warnings.length) {
    line(`  ${c('bold', 'Warnings')}`);
    for (const w of result.warnings) {
      line(`  ${c('yellow', '⚠')} ${w.message}`);
    }
    line();
  } else {
    line(`  ${c('green', '✓')} no bloat, duplication, or budget pressure detected`);
    line();
  }

  // --- Health -------------------------------------------------------------
  if (result.grade) {
    const gStyle = GRADE_STYLE[result.grade] || 'yellow';
    line(
      `  ${c('bold', 'Health:')} ${c(gStyle, c('bold', result.grade))} ${c('dim', `(${result.score}/100)`)}`
    );
    line();
  }

  return out.join('\n');
}

function renderEntry(line, c, e) {
  const indent = e.imported ? '    └ ' : '  ';
  const label = e.imported
    ? `${e.relPath} ${c('dim', '(import)')}`
    : e.relPath;
  // Build a plain version for width math, then colorize.
  const plainLabel = e.imported ? `${e.relPath} (import)` : e.relPath;
  const labelCol = padEndVisible(plainLabel, e.imported ? 30 : 32);
  // Re-inject the dim "(import)" coloring after padding.
  const coloredLabel = e.imported
    ? labelCol.replace('(import)', c('dim', '(import)'))
    : labelCol;
  const toolNote = e.imported ? '' : c('gray', `  ${e.tool}`);
  line(`${indent}${coloredLabel}${padEndVisible(tokenCol(e), 12)}${toolNote}`);
}

/**
 * Build a plain JSON-serializable object (drops file contents).
 * @param {object} result analyze() output
 * @param {object} ctx { root }
 * @returns {object}
 */
export function toJSON(result, ctx = {}) {
  const strip = (e) => ({
    source: e.sourceId,
    label: e.sourceLabel,
    tool: e.tool,
    type: e.type,
    path: e.relPath,
    scope: e.scope,
    tokens: e.tokens,
    bytes: e.bytes,
    autoLoaded: e.autoLoaded,
    imported: e.imported,
    importedBy: e.importedBy,
  });
  return {
    root: ctx.root ?? null,
    budget: result.budget,
    threshold: result.threshold,
    score: result.score,
    grade: result.grade,
    totals: result.totals,
    autoLoaded: result.autoLoaded.map(strip),
    conditional: result.conditional.map(strip),
    warnings: result.warnings,
  };
}
