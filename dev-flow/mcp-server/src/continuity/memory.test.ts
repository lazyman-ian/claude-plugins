/**
 * Memory module tests — dedup functions + prune + quality gate + temporal decay
 */

import { extractKeyTerms, tokenOverlap, memoryPrune, qualityCheck } from './memory';

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

describe('qualityCheck', () => {
  it('rejects text that is too short', () => {
    const result = qualityCheck('X');
    expect(result.pass).toBe(false);
    expect(result.reason).toContain('Too short');
  });

  it('rejects empty text', () => {
    const result = qualityCheck('');
    expect(result.pass).toBe(false);
  });

  it('rejects generic descriptions', () => {
    expect(qualityCheck('Significant changes were made to the system').pass).toBe(false);
    expect(qualityCheck('Updated the configuration files').pass).toBe(false);
    expect(qualityCheck('Modified several components in the project').pass).toBe(false);
    expect(qualityCheck('Changed the build process').pass).toBe(false);
    expect(qualityCheck('There were updates to the codebase').pass).toBe(false);
    expect(qualityCheck('Added several new features to the app').pass).toBe(false);
    expect(qualityCheck('Removed several deprecated functions').pass).toBe(false);
    expect(qualityCheck('Made adjustments to the API layer').pass).toBe(false);
  });

  it('rejects pure statistics', () => {
    expect(qualityCheck('5 files changed in this commit').pass).toBe(false);
    expect(qualityCheck('12 insertions and 3 deletions').pass).toBe(false);
    expect(qualityCheck('1 file modified').pass).toBe(false);
  });

  it('rejects repetitive content', () => {
    const repetitive = 'test test test test test test test test test test test test';
    const result = qualityCheck(repetitive);
    expect(result.pass).toBe(false);
    expect(result.reason).toContain('lexical diversity');
  });

  it('accepts valid knowledge', () => {
    expect(qualityCheck('Use guard clauses at function entry to reduce nesting depth').pass).toBe(true);
    expect(qualityCheck('SQLite FTS5 requires content= parameter for external content tables').pass).toBe(true);
  });

  it('accepts short but valid text (>= 20 chars)', () => {
    expect(qualityCheck('Guard clause reduces nesting').pass).toBe(true);
  });

  it('ignores title parameter for now', () => {
    const result = qualityCheck('X', 'Some Title');
    expect(result.pass).toBe(false);
  });
});

describe('memoryPrune', () => {
  it('returns no-database message when DB does not exist', () => {
    const result = memoryPrune(false);
    expect(result.pruned).toBe(0);
    expect(result.promoted).toBe(0);
    expect(result.demoted).toBe(0);
    expect(result.archived).toBe(0);
    expect(result.message).toBeTruthy();
  });

  it('supports dry run mode', () => {
    const result = memoryPrune(true);
    expect(result.pruned).toBeGreaterThanOrEqual(0);
    expect(typeof result.promoted).toBe('number');
    expect(typeof result.demoted).toBe('number');
    expect(typeof result.archived).toBe('number');
    expect(typeof result.message).toBe('string');
  });
});
