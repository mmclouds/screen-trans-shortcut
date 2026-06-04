import { describe, expect, test } from 'vitest';
// @ts-expect-error Vitest/Vite supports raw asset imports for fixture-style browser scripts.
import reviewStateSource from '../public/review-state.js?raw';

type ReviewStateApi = {
  partitionCandidates: <T extends { status?: string }>(items: T[]) => {
    active: T[];
    rejected: T[];
    filtered: T[];
  };
  applyReviewStatus: <T extends { candidates: any[]; grammar: any[] }>(
    translations: T[],
    kind: 'candidate' | 'grammar',
    id: number,
    status: string
  ) => T[];
  countPending: (translation: { candidates: { status?: string }[]; grammar: { status?: string }[] }) => number;
  removeById: <T extends { id: number }>(items: T[], id: number) => T[];
  removeByIds: <T extends { id: number }>(items: T[], ids: number[]) => T[];
};

function loadReviewState(): ReviewStateApi {
  const context = {};
  new Function('globalThis', reviewStateSource)(context);
  return (context as { ReviewState: ReviewStateApi }).ReviewState;
}

describe('ReviewState', () => {
  const state = loadReviewState();

  test('partitions visible, rejected, and filtered candidates', () => {
    const items = [
      { id: 1, status: 'pending' },
      { id: 2, status: 'rejected' },
      { id: 3, status: 'filtered' },
      { id: 4, status: 'accepted' },
    ];

    expect(state.partitionCandidates(items)).toEqual({
      active: [{ id: 1, status: 'pending' }, { id: 4, status: 'accepted' }],
      rejected: [{ id: 2, status: 'rejected' }],
      filtered: [{ id: 3, status: 'filtered' }],
    });
  });

  test('updates only the targeted candidate status', () => {
    const translations = [{
      id: 'translation-1',
      candidates: [{ id: 10, status: 'pending' }, { id: 11, status: 'pending' }],
      grammar: [{ id: 20, status: 'pending' }],
    }];

    const next = state.applyReviewStatus(translations, 'candidate', 10, 'rejected');

    expect(next[0].candidates).toEqual([
      { id: 10, status: 'rejected' },
      { id: 11, status: 'pending' },
    ]);
    expect(next[0].grammar).toEqual([{ id: 20, status: 'pending' }]);
    expect(translations[0].candidates[0].status).toBe('pending');
  });

  test('counts pending vocabulary and grammar after local changes', () => {
    const translations = [{
      id: 'translation-1',
      candidates: [{ id: 10, status: 'pending' }],
      grammar: [{ id: 20, status: 'pending' }],
    }];

    const next = state.applyReviewStatus(translations, 'grammar', 20, 'accepted');

    expect(state.countPending(next[0])).toBe(1);
  });

  test('removes a word from a local list by id without mutating the original list', () => {
    const words = [{ id: 1, word: 'insight' }, { id: 2, word: 'clarity' }];

    expect(state.removeById(words, 1)).toEqual([{ id: 2, word: 'clarity' }]);
    expect(words).toEqual([{ id: 1, word: 'insight' }, { id: 2, word: 'clarity' }]);
  });

  test('removes multiple words from a local list by ids', () => {
    const words = [{ id: 1, word: 'insight' }, { id: 2, word: 'clarity' }, { id: 3, word: 'burn' }];

    expect(state.removeByIds(words, [1, 3])).toEqual([{ id: 2, word: 'clarity' }]);
  });
});
