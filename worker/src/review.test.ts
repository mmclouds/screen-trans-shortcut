import { describe, expect, test } from 'vitest';
import { classifyVocabularyCandidate, getShanghaiDayRange, normalizeWord } from './review';

describe('normalizeWord', () => {
  test('lowercases and trims simple words', () => {
    expect(normalizeWord('  Insight. ')).toBe('insight');
  });

  test('keeps inner apostrophes and hyphens', () => {
    expect(normalizeWord('State-of-the-art')).toBe('state-of-the-art');
    expect(normalizeWord("Don't")).toBe("don't");
  });
});

describe('getShanghaiDayRange', () => {
  test('converts local Shanghai day to UTC boundaries', () => {
    expect(getShanghaiDayRange('2026-06-03')).toEqual({
      startUtc: '2026-06-02 16:00:00',
      endUtc: '2026-06-03 16:00:00',
    });
  });
});

describe('classifyVocabularyCandidate', () => {
  test('classifies mastered words as filtered', () => {
    expect(classifyVocabularyCandidate({ id: 1, familiarity: 'mastered' })).toBe('filtered');
  });

  test('classifies unknown words as pending', () => {
    expect(classifyVocabularyCandidate({ id: 1, familiarity: 'unknown' })).toBe('pending');
  });

  test('classifies new words as pending', () => {
    expect(classifyVocabularyCandidate(null)).toBe('pending');
  });
});
