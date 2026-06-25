import { describe, it, expect, afterEach } from 'vitest';
import { discover } from '../src/index.js';
import { makeProject } from './helpers.js';

let project;
afterEach(() => project?.cleanup());

function ids(entries) {
  return entries.map((e) => e.relPath).sort();
}

describe('discover', () => {
  it('finds nothing in an empty dir', () => {
    project = makeProject({});
    expect(discover(project.root)).toEqual([]);
  });

  it('discovers the common agent files', () => {
    project = makeProject({
      'CLAUDE.md': '# Claude rules\nBe concise.',
      'AGENTS.md': '# Agents\nRun tests.',
      '.cursorrules': 'Use tabs.',
      '.github/copilot-instructions.md': 'Prefer TypeScript.',
      '.mcp.json': '{"mcpServers":{}}',
    });
    const found = discover(project.root);
    expect(ids(found)).toEqual([
      '.cursorrules',
      '.github/copilot-instructions.md',
      '.mcp.json',
      'AGENTS.md',
      'CLAUDE.md',
    ]);
  });

  it('marks .mcp.json and .cursor/rules as not auto-loaded', () => {
    project = makeProject({
      'CLAUDE.md': 'hi',
      '.mcp.json': '{}',
      '.cursor/rules/style.mdc': 'use spaces',
    });
    const found = discover(project.root);
    const byPath = Object.fromEntries(found.map((e) => [e.relPath, e]));
    expect(byPath['CLAUDE.md'].autoLoaded).toBe(true);
    expect(byPath['.mcp.json'].autoLoaded).toBe(false);
    expect(byPath['.cursor/rules/style.mdc'].autoLoaded).toBe(false);
  });

  it('walks directory-based rule sets', () => {
    project = makeProject({
      '.cursor/rules/a.mdc': 'rule a',
      '.cursor/rules/nested/b.mdc': 'rule b',
      '.cursor/rules/ignore.txt': 'not a rule',
    });
    const found = discover(project.root);
    expect(ids(found)).toEqual(['.cursor/rules/a.mdc', '.cursor/rules/nested/b.mdc']);
  });

  it('resolves @imports in CLAUDE.md and attributes them', () => {
    project = makeProject({
      'CLAUDE.md': 'Base rules.\nSee @./docs/style.md for details.',
      'docs/style.md': 'Two spaces. No trailing whitespace.',
    });
    const found = discover(project.root);
    const imported = found.find((e) => e.imported);
    expect(imported).toBeTruthy();
    expect(imported.relPath).toBe('docs/style.md');
    expect(imported.importedBy).toBe('CLAUDE.md');
    expect(imported.autoLoaded).toBe(true);
  });

  it('does not double-count a file that is both a primary and an import', () => {
    project = makeProject({
      'CLAUDE.md': 'Read @./AGENTS.md too.',
      'AGENTS.md': 'Shared instructions.',
    });
    const found = discover(project.root);
    const agentsEntries = found.filter((e) => e.relPath === 'AGENTS.md');
    expect(agentsEntries.length).toBe(1);
    expect(agentsEntries[0].imported).toBe(false);
  });

  it('ignores @mentions that are not real file paths (e.g. emails)', () => {
    project = makeProject({
      'CLAUDE.md': 'Contact me@example.com or @nonexistent/path.md',
    });
    const found = discover(project.root);
    expect(found.length).toBe(1);
    expect(found[0].imported).toBe(false);
  });

  it('includes global sources only when requested', () => {
    project = makeProject({ 'CLAUDE.md': 'project rules' });
    const home = makeProject({ '.claude/CLAUDE.md': 'global rules' });
    try {
      const withoutGlobal = discover(project.root, { home: home.root });
      expect(withoutGlobal.some((e) => e.scope === 'global')).toBe(false);

      const withGlobal = discover(project.root, { global: true, home: home.root });
      const globals = withGlobal.filter((e) => e.scope === 'global');
      expect(globals.length).toBe(1);
      expect(globals[0].sourceId).toBe('claude-md-global');
    } finally {
      home.cleanup();
    }
  });
});
