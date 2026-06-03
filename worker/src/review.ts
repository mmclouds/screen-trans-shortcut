import type { Familiarity, VocabularyStatus } from './types';

const SHANGHAI_UTC_OFFSET_HOURS = 8;

export function normalizeWord(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')
    .replace(/\s+/g, ' ');
}

export function getShanghaiDayRange(date: string): { startUtc: string; endUtc: string } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error('Invalid date format. Expected YYYY-MM-DD.');
  }

  const [year, month, day] = date.split('-').map(Number);
  const localStartAsUtc = Date.UTC(year, month - 1, day, 0, 0, 0);
  const start = new Date(localStartAsUtc - SHANGHAI_UTC_OFFSET_HOURS * 60 * 60 * 1000);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  return {
    startUtc: formatSqlDateTime(start),
    endUtc: formatSqlDateTime(end),
  };
}

export function classifyVocabularyCandidate(
  matchedWord: { id: number; familiarity: Familiarity } | null
): VocabularyStatus {
  return matchedWord?.familiarity === 'mastered' ? 'filtered' : 'pending';
}

function formatSqlDateTime(date: Date): string {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}
