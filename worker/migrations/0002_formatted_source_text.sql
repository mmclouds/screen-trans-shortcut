-- Store AI-formatted source text while preserving the original OCR source_text.

ALTER TABLE translations ADD COLUMN formatted_source_text TEXT NOT NULL DEFAULT '';
