export interface TextBlock {
  Points: { X: number; Y: number }[];
  DetectedLanguage: string;
  Text: string;
  Translation: string;
  ForeColor?: number[];
  BackColor?: number[];
}

export interface CreateTranslationBody {
  id: string;
  original_image_url: string;
  translated_image_url: string;
  source_text: string;
  translated_text: string;
  source_language: string;
  target_language: string;
  text_blocks_json: string;
  vocabulary?: Omit<VocabInput, 'translation_id'>[];
  grammar?: Omit<GrammarInput, 'translation_id'>[];
}

export interface VocabInput {
  translation_id: string;
  word: string;
  meaning: string;
  part_of_speech: string;
  context: string;
}

export interface GrammarInput {
  translation_id: string;
  pattern: string;
  explanation: string;
  example: string;
}

export interface Translation {
  id: string;
  original_image_url: string;
  translated_image_url: string;
  source_text: string;
  translated_text: string;
  source_language: string;
  target_language: string;
  text_blocks_json: string;
  created_at: string;
}

export interface Vocabulary extends VocabInput {
  id: number;
  created_at: string;
}

export interface GrammarNote extends GrammarInput {
  id: number;
  created_at: string;
}

export interface TranslationDetail extends Translation {
  vocabulary: Vocabulary[];
  grammar: GrammarNote[];
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
