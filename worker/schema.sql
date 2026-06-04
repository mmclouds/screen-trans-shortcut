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

-- 全局单词本
CREATE TABLE words (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  word TEXT NOT NULL,
  normalized_word TEXT NOT NULL UNIQUE,
  meaning TEXT NOT NULL,
  phonetic TEXT DEFAULT '',
  part_of_speech TEXT DEFAULT '',
  familiarity TEXT NOT NULL DEFAULT 'unknown' CHECK (familiarity IN ('unknown', 'learning', 'mastered')),
  occurrence_count INTEGER NOT NULL DEFAULT 0,
  first_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 翻译级单词候选表
CREATE TABLE translation_vocabulary (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  translation_id TEXT NOT NULL REFERENCES translations(id) ON DELETE CASCADE,
  word TEXT NOT NULL,
  normalized_word TEXT NOT NULL,
  meaning TEXT NOT NULL,
  phonetic TEXT DEFAULT '',
  part_of_speech TEXT DEFAULT '',
  context TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'filtered')),
  matched_word_id INTEGER REFERENCES words(id) ON DELETE SET NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (translation_id, normalized_word)
);

-- 单词来源上下文表
CREATE TABLE word_occurrences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  word_id INTEGER NOT NULL REFERENCES words(id) ON DELETE CASCADE,
  translation_id TEXT NOT NULL REFERENCES translations(id) ON DELETE CASCADE,
  translation_vocab_id INTEGER NOT NULL REFERENCES translation_vocabulary(id) ON DELETE CASCADE,
  context TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (word_id, translation_vocab_id)
);

-- 语法笔记表
CREATE TABLE grammar_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  translation_id TEXT NOT NULL REFERENCES translations(id) ON DELETE CASCADE,
  pattern TEXT NOT NULL,
  explanation TEXT NOT NULL,
  example TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'accepted' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 索引
CREATE INDEX idx_translations_created_at ON translations(created_at DESC);
CREATE INDEX idx_vocabulary_translation_id ON vocabulary(translation_id);
CREATE INDEX idx_translation_vocabulary_translation_id ON translation_vocabulary(translation_id);
CREATE INDEX idx_translation_vocabulary_status ON translation_vocabulary(status);
CREATE INDEX idx_translation_vocabulary_matched_word_id ON translation_vocabulary(matched_word_id);
CREATE INDEX idx_words_familiarity ON words(familiarity);
CREATE INDEX idx_words_last_seen_at ON words(last_seen_at DESC);
CREATE INDEX idx_word_occurrences_word_id ON word_occurrences(word_id);
CREATE INDEX idx_word_occurrences_translation_id ON word_occurrences(translation_id);
CREATE INDEX idx_grammar_notes_translation_id ON grammar_notes(translation_id);
CREATE INDEX idx_grammar_notes_status ON grammar_notes(status);
