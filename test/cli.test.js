import { describe, it, expect, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { makeProject, bulkText } from './helpers.js';

const BIN = join(dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'ctxbudget.js');

function cli(args = [], cwd) {
  try {
    const stdout = execFileSync('node', [BIN, ...args], {
      cwd,
      encoding: 'utf8',
      env: { ...process.env, NO_COLOR: '1' },
    });
    return { code: 0, stdout };
  } catch (err) {
    return { code: err.status ?? 1, stdout: err.stdout ?? '', stderr: err.stderr ?? '' };
  }
}

let project;
afterEach(() => project?.cleanup());

describe('cli', () => {
  it('prints help and exits 0', () => {
    const { code, stdout } = cli(['--help']);
    expect(code).toBe(0);
    expect(stdout).toContain('USAGE');
    expect(stdout).toContain('ctxbudget');
  });

  it('prints a version and exits 0', () => {
    const { code, stdout } = cli(['--version']);
    expect(code).toBe(0);
    expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('errors on unknown options with exit 2', () => {
    const { code, stderr } = cli(['--nope']);
    expect(code).toBe(2);
    expect(stderr).toContain('unknown option');
  });

  it('scans a project path and reports a grade', () => {
    project = makeProject({
      'CLAUDE.md': 'Run npm test. Keep it concise.',
      'AGENTS.md': 'Build with vite.',
    });
    const { code, stdout } = cli([project.root]);
    expect(code).toBe(0);
    expect(stdout).toContain('TOTAL auto-loaded');
    expect(stdout).toMatch(/Health:\s+A/);
  });

  it('emits valid JSON with --json', () => {
    project = makeProject({ 'CLAUDE.md': 'hello world' });
    const { code, stdout } = cli([project.root, '--json']);
    expect(code).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed.grade).toBeTruthy();
    expect(parsed.totals.autoLoaded).toBeGreaterThan(0);
  });

  it('--fail-under returns exit 1 when score is below the bar', () => {
    project = makeProject({ 'CLAUDE.md': bulkText(6000) });
    const good = cli([project.root, '--fail-under', '0']);
    expect(good.code).toBe(0);
    const bad = cli([project.root, '--fail-under', '100']);
    expect(bad.code).toBe(1);
  });
});
