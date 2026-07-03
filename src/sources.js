/**
 * Registry of known AI-agent context / instruction sources.
 *
 * Each source describes where a tool looks for the files it loads into the
 * model's context. A source can declare:
 *   - `candidates`: explicit relative file paths to probe (first match wins per
 *     candidate; all existing candidates are reported).
 *   - `dir` + `exts`: a directory of rule files to walk (recursively). Add
 *     `flat: true` to match only files directly in `dir` (a non-recursive
 *     `dir/*.ext` glob), following symlinks — used for Claude Code `rules/`.
 *
 * `autoLoaded: true` means the tool injects this content on (nearly) every turn,
 * so it counts toward the "always-on" context budget. `autoLoaded: false`
 * sources are present but applied conditionally (e.g. Cursor `.mdc` rules with
 * glob/agent-requested triggers) or are tool schemas rather than prompt text.
 */
export const PROJECT_SOURCES = [
  {
    id: 'claude-md',
    label: 'CLAUDE.md',
    tool: 'Claude Code',
    candidates: ['CLAUDE.md', '.claude/CLAUDE.md', 'CLAUDE.local.md'],
    autoLoaded: true,
    supportsImports: true,
    type: 'instructions',
  },
  {
    id: 'claude-rules',
    label: '.claude/rules',
    tool: 'Claude Code',
    // Claude Code auto-loads every `.md` directly in `.claude/rules/` (a flat
    // `rules/*.md` glob) when settingSources includes "project". It also loads
    // parent dirs' `.claude/rules/`, but — like our CLAUDE.md handling — we scan
    // only the given root, not ancestors.
    dir: '.claude/rules',
    exts: ['.md'],
    flat: true,
    autoLoaded: true,
    type: 'rules',
  },
  {
    id: 'agents-md',
    label: 'AGENTS.md',
    tool: 'AGENTS.md (universal)',
    candidates: ['AGENTS.md'],
    autoLoaded: true,
    type: 'instructions',
  },
  {
    id: 'cursorrules',
    label: '.cursorrules',
    tool: 'Cursor (legacy)',
    candidates: ['.cursorrules'],
    autoLoaded: true,
    type: 'rules',
  },
  {
    id: 'cursor-rules',
    label: '.cursor/rules',
    tool: 'Cursor',
    dir: '.cursor/rules',
    exts: ['.mdc', '.md'],
    autoLoaded: false,
    note: 'applied conditionally per rule metadata',
    type: 'rules',
  },
  {
    id: 'copilot',
    label: '.github/copilot-instructions.md',
    tool: 'GitHub Copilot',
    candidates: ['.github/copilot-instructions.md'],
    autoLoaded: true,
    type: 'instructions',
  },
  {
    id: 'windsurf',
    label: '.windsurfrules',
    tool: 'Windsurf',
    candidates: ['.windsurfrules'],
    autoLoaded: true,
    type: 'rules',
  },
  {
    id: 'windsurf-rules',
    label: '.windsurf/rules',
    tool: 'Windsurf',
    dir: '.windsurf/rules',
    exts: ['.md'],
    autoLoaded: false,
    note: 'applied conditionally per rule metadata',
    type: 'rules',
  },
  {
    id: 'cline',
    label: '.clinerules',
    tool: 'Cline',
    candidates: ['.clinerules'],
    dir: '.clinerules',
    exts: ['.md'],
    autoLoaded: true,
    type: 'rules',
  },
  {
    id: 'mcp',
    label: '.mcp.json',
    tool: 'MCP servers',
    candidates: ['.mcp.json'],
    autoLoaded: false,
    note: 'tool schemas, not prompt text — counts against the tool budget',
    type: 'config',
  },
];

/**
 * Global (per-user) sources, only scanned when `--global` is passed.
 * Paths are resolved against the user's home directory at discovery time.
 */
export const GLOBAL_SOURCES = [
  {
    id: 'claude-md-global',
    label: '~/.claude/CLAUDE.md',
    tool: 'Claude Code',
    candidates: ['.claude/CLAUDE.md'],
    autoLoaded: true,
    supportsImports: true,
    type: 'instructions',
  },
  {
    id: 'claude-rules-global',
    label: '~/.claude/rules',
    tool: 'Claude Code',
    // Auto-loaded when settingSources includes "user" (on by default).
    dir: '.claude/rules',
    exts: ['.md'],
    flat: true,
    autoLoaded: true,
    type: 'rules',
  },
  {
    id: 'codex-global',
    label: '~/.codex/AGENTS.md',
    tool: 'Codex',
    candidates: ['.codex/AGENTS.md'],
    autoLoaded: true,
    type: 'instructions',
  },
];
