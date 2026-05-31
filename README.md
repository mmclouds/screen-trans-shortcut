# Screen Translation Shortcut

基于 iOS 快捷指令和火山引擎图片翻译 API 实现的移动端屏幕翻译工具。

支持翻译历史回顾、AI 自动提取生词和语法点，方便持续提升翻译能力。

## 效果演示

在任何 App 页面，轻击两下手机背面即可翻译屏幕内容：

<img src="images/1.gif" width="300" alt="效果演示">

---

## 项目结构

```
screen-trans-shortcut/
├── server/                   # Express 服务（翻译核心 + R2 上传 + AI 提取）
│   ├── package.json
│   ├── .env.example
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── ImagesTrans.js
│
├── worker/                   # Cloudflare Worker（API + 回顾页面一体）
│   ├── package.json
│   ├── wrangler.toml.example
│   ├── tsconfig.json
│   ├── schema.sql
│   ├── src/
│   │   ├── types.ts
│   │   ├── db.ts             # D1 数据库 CRUD
│   │   └── index.ts          # API 路由
│   └── public/               # 回顾页面（前端）
│       ├── index.html
│       ├── app.js
│       └── style.css
│
└── docs/
    └── DESIGN.md             # 详细设计文档
```

两个子项目**独立部署**，无代码依赖。

---

## 服务端部署

### 前置：Cloudflare 基础设施

部署前需要在 Cloudflare 创建以下资源：

**1. 创建 R2 存储桶**
- 进入 [Cloudflare Dashboard → R2](https://dash.cloudflare.com/)
- 创建 Bucket，名称如 `screen-trans-images`
- **开启 Public Access**（通过 `r2.dev` 域名公开访问）
- 记录 `R2_PUBLIC_URL`（格式 `https://pub-xxx.r2.dev`）
- 生成 R2 API Token（Access Key ID + Secret Access Key），记录 `R2_ENDPOINT`

**2. 创建 D1 数据库**
```bash
cd worker
npx wrangler d1 create screen-trans-db
# 将输出的 database_id 和 database_name 复制备用
```

**3. 执行建表语句**
```bash
cd worker
cp wrangler.toml.example wrangler.toml
# 编辑 wrangler.toml，填入 database_id
npx wrangler d1 execute screen-trans-db --file=schema.sql
```

---

### 一、Server（Express 翻译服务）

#### 本地开发

```bash
cd server

# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env，填入必要的配置

# 3. 启动
node ImagesTrans.js
# Server running on port 3000
```

#### `.env` 环境变量说明

| 变量 | 必填 | 说明 |
|------|------|------|
| `TARGET_LANGUAGE` | 是 | 目标翻译语言，如 `zh`/`en`/`ja`/`ko` |
| `API_PASSWORD` | 是 | iOS 快捷指令访问密码 |
| `VOLC_ACCESS_KEY` | 是 | 火山引擎 Access Key |
| `VOLC_SECRET_KEY` | 是 | 火山引擎 Secret Key |
| `R2_ENDPOINT` | 否 | R2 S3 端点，如 `https://<id>.r2.cloudflarestorage.com` |
| `R2_ACCESS_KEY_ID` | 否 | R2 API Token Access Key |
| `R2_SECRET_ACCESS_KEY` | 否 | R2 API Token Secret |
| `R2_BUCKET` | 否 | R2 存储桶名称 |
| `R2_PUBLIC_URL` | 否 | R2 公开访问地址 |
| `WORKER_API_URL` | 否 | Worker 部署后的 URL |
| `WORKER_API_KEY` | 否 | Worker 共享密钥 |
| `OPENROUTER_API_KEY` | 否 | OpenRouter API Key（AI 词汇提取） |
| `OPENROUTER_MODEL` | 否 | 模型名，默认 `openai/gpt-4o-mini` |

> 未配置 AI/Worker/R2 时，翻译功能正常工作，仅跳过持久化和 AI 提取。

#### 本地测试

```bash
curl -X POST http://localhost:3000 \
  -H "Content-Type: application/json" \
  -d '{"message":"<base64图片>","password":"你的密码"}'
```

#### Docker 部署

```bash
cd server

# Docker Compose（推荐）
cp .env.example .env
# 编辑 .env 填入配置
docker-compose up -d
docker-compose logs -f

# 或直接 docker run
docker run -d \
  --name screen-trans \
  -p 3000:3000 \
  -e TARGET_LANGUAGE=zh \
  -e API_PASSWORD=your_password \
  -e VOLC_ACCESS_KEY=your_access_key \
  -e VOLC_SECRET_KEY=your_secret_key \
  -e R2_ENDPOINT=https://xxx.r2.cloudflarestorage.com \
  -e R2_ACCESS_KEY_ID=xxx \
  -e R2_SECRET_ACCESS_KEY=xxx \
  -e R2_BUCKET=screen-trans-images \
  -e R2_PUBLIC_URL=https://pub-xxx.r2.dev \
  -e WORKER_API_URL=https://screen-trans-api.xxx.workers.dev \
  -e WORKER_API_KEY=xxx \
  -e OPENROUTER_API_KEY=sk-or-v1-xxx \
  mmclouds/screen-trans-shortcut
```

---

### 二、Worker（API + 回顾页面）

#### 本地开发

```bash
cd worker

# 1. 安装依赖
npm install

# 2. 配置
cp wrangler.toml.example wrangler.toml
# 编辑 wrangler.toml：
#   - 填入 database_id
#   - 设置 WORKER_API_KEY

# 3. 执行数据库迁移（首次）
npx wrangler d1 execute screen-trans-db --file=schema.sql --local

# 4. 本地启动（含前端热更新）
npx wrangler dev
# 访问 http://localhost:8787 即可看到回顾页面
```

#### 部署上线

```bash
cd worker

# 1. 设置密钥
npx wrangler secret put WORKER_API_KEY

# 2. 执行数据库迁移（生产环境）
npx wrangler d1 execute screen-trans-db --file=schema.sql --remote

# 3. 部署（API + 前端一起上线）
npx wrangler deploy
# Worker 部署到 https://screen-trans-api.<your-subdomain>.workers.dev
# 直接访问即可看到回顾页面
```

---

## 架构说明

```
iOS 快捷指令
    │  POST /  (base64 图片 + 密码)
    ▼
Express (server/ImagesTrans.js)
    │
    ├─ 火山引擎 API ──→ 翻译图片
    │
    ├─ R2 ──→ 存储原文 + 译文图片（异步，失败不影响翻译）
    │
    ├─ OpenRouter API ──→ AI 提取词汇 + 语法（异步，失败不影响翻译）
    │
    └─ Worker API ──→ 写入 D1 数据库（异步，失败不影响翻译）
                          │
                          ▼
              Worker ──→ /api/* (JSON API)
                     ──→ /*     (回顾页面)
```

- **翻译请求不阻塞**：R2 上传、AI 提取、数据库写入均为异步，翻译图片实时返回
- **Worker 同源托管**：API 和前端部署在同一个 Worker，无 CORS 问题
- **R2 公开访问**：图片存完整 URL，前端 `<img>` 直接加载，无需预签名

## 回顾页面

部署 Worker 后，访问 Worker 地址即可看到翻译回顾页面：

- **列表页**：展示所有翻译历史，带缩略图和时间
- **详情页**：原文/译文图片左右对比，点击放大查看
- **词汇 Tab**：AI 自动提取的生词表，支持手动增删改
- **语法 Tab**：AI 自动提取的语法笔记，支持手动增删改

页面适配移动端，手机上可直接查看。

## 快捷指令配置

### 1. 添加快捷指令

手机访问：https://www.icloud.com/shortcuts/0008eb28503e42c2a187aef8bc94627d

<img src="images/2.png" width="300" alt="快捷指令配置1">
<img src="images/3.png" width="300" alt="快捷指令配置2">

### 2. 修改配置

打开快捷指令，设置服务器的地址和密码。

### 3. 双击触发

<img src="images/4.gif" width="300" alt="配置演示">

### 4. 注意事项

- 以上测试基于 iOS 18.1.1，**老版本快捷指令脚本不支持，需更新到最新版本**
- 快捷指令偶发性图片渲染失败，暂无完美解决方案

## 许可证

MIT License
