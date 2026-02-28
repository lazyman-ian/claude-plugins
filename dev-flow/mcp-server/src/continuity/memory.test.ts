/**
 * Memory module tests — dedup functions
 */

import { extractKeyTerms, tokenOverlap } from './memory';

describe('extractKeyTerms', () => {
  it('removes stop words', () => {
    const terms = extractKeyTerms('the quick brown fox is a fast animal');
    expect(terms).not.toContain('the');
    expect(terms).not.toContain('is');
    expect(terms).toContain('quick');
    expect(terms).toContain('brown');
    expect(terms).toContain('fox');
  });

  it('handles empty string', () => {
    expect(extractKeyTerms('')).toEqual([]);
  });

  it('filters short words', () => {
    const terms = extractKeyTerms('go to the big map');
    expect(terms).not.toContain('go');
    expect(terms).not.toContain('to');
    expect(terms).toContain('big');
    expect(terms).toContain('map');
  });

  it('strips punctuation', () => {
    const terms = extractKeyTerms("hello-world! it's a test.");
    expect(terms).toContain('hello');
    expect(terms).toContain('world');
    expect(terms).toContain('test');
  });

  it('lowercases all terms', () => {
    const terms = extractKeyTerms('SwiftUI NavigationStack Concurrency');
    expect(terms).toContain('swiftui');
    expect(terms).toContain('navigationstack');
    expect(terms).toContain('concurrency');
  });
});

describe('tokenOverlap', () => {
  it('returns 1.0 for identical texts', () => {
    expect(tokenOverlap('hello world test', 'hello world test')).toBeCloseTo(1.0);
  });

  it('returns 0.0 for completely different texts', () => {
    expect(tokenOverlap('swift concurrency actors', 'python django templates')).toBeCloseTo(0.0);
  });

  it('handles empty strings', () => {
    expect(tokenOverlap('', 'hello')).toBe(0);
    expect(tokenOverlap('hello', '')).toBe(0);
  });

  it('returns partial overlap', () => {
    const overlap = tokenOverlap('swift async await concurrency', 'swift concurrency mainactor');
    expect(overlap).toBeGreaterThan(0.2);
    expect(overlap).toBeLessThan(0.8);
  });

  it('is symmetric', () => {
    const ab = tokenOverlap('alpha beta gamma', 'beta gamma delta');
    const ba = tokenOverlap('beta gamma delta', 'alpha beta gamma');
    expect(ab).toBeCloseTo(ba);
  });
});
