-- 翻译记录表
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

-- 词汇表
CREATE TABLE vocabulary (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  translation_id TEXT NOT NULL REFERENCES translations(id) ON DELETE CASCADE,
  word TEXT NOT NULL,
  meaning TEXT NOT NULL,
  part_of_speech TEXT DEFAULT '',
  context TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 语法笔记表
CREATE TABLE grammar_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  translation_id TEXT NOT NULL REFERENCES translations(id) ON DELETE CASCADE,
  pattern TEXT NOT NULL,
  explanation TEXT NOT NULL,
  example TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 索引
CREATE INDEX idx_translations_created_at ON translations(created_at DESC);
CREATE INDEX idx_vocabulary_translation_id ON vocabulary(translation_id);
CREATE INDEX idx_grammar_notes_translation_id ON grammar_notes(translation_id);
