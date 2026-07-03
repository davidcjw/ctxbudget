#!/usr/bin/env bash
# Build a synthetic project (~/acme-dashboard) with intentionally bloated and
# duplicated agent-context files, so the ctxbudget demo shows real warnings and
# a low health grade. No real data. Reproducible.
#   bash docs/build-demo-fixture.sh && vhs docs/demo.tape
set -euo pipefail

DEMO="$HOME/acme-dashboard"
rm -rf "$DEMO"
mkdir -p "$DEMO/.cursor/rules" "$DEMO/.github"

# Bloated CLAUDE.md (well over the 1800-token per-file threshold).
{
  echo "# ACME Dashboard — Agent Instructions"; echo
  echo "## Project overview"
  for i in $(seq 1 40); do echo "This project is a Next.js 16 analytics dashboard for the ACME sales team. It renders KPI tiles, cohort charts, and a retention heatmap. Data comes from the warehouse via a typed API client. Prefer server components; keep client components small and leaf-level. Follow the existing design tokens and never hardcode colors. ($i)"; done
  echo
  echo "## Coding conventions"
  for i in $(seq 1 30); do echo "Use TypeScript strict mode. Name files in kebab-case. Co-locate tests. Avoid default exports. Keep functions under 40 lines. Write a docstring for every exported symbol. Never introduce a new dependency without justification. ($i)"; done
} > "$DEMO/CLAUDE.md"

# AGENTS.md duplicates a big chunk of CLAUDE.md → overlap/duplication warning.
{
  echo "# ACME Dashboard — Agent Instructions"; echo
  echo "## Coding conventions"
  for i in $(seq 1 30); do echo "Use TypeScript strict mode. Name files in kebab-case. Co-locate tests. Avoid default exports. Keep functions under 40 lines. Write a docstring for every exported symbol. Never introduce a new dependency without justification. ($i)"; done
} > "$DEMO/AGENTS.md"

echo "Prefer Tailwind utility classes. Use the shared Button and Card primitives. Match the spacing scale." > "$DEMO/.cursor/rules/style.md"
echo "When editing API routes, validate input with zod and return typed errors. Never log secrets." > "$DEMO/.github/copilot-instructions.md"

echo "built $DEMO"
