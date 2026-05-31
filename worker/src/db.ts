import type { D1Database } from '@cloudflare/workers-types';
import type {
  CreateTranslationBody,
  VocabInput,
  GrammarInput,
  Translation,
  TranslationDetail,
  Vocabulary,
  GrammarNote,
  PaginatedResponse,
} from './types';

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

  const { results: grammar } = await db
    .prepare('SELECT * FROM grammar_notes WHERE translation_id = ? ORDER BY id ASC')
    .bind(id)
    .all<GrammarNote>();

  return { ...translation, vocabulary, grammar };
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
