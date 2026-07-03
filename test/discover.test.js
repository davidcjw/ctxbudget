import { describe, it, expect, afterEach } from 'vitest';
import { symlinkSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
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

  it('counts .claude/rules/*.md as auto-loaded, flat (non-recursive)', () => {
    project = makeProject({
      'CLAUDE.md': 'base',
      '.claude/rules/development.md': 'dev rule',
      '.claude/rules/style.md': 'style rule',
      '.claude/rules/ignore.txt': 'not markdown',
      '.claude/rules/nested/deep.md': 'nested — Claude Code does not load this',
    });
    const found = discover(project.root);
    const byPath = Object.fromEntries(found.map((e) => [e.relPath, e]));
    expect(byPath['.claude/rules/development.md']?.autoLoaded).toBe(true);
    expect(byPath['.claude/rules/style.md']?.autoLoaded).toBe(true);
    // flat glob: nested dirs and non-.md files are excluded
    expect(byPath['.claude/rules/nested/deep.md']).toBeUndefined();
    expect(byPath['.claude/rules/ignore.txt']).toBeUndefined();
  });

  it('follows a symlinked rule file in .claude/rules', () => {
    project = makeProject({
      'CLAUDE.md': 'base',
      'shared/dev.md': 'shared dev rules',
    });
    mkdirSync(join(project.root, '.claude/rules'), { recursive: true });
    symlinkSync(join(project.root, 'shared/dev.md'), join(project.root, '.claude/rules/dev.md'));
    const found = discover(project.root);
    const entry = found.find((e) => e.relPath === '.claude/rules/dev.md');
    expect(entry?.autoLoaded).toBe(true);
    expect(entry?.content).toContain('shared dev rules');
  });

  it('counts ~/.claude/rules/*.md under --global', () => {
    project = makeProject({ 'CLAUDE.md': 'project' });
    const home = makeProject({
      '.claude/CLAUDE.md': 'global',
      '.claude/rules/dev.md': 'global dev rule',
    });
    try {
      const withGlobal = discover(project.root, { global: true, home: home.root });
      const rules = withGlobal.filter((e) => e.sourceId === 'claude-rules-global');
      expect(rules.length).toBe(1);
      expect(rules[0].scope).toBe('global');
      expect(rules[0].autoLoaded).toBe(true);
    } finally {
      home.cleanup();
    }
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
