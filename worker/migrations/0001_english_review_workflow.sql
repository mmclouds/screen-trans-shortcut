-- English review workflow migration for existing D1 databases.

CREATE TABLE IF NOT EXISTS words (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  word TEXT NOT NULL,
  normalized_word TEXT NOT NULL UNIQUE,
  meaning TEXT NOT NULL,
  part_of_speech TEXT DEFAULT '',
  familiarity TEXT NOT NULL DEFAULT 'unknown' CHECK (familiarity IN ('unknown', 'learning', 'mastered')),
  occurrence_count INTEGER NOT NULL DEFAULT 0,
  first_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS translation_vocabulary (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  translation_id TEXT NOT NULL REFERENCES translations(id) ON DELETE CASCADE,
  word TEXT NOT NULL,
  normalized_word TEXT NOT NULL,
  meaning TEXT NOT NULL,
  part_of_speech TEXT DEFAULT '',
  context TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'filtered')),
  matched_word_id INTEGER REFERENCES words(id) ON DELETE SET NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (translation_id, normalized_word)
);

CREATE TABLE IF NOT EXISTS word_occurrences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  word_id INTEGER NOT NULL REFERENCES words(id) ON DELETE CASCADE,
  translation_id TEXT NOT NULL REFERENCES translations(id) ON DELETE CASCADE,
  translation_vocab_id INTEGER NOT NULL REFERENCES translation_vocabulary(id) ON DELETE CASCADE,
  context TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (word_id, translation_vocab_id)
);

ALTER TABLE grammar_notes ADD COLUMN status TEXT NOT NULL DEFAULT 'accepted' CHECK (status IN ('pending', 'accepted', 'rejected'));
ALTER TABLE grammar_notes ADD COLUMN updated_at DATETIME;

INSERT OR IGNORE INTO translation_vocabulary
  (translation_id, word, normalized_word, meaning, part_of_speech, context, status, created_at, updated_at)
SELECT
  translation_id,
  word,
  lower(trim(word)),
  meaning,
  part_of_speech,
  context,
  'accepted',
  created_at,
  CURRENT_TIMESTAMP
FROM vocabulary;

INSERT OR IGNORE INTO words
  (word, normalized_word, meaning, part_of_speech, familiarity, occurrence_count, first_seen_at, last_seen_at, created_at, updated_at)
SELECT
  tv.word,
  tv.normalized_word,
  tv.meaning,
  tv.part_of_speech,
  'unknown',
  0,
  MIN(tv.created_at),
  MAX(tv.created_at),
  MIN(tv.created_at),
  CURRENT_TIMESTAMP
FROM translation_vocabulary tv
GROUP BY tv.normalized_word;

UPDATE translation_vocabulary
SET matched_word_id = (
  SELECT words.id FROM words WHERE words.normalized_word = translation_vocabulary.normalized_word
)
WHERE matched_word_id IS NULL;

INSERT OR IGNORE INTO word_occurrences
  (word_id, translation_id, translation_vocab_id, context, created_at)
SELECT
  matched_word_id,
  translation_id,
  id,
  context,
  created_at
FROM translation_vocabulary
WHERE matched_word_id IS NOT NULL AND status = 'accepted';

UPDATE words
SET occurrence_count = (
  SELECT COUNT(*) FROM word_occurrences WHERE word_occurrences.word_id = words.id
);

UPDATE grammar_notes
SET updated_at = CURRENT_TIMESTAMP
WHERE updated_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_translation_vocabulary_translation_id ON translation_vocabulary(translation_id);
CREATE INDEX IF NOT EXISTS idx_translation_vocabulary_status ON translation_vocabulary(status);
CREATE INDEX IF NOT EXISTS idx_translation_vocabulary_matched_word_id ON translation_vocabulary(matched_word_id);
CREATE INDEX IF NOT EXISTS idx_words_familiarity ON words(familiarity);
CREATE INDEX IF NOT EXISTS idx_words_last_seen_at ON words(last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_word_occurrences_word_id ON word_occurrences(word_id);
CREATE INDEX IF NOT EXISTS idx_word_occurrences_translation_id ON word_occurrences(translation_id);
CREATE INDEX IF NOT EXISTS idx_grammar_notes_status ON grammar_notes(status);
