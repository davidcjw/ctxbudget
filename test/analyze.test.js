import { describe, it, expect, afterEach } from 'vitest';
import { run, analyze, discover } from '../src/index.js';
import { makeProject, bulkText } from './helpers.js';

let project;
afterEach(() => project?.cleanup());

describe('analyze', () => {
  it('returns null score when nothing is found', () => {
    const result = analyze([]);
    expect(result.score).toBeNull();
    expect(result.grade).toBeNull();
    expect(result.totals.autoLoaded).toBe(0);
  });

  it('sums only auto-loaded files into the budget total', () => {
    project = makeProject({
      'CLAUDE.md': bulkText(300),
      '.mcp.json': '{"mcpServers":{"a":{}}}', // not auto-loaded
    });
    const { result } = run({ path: project.root });
    const claude = result.autoLoaded.find((e) => e.relPath === 'CLAUDE.md');
    expect(result.totals.autoLoaded).toBe(claude.tokens);
    expect(result.totals.conditional).toBeGreaterThan(0);
    expect(result.totals.all).toBe(result.totals.autoLoaded + result.totals.conditional);
  });

  it('flags an oversized file as bloat', () => {
    project = makeProject({ 'CLAUDE.md': bulkText(4000) });
    const { result } = run({ path: project.root, threshold: 1800 });
    expect(result.bloated.length).toBe(1);
    expect(result.warnings.some((w) => w.kind === 'bloat')).toBe(true);
    expect(result.score).toBeLessThan(100);
  });

  it('does not flag config files as bloat', () => {
    project = makeProject({ '.mcp.json': '{"x":"' + 'y'.repeat(20000) + '"}' });
    const { result } = run({ path: project.root, threshold: 1800 });
    expect(result.bloated.length).toBe(0);
  });

  it('detects overlap between two auto-loaded files', () => {
    const shared = [
      'Always run the test suite before declaring a feature complete.',
      'Prefer the minimum code that solves the problem at hand.',
      'Never commit secrets, API keys, or tokens to the repository.',
      'Keep all explanations concise and to the point for the reader.',
    ].join('\n');
    project = makeProject({
      'CLAUDE.md': `# Claude\n${shared}\nExtra claude-only line here for variety.`,
      'AGENTS.md': `# Agents\n${shared}\nExtra agents-only line here for variety.`,
    });
    const { result } = run({ path: project.root });
    const overlap = result.warnings.find((w) => w.kind === 'overlap');
    expect(overlap).toBeTruthy();
    expect(overlap.pct).toBeGreaterThan(0.3);
  });

  it('gives a clean small config a top grade', () => {
    project = makeProject({
      'CLAUDE.md': '# Project\nRun `npm test`. Use ESM. Keep PRs small.',
      'AGENTS.md': '# Build\nLint with eslint. Format with prettier.',
    });
    const { result } = run({ path: project.root });
    expect(result.grade).toBe('A');
    expect(result.score).toBe(100);
    expect(result.warnings.length).toBe(0);
  });

  it('reports budget pressure relative to the configured window', () => {
    project = makeProject({ 'CLAUDE.md': bulkText(12000) });
    const { result } = run({ path: project.root, budget: 100000 });
    expect(result.totals.budgetPct).toBeGreaterThan(0.05);
    expect(result.warnings.some((w) => w.kind === 'budget')).toBe(true);
  });

  it('score is bounded to 0..100', () => {
    project = makeProject({
      'CLAUDE.md': bulkText(50000),
      'AGENTS.md': bulkText(50000),
    });
    const { result } = run({ path: project.root, budget: 50000 });
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });
});
