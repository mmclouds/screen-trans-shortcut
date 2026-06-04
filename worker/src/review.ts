import type { DayWord, DayWordOccurrence, Familiarity, VocabularyStatus } from './types';

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

type DayWordRow = {
  id: number;
  normalized_word: string;
  word: string;
  meaning: string;
  phonetic: string;
  part_of_speech: string;
  status: VocabularyStatus;
  matched_word_id: number | null;
  context: string;
  source_text: string;
  translated_text: string;
  original_image_url: string;
  translated_image_url: string;
};

export function groupDayWords(rows: DayWordRow[]): DayWord[] {
  const grouped = new Map<string, DayWord>();

  for (const item of rows) {
    if (item.status === 'rejected') continue;

    const occurrence: DayWordOccurrence = {
      candidate_id: item.id,
      context: item.context,
      source_text: item.source_text,
      translated_text: item.translated_text,
      original_image_url: item.original_image_url,
      translated_image_url: item.translated_image_url,
    };
    const existing = grouped.get(item.normalized_word);

    if (!existing) {
      grouped.set(item.normalized_word, {
        normalized_word: item.normalized_word,
        word: item.word,
        meaning: item.meaning,
        phonetic: item.phonetic || '',
        part_of_speech: item.part_of_speech,
        status: item.status,
        matched_word_id: item.matched_word_id,
        candidate_ids: String(item.id),
        occurrence_count: 1,
        occurrences: [occurrence],
      });
      continue;
    }

    existing.occurrence_count += 1;
    existing.candidate_ids += `,${item.id}`;
    existing.occurrences.push(occurrence);
    if (existing.status !== 'pending' && item.status === 'pending') {
      existing.status = 'pending';
    }
  }

  return [...grouped.values()];
}

function formatSqlDateTime(date: Date): string {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}
