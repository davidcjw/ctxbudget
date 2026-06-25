import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, resolve, dirname, relative } from 'node:path';
import { homedir } from 'node:os';
import { estimateTokens } from './tokens.js';
import { PROJECT_SOURCES, GLOBAL_SOURCES } from './sources.js';

/**
 * Matches Claude Code `@path` imports: an `@` at a line/whitespace boundary
 * followed by a path-like token (must start with `~`, `.` or `/` and contain a
 * slash so we don't match emails/handles like `foo@bar`).
 */
const IMPORT_RE = /(?:^|\s)@([~./][^\s)'"`]*\/[^\s)'"`]*)/g;

const MAX_DEPTH = 8;

function safeStat(p) {
  try {
    return statSync(p);
  } catch {
    return null;
  }
}

function readFile(p) {
  try {
    return readFileSync(p, 'utf8');
  } catch {
    return null;
  }
}

function walkDir(dir, exts, depth = 0, acc = []) {
  if (depth > 6) return acc;
  let items;
  try {
    items = readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const item of items) {
    const full = join(dir, item.name);
    if (item.isDirectory()) {
      walkDir(full, exts, depth + 1, acc);
    } else if (exts.some((e) => item.name.endsWith(e))) {
      acc.push(full);
    }
  }
  return acc;
}

function makeEntry(source, absPath, baseDir, scope, extra = {}) {
  const content = readFile(absPath) ?? '';
  return {
    sourceId: source.id,
    sourceLabel: source.label,
    tool: source.tool,
    type: source.type,
    autoLoaded: source.autoLoaded,
    note: source.note ?? null,
    path: absPath,
    relPath: relative(baseDir, absPath) || absPath,
    scope,
    content,
    bytes: Buffer.byteLength(content, 'utf8'),
    tokens: estimateTokens(content),
    imported: false,
    importedBy: null,
    ...extra,
  };
}

function resolveImports(entry, baseDir, home, seen, depth = 0) {
  if (depth > MAX_DEPTH) return [];
  const out = [];
  const fromDir = dirname(entry.path);
  const found = new Set();
  let m;
  IMPORT_RE.lastIndex = 0;
  while ((m = IMPORT_RE.exec(entry.content))) {
    found.add(m[1]);
  }
  for (const spec of found) {
    let abs;
    if (spec.startsWith('~')) abs = join(home, spec.slice(1));
    else abs = resolve(fromDir, spec);
    if (seen.has(abs)) continue;
    const st = safeStat(abs);
    if (!st || !st.isFile()) continue;
    seen.add(abs);
    const content = readFile(abs) ?? '';
    const child = {
      sourceId: entry.sourceId,
      sourceLabel: entry.sourceLabel,
      tool: entry.tool,
      type: entry.type,
      autoLoaded: entry.autoLoaded,
      note: null,
      path: abs,
      relPath: relative(baseDir, abs) || abs,
      scope: entry.scope,
      content,
      bytes: Buffer.byteLength(content, 'utf8'),
      tokens: estimateTokens(content),
      imported: true,
      importedBy: entry.relPath,
      importSpec: spec,
    };
    out.push(child);
    // Imports can chain (an imported file importing more).
    out.push(...resolveImports(child, baseDir, home, seen, depth + 1));
  }
  return out;
}

function collectFromSource(source, rootDir, scope) {
  const matches = [];
  for (const cand of source.candidates ?? []) {
    const abs = join(rootDir, cand);
    const st = safeStat(abs);
    if (st && st.isFile()) matches.push(abs);
  }
  if (source.dir) {
    const dirAbs = join(rootDir, source.dir);
    const st = safeStat(dirAbs);
    if (st && st.isDirectory()) {
      for (const f of walkDir(dirAbs, source.exts ?? ['.md'])) matches.push(f);
    }
  }
  return matches;
}

/**
 * Discover all agent context entries under `rootDir`.
 *
 * @param {string} rootDir absolute project root to scan
 * @param {object} [opts]
 * @param {boolean} [opts.global] also scan per-user global sources
 * @param {string} [opts.home] override home dir (for testing)
 * @returns {Array<object>} flat, de-duplicated, sorted list of entries
 */
export function discover(rootDir, opts = {}) {
  const root = resolve(rootDir);
  const home = opts.home ? resolve(opts.home) : homedir();
  const entries = [];
  const seenPaths = new Set();

  const add = (entry) => {
    if (seenPaths.has(entry.path)) return;
    seenPaths.add(entry.path);
    entries.push(entry);
  };

  // Project sources (relative paths reported against root).
  for (const source of PROJECT_SOURCES) {
    for (const abs of collectFromSource(source, root, 'project')) {
      add(makeEntry(source, abs, root, 'project'));
    }
  }

  // Global sources (relative paths reported against home).
  if (opts.global) {
    for (const source of GLOBAL_SOURCES) {
      for (const abs of collectFromSource(source, home, 'global')) {
        add(makeEntry(source, abs, home, 'global'));
      }
    }
  }

  // Resolve @imports for sources that support them, seeding `seen` with every
  // primary path so an imported file that is also a primary isn't double-counted.
  const seenForImports = new Set(entries.map((e) => e.path));
  const importEntries = [];
  for (const entry of entries) {
    const source =
      PROJECT_SOURCES.find((s) => s.id === entry.sourceId) ||
      GLOBAL_SOURCES.find((s) => s.id === entry.sourceId);
    if (!source?.supportsImports) continue;
    const base = entry.scope === 'global' ? home : root;
    importEntries.push(...resolveImports(entry, base, home, seenForImports));
  }
  for (const e of importEntries) entries.push(e);

  return sortEntries(entries);
}

function sortEntries(entries) {
  const scopeRank = { project: 0, global: 1 };
  return entries.sort((a, b) => {
    if (scopeRank[a.scope] !== scopeRank[b.scope]) {
      return scopeRank[a.scope] - scopeRank[b.scope];
    }
    if (a.sourceId !== b.sourceId) return a.sourceId.localeCompare(b.sourceId);
    // Keep a parent immediately followed by its imports.
    if (a.imported !== b.imported) return a.imported ? 1 : -1;
    return a.relPath.localeCompare(b.relPath);
  });
}
