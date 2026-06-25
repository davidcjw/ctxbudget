import { describe, it, expect, afterEach } from 'vitest';
import { run } from '../src/index.js';
import { renderText, toJSON } from '../src/report.js';
import { makeProject, bulkText } from './helpers.js';

let project;
afterEach(() => project?.cleanup());

// strip ANSI for assertions
const plain = (s) => s.replace(/\x1b\[[0-9;]*m/g, '');

describe('renderText', () => {
  it('shows a friendly message when no files are found', () => {
    project = makeProject({});
    const { result, root } = run({ path: project.root });
    const out = plain(renderText(result, { root, color: false }));
    expect(out).toContain('No agent context files found');
  });

  it('renders totals, sections and a grade', () => {
    project = makeProject({
      'CLAUDE.md': bulkText(2500),
      'AGENTS.md': 'Run tests. Keep it small.',
      '.mcp.json': '{"mcpServers":{}}',
    });
    const { result, root } = run({ path: project.root });
    const out = plain(renderText(result, { root, color: false }));
    expect(out).toContain('Auto-loaded every turn');
    expect(out).toContain('TOTAL auto-loaded');
    expect(out).toContain('Also present');
    expect(out).toContain('.mcp.json');
    expect(out).toMatch(/Health:\s+[A-F]/);
  });

  it('emits no ANSI codes when color is disabled', () => {
    project = makeProject({ 'CLAUDE.md': 'hello' });
    const { result, root } = run({ path: project.root });
    const out = renderText(result, { root, color: false });
    expect(out).not.toMatch(/\x1b\[/);
  });
});

describe('toJSON', () => {
  it('produces a serializable object without file contents', () => {
    project = makeProject({
      'CLAUDE.md': 'Base.\nSee @./docs/x.md',
      'docs/x.md': 'imported detail',
      '.mcp.json': '{}',
    });
    const { result, root } = run({ path: project.root });
    const json = toJSON(result, { root });
    const roundTrip = JSON.parse(JSON.stringify(json));

    expect(roundTrip.grade).toBeTruthy();
    expect(roundTrip.root).toBe(root);
    expect(Array.isArray(roundTrip.autoLoaded)).toBe(true);
    // no raw content leaked
    for (const e of [...roundTrip.autoLoaded, ...roundTrip.conditional]) {
      expect(e).not.toHaveProperty('content');
      expect(e).toHaveProperty('tokens');
    }
    const imported = roundTrip.autoLoaded.find((e) => e.imported);
    expect(imported.importedBy).toBe('CLAUDE.md');
  });
});
