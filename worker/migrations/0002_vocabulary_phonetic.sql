-- Add phonetic transcription to vocabulary candidates and global words.

ALTER TABLE translation_vocabulary ADD COLUMN phonetic TEXT DEFAULT '';
ALTER TABLE words ADD COLUMN phonetic TEXT DEFAULT '';
