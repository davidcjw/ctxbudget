import { describe, it, expect } from 'vitest';
import { estimateTokens, formatTokens, formatBudget } from '../src/index.js';

describe('estimateTokens', () => {
  it('returns 0 for empty / nullish input', () => {
    expect(estimateTokens('')).toBe(0);
    expect(estimateTokens(undefined)).toBe(0);
    expect(estimateTokens(null)).toBe(0);
    expect(estimateTokens('   \n\t  ')).toBe(0);
  });

  it('bills short words as a single token', () => {
    expect(estimateTokens('cat')).toBe(1);
    expect(estimateTokens('hi')).toBe(1);
  });

  it('splits long words roughly every 4 characters', () => {
    expect(estimateTokens('antidisestablishmentarianism')).toBe(7); // 28 chars
    expect(estimateTokens('abcd')).toBe(1);
    expect(estimateTokens('abcde')).toBe(2);
  });

  it('counts punctuation as its own token', () => {
    // "a" + "," + "b" = 3
    expect(estimateTokens('a, b')).toBe(3);
    expect(estimateTokens('{}')).toBe(2);
  });

  it('is monotonic — more text never decreases tokens', () => {
    const a = estimateTokens('hello world');
    const b = estimateTokens('hello world again');
    expect(b).toBeGreaterThan(a);
  });

  it('lands within a sane range for a realistic paragraph', () => {
    const text = `This is a fairly typical sentence you might find in an AGENTS.md file,
    with some punctuation, a list:
    - item one
    - item two
    and a closing thought.`;
    const tokens = estimateTokens(text);
    // ~40 words of prose; a real tokenizer would be ~55-75. We allow a wide band.
    expect(tokens).toBeGreaterThan(40);
    expect(tokens).toBeLessThan(120);
  });
});

describe('formatTokens', () => {
  it('adds thousands separators', () => {
    expect(formatTokens(0)).toBe('0');
    expect(formatTokens(1234)).toBe('1,234');
    expect(formatTokens(1234567)).toBe('1,234,567');
  });
});

describe('formatBudget', () => {
  it('formats k and M', () => {
    expect(formatBudget(200000)).toBe('200k');
    expect(formatBudget(1000000)).toBe('1M');
    expect(formatBudget(1500000)).toBe('1.5M');
    expect(formatBudget(500)).toBe('500');
  });
});
