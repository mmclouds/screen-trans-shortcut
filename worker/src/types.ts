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

export interface AiExtractionMessage {
  translation_id: string;
  source_text: string;
  translated_text: string;
  source_language: string;
  target_language: string;
}

export interface SelectedVocabularyRequest {
  words: string[];
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

export type VocabularyStatus = 'pending' | 'accepted' | 'rejected' | 'filtered';
export type GrammarStatus = 'pending' | 'accepted' | 'rejected';
export type Familiarity = 'unknown' | 'learning' | 'mastered';

export interface Translation {
  id: string;
  original_image_url: string;
  translated_image_url: string;
  source_text: string;
  formatted_source_text: string;
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

export interface TranslationVocabulary {
  id: number;
  translation_id: string;
  word: string;
  normalized_word: string;
  meaning: string;
  part_of_speech: string;
  context: string;
  status: VocabularyStatus;
  matched_word_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface Word {
  id: number;
  word: string;
  normalized_word: string;
  meaning: string;
  part_of_speech: string;
  familiarity: Familiarity;
  occurrence_count: number;
  first_seen_at: string;
  last_seen_at: string;
  created_at: string;
  updated_at: string;
}

export interface WordOccurrence {
  id: number;
  word_id: number;
  translation_id: string;
  translation_vocab_id: number;
  context: string;
  created_at: string;
  source_text?: string;
  translated_text?: string;
  translated_image_url?: string;
}

export interface WordDetail extends Word {
  occurrences: WordOccurrence[];
}

export interface GrammarNote extends GrammarInput {
  id: number;
  status: GrammarStatus;
  created_at: string;
  updated_at: string;
}

export interface TranslationDetail extends Translation {
  vocabulary: Vocabulary[];
  candidates?: TranslationVocabulary[];
  grammar: GrammarNote[];
}

export interface DaySummary {
  date: string;
  translations: number;
  vocabulary: {
    pending: number;
    accepted: number;
    rejected: number;
    filtered: number;
  };
  grammar: {
    pending: number;
    accepted: number;
    rejected: number;
  };
}

export interface DayTranslation extends Translation {
  candidates: TranslationVocabulary[];
  grammar: GrammarNote[];
}

export interface DayWord {
  normalized_word: string;
  word: string;
  meaning: string;
  part_of_speech: string;
  status: VocabularyStatus;
  matched_word_id: number | null;
  candidate_ids: string;
  occurrence_count: number;
  occurrences: DayWordOccurrence[];
}

export interface DayWordOccurrence {
  candidate_id: number;
  context: string;
  source_text: string;
  translated_text: string;
  original_image_url: string;
  translated_image_url: string;
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
