# AGENTS.md

Guidance for AI coding agents working in this repository.

## What this is

`ctxbudget` is a zero-dependency Node.js CLI that audits the token cost of AI-agent
context files (CLAUDE.md, AGENTS.md, Cursor/Copilot/Windsurf/Cline rules, MCP config)
in a repo, flags bloat/duplication, and scores context health. ESM, Node >= 18.

## Layout

- `bin/ctxbudget.js` — CLI entrypoint: arg parsing, exit codes, stdout/stderr.
- `src/index.js` — public API (`run`, `report`) and re-exports.
- `src/sources.js` — registry of known agent context file locations.
- `src/discover.js` — filesystem discovery + `@import` resolution.
- `src/tokens.js` — heuristic token estimator (no BPE dep).
- `src/analyze.js` — bloat/overlap detection + health scoring.
- `src/report.js` — terminal and JSON renderers.
- `test/` — vitest suite (`*.test.js`) + `helpers.js` (temp-dir fixtures).

## Build / test

```bash
npm install
npm test          # vitest run — must stay green
npm start         # run the CLI locally
```

There is no build step; the published package is the raw `src/` + `bin/`.

## Conventions

- **Zero runtime dependencies.** Do not add any. `vitest` is the only devDependency.
- Pure ESM (`"type": "module"`); use `node:` import prefixes for builtins.
- Token estimation is intentionally a heuristic — keep it deterministic and
  dependency-free. If you change it, update the tests' tolerance bands and the
  README "How token estimation works" section.
- Adding a new agent file format = add an entry to `src/sources.js` and a test
  in `test/discover.test.js`. Update the "What it scans" table in `README.md`.
- Keep output stable: `--json` is a public contract (no file contents leak).

## Definition of done

- `npm test` passes.
- The CLI runs cleanly on a real repo and on an empty dir.
- `README.md` and this file reflect any behavior change.
