import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import * as db from './db';
import type { CreateTranslationBody } from './types';

const app = new Hono<{ Bindings: { DB: D1Database; WORKER_API_KEY: string } }>();

// ========== 配置 ==========

// 前端同源获取 API Key（用于手工编辑词汇/语法）
app.get('/api/config', async (c) => {
  return c.json({ apiKey: c.env.WORKER_API_KEY });
});

// 鉴权中间件 — 仅写操作需要
function auth(c: any, next: any) {
  const key = c.req.header('Authorization')?.replace('Bearer ', '');
  if (key !== c.env.WORKER_API_KEY) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  return next();
}

// ========== 翻译记录 ==========

// POST /api/translations — Express 一次性写入翻译 + 词汇 + 语法
const createSchema = z.object({
  id: z.string().uuid(),
  original_image_url: z.string().url(),
  translated_image_url: z.string().url(),
  source_text: z.string().default(''),
  translated_text: z.string().default(''),
  source_language: z.string().default('auto'),
  target_language: z.string().default('zh'),
  text_blocks_json: z.string().default('[]'),
  vocabulary: z.array(z.object({
    word: z.string(),
    meaning: z.string(),
    part_of_speech: z.string().optional().default(''),
    context: z.string().optional().default(''),
  })).optional(),
  grammar: z.array(z.object({
    pattern: z.string(),
    explanation: z.string(),
    example: z.string().optional().default(''),
  })).optional(),
});

app.post('/api/translations', auth, zValidator('json', createSchema), async (c) => {
  const body = await c.req.json<CreateTranslationBody>();
  await db.createTranslation(c.env.DB, body);
  return c.json({ id: body.id }, 201);
});

// GET /api/translations — 分页列表
app.get('/api/translations', async (c) => {
  const page = Math.max(1, parseInt(c.req.query('page') || '1'));
  const limit = Math.min(50, Math.max(1, parseInt(c.req.query('limit') || '20')));
  const result = await db.listTranslations(c.env.DB, page, limit);
  return c.json(result);
});

// GET /api/translations/:id — 详情
app.get('/api/translations/:id', async (c) => {
  const id = c.req.param('id');
  const translation = await db.getTranslation(c.env.DB, id);
  if (!translation) return c.json({ error: 'Not found' }, 404);
  return c.json(translation);
});

// DELETE /api/translations/:id
app.delete('/api/translations/:id', auth, async (c) => {
  const id = c.req.param('id');
  const ok = await db.deleteTranslation(c.env.DB, id);
  if (!ok) return c.json({ error: 'Not found' }, 404);
  return c.json({ success: true });
});

// ========== 词汇 ==========

const vocabSchema = z.object({
  word: z.string().min(1),
  meaning: z.string().min(1),
  part_of_speech: z.string().optional().default(''),
  context: z.string().optional().default(''),
});

app.post('/api/translations/:id/vocabulary', auth, zValidator('json', vocabSchema), async (c) => {
  const translationId = c.req.param('id');
  const body = await c.req.json();
  const vocab = await db.addVocabulary(c.env.DB, { translation_id: translationId, ...body });
  if (!vocab) return c.json({ error: 'Translation not found' }, 404);
  return c.json(vocab, 201);
});

app.put('/api/translations/:id/vocabulary/:vid', auth, async (c) => {
  const translationId = c.req.param('id');
  const vocabId = parseInt(c.req.param('vid'));
  const body = await c.req.json();
  const ok = await db.updateVocabulary(c.env.DB, translationId, vocabId, body);
  if (!ok) return c.json({ error: 'Not found' }, 404);
  return c.json({ success: true });
});

app.delete('/api/translations/:id/vocabulary/:vid', auth, async (c) => {
  const translationId = c.req.param('id');
  const vocabId = parseInt(c.req.param('vid'));
  const ok = await db.deleteVocabulary(c.env.DB, translationId, vocabId);
  if (!ok) return c.json({ error: 'Not found' }, 404);
  return c.json({ success: true });
});

// ========== 语法 ==========

const grammarSchema = z.object({
  pattern: z.string().min(1),
  explanation: z.string().min(1),
  example: z.string().optional().default(''),
});

app.post('/api/translations/:id/grammar', auth, zValidator('json', grammarSchema), async (c) => {
  const translationId = c.req.param('id');
  const body = await c.req.json();
  const grammar = await db.addGrammar(c.env.DB, { translation_id: translationId, ...body });
  if (!grammar) return c.json({ error: 'Translation not found' }, 404);
  return c.json(grammar, 201);
});

app.put('/api/translations/:id/grammar/:gid', auth, async (c) => {
  const translationId = c.req.param('id');
  const grammarId = parseInt(c.req.param('gid'));
  const body = await c.req.json();
  const ok = await db.updateGrammar(c.env.DB, translationId, grammarId, body);
  if (!ok) return c.json({ error: 'Not found' }, 404);
  return c.json({ success: true });
});

app.delete('/api/translations/:id/grammar/:gid', auth, async (c) => {
  const translationId = c.req.param('id');
  const grammarId = parseInt(c.req.param('gid'));
  const ok = await db.deleteGrammar(c.env.DB, translationId, grammarId);
  if (!ok) return c.json({ error: 'Not found' }, 404);
  return c.json({ success: true });
});

export default app;
