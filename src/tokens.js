/**
 * Lightweight, dependency-free token estimator.
 *
 * This is NOT a real BPE tokenizer — it is a deterministic heuristic that
 * approximates how LLM tokenizers (Claude / GPT family) split English prose and
 * code. The model:
 *   - A run of letters/digits is billed at ~1 token per 4 characters (min 1).
 *     Real BPE merges common subwords roughly every 3–4 chars.
 *   - Every standalone punctuation / symbol char is billed as 1 token, which is
 *     how most tokenizers treat them in dense markdown / JSON / code.
 *
 * It tends to run slightly conservative (a few % high) on punctuation-heavy
 * markdown, which is the safe direction for a *budget* tool: better to nudge
 * someone to trim than to under-report. Expect roughly ±15% vs. a real
 * tokenizer on typical instruction files.
 *
 * @param {string} text
 * @returns {number} estimated token count
 */
export function estimateTokens(text) {
  if (!text) return 0;
  const segments = text.match(/[A-Za-z0-9]+|[^\sA-Za-z0-9]/g);
  if (!segments) return 0;

  let tokens = 0;
  for (const seg of segments) {
    const c = seg.charCodeAt(0);
    const isAlnum =
      (c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122);
    if (isAlnum) {
      tokens += Math.max(1, Math.ceil(seg.length / 4));
    } else {
      tokens += 1;
    }
  }
  return tokens;
}

/**
 * Format a token count with thousands separators, e.g. 1234 -> "1,234".
 * @param {number} n
 * @returns {string}
 */
export function formatTokens(n) {
  return Math.round(n).toLocaleString('en-US');
}

/**
 * Human-friendly budget label, e.g. 200000 -> "200k", 1000000 -> "1M".
 * @param {number} n
 * @returns {string}
 */
export function formatBudget(n) {
  if (n >= 1_000_000) {
    const v = n / 1_000_000;
    return `${Number.isInteger(v) ? v : v.toFixed(1)}M`;
  }
  if (n >= 1_000) {
    const v = n / 1_000;
    return `${Number.isInteger(v) ? v : v.toFixed(1)}k`;
  }
  return String(n);
}
