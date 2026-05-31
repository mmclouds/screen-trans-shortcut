# 屏幕翻译 - 持久化存储 & 词汇复习系统设计文档

## 概述

当前项目是一个 Express 服务器（`ImagesTrans.js`），接收 iOS 快捷指令发来的截图 base64，调用火山引擎翻译 API，返回翻译后的图片。目前没有任何持久化、前端页面和历史记录。

本次改造新增四个能力：
1. **图片持久化** — 原文和译文图片上传到 Cloudflare R2
2. **数据存储** — 翻译记录、图片映射关系存入 Cloudflare D1
3. **AI 词汇提取** — 每次翻译后通过 OpenRouter 大模型自动提取生词和语法点
4. **回顾页面** — Worker 直接托管前端页面（`[assets]`），一个项目同时提供 API 和静态页面，查看历史、复习词汇语法

---

## 架构

```
iOS 快捷指令
    │
    ▼
Express (server/ImagesTrans.js)  ←── 核心，本次重点修改
    │
    ├─ 1. 火山引擎 API  ──→ 翻译图片（返回 Image + TextBlocks）
    │
    ├─ 2. @aws-sdk/client-s3 ──→ R2（原文.jpg + 译文.jpg）
    │
    ├─ 3. OpenRouter API ──→ AI 提取词汇 + 语法
    │
    └─ 4. POST /api/translations ──→ Cloudflare Worker ──→ D1
                                           │
                                           ├── /api/*  (JSON API)
                                           └── /*       (静态页面)
```

Worker 通过 `[assets]` 配置直接托管 `public/` 目录，前端与 API 同源部署，无需 CORS，无需单独部署 Pages。

### 关键设计决策

**AI 提取放在 Express 而非 Worker**

Cloudflare Worker 免费计划 CPU 时间仅 10ms，付费也仅 30s。OpenRouter API 调用通常 2-10s，在 Worker 里极易超时。改为 Express 直接调用 OpenRouter（Node.js 无超时限制），提取完成后把完整数据（翻译 + 词汇 + 语法）一次性 POST 给 Worker 写入 D1。Worker 变成纯粹的 D1 API 层。

**Express 直接上传 R2，不走 Worker 中转**

Express 已有图片的 Buffer 数据，直接通过 `@aws-sdk/client-s3` 上传 R2。如果走 Worker 上传，需要传透 base64（比原图大 33%），浪费带宽和时间。

**R2 和 Worker 上传失败不阻塞翻译返回**

翻译图片是核心功能。上传 R2 和通知 Worker 失败时，静默记录日志，仍然返回翻译结果给 iOS 用户。

---

## 数据库设计 (D1)

```sql
-- 翻译记录
CREATE TABLE translations (
  id TEXT PRIMARY KEY,
  original_image_url TEXT NOT NULL,
  translated_image_url TEXT NOT NULL,
  source_text TEXT NOT NULL DEFAULT '',
  translated_text TEXT NOT NULL DEFAULT '',
  source_language TEXT DEFAULT 'auto',
  target_language TEXT NOT NULL DEFAULT 'zh',
  text_blocks_json TEXT DEFAULT '[]',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 词汇
CREATE TABLE vocabulary (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  translation_id TEXT NOT NULL REFERENCES translations(id) ON DELETE CASCADE,
  word TEXT NOT NULL,
  meaning TEXT NOT NULL,
  part_of_speech TEXT DEFAULT '',
  context TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 语法笔记
CREATE TABLE grammar_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  translation_id TEXT NOT NULL REFERENCES translations(id) ON DELETE CASCADE,
  pattern TEXT NOT NULL,
  explanation TEXT NOT NULL,
  example TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## Express 改造 (server/ImagesTrans.js)

### 新增流程

在火山引擎 API 返回后，新增以下处理（均在 try/catch 包裹内，失败不影响主流程）：

1. **提取 TextBlocks** — 从 API 返回的 `TextBlocks` 数组提取每块的 `Text`、`Translation`、`DetectedLanguage`
2. **生成 UUID** — `crypto.randomUUID()` 作为本次翻译 ID
3. **上传 R2** — 并行上传原始图和翻译图到 `translations/{id}/original.jpg` 和 `translated.jpg`。R2 Bucket 开启公开访问，图片路径拼接 `R2_PUBLIC_URL` 即为最终可访问地址（如 `https://pub-xxx.r2.dev/translations/{id}/original.jpg`），无需预签名 URL，前端可直接加载
4. **AI 提取** — 调用 OpenRouter API，传入原文译文，提取词汇和语法（JSON 结构化输出）
5. **通知 Worker** — POST 完整数据到 Worker API

### 新增环境变量

```
R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=xxx
R2_SECRET_ACCESS_KEY=xxx
R2_BUCKET=screen-trans-images
R2_PUBLIC_URL=https://pub-xxx.r2.dev
WORKER_API_URL=https://screen-trans-api.xxx.workers.dev
WORKER_API_KEY=xxx
OPENROUTER_API_KEY=xxx
OPENROUTER_MODEL=openai/gpt-4o-mini
```

### 新增依赖

- `@aws-sdk/client-s3` — R2 上传

---

## Cloudflare Worker API

使用 **Hono** 框架 + **TypeScript**，提供以下接口：

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/translations` | 创建翻译记录 + 批量写词汇/语法 |
| GET | `/api/translations?page=&limit=` | 分页列表（最新在前） |
| GET | `/api/translations/:id` | 详情（含词汇+语法） |
| DELETE | `/api/translations/:id` | 删除翻译及关联数据 |
| POST | `/api/translations/:id/vocabulary` | 添加词汇 |
| PUT | `/api/translations/:id/vocabulary/:vid` | 更新词汇 |
| DELETE | `/api/translations/:id/vocabulary/:vid` | 删除词汇 |
| POST | `/api/translations/:id/grammar` | 添加语法笔记 |
| PUT | `/api/translations/:id/grammar/:gid` | 更新语法笔记 |
| DELETE | `/api/translations/:id/grammar/:gid` | 删除语法笔记 |

- POST/PUT/DELETE 需要 `Authorization: Bearer <WORKER_API_KEY>`
- GET 接口公开（个人工具，Pages 前端直接调用）

---

## AI 提取设计

### 调用方

**Express 端**（非 Worker），通过 OpenRouter API 调用。

### 流程

1. 拿到火山引擎返回的 `TextBlocks`，拼接 `source_text` 和 `translated_text`
2. 构造 Prompt 发给 OpenRouter：

```
你是一位语言导师，请分析以下从 {source_language} 翻译到 {target_language} 的内容。

原文：{source_text}
译文：{translated_text}

请提取有价值的词汇和语法点，返回 JSON：
{
  "vocabulary": [
    { "word": "...", "meaning": "...", "part_of_speech": "...", "context": "..." }
  ],
  "grammar": [
    { "pattern": "...", "explanation": "...", "example": "..." }
  ]
}

要求：
- vocabulary 最多 10 个，筛选不常见或有学习价值的词汇
- grammar 最多 5 条，关注原文中的语法结构
- 如果原文为空或无提取价值，返回空数组
```

3. 解析 JSON 响应，校验后随翻译记录一起 POST 给 Worker

### 容错

- OpenRouter 调用失败时静默跳过，不影响翻译图片返回
- AI 返回格式异常时，记录日志，词汇/语法留空
- 用户可在前端手动添加

---

## 前端页面设计

### 技术栈

- 原生 HTML/CSS/JS，零构建
- Pico.css v2（CDN），响应式语义化样式
- Hash-router SPA

### 移动端优化

- `<meta name="viewport" content="width=device-width, initial-scale=1">`
- 图片对比：桌面 `grid: 1fr 1fr` 左右并排，移动端上下堆叠
- 所有可点击元素 ≥ 44px（触控友好）
- 输入框 `font-size: 16px`（防止 iOS 自动缩放）
- Modal 在移动端全屏显示
- 词汇表在移动端用卡片布局替代传统表格

### 页面路由

| Hash | 视图 | 内容 |
|------|------|------|
| `#/` | 翻译列表 | 卡片列表，缩略图 + 原文片段 + 时间，分页加载 |
| `#/translation/:id` | 翻译详情 | 图片对比 + 文本展示 + 词汇/语法 Tab + 增删改表单 |

### 详情页布局

```
┌──────────────────────────────┐
│  ← Back to list             │
├────────────┬─────────────────┤
│  Original  │  Translated     │  ← 桌面端左右，移动端上下
│  [图片]     │  [图片]         │
├────────────┴─────────────────┤
│  原文: xxx    │  译文: xxx    │
├──────────────────────────────┤
│  [Vocabulary] [Grammar]      │  ← Tab
├──────────────────────────────┤
│  word | meaning | 操作       │
│  ...                        │
│  [+ Add]                    │
└──────────────────────────────┘
```

### 点击图片 lightbox

点击任意图片全屏查看，再次点击关闭，移动端支持双指缩放。

---

## 安全

| 关注点 | 措施 |
|--------|------|
| Express 接口 | 已有 password 验证 |
| Worker 写操作 | Bearer token (`WORKER_API_KEY`) |
| Worker 读操作 | 公开（个人工具） |
| OpenRouter Key | Express `.env`，不对外 |
| R2 凭证 | Express `.env`，不对外 |
| CORS | Worker 仅允许 Pages 域名 |
| XSS | `textContent` 渲染内容 |
| SQL 注入 | D1 prepared statements |

---

## 文件清单

项目拆分为三个独立子项目：

### server/（Express 服务）
- `server/package.json` — 依赖 express, sharp, axios, @aws-sdk/client-s3, volcengine-sdk
- `server/.env.example` — 环境变量模板
- `server/Dockerfile` — Docker 构建
- `server/docker-compose.yml` — Docker Compose 编排
- `server/ImagesTrans.js` — 核心服务（翻译 + R2 上传 + OpenRouter AI + Worker 通知）

### worker/（Cloudflare Worker）
- `worker/schema.sql` — D1 建表语句
- `worker/package.json` — 依赖 hono, zod, @hono/zod-validator
- `worker/wrangler.toml` — Worker 配置 + D1 绑定 + assets
- `worker/wrangler.toml.example` — 配置模板（不含敏感值）
- `worker/tsconfig.json` — TypeScript 配置
- `worker/src/types.ts` — 类型定义
- `worker/src/db.ts` — D1 CRUD
- `worker/src/index.ts` — Hono 路由 + `/api/config`
- `worker/public/index.html` — 前端入口
- `worker/public/app.js` — Hash-router SPA
- `worker/public/style.css` — 响应式样式（移动端优先）

---

## 实现步骤

| 阶段 | 内容 |
|------|------|
| 1 | `schema.sql` + Worker 项目初始化 |
| 2 | Worker API 实现（Hono + D1 CRUD） |
| 3 | 前端页面（响应式 + 移动端优化） |
| 4 | Express 改造（R2 + OpenRouter + Worker 调用） |
| 5 | 配置文件更新（`.env.example` / Docker） |
| 6 | 集成测试 |

## 验证

1. `curl` 测试 Worker 各接口
2. 发送翻译请求到 Express，验证 R2 文件存在、D1 记录写入、词汇语法自动生成
3. 手机端和桌面端分别打开 Pages 地址，验证列表/详情/增删改查功能正常
