const express = require('express');
const bodyParser = require('body-parser');
const sharp = require('sharp');
const axios = require('axios');
const crypto = require('crypto');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const VolcEngineSDK = require('volcengine-sdk');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3003;

app.use(bodyParser.json({ limit: '20mb' }));

// R2 client
const s3Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

app.post('/', async (req, res) => {
  try {
    const { message, password } = req.body;

    // 验证密码
    if (password !== process.env.API_PASSWORD) {
      return res.status(401).json({
        error: '密码错误',
        message: '请提供正确的访问密码',
      });
    }

    // 压缩图片
    const compressedImage = await compressImage(message, 70);
    console.log('原始图片大小:', (message.length / 1024).toFixed(2) + ' KB');
    console.log('压缩后图片大小:', (compressedImage.length / 1024).toFixed(2) + ' KB');

    // 调用火山引擎翻译 API
    const { ApiInfo, ServiceInfo, Credentials, API, Request } = VolcEngineSDK;
    const body = new Request.Body({
      'TargetLanguage': process.env.TARGET_LANGUAGE,
      'Image': compressedImage,
    });
    const credentials = new Credentials(
      process.env.VOLC_ACCESS_KEY,
      process.env.VOLC_SECRET_KEY,
      'translate',
      'cn-north-1'
    );
    const query = new Request.Query({ 'Action': 'TranslateImage', 'Version': '2020-07-01' });
    const header = new Request.Header({ 'Content-Type': 'application/json' });
    const serviceInfo = new ServiceInfo('open.volcengineapi.com', header, credentials);
    const apiInfo = new ApiInfo('POST', '/', query, body);
    const api = API(serviceInfo, apiInfo);
    const axiosResponse = await axios.post(api.url, api.params, api.config);

    const volcData = axiosResponse.data;
    console.log('火山引擎返回:', JSON.stringify(volcData).substring(0, 500));
    if (!volcData.Image) {
      console.error('火山引擎返回异常，缺少 Image 字段');
      return res.status(500).json({ error: '翻译服务返回异常', detail: volcData });
    }
    console.log('翻译后图片大小:', (volcData.Image.length / 1024).toFixed(2) + ' KB');

    // 返回翻译结果（保持向下兼容）
    const resImage = `data:image/jpeg;base64,${volcData.Image}`;
    res.status(200).json({ message: resImage });

    // 以下为异步持久化操作，不阻塞响应
    persistTranslation(message, volcData).catch(err => {
      console.error('持久化失败:', err.message);
    });

  } catch (error) {
    console.error('处理请求时出错:', error);
    res.status(500).json({ error: error.message });
  }
});

// 持久化：上传 R2 → AI 提取 → 通知 Worker
async function persistTranslation(originalBase64, volcData) {
  const translationId = crypto.randomUUID();
  const textBlocks = volcData.TextBlocks || [];

  // 提取文本
  const sourceText = textBlocks.map(b => b.Text).filter(Boolean).join('\n');
  const translatedText = textBlocks.map(b => b.Translation).filter(Boolean).join('\n');
  const sourceLanguage = textBlocks[0]?.DetectedLanguage || 'auto';
  const targetLanguage = process.env.TARGET_LANGUAGE || 'zh';

  // 上传 R2（并行）
  const originalBuffer = Buffer.from(originalBase64, 'base64');
  const translatedBuffer = Buffer.from(volcData.Image, 'base64');

  await Promise.all([
    s3Client.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: `translations/${translationId}/original.jpg`,
      Body: originalBuffer,
      ContentType: 'image/jpeg',
    })),
    s3Client.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: `translations/${translationId}/translated.jpg`,
      Body: translatedBuffer,
      ContentType: 'image/jpeg',
    })),
  ]);

  const r2Public = process.env.R2_PUBLIC_URL.replace(/\/$/, '');
  const originalUrl = `${r2Public}/translations/${translationId}/original.jpg`;
  const translatedUrl = `${r2Public}/translations/${translationId}/translated.jpg`;

  console.log('R2 上传完成:', translationId);

  // AI 提取词汇和语法
  let vocabulary = [];
  let grammar = [];
  if (process.env.OPENROUTER_API_KEY && sourceText) {
    console.log('AI 提取: OPENROUTER_API_KEY 已配置, 模型=%s', process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini');
    try {
      const result = await extractAI(sourceText, translatedText, sourceLanguage, targetLanguage);
      vocabulary = result.vocabulary || [];
      grammar = result.grammar || [];
      console.log('AI 提取完成: %d 词汇, %d 语法', vocabulary.length, grammar.length);
    } catch (err) {
      console.error('AI 提取失败:', err.message);
      if (err.response) {
        console.error('AI 提取 HTTP 状态:', err.response.status);
        console.error('AI 提取响应体:', JSON.stringify(err.response.data).substring(0, 500));
      }
    }
  } else {
    if (!process.env.OPENROUTER_API_KEY) console.warn('AI 提取: OPENROUTER_API_KEY 未配置，跳过');
    if (!sourceText) console.warn('AI 提取: 翻译结果中无文本，跳过');
  }

  // 通知 Worker
  if (process.env.WORKER_API_URL && process.env.WORKER_API_KEY) {
    console.log('Worker 通知: WORKER_API_URL=%s', process.env.WORKER_API_URL);
    try {
      await axios.post(`${process.env.WORKER_API_URL}/api/translations`, {
        id: translationId,
        original_image_url: originalUrl,
        translated_image_url: translatedUrl,
        source_text: sourceText,
        translated_text: translatedText,
        source_language: sourceLanguage,
        target_language: targetLanguage,
        text_blocks_json: JSON.stringify(textBlocks),
        vocabulary,
        grammar,
      }, {
        headers: {
          'Authorization': `Bearer ${process.env.WORKER_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      });
      console.log('Worker 通知完成:', translationId);
    } catch (err) {
      console.error('Worker 通知失败:', err.message);
      if (err.response) {
        console.error('Worker 通知 HTTP 状态:', err.response.status);
        console.error('Worker 通知响应体:', JSON.stringify(err.response.data).substring(0, 500));
      }
    }
  } else {
    if (!process.env.WORKER_API_URL) console.warn('Worker 通知: WORKER_API_URL 未配置，跳过');
    if (!process.env.WORKER_API_KEY) console.warn('Worker 通知: WORKER_API_KEY 未配置，跳过');
  }
}

// AI 提取 — 通过 OpenRouter 调用大模型
async function extractAI(sourceText, translatedText, sourceLang, targetLang) {
  const prompt = `You are a language tutor. Analyze the following translation from ${sourceLang} to ${targetLang}.

Source (${sourceLang}):
${sourceText}

Translation (${targetLang}):
${translatedText}

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
- vocabulary: max 10 items, pick uncommon or valuable words
- grammar: max 5 items, focus on patterns in the source text
- part_of_speech: noun/verb/adjective/adverb/phrase/etc.
- If nothing worth extracting, return empty arrays`;

  const response = await axios.post(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      model: process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      max_tokens: 2000,
    },
    {
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    }
  );

  const content = response.data.choices?.[0]?.message?.content;
  if (!content) throw new Error('AI 返回空内容');

  const parsed = JSON.parse(content);
  return {
    vocabulary: (parsed.vocabulary || []).slice(0, 10),
    grammar: (parsed.grammar || []).slice(0, 5),
  };
}

async function compressImage(base64String, quality) {
  const inputBuffer = Buffer.from(base64String, 'base64');
  const outputBuffer = await sharp(inputBuffer)
    .jpeg({
      quality: quality || 85,
      chromaSubsampling: '4:2:0',
    })
    .resize(1200, 1200, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .normalize()
    .modulate({
      saturation: 0.8,
      brightness: 1.0,
      hue: 0,
    })
    .toBuffer();
  return outputBuffer.toString('base64');
}

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
