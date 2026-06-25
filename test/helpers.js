import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';

/** Create an isolated temp directory tree from a { relPath: content } map. */
export function makeProject(files = {}) {
  const root = mkdtempSync(join(tmpdir(), 'ctxbudget-'));
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(root, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content, 'utf8');
  }
  return {
    root,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}

/** Repeat a line of prose enough times to roughly hit a token target. */
export function bulkText(approxTokens) {
  const line = 'This is a representative instruction line for the agent to follow.\n';
  // ~13 tokens per line with this estimator; pad generously.
  const lines = Math.ceil(approxTokens / 12);
  return line.repeat(lines);
}
