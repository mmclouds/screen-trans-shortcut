# 英语复习工作流设计

## 目标

把当前的屏幕翻译工具升级成一个每日英语复习系统。

产品仍然要保留快速屏幕翻译能力，但核心价值要从“翻译一次”转向“把翻译中遇到的内容整理、确认并复习”。第一版优先做好每日复习工作流，同时支持全局单词本。

## 用户体验

应用包含三个主要区域：

1. **Today**
   - 默认入口。
   - 展示某一个选中日期，默认是今天。
   - 支持切换到前一天、后一天或指定日期。
   - 包含两个复习维度：
     - 按翻译：逐条查看当天翻译截图，确认 AI 提取出的单词和语法。
     - 按单词：把当天候选单词按词聚合后复习。

2. **Words**
   - 全局单词本。
   - 展示所有日期、所有翻译中已经确认收录的单词。
   - 支持搜索、熟悉度筛选和来源上下文查看。

3. **History**
   - 保留现有翻译历史能力。
   - 用于浏览全部翻译记录，查看原图和译图。
   - 作为单词和语法的来源追溯入口。

Today 工作流里的日期使用用户本地学习时区，目前按 `Asia/Shanghai` 处理。API 日期参数使用 `YYYY-MM-DD`，后端应按该时区的本地日期边界解释，即使 D1 内部存储的是 UTC 时间。

## Today：按翻译

这是 Today 内的默认工作流。

每条翻译卡片展示：

- 截图缩略图。
- 原文摘要。
- 译文摘要。
- AI 提取的单词候选。
- AI 提取的语法候选。
- 当前翻译的处理状态。

每个单词候选支持这些操作：

- **收录为陌生**：主操作。把单词添加或更新到全局单词本，熟悉度设为 `unknown`。
- **收录为学习中**：把单词添加或更新到全局单词本，熟悉度设为 `learning`。
- **标记为已掌握**：把单词添加或更新到全局单词本，熟悉度设为 `mastered`。
- **不收录**：把当前候选标记为无学习价值，不加入单词本。
- **编辑**：在收录前修正单词、释义、词性和上下文。

AI 提取阶段被过滤掉的已掌握词默认折叠在“已过滤的已掌握词”区域中。这样主审核列表保持干净，同时仍然可以审计 AI 到底过滤了哪些词。

当一条翻译下的所有单词和语法候选都不再是待处理状态时，这条翻译视为已处理。

## Today：按单词

这个视图把选中日期的单词候选按 `normalized_word` 聚合。

它用于在逐条翻译审核之后快速复盘，也可以作为快速处理当天候选词的入口。

每个聚合单词展示：

- 单词。
- 释义。
- 词性。
- 当天出现次数。
- 候选状态。
- 可用的熟悉度操作。

在该视图中修改某个聚合单词的熟悉度时，应作用于选中日期内该 `normalized_word` 下所有仍处于待处理状态的候选。已经人工拒绝的候选不应被批量操作覆盖。

## Words

全局单词本只存放已经确认的学习项。

每个单词条目展示：

- 单词。
- 归一化单词。
- 释义。
- 词性。
- 熟悉度：`unknown`、`learning` 或 `mastered`。
- 首次出现日期。
- 最近出现日期。
- 出现次数。
- 可追溯到翻译记录的来源上下文。

Words 支持：

- 按单词或释义搜索。
- 按熟悉度筛选。
- 按最近出现日期、首次出现日期或出现次数排序。
- 直接更新熟悉度。

## 熟悉度模型

使用三个熟悉度等级：

- `unknown`：陌生，需要经常复习。
- `learning`：有印象，但还需要加强。
- `mastered`：已经掌握，默认从每日 AI 候选主列表中隐藏。

AI 提取必须使用本地熟悉度状态：

- 如果归一化后的提取词匹配到 `mastered` 单词，则创建一个 `filtered` 候选，但不展示在主待处理列表中。
- 如果匹配到 `unknown` 或 `learning` 单词，则创建一个 `pending` 候选，并关联已有单词。
- 如果没有匹配到任何单词，则创建一个 `pending` 候选。

## 数据模型

当前 `vocabulary` 表不应继续作为真正的全局单词本使用。新的模型要把“翻译级候选词”和“已确认的全局单词”拆开。

### `translation_vocabulary`

存储某一条翻译下 AI 提取或人工添加的单词候选。

字段：

- `id`
- `translation_id`
- `word`
- `normalized_word`
- `meaning`
- `part_of_speech`
- `context`
- `status`：`pending`、`accepted`、`rejected` 或 `filtered`
- `matched_word_id`
- `created_at`
- `updated_at`

约束和索引：

- 同一个 `translation_id` 和 `normalized_word` 下只保留一个候选。
- 按 `translation_id` 建索引。
- 按 `status` 建索引。
- 按 `matched_word_id` 建索引。

状态含义：

- `pending`：等待用户审核。
- `accepted`：已确认，并已连接到全局单词。
- `rejected`：人工排除，不进入单词本。
- `filtered`：因为匹配到已掌握的全局单词而被隐藏。

### `words`

存储全局单词本条目。一个 `normalized_word` 应只有一条主记录。

字段：

- `id`
- `word`
- `normalized_word`
- `meaning`
- `part_of_speech`
- `familiarity`：`unknown`、`learning` 或 `mastered`
- `occurrence_count`
- `first_seen_at`
- `last_seen_at`
- `created_at`
- `updated_at`

约束和索引：

- `normalized_word` 唯一。
- 按 `familiarity` 建索引。
- 按 `last_seen_at` 建索引。

### `word_occurrences`

连接全局单词、翻译记录和上下文。

字段：

- `id`
- `word_id`
- `translation_id`
- `translation_vocab_id`
- `context`
- `created_at`

约束和索引：

- 同一个 `word_id` 和 `translation_vocab_id` 下只保留一条出现记录。
- 按 `word_id` 建索引。
- 按 `translation_id` 建索引。

### `grammar_notes`

第一版继续让语法附属于翻译记录。

新增字段：

- `status`：`pending`、`accepted` 或 `rejected`
- `updated_at`

第一版不引入全局语法库。如果后续发现语法复习的需求足够强，再抽象成全局 `grammar_patterns`。

## AI 提取流程

1. 快捷指令把截图发送给 Worker。
2. Worker 翻译截图，并保存翻译记录。
3. Worker 发送 Queue 消息，触发 AI 提取。
4. AI 返回单词候选和语法候选。
5. Worker 对提取词做归一化，并去重同一条翻译内重复的单词。
6. Worker 使用 `normalized_word` 查询 `words`。
7. Worker 写入 `translation_vocabulary`：
   - 没有匹配：写入 `pending`。
   - 匹配到 `unknown` 或 `learning`：写入 `pending`，并设置 `matched_word_id`。
   - 匹配到 `mastered`：写入 `filtered`，并设置 `matched_word_id`。
8. Worker 把语法候选写入 `grammar_notes`，状态设为 `pending`。

AI 不应直接创建全局单词本条目。候选必须由用户确认后才进入全局单词本。

## 审核流程

接受候选时：

1. 如果存在 `matched_word_id`，更新该单词的释义、词性、熟悉度、`last_seen_at` 和 `occurrence_count`。
2. 如果不存在匹配单词，创建新的 `words` 记录。
3. 创建一条 `word_occurrences` 记录。
4. 把候选标记为 `accepted`。

拒绝候选时：

1. 把候选标记为 `rejected`。
2. 不创建也不更新全局单词。

标记候选为已掌握时：

1. 创建或更新全局单词，并把熟悉度设为 `mastered`。
2. 创建一条 `word_occurrences` 记录。
3. 把候选标记为 `accepted`。
4. 后续 AI 再提取到同一个归一化单词时，应自动过滤。

## API 设计

新增每日复习接口：

- `GET /api/days/:date/summary`
- `GET /api/days/:date/translations`
- `GET /api/days/:date/words`

`:date` 是 `YYYY-MM-DD` 格式的本地日期字符串。后端需要把它转换成 UTC 起止时间，再查询 `translations.created_at`。

新增候选审核接口：

- `PUT /api/translation-vocabulary/:id`
- `POST /api/translation-vocabulary/:id/accept`
- `POST /api/translation-vocabulary/:id/reject`
- `POST /api/grammar-notes/:id/accept`
- `POST /api/grammar-notes/:id/reject`

新增全局单词接口：

- `GET /api/words`
- `GET /api/words/:id`
- `PUT /api/words/:id`

现有翻译历史接口继续保留。

## UI 导航

使用克制、内容优先的导航方式，延续当前产品方向。

推荐顶部导航：

- `Today`
- `Words`
- `History`

Today 日期控制：

- 前一天。
- 当前选中日期。
- 后一天。
- 可选日期选择器。

Today 状态控制：

- 只看待处理。
- 查看全部。
- 在每条翻译内展开查看已过滤的已掌握词。

## 数据迁移

针对已有数据：

1. 创建 `translation_vocabulary`、`words` 和 `word_occurrences`。
2. 把现有 `vocabulary` 行迁移到 `translation_vocabulary`，状态设为 `accepted`。
3. 对每一条迁移后的词汇，创建或更新全局 `words` 条目，熟悉度设为 `unknown`。
4. 为每条迁移后的词汇创建 `word_occurrences` 记录。
5. 给 `grammar_notes` 增加 `status` 和 `updated_at`，并把已有行设为 `accepted`。

旧的 `vocabulary` 表可以在迁移期间临时保留，但新的读写都应使用新表。

## 测试

后端测试或手动 API 验证应覆盖：

- AI 提取会为新词创建 `pending` 候选。
- AI 提取会过滤已掌握单词。
- 接受候选会创建或更新全局单词。
- 拒绝候选不会创建全局单词。
- Today summary 能正确统计 `pending`、`accepted`、`rejected` 和 `filtered` 项。
- Words 列表能按熟悉度筛选。

前端验证应覆盖：

- Today 默认打开当前日期。
- 切换日期能加载对应日期数据。
- 按翻译审核操作能更新 UI。
- 按单词聚合能反映多次出现。
- Words 搜索和熟悉度筛选可用。
- History 仍然可以打开翻译详情。

实现验证时不要执行 `npm run build`。构建验证留给用户手动执行。

## 第一版范围

实现方案 B：

- Today 每日复习工作流。
- 翻译级候选审核。
- 日期级单词聚合。
- 全局 Words 单词本。
- 三档熟悉度模型。
- AI 提取时基于本地已掌握词过滤。

第一版明确不做：

- 间隔重复调度。
- 测验模式。
- 全局语法库。
- 多用户支持。
- 复杂统计、连续打卡或游戏化功能。
