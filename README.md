# ctxbudget

> Audit the token cost of everything your AI coding agent auto-loads — before it burns your context window.

[![CI](https://github.com/davidcjw/ctxbudget/actions/workflows/ci.yml/badge.svg)](https://github.com/davidcjw/ctxbudget/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/ctxbudget.svg)](https://www.npmjs.com/package/ctxbudget)
[![license: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![node](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org)
[![zero dependencies](https://img.shields.io/badge/dependencies-0-blue.svg)](package.json)

Every AI coding agent — Claude Code, Cursor, Copilot, Windsurf, Cline — silently injects instruction files into the model's context on **every single turn**: `CLAUDE.md`, `AGENTS.md`, `.cursor/rules`, `copilot-instructions.md`, and friends. That context is your scarcest resource. Bloated, duplicated, or sprawling rule files quietly tax every request — slower, costlier, and more distracted answers — and nobody ever shows you the bill.

**`ctxbudget` is that bill.** Point it at a repo and it finds every agent context file, estimates the token cost of what gets auto-loaded, flags bloat and duplication, and gives you a context-health grade.

<p align="center">
  <img src="docs/demo.gif" alt="ctxbudget terminal report showing per-file token costs, bloat and overlap warnings, and a health grade of D" width="720">
</p>

---

## Contents

- [Why](#why)
- [Install](#install)
- [Usage](#usage)
- [What it scans](#what-it-scans)
- [How the health score works](#how-the-health-score-works)
- [How token estimation works](#how-token-estimation-works)
- [JSON output](#json-output)
- [Use in CI](#use-in-ci)
- [Programmatic API](#programmatic-api)
- [Development](#development)
- [Contributing](#contributing)
- [Code of Conduct](#code-of-conduct)
- [Roadmap](#roadmap)
- [License](#license)

## Why

- **Context is the budget.** Tokens spent on instructions are tokens not spent on your code. A 4,000-token `CLAUDE.md` is ~2% of a 200k window gone before the agent reads a single line of your project.
- **Bloat is invisible.** No tool shows you the running total of what's auto-loaded across `CLAUDE.md` + `AGENTS.md` + Cursor rules + Copilot instructions — including files pulled in via `@import`.
- **Duplication is rampant.** The same "always run the tests / never commit secrets" rules get pasted into three different files. `ctxbudget` measures the overlap.
- **Lean context = better agents.** Smaller, focused instruction files mean faster, cheaper, more on-task responses.

## Install

Run it without installing:

```bash
npx ctxbudget
```

Or install globally:

```bash
npm install -g ctxbudget
```

Requires Node.js >= 18. **Zero runtime dependencies.**

## Usage

```bash
# Scan the current repo
ctxbudget

# Scan another repo
ctxbudget ../my-app

# Include your per-user global config (~/.claude/CLAUDE.md, ~/.claude/rules/*.md, ~/.codex/AGENTS.md)
ctxbudget --global

# Machine-readable output
ctxbudget --json

# Fail CI when context health drops below a B (80)
ctxbudget --fail-under 80
```

### Options

| Option | Description | Default |
| --- | --- | --- |
| `path` | Directory to scan | current directory |
| `-g, --global` | Also include per-user config (`~/.claude/CLAUDE.md`, `~/.claude/rules/*.md`, `~/.codex/AGENTS.md`) | off |
| `-b, --budget <n>` | Context window size (tokens) for the `%` readout | `200000` |
| `-t, --threshold <n>` | Per-file bloat threshold (tokens) | `1800` |
| `--json` | Emit machine-readable JSON | off |
| `--no-color` | Disable ANSI colors (also respects `NO_COLOR`) | colors on TTY |
| `--fail-under <n>` | Exit `1` if the health score is below `n` (for CI) | off |
| `-h, --help` | Show help | |
| `-v, --version` | Show version | |

## What it scans

| Source | Tool | Auto-loaded? |
| --- | --- | --- |
| `CLAUDE.md`, `.claude/CLAUDE.md`, `CLAUDE.local.md` (+ `@imports`) | Claude Code | ✅ every turn |
| `.claude/rules/*.md` | Claude Code | ✅ every turn |
| `AGENTS.md` | AGENTS.md (universal) | ✅ every turn |
| `.cursorrules` | Cursor (legacy) | ✅ every turn |
| `.cursor/rules/*.mdc` | Cursor | ⚙️ conditional |
| `.github/copilot-instructions.md` | GitHub Copilot | ✅ every turn |
| `.windsurfrules`, `.windsurf/rules/*` | Windsurf | ✅ / ⚙️ |
| `.clinerules` (file or dir) | Cline | ✅ every turn |
| `.mcp.json` | MCP servers | ⚙️ tool schemas |

Claude Code auto-loads every `.md` directly in `.claude/rules/` (a flat `rules/*.md` glob, symlinks followed) — at the user level (`~/.claude/rules/`) and project level. With `--global`, ctxbudget also includes `~/.claude/CLAUDE.md`, `~/.claude/rules/*.md`, and `~/.codex/AGENTS.md`.

**`@import` resolution:** Claude Code lets `CLAUDE.md` pull in other files with `@path/to/file` syntax. `ctxbudget` follows those imports (recursively, with cycle protection), counts their tokens, and attributes them to the parent file — so the "hidden" cost of imports shows up in your total.

## How the health score works

The score starts at 100 and deducts for the three things that make agent context expensive:

| Factor | Penalty |
| --- | --- |
| **Budget pressure** — auto-loaded tokens as a share of the window | every 1% over 5% of the window costs 2 points (max 20) |
| **Bloat** — any text file over the threshold | up to 20 points per oversized file, scaled by how far over |
| **Duplication** — overlap between auto-loaded files | up to 15 points, scaled by the worst pair |

| Grade | Score |
| --- | --- |
| **A** | 90–100 |
| **B** | 80–89 |
| **C** | 70–79 |
| **D** | 60–69 |
| **F** | < 60 |

## How token estimation works

`ctxbudget` ships a **dependency-free heuristic estimator**, not a full BPE tokenizer. It bills a run of letters/digits at ~1 token per 4 characters and each standalone punctuation/symbol as its own token. This tracks real Claude/GPT tokenizers within roughly **±15%** on typical instruction files, and runs slightly conservative (a touch high) on punctuation-dense markdown — the safe direction for a budget tool. The numbers are a reliable *relative* signal for comparing and trimming files; treat them as estimates, not invoices.

## JSON output

`--json` emits a stable, content-free object you can pipe into other tools:

```jsonc
{
  "root": "/path/to/repo",
  "budget": 200000,
  "score": 74,
  "grade": "C",
  "totals": {
    "autoLoaded": 3630,
    "conditional": 72,
    "all": 3702,
    "budgetPct": 0.01815
  },
  "autoLoaded": [ { "path": "CLAUDE.md", "tokens": 3484, "imported": false }, ... ],
  "warnings": [ { "kind": "bloat", ... }, { "kind": "overlap", ... } ]
}
```

## Use in CI

Keep your agent context lean over time by failing the build when it bloats:

```yaml
# .github/workflows/context-budget.yml
- run: npx ctxbudget --fail-under 80
```

## Programmatic API

```js
import { run, report } from 'ctxbudget';

const { result } = run({ path: '.', global: true });
console.log(result.grade, result.totals.autoLoaded);

// or get a rendered string directly
console.log(report({ path: '.', json: true }));
```

## Development

```bash
npm install
npm test          # run the vitest suite
npm run test:watch
npm start         # node bin/ctxbudget.js
```

The codebase is small and dependency-free by design — see [AGENTS.md](AGENTS.md) for a map of the modules.

## Contributing

Contributions are welcome! Please open an issue first to discuss what you'd like to change.

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -m 'feat: describe change'`)
4. Push and open a pull request

A few house rules:

- **Keep it zero-dependency.** `vitest` is the only devDependency; please don't add runtime deps.
- Adding support for a new agent file format? Add an entry to `src/sources.js`, a test in `test/discover.test.js`, and a row to the *What it scans* table above.
- Make sure `npm test` passes before submitting a PR.

## Code of Conduct

This project follows the [Contributor Covenant v2.1](https://www.contributor-covenant.org/version/2/1/code_of_conduct/).
By participating you agree to uphold a welcoming, harassment-free environment.

## Roadmap

- [ ] Per-directory breakdown for monorepos (nested `CLAUDE.md` / `AGENTS.md`)
- [ ] Optional real tokenizer backend (opt-in, keeps the default dependency-free)
- [ ] `--diff` mode to compare context budget against a git ref
- [ ] More sources: `.aider.conf.yml`, Zed `.rules`, JetBrains AI rules

Have an idea? [Open an issue](https://github.com/davidcjw/ctxbudget/issues).

## License

[MIT](LICENSE) © David Chong
