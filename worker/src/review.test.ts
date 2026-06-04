import { describe, expect, test } from 'vitest';
import { classifyVocabularyCandidate, getShanghaiDayRange, groupDayWords, normalizeWord } from './review';

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

describe('groupDayWords', () => {
  test('keeps each word occurrence sentence and source image', () => {
    const words = groupDayWords([
      {
        id: 1,
        normalized_word: 'insight',
        word: 'Insight',
        meaning: '洞察',
        phonetic: '/ˈɪnsaɪt/',
        part_of_speech: 'noun',
        status: 'pending',
        matched_word_id: null,
        context: 'This insight matters.',
        source_text: 'This insight matters.',
        translated_text: '这个洞察很重要。',
        original_image_url: 'https://example.com/original-1.jpg',
        translated_image_url: 'https://example.com/translated-1.jpg',
      },
      {
        id: 2,
        normalized_word: 'insight',
        word: 'insights',
        meaning: '见解',
        phonetic: '/ˈɪnsaɪts/',
        part_of_speech: 'noun',
        status: 'accepted',
        matched_word_id: 9,
        context: 'The report has fresh insights.',
        source_text: 'The report has fresh insights.',
        translated_text: '报告有新的见解。',
        original_image_url: 'https://example.com/original-2.jpg',
        translated_image_url: 'https://example.com/translated-2.jpg',
      },
    ]);

    expect(words).toEqual([{
      normalized_word: 'insight',
      word: 'Insight',
      meaning: '洞察',
      phonetic: '/ˈɪnsaɪt/',
      part_of_speech: 'noun',
      status: 'pending',
      matched_word_id: null,
      candidate_ids: '1,2',
      occurrence_count: 2,
      occurrences: [
        {
          candidate_id: 1,
          context: 'This insight matters.',
          source_text: 'This insight matters.',
          translated_text: '这个洞察很重要。',
          original_image_url: 'https://example.com/original-1.jpg',
          translated_image_url: 'https://example.com/translated-1.jpg',
        },
        {
          candidate_id: 2,
          context: 'The report has fresh insights.',
          source_text: 'The report has fresh insights.',
          translated_text: '报告有新的见解。',
          original_image_url: 'https://example.com/original-2.jpg',
          translated_image_url: 'https://example.com/translated-2.jpg',
        },
      ],
    }]);
  });

  test('excludes rejected words from word grouping', () => {
    const words = groupDayWords([
      {
        id: 1,
        normalized_word: 'skip',
        word: 'skip',
        meaning: '跳过',
        phonetic: '/skɪp/',
        part_of_speech: 'verb',
        status: 'rejected',
        matched_word_id: null,
        context: 'Skip this.',
        source_text: 'Skip this.',
        translated_text: '跳过这个。',
        original_image_url: 'https://example.com/original.jpg',
        translated_image_url: 'https://example.com/translated.jpg',
      },
    ]);

    expect(words).toEqual([]);
  });
});
