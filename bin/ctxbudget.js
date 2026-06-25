#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { run } from '../src/index.js';
import { renderText, toJSON } from '../src/report.js';
import { DEFAULTS } from '../src/analyze.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function pkgVersion() {
  try {
    const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'));
    return pkg.version;
  } catch {
    return '0.0.0';
  }
}

const HELP = `
ctxbudget — audit the token cost of everything your AI agent auto-loads.

USAGE
  ctxbudget [path] [options]

ARGUMENTS
  path                  directory to scan (default: current directory)

OPTIONS
  -g, --global          also include per-user config (~/.claude/CLAUDE.md, ~/.codex/AGENTS.md)
  -b, --budget <n>      context window size in tokens for the % readout (default: ${DEFAULTS.budget})
  -t, --threshold <n>   per-file bloat threshold in tokens (default: ${DEFAULTS.threshold})
      --json            emit machine-readable JSON
      --no-color        disable ANSI colors
      --fail-under <n>  exit 1 if the health score is below n (for CI)
  -h, --help            show this help
  -v, --version         show version

EXAMPLES
  ctxbudget                     scan the current repo
  ctxbudget ../my-app --global  scan a repo plus your global agent config
  ctxbudget --json | jq .score  use the score in a script
  ctxbudget --fail-under 80     fail CI when context health drops below B
`;

function parseArgs(argv) {
  const opts = {
    path: undefined,
    global: false,
    budget: DEFAULTS.budget,
    threshold: DEFAULTS.threshold,
    json: false,
    color: undefined,
    failUnder: undefined,
    help: false,
    version: false,
  };
  const errors = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const needNum = (name) => {
      const v = Number(argv[++i]);
      if (!Number.isFinite(v)) {
        errors.push(`${name} expects a number`);
        return undefined;
      }
      return v;
    };
    switch (arg) {
      case '-g':
      case '--global':
        opts.global = true;
        break;
      case '-b':
      case '--budget':
        opts.budget = needNum('--budget') ?? opts.budget;
        break;
      case '-t':
      case '--threshold':
        opts.threshold = needNum('--threshold') ?? opts.threshold;
        break;
      case '--json':
        opts.json = true;
        break;
      case '--no-color':
        opts.color = false;
        break;
      case '--fail-under':
        opts.failUnder = needNum('--fail-under');
        break;
      case '-h':
      case '--help':
        opts.help = true;
        break;
      case '-v':
      case '--version':
        opts.version = true;
        break;
      default:
        if (arg.startsWith('-')) {
          errors.push(`unknown option: ${arg}`);
        } else if (opts.path === undefined) {
          opts.path = arg;
        } else {
          errors.push(`unexpected argument: ${arg}`);
        }
    }
  }
  return { opts, errors };
}

function main() {
  const { opts, errors } = parseArgs(process.argv.slice(2));

  if (opts.help) {
    process.stdout.write(HELP);
    return 0;
  }
  if (opts.version) {
    process.stdout.write(`${pkgVersion()}\n`);
    return 0;
  }
  if (errors.length) {
    process.stderr.write(`ctxbudget: ${errors.join('; ')}\n`);
    process.stderr.write(`Try 'ctxbudget --help'.\n`);
    return 2;
  }

  // Default color: on for TTY, off otherwise / when NO_COLOR is set.
  const color =
    opts.color !== undefined
      ? opts.color
      : Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;

  let scan;
  try {
    scan = run(opts);
  } catch (err) {
    process.stderr.write(`ctxbudget: ${err.message}\n`);
    return 1;
  }

  if (opts.json) {
    process.stdout.write(`${JSON.stringify(toJSON(scan.result, { root: scan.root }), null, 2)}\n`);
  } else {
    process.stdout.write(`${renderText(scan.result, { root: scan.root, color })}\n`);
  }

  if (opts.failUnder !== undefined && scan.result.score !== null) {
    if (scan.result.score < opts.failUnder) return 1;
  }
  return 0;
}

process.exit(main());
