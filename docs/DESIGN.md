# 屏幕翻译 - Worker-only 设计文档

## 概述

当前项目只保留 Cloudflare Worker 实现。Worker 同时负责翻译 API、图片压缩、R2 图片持久化、D1 数据写入、Queue 异步 AI 提取，以及回顾页面托管。

## 架构

```
iOS 快捷指令
    │  POST / 或 /api/translate
    ▼
Cloudflare Worker
    │
    ├─ Images binding ──→ 压缩截图
    ├─ 火山引擎 API ──→ 翻译图片，返回 Image + TextBlocks
    ├─ R2 ──→ 保存原图和译图
    ├─ D1 ──→ 保存翻译记录
    └─ Queue ──→ OpenRouter AI 提取词汇和语法，再写回 D1

Worker Assets
    └─ public/ ──→ 翻译回顾页面
```

Worker 通过 `[assets]` 托管 `public/` 目录，前端与 API 同源，无需单独部署 Pages，也无需 CORS 配置。

## 数据库设计

数据库建表语句维护在 `worker/schema.sql`。

核心表：

- `translations`：翻译记录、图片 URL、原文/译文、语言、TextBlocks JSON。
- `vocabulary`：每条翻译关联的词汇。
- `grammar_notes`：每条翻译关联的语法笔记。

本地调试使用：

```bash
cd worker
npx wrangler d1 execute screen-trans-db --file=schema.sql --local
```

线上迁移使用：

```bash
cd worker
npx wrangler d1 execute screen-trans-db --file=schema.sql --remote
```

## Worker API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/` | iOS 快捷指令翻译入口 |
| POST | `/api/translate` | 翻译入口 |
| GET | `/api/config` | 前端获取写操作 API Key |
| POST | `/api/translations` | 手动或外部客户端写入翻译记录 |
| GET | `/api/translations?page=&limit=` | 分页列表 |
| GET | `/api/translations/:id` | 翻译详情 |
| DELETE | `/api/translations/:id` | 删除翻译及关联数据 |
| POST | `/api/translations/:id/ai/retry` | 重新投递 AI 提取任务 |
| POST | `/api/translations/:id/vocabulary` | 添加词汇 |
| PUT | `/api/translations/:id/vocabulary/:vid` | 更新词汇 |
| DELETE | `/api/translations/:id/vocabulary/:vid` | 删除词汇 |
| POST | `/api/translations/:id/grammar` | 添加语法笔记 |
| PUT | `/api/translations/:id/grammar/:gid` | 更新语法笔记 |
| DELETE | `/api/translations/:id/grammar/:gid` | 删除语法笔记 |

写操作使用 `Authorization: Bearer <WORKER_API_KEY>` 鉴权。翻译接口使用请求体里的 `password` 与 `API_PASSWORD` 校验。

## 翻译流程

1. 接收 base64 截图和访问密码。
2. 使用 Images binding 压缩截图。
3. 调用火山引擎图片翻译接口。
4. 从 `TextBlocks` 提取原文、译文、源语言和目标语言。
5. 生成翻译 ID。
6. 上传原图和译图到 R2：
   - `translations/{id}/original.jpg`
   - `translations/{id}/translated.jpg`
7. 拼接 `R2_PUBLIC_URL` 保存图片公开 URL。
8. 写入 D1。
9. 如果有 `source_text` 且配置了 `OPENROUTER_API_KEY`，投递 Queue。
10. Queue consumer 调用 OpenRouter，保存词汇和语法结果。

## 本地调试

配置文件：

- `worker/wrangler.toml`：资源绑定和非敏感变量。
- `worker/.dev.vars`：本地密钥，不提交。
- `worker/.wrangler/`：Wrangler 本地状态，不提交。

启动：

```bash
cd worker
npm install
npx wrangler d1 execute screen-trans-db --file=schema.sql --local
npm run dev
```

访问：

```text
http://localhost:8787
```

本地 D1、R2、Queue 默认由 Wrangler 模拟。需要验证远程资源时，可以使用指定 binding 的 `remote = true` 或 `npx wrangler dev --remote`，但后者会连接远程资源，可能写入线上数据。

## 前端页面

前端位于 `worker/public/`，使用原生 HTML/CSS/JS 和 Hash Router。

页面：

- `#/`：翻译列表。
- `#/translation/:id`：翻译详情，包含图片对比、原文/译文、词汇和语法 Tab。

## 文件清单

### worker/

- `worker/package.json`：依赖和脚本。
- `worker/wrangler.toml.example`：Wrangler 配置模板。
- `worker/.dev.vars.example`：本地密钥模板。
- `worker/schema.sql`：D1 建表语句。
- `worker/src/index.ts`：Hono 路由、翻译流程、Queue consumer。
- `worker/src/db.ts`：D1 CRUD。
- `worker/src/types.ts`：类型定义。
- `worker/public/index.html`：前端入口。
- `worker/public/app.js`：回顾页面逻辑。
- `worker/public/style.css`：页面样式。

## 安全

| 关注点 | 措施 |
|--------|------|
| 翻译入口 | `API_PASSWORD` 校验 |
| 写操作 | Bearer token (`WORKER_API_KEY`) |
| D1 写入 | prepared statements |
| 前端渲染 | 使用 DOM API/textContent，避免直接拼接不可信 HTML |
| 密钥 | 本地放 `.dev.vars`，线上用 `wrangler secret put` |
