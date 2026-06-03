import type { D1Database } from '@cloudflare/workers-types';
import type {
  CreateTranslationBody,
  VocabInput,
  GrammarInput,
  Translation,
  TranslationDetail,
  Vocabulary,
  GrammarNote,
  DaySummary,
  DayTranslation,
  DayWord,
  Familiarity,
  PaginatedResponse,
  TranslationVocabulary,
  VocabularyStatus,
  Word,
  WordDetail,
  WordOccurrence,
} from './types';
import { classifyVocabularyCandidate, getShanghaiDayRange, normalizeWord } from './review';

// ---------- 翻译记录 ----------

export async function createTranslation(
  db: D1Database,
  body: CreateTranslationBody
): Promise<void> {
  // 使用 batch 一次性写入翻译 + 词汇 + 语法
  const stmts = [
    db.prepare(`INSERT INTO translations
      (id, original_image_url, translated_image_url, source_text, translated_text, source_language, target_language, text_blocks_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(body.id, body.original_image_url, body.translated_image_url, body.source_text, body.translated_text, body.source_language, body.target_language, body.text_blocks_json),
  ];

  if (body.vocabulary?.length) {
    for (const v of body.vocabulary) {
      stmts.push(
        db.prepare(`INSERT INTO vocabulary (translation_id, word, meaning, part_of_speech, context)
          VALUES (?, ?, ?, ?, ?)`)
          .bind(body.id, v.word, v.meaning, v.part_of_speech || '', v.context || '')
      );
    }
  }

  if (body.grammar?.length) {
    for (const g of body.grammar) {
      stmts.push(
        db.prepare(`INSERT INTO grammar_notes (translation_id, pattern, explanation, example)
          VALUES (?, ?, ?, ?)`)
          .bind(body.id, g.pattern, g.explanation, g.example || '')
      );
    }
  }

  await db.batch(stmts);
}

export async function listTranslations(
  db: D1Database,
  page: number,
  limit: number
): Promise<PaginatedResponse<Translation>> {
  const offset = (page - 1) * limit;

  const { total } = await db
    .prepare('SELECT COUNT(*) as total FROM translations')
    .first<{ total: number }>() as { total: number };

  const { results } = await db
    .prepare('SELECT * FROM translations ORDER BY created_at DESC LIMIT ? OFFSET ?')
    .bind(limit, offset)
    .all<Translation>();

  return {
    data: results,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getTranslation(
  db: D1Database,
  id: string
): Promise<TranslationDetail | null> {
  const translation = await db
    .prepare('SELECT * FROM translations WHERE id = ?')
    .bind(id)
    .first<Translation>();

  if (!translation) return null;

  const { results: vocabulary } = await db
    .prepare('SELECT * FROM vocabulary WHERE translation_id = ? ORDER BY id ASC')
    .bind(id)
    .all<Vocabulary>();

  const { results: candidates } = await db
    .prepare('SELECT * FROM translation_vocabulary WHERE translation_id = ? ORDER BY id ASC')
    .bind(id)
    .all<TranslationVocabulary>();

  const { results: grammar } = await db
    .prepare('SELECT * FROM grammar_notes WHERE translation_id = ? ORDER BY id ASC')
    .bind(id)
    .all<GrammarNote>();

  return { ...translation, vocabulary, candidates, grammar };
}

export async function deleteTranslation(
  db: D1Database,
  id: string
): Promise<boolean> {
  const { success } = await db
    .prepare('DELETE FROM translations WHERE id = ?')
    .bind(id)
    .run();
  return success;
}

export async function saveAiExtraction(
  db: D1Database,
  translationId: string,
  vocabulary: Omit<VocabInput, 'translation_id'>[],
  grammar: Omit<GrammarInput, 'translation_id'>[]
): Promise<boolean> {
  const existing = await db
    .prepare(`SELECT
      (SELECT COUNT(*) FROM vocabulary WHERE translation_id = ?) as vocab_count,
      (SELECT COUNT(*) FROM grammar_notes WHERE translation_id = ?) as grammar_count`)
    .bind(translationId, translationId)
    .first<{ vocab_count: number; grammar_count: number }>();

  if (!existing || existing.vocab_count > 0 || existing.grammar_count > 0) {
    return false;
  }

  const stmts = [];

  for (const v of vocabulary) {
    stmts.push(
      db.prepare(`INSERT INTO vocabulary (translation_id, word, meaning, part_of_speech, context)
        VALUES (?, ?, ?, ?, ?)`)
        .bind(translationId, v.word, v.meaning, v.part_of_speech || '', v.context || '')
    );
  }

  for (const g of grammar) {
    stmts.push(
      db.prepare(`INSERT INTO grammar_notes (translation_id, pattern, explanation, example)
        VALUES (?, ?, ?, ?)`)
        .bind(translationId, g.pattern, g.explanation, g.example || '')
    );
  }

  if (stmts.length === 0) return true;
  await db.batch(stmts);
  return true;
}

export async function saveAiExtractionCandidates(
  db: D1Database,
  translationId: string,
  vocabulary: Omit<VocabInput, 'translation_id'>[],
  grammar: Omit<GrammarInput, 'translation_id'>[]
): Promise<void> {
  const stmts = [];
  const seen = new Set<string>();

  for (const v of vocabulary) {
    const normalized = normalizeWord(v.word);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);

    const matchedWord = await db
      .prepare('SELECT id, familiarity FROM words WHERE normalized_word = ?')
      .bind(normalized)
      .first<{ id: number; familiarity: Familiarity }>();
    const status = classifyVocabularyCandidate(matchedWord ?? null);

    stmts.push(
      db.prepare(`INSERT OR IGNORE INTO translation_vocabulary
        (translation_id, word, normalized_word, meaning, part_of_speech, context, status, matched_word_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(
          translationId,
          v.word,
          normalized,
          v.meaning,
          v.part_of_speech || '',
          v.context || '',
          status,
          matchedWord?.id ?? null
        )
    );
  }

  for (const g of grammar) {
    stmts.push(
      db.prepare(`INSERT INTO grammar_notes (translation_id, pattern, explanation, example, status)
        VALUES (?, ?, ?, ?, 'pending')`)
        .bind(translationId, g.pattern, g.explanation, g.example || '')
    );
  }

  if (stmts.length) await db.batch(stmts);
}

export async function listDayTranslations(
  db: D1Database,
  date: string,
  pendingOnly = false
): Promise<DayTranslation[]> {
  const { startUtc, endUtc } = getShanghaiDayRange(date);
  const { results: translations } = await db
    .prepare('SELECT * FROM translations WHERE created_at >= ? AND created_at < ? ORDER BY created_at DESC')
    .bind(startUtc, endUtc)
    .all<Translation>();

  const output: DayTranslation[] = [];
  for (const t of translations) {
    const candidateSql = pendingOnly
      ? `SELECT * FROM translation_vocabulary WHERE translation_id = ? AND status = 'pending' ORDER BY id ASC`
      : 'SELECT * FROM translation_vocabulary WHERE translation_id = ? ORDER BY id ASC';
    const grammarSql = pendingOnly
      ? `SELECT * FROM grammar_notes WHERE translation_id = ? AND status = 'pending' ORDER BY id ASC`
      : 'SELECT * FROM grammar_notes WHERE translation_id = ? ORDER BY id ASC';

    const [{ results: candidates }, { results: grammar }] = await Promise.all([
      db.prepare(candidateSql).bind(t.id).all<TranslationVocabulary>(),
      db.prepare(grammarSql).bind(t.id).all<GrammarNote>(),
    ]);
    output.push({ ...t, candidates, grammar });
  }

  return output;
}

export async function getDaySummary(db: D1Database, date: string): Promise<DaySummary> {
  const { startUtc, endUtc } = getShanghaiDayRange(date);
  const translations = await db
    .prepare('SELECT COUNT(*) as total FROM translations WHERE created_at >= ? AND created_at < ?')
    .bind(startUtc, endUtc)
    .first<{ total: number }>();

  const { results: vocabRows } = await db
    .prepare(`SELECT tv.status, COUNT(*) as total
      FROM translation_vocabulary tv
      JOIN translations t ON t.id = tv.translation_id
      WHERE t.created_at >= ? AND t.created_at < ?
      GROUP BY tv.status`)
    .bind(startUtc, endUtc)
    .all<{ status: VocabularyStatus; total: number }>();

  const { results: grammarRows } = await db
    .prepare(`SELECT g.status, COUNT(*) as total
      FROM grammar_notes g
      JOIN translations t ON t.id = g.translation_id
      WHERE t.created_at >= ? AND t.created_at < ?
      GROUP BY g.status`)
    .bind(startUtc, endUtc)
    .all<{ status: 'pending' | 'accepted' | 'rejected'; total: number }>();

  return {
    date,
    translations: translations?.total ?? 0,
    vocabulary: countStatuses(vocabRows, ['pending', 'accepted', 'rejected', 'filtered']),
    grammar: countStatuses(grammarRows, ['pending', 'accepted', 'rejected']),
  };
}

export async function listDayWords(db: D1Database, date: string): Promise<DayWord[]> {
  const { startUtc, endUtc } = getShanghaiDayRange(date);
  const { results } = await db
    .prepare(`SELECT tv.*
      FROM translation_vocabulary tv
      JOIN translations t ON t.id = tv.translation_id
      WHERE t.created_at >= ? AND t.created_at < ?
      ORDER BY tv.created_at DESC`)
    .bind(startUtc, endUtc)
    .all<TranslationVocabulary>();

  const grouped = new Map<string, DayWord>();
  for (const item of results) {
    const existing = grouped.get(item.normalized_word);
    if (!existing) {
      grouped.set(item.normalized_word, {
        normalized_word: item.normalized_word,
        word: item.word,
        meaning: item.meaning,
        part_of_speech: item.part_of_speech,
        status: item.status,
        matched_word_id: item.matched_word_id,
        candidate_ids: String(item.id),
        occurrence_count: 1,
      });
      continue;
    }
    existing.occurrence_count += 1;
    existing.candidate_ids += `,${item.id}`;
    if (existing.status !== 'pending' && item.status === 'pending') {
      existing.status = 'pending';
    }
  }

  return [...grouped.values()];
}

export async function updateTranslationVocabulary(
  db: D1Database,
  id: number,
  input: Partial<Pick<TranslationVocabulary, 'word' | 'meaning' | 'part_of_speech' | 'context'>>
): Promise<boolean> {
  const fields: string[] = [];
  const values: string[] = [];

  if (input.word !== undefined) {
    fields.push('word = ?', 'normalized_word = ?');
    values.push(input.word, normalizeWord(input.word));
  }
  if (input.meaning !== undefined) { fields.push('meaning = ?'); values.push(input.meaning); }
  if (input.part_of_speech !== undefined) { fields.push('part_of_speech = ?'); values.push(input.part_of_speech); }
  if (input.context !== undefined) { fields.push('context = ?'); values.push(input.context); }
  if (!fields.length) return false;

  fields.push('updated_at = CURRENT_TIMESTAMP');
  const { success } = await db
    .prepare(`UPDATE translation_vocabulary SET ${fields.join(', ')} WHERE id = ?`)
    .bind(...values, id)
    .run();
  return success;
}

export async function acceptTranslationVocabulary(
  db: D1Database,
  id: number,
  familiarity: Familiarity
): Promise<Word | null> {
  const candidate = await db
    .prepare('SELECT * FROM translation_vocabulary WHERE id = ?')
    .bind(id)
    .first<TranslationVocabulary>();
  if (!candidate) return null;

  const normalized = candidate.normalized_word || normalizeWord(candidate.word);
  let word = candidate.matched_word_id
    ? await db.prepare('SELECT * FROM words WHERE id = ?').bind(candidate.matched_word_id).first<Word>()
    : await db.prepare('SELECT * FROM words WHERE normalized_word = ?').bind(normalized).first<Word>();

  if (word) {
    await db.prepare(`UPDATE words SET
        word = ?,
        meaning = ?,
        part_of_speech = ?,
        familiarity = ?,
        occurrence_count = occurrence_count + 1,
        last_seen_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`)
      .bind(candidate.word, candidate.meaning, candidate.part_of_speech || '', familiarity, word.id)
      .run();
  } else {
    await db.prepare(`INSERT INTO words
        (word, normalized_word, meaning, part_of_speech, familiarity, occurrence_count)
        VALUES (?, ?, ?, ?, ?, 1)`)
      .bind(candidate.word, normalized, candidate.meaning, candidate.part_of_speech || '', familiarity)
      .run();
    word = await db.prepare('SELECT * FROM words WHERE normalized_word = ?').bind(normalized).first<Word>();
  }

  if (!word) return null;

  await db.batch([
    db.prepare(`INSERT OR IGNORE INTO word_occurrences
      (word_id, translation_id, translation_vocab_id, context)
      VALUES (?, ?, ?, ?)`)
      .bind(word.id, candidate.translation_id, candidate.id, candidate.context || ''),
    db.prepare(`UPDATE translation_vocabulary
      SET status = 'accepted', matched_word_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`)
      .bind(word.id, candidate.id),
  ]);

  return db.prepare('SELECT * FROM words WHERE id = ?').bind(word.id).first<Word>();
}

export async function rejectTranslationVocabulary(db: D1Database, id: number): Promise<boolean> {
  const { success } = await db
    .prepare(`UPDATE translation_vocabulary SET status = 'rejected', updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .bind(id)
    .run();
  return success;
}

export async function acceptGrammarNote(db: D1Database, id: number): Promise<boolean> {
  const { success } = await db
    .prepare(`UPDATE grammar_notes SET status = 'accepted', updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .bind(id)
    .run();
  return success;
}

export async function rejectGrammarNote(db: D1Database, id: number): Promise<boolean> {
  const { success } = await db
    .prepare(`UPDATE grammar_notes SET status = 'rejected', updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .bind(id)
    .run();
  return success;
}

export async function listWords(
  db: D1Database,
  options: { q?: string; familiarity?: Familiarity; sort?: string }
): Promise<Word[]> {
  const where: string[] = [];
  const values: string[] = [];

  if (options.q) {
    where.push('(word LIKE ? OR meaning LIKE ?)');
    values.push(`%${options.q}%`, `%${options.q}%`);
  }
  if (options.familiarity) {
    where.push('familiarity = ?');
    values.push(options.familiarity);
  }

  const orderBy = options.sort === 'first_seen'
    ? 'first_seen_at DESC'
    : options.sort === 'occurrence'
      ? 'occurrence_count DESC, last_seen_at DESC'
      : 'last_seen_at DESC';

  const sql = `SELECT * FROM words ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY ${orderBy} LIMIT 200`;
  const { results } = await db.prepare(sql).bind(...values).all<Word>();
  return results;
}

export async function getWord(db: D1Database, id: number): Promise<WordDetail | null> {
  const word = await db.prepare('SELECT * FROM words WHERE id = ?').bind(id).first<Word>();
  if (!word) return null;

  const { results: occurrences } = await db
    .prepare(`SELECT wo.*, t.source_text, t.translated_text, t.translated_image_url
      FROM word_occurrences wo
      JOIN translations t ON t.id = wo.translation_id
      WHERE wo.word_id = ?
      ORDER BY wo.created_at DESC
      LIMIT 50`)
    .bind(id)
    .all<WordOccurrence>();

  return { ...word, occurrences };
}

export async function updateWord(
  db: D1Database,
  id: number,
  input: Partial<Pick<Word, 'word' | 'meaning' | 'part_of_speech' | 'familiarity'>>
): Promise<boolean> {
  const fields: string[] = [];
  const values: string[] = [];

  if (input.word !== undefined) {
    fields.push('word = ?', 'normalized_word = ?');
    values.push(input.word, normalizeWord(input.word));
  }
  if (input.meaning !== undefined) { fields.push('meaning = ?'); values.push(input.meaning); }
  if (input.part_of_speech !== undefined) { fields.push('part_of_speech = ?'); values.push(input.part_of_speech); }
  if (input.familiarity !== undefined) { fields.push('familiarity = ?'); values.push(input.familiarity); }
  if (!fields.length) return false;

  fields.push('updated_at = CURRENT_TIMESTAMP');
  const { success } = await db
    .prepare(`UPDATE words SET ${fields.join(', ')} WHERE id = ?`)
    .bind(...values, id)
    .run();
  return success;
}

function countStatuses<T extends string>(rows: { status: T; total: number }[], statuses: T[]): Record<T, number> {
  const output = Object.fromEntries(statuses.map((status) => [status, 0])) as Record<T, number>;
  for (const row of rows) output[row.status] = row.total;
  return output;
}

// ---------- 词汇 ----------

export async function addVocabulary(
  db: D1Database,
  v: VocabInput
): Promise<Vocabulary | null> {
  const { success } = await db
    .prepare(`INSERT INTO vocabulary (translation_id, word, meaning, part_of_speech, context)
      VALUES (?, ?, ?, ?, ?)`)
    .bind(v.translation_id, v.word, v.meaning, v.part_of_speech || '', v.context || '')
    .run();

  if (!success) return null;

  // D1 的 last_insert_rowid 需要通过额外查询获取
  const row = await db
    .prepare('SELECT * FROM vocabulary WHERE translation_id = ? ORDER BY id DESC LIMIT 1')
    .bind(v.translation_id)
    .first<Vocabulary>();

  return row ?? null;
}

export async function updateVocabulary(
  db: D1Database,
  translationId: string,
  vocabId: number,
  v: Partial<VocabInput>
): Promise<boolean> {
  const fields: string[] = [];
  const values: (string | number)[] = [];

  if (v.word !== undefined) { fields.push('word = ?'); values.push(v.word); }
  if (v.meaning !== undefined) { fields.push('meaning = ?'); values.push(v.meaning); }
  if (v.part_of_speech !== undefined) { fields.push('part_of_speech = ?'); values.push(v.part_of_speech); }
  if (v.context !== undefined) { fields.push('context = ?'); values.push(v.context); }

  if (fields.length === 0) return false;

  values.push(vocabId, translationId);
  const { success } = await db
    .prepare(`UPDATE vocabulary SET ${fields.join(', ')} WHERE id = ? AND translation_id = ?`)
    .bind(...values)
    .run();

  return success;
}

export async function deleteVocabulary(
  db: D1Database,
  translationId: string,
  vocabId: number
): Promise<boolean> {
  const { success } = await db
    .prepare('DELETE FROM vocabulary WHERE id = ? AND translation_id = ?')
    .bind(vocabId, translationId)
    .run();
  return success;
}

// ---------- 语法 ----------

export async function addGrammar(
  db: D1Database,
  g: GrammarInput
): Promise<GrammarNote | null> {
  const { success } = await db
    .prepare(`INSERT INTO grammar_notes (translation_id, pattern, explanation, example)
      VALUES (?, ?, ?, ?)`)
    .bind(g.translation_id, g.pattern, g.explanation, g.example || '')
    .run();

  if (!success) return null;

  const row = await db
    .prepare('SELECT * FROM grammar_notes WHERE translation_id = ? ORDER BY id DESC LIMIT 1')
    .bind(g.translation_id)
    .first<GrammarNote>();

  return row ?? null;
}

export async function updateGrammar(
  db: D1Database,
  translationId: string,
  grammarId: number,
  g: Partial<GrammarInput>
): Promise<boolean> {
  const fields: string[] = [];
  const values: (string | number)[] = [];

  if (g.pattern !== undefined) { fields.push('pattern = ?'); values.push(g.pattern); }
  if (g.explanation !== undefined) { fields.push('explanation = ?'); values.push(g.explanation); }
  if (g.example !== undefined) { fields.push('example = ?'); values.push(g.example); }

  if (fields.length === 0) return false;

  values.push(grammarId, translationId);
  const { success } = await db
    .prepare(`UPDATE grammar_notes SET ${fields.join(', ')} WHERE id = ? AND translation_id = ?`)
    .bind(...values)
    .run();

  return success;
}

export async function deleteGrammar(
  db: D1Database,
  translationId: string,
  grammarId: number
): Promise<boolean> {
  const { success } = await db
    .prepare('DELETE FROM grammar_notes WHERE id = ? AND translation_id = ?')
    .bind(grammarId, translationId)
    .run();
  return success;
}
