import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import * as db from './db';
import type { AiExtractionMessage, CreateTranslationBody, Familiarity, TextBlock } from './types';

type Env = {
  DB: D1Database;
  IMAGE_BUCKET: R2Bucket;
  IMAGES: ImagesBinding;
  AI_QUEUE: Queue<AiExtractionMessage>;
  ASSETS: Fetcher;
  WORKER_API_KEY: string;
  API_PASSWORD: string;
  TARGET_LANGUAGE: string;
  VOLC_ACCESS_KEY: string;
  VOLC_SECRET_KEY: string;
  R2_PUBLIC_URL: string;
  OPENROUTER_API_KEY?: string;
  OPENROUTER_MODEL?: string;
};

const app = new Hono<{ Bindings: Env }>();

app.notFound((c) => c.env.ASSETS.fetch(c.req.raw));

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

// ========== 截图翻译 ==========

const translateSchema = z.object({
  message: z.string().min(1),
  password: z.string().min(1),
});

app.post('/', zValidator('json', translateSchema), async (c) => handleTranslate(c));
app.post('/api/translate', zValidator('json', translateSchema), async (c) => handleTranslate(c));

async function handleTranslate(c: any) {
  const { message, password } = await c.req.json() as { message: string; password: string };
  if (password !== c.env.API_PASSWORD) {
    return c.json({ error: '密码错误', message: '请提供正确的访问密码' }, 401);
  }

  const compressedImage = await compressImage(c.env.IMAGES, message, 70);
  const volcData = await translateImage(c.env, compressedImage);

  if (!volcData.Image) {
    return c.json({ error: '翻译服务返回异常', detail: volcData }, 500);
  }

  const translationId = crypto.randomUUID();
  const textBlocks = (volcData.TextBlocks || []) as TextBlock[];
  const sourceText = textBlocks.map((b) => b.Text).filter(Boolean).join('\n');
  const translatedText = textBlocks.map((b) => b.Translation).filter(Boolean).join('\n');
  const sourceLanguage = textBlocks[0]?.DetectedLanguage || 'auto';
  const targetLanguage = c.env.TARGET_LANGUAGE || 'zh';
  const r2Public = c.env.R2_PUBLIC_URL.replace(/\/$/, '');
  const originalKey = `translations/${translationId}/original.jpg`;
  const translatedKey = `translations/${translationId}/translated.jpg`;
  const translatedImage = normalizeBase64(volcData.Image);

  await Promise.all([
    c.env.IMAGE_BUCKET.put(originalKey, base64ToArrayBuffer(compressedImage), {
      httpMetadata: { contentType: 'image/jpeg' },
    }),
    c.env.IMAGE_BUCKET.put(translatedKey, base64ToArrayBuffer(translatedImage), {
      httpMetadata: { contentType: 'image/jpeg' },
    }),
    db.createTranslation(c.env.DB, {
      id: translationId,
      original_image_url: `${r2Public}/${originalKey}`,
      translated_image_url: `${r2Public}/${translatedKey}`,
      source_text: sourceText,
      translated_text: translatedText,
      source_language: sourceLanguage,
      target_language: targetLanguage,
      text_blocks_json: JSON.stringify(textBlocks),
      vocabulary: [],
      grammar: [],
    }),
  ]);

  let aiQueue = {
    queued: false,
    reason: 'queued',
  };

  if (!sourceText) {
    aiQueue = { queued: false, reason: 'no_source_text' };
    console.log('AI 队列跳过: 无 source_text', translationId);
  } else if (!c.env.OPENROUTER_API_KEY) {
    aiQueue = { queued: false, reason: 'missing_openrouter_api_key' };
    console.log('AI 队列跳过: OPENROUTER_API_KEY 未配置', translationId);
  } else {
    await c.env.AI_QUEUE.send({
      translation_id: translationId,
      source_text: sourceText,
      translated_text: translatedText,
      source_language: sourceLanguage,
      target_language: targetLanguage,
    });
    aiQueue = { queued: true, reason: 'queued' };
    console.log('AI 队列已投递:', translationId);
  }

  return c.json({ message: `data:image/jpeg;base64,${translatedImage}`, id: translationId, ai_queue: aiQueue });
}

// ========== 翻译记录 ==========

// POST /api/translations — 手动或外部客户端写入翻译 + 词汇 + 语法
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

app.post('/api/translations/:id/ai/retry', auth, async (c) => {
  const id = c.req.param('id');
  const translation = await db.getTranslation(c.env.DB, id);
  if (!translation) return c.json({ error: 'Not found' }, 404);
  if (!translation.source_text) return c.json({ error: 'No source_text to analyze' }, 400);
  if (!c.env.OPENROUTER_API_KEY) return c.json({ error: 'OPENROUTER_API_KEY is not configured' }, 400);

  await c.env.AI_QUEUE.send({
    translation_id: id,
    source_text: translation.source_text,
    translated_text: translation.translated_text,
    source_language: translation.source_language,
    target_language: translation.target_language,
  });

  console.log('AI 队列手动重试已投递:', id);
  return c.json({ success: true, id });
});

// ========== 每日复习 ==========

app.get('/api/days/:date/summary', async (c) => {
  try {
    return c.json(await db.getDaySummary(c.env.DB, c.req.param('date')));
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Invalid date' }, 400);
  }
});

app.get('/api/days/:date/translations', async (c) => {
  try {
    const pendingOnly = c.req.query('pending') === '1';
    return c.json(await db.listDayTranslations(c.env.DB, c.req.param('date'), pendingOnly));
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Invalid date' }, 400);
  }
});

app.get('/api/days/:date/words', async (c) => {
  try {
    return c.json(await db.listDayWords(c.env.DB, c.req.param('date')));
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Invalid date' }, 400);
  }
});

// ========== 候选审核 ==========

const familiaritySchema = z.enum(['unknown', 'learning', 'mastered']);

const updateCandidateSchema = z.object({
  word: z.string().min(1).optional(),
  meaning: z.string().min(1).optional(),
  part_of_speech: z.string().optional(),
  context: z.string().optional(),
});

const acceptCandidateSchema = z.object({
  familiarity: familiaritySchema.default('unknown'),
});

app.put('/api/translation-vocabulary/:id', auth, zValidator('json', updateCandidateSchema), async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  const body = await c.req.json();
  const ok = await db.updateTranslationVocabulary(c.env.DB, id, body);
  if (!ok) return c.json({ error: 'Not found' }, 404);
  return c.json({ success: true });
});

app.post('/api/translation-vocabulary/:id/accept', auth, zValidator('json', acceptCandidateSchema), async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  const body = await c.req.json<{ familiarity: Familiarity }>();
  const word = await db.acceptTranslationVocabulary(c.env.DB, id, body.familiarity);
  if (!word) return c.json({ error: 'Not found' }, 404);
  return c.json(word);
});

app.post('/api/translation-vocabulary/:id/reject', auth, async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  const ok = await db.rejectTranslationVocabulary(c.env.DB, id);
  if (!ok) return c.json({ error: 'Not found' }, 404);
  return c.json({ success: true });
});

app.post('/api/grammar-notes/:id/accept', auth, async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  const ok = await db.acceptGrammarNote(c.env.DB, id);
  if (!ok) return c.json({ error: 'Not found' }, 404);
  return c.json({ success: true });
});

app.post('/api/grammar-notes/:id/reject', auth, async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  const ok = await db.rejectGrammarNote(c.env.DB, id);
  if (!ok) return c.json({ error: 'Not found' }, 404);
  return c.json({ success: true });
});

// ========== 全局单词本 ==========

const updateWordSchema = z.object({
  word: z.string().min(1).optional(),
  meaning: z.string().min(1).optional(),
  part_of_speech: z.string().optional(),
  familiarity: familiaritySchema.optional(),
});

app.get('/api/words', async (c) => {
  const familiarity = c.req.query('familiarity') as Familiarity | undefined;
  return c.json(await db.listWords(c.env.DB, {
    q: c.req.query('q') || undefined,
    familiarity: familiarity && ['unknown', 'learning', 'mastered'].includes(familiarity) ? familiarity : undefined,
    sort: c.req.query('sort') || undefined,
  }));
});

app.get('/api/words/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  const word = await db.getWord(c.env.DB, id);
  if (!word) return c.json({ error: 'Not found' }, 404);
  return c.json(word);
});

app.put('/api/words/:id', auth, zValidator('json', updateWordSchema), async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  const body = await c.req.json();
  const ok = await db.updateWord(c.env.DB, id, body);
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

async function compressImage(images: ImagesBinding, base64: string, quality: number): Promise<string> {
  const input = new Response(normalizeBase64(base64)).body;
  if (!input) throw new Error('图片数据为空');

  const result = await images
    .input(input, { encoding: 'base64' })
    .transform({
      width: 1200,
      height: 1200,
      fit: 'scale-down',
      saturation: 0.8,
      brightness: 1.0,
    })
    .output({ format: 'image/jpeg', quality });

  const response = result.response();
  return arrayBufferToBase64(await response.arrayBuffer());
}

async function translateImage(env: Env, imageBase64: string): Promise<{ Image?: string; TextBlocks?: TextBlock[]; [key: string]: unknown }> {
  const body = JSON.stringify({
    TargetLanguage: env.TARGET_LANGUAGE,
    Image: imageBase64,
  });
  const query = 'Action=TranslateImage&Version=2020-07-01';
  const headers = await signVolcRequest({
    method: 'POST',
    path: '/',
    query,
    body,
    accessKey: env.VOLC_ACCESS_KEY,
    secretKey: env.VOLC_SECRET_KEY,
    service: 'translate',
    region: 'cn-north-1',
  });

  const response = await fetch(`https://open.volcengineapi.com/?${query}`, {
    method: 'POST',
    headers,
    body,
  });

  const data = await response.json<Record<string, unknown>>();
  if (!response.ok) {
    throw new Error(`火山引擎请求失败: ${response.status} ${JSON.stringify(data).slice(0, 300)}`);
  }
  return data;
}

async function extractAI(env: Env, message: AiExtractionMessage) {
  const prompt = `You are a language tutor. Analyze the following translation from ${message.source_language} to ${message.target_language}.

Source (${message.source_language}):
${message.source_text}

Translation (${message.target_language}):
${message.translated_text}

Extract vocabulary and grammar worth learning. Return ONLY valid JSON:
{
  "vocabulary": [
    { "word": "...", "meaning": "...", "part_of_speech": "...", "context": "..." }
  ],
  "grammar": [
    { "pattern": "...", "explanation": "...", "example": "..." }
  ]
}

Rules:
- vocabulary: return 3-10 items when the source text contains learnable words or phrases
- grammar: return 1-5 items when the source text contains useful sentence patterns
- Prefer words, phrases, collocations, idioms, and practical expressions from the source text
- Explain meanings in ${message.target_language}
- part_of_speech: noun/verb/adjective/adverb/phrase/etc.
- Only return empty arrays when the source text is empty, unreadable, or entirely trivial
- Do not include markdown fences or commentary`;

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      max_tokens: 2000,
    }),
  });

  const data = await response.json<any>();
  if (!response.ok) {
    throw new Error(`AI 提取失败: ${response.status} ${JSON.stringify(data).slice(0, 300)}`);
  }

  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('AI 返回空内容');

  const parsed = JSON.parse(content);
  const vocabulary = normalizeAiArray(parsed.vocabulary || parsed.vocab || parsed.words).slice(0, 10);
  const grammar = normalizeAiArray(parsed.grammar || parsed.grammar_notes || parsed.patterns).slice(0, 5);
  console.log('AI 返回解析完成:', message.translation_id, vocabulary.length, grammar.length);

  return {
    vocabulary,
    grammar,
  };
}

function normalizeAiArray(value: unknown): any[] {
  return Array.isArray(value) ? value.filter((item) => item && typeof item === 'object') : [];
}

type VolcSignInput = {
  method: string;
  path: string;
  query: string;
  body: string;
  accessKey: string;
  secretKey: string;
  service: string;
  region: string;
};

async function signVolcRequest(input: VolcSignInput): Promise<Record<string, string>> {
  const xDate = getXDate();
  const xContentSha256 = await sha256Hex(input.body);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Date': xDate,
    'X-Content-Sha256': xContentSha256,
  };
  const signedHeaders = Object.keys(headers).sort().map((key) => key.toLowerCase()).join(';');
  const canonicalHeaders = Object.keys(headers)
    .sort()
    .map((key) => `${key.toLowerCase()}:${headers[key]}\n`)
    .join('');
  const canonicalRequest = [
    input.method,
    input.path,
    input.query,
    canonicalHeaders,
    signedHeaders,
    xContentSha256,
  ].join('\n');
  const credentialScope = `${xDate}/${input.region}/${input.service}/request`;
  const signingString = [
    'HMAC-SHA256',
    xDate,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join('\n');

  const kDate = await hmac(input.secretKey, xDate);
  const kRegion = await hmac(kDate, input.region);
  const kService = await hmac(kRegion, input.service);
  const kSigning = await hmac(kService, 'request');
  const signature = await hmacHex(kSigning, signingString);

  headers.Authorization = [
    `HMAC-SHA256 Credential=${input.accessKey}/${credentialScope}`,
    `SignedHeaders=${signedHeaders}`,
    `Signature=${signature}`,
  ].join(', ');

  return headers;
}

function getXDate(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return [
    now.getUTCFullYear(),
    pad(now.getUTCMonth() + 1),
    pad(now.getUTCDate()),
    'T',
    pad(now.getUTCHours()),
    pad(now.getUTCMinutes()),
    pad(now.getUTCSeconds()),
    'Z',
  ].join('');
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return bufferToHex(digest);
}

async function hmac(key: string | ArrayBuffer, value: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    typeof key === 'string' ? new TextEncoder().encode(key) : key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(value));
}

async function hmacHex(key: ArrayBuffer, value: string): Promise<string> {
  return bufferToHex(await hmac(key, value));
}

function bufferToHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function normalizeBase64(value: string): string {
  const commaIndex = value.indexOf(',');
  return commaIndex >= 0 ? value.slice(commaIndex + 1) : value;
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(normalizeBase64(base64));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

export default {
  fetch: app.fetch,
  async queue(batch: MessageBatch<AiExtractionMessage>, env: Env) {
    console.log('AI 队列消费批次:', batch.messages.length);
    await Promise.all(batch.messages.map(async (message) => {
      try {
        if (!env.OPENROUTER_API_KEY || !message.body.source_text) {
          console.log('AI 队列消息跳过:', message.body.translation_id);
          message.ack();
          return;
        }
        const result = await extractAI(env, message.body);
        await db.saveAiExtractionCandidates(env.DB, message.body.translation_id, result.vocabulary, result.grammar);
        console.log('AI 队列消息完成:', message.body.translation_id, result.vocabulary.length, result.grammar.length);
        message.ack();
      } catch (error) {
        console.error('AI 队列处理失败:', error);
        message.retry({ delaySeconds: 60 });
      }
    }));
  },
} satisfies ExportedHandler<Env, AiExtractionMessage>;
