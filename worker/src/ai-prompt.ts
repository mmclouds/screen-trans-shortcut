import type { AiExtractionMessage } from './types';

export function buildAiExtractionPrompt(message: AiExtractionMessage): string {
  return `You are an English learning assistant. Extract learnable items ONLY from the Source text.

Source language: ${message.source_language}
Target explanation language: ${message.target_language}

Source:
${message.source_text}

Reference translation:
${message.translated_text}

Return ONLY valid JSON with this shape:
{
  "formatted_source_text": "...",
  "formatted_translated_text": "...",
  "vocabulary": [
    { "word": "...", "meaning": "...", "part_of_speech": "...", "context": "..." }
  ],
  "grammar": [
    { "pattern": "...", "explanation": "...", "example": "..." }
  ]
}

Hard rules:
- formatted_source_text MUST be readable ${message.source_language} text reconstructed from Source.
- Format Source into readable source-language text: fix broken line breaks, spacing, and list/table-like layout.
- formatted_source_text MUST preserve the exact meaning, names, numbers, dates, units, and ordering from Source.
- formatted_translated_text MUST be an improved ${message.target_language} translation of Source.
- Improve the Reference translation using Source: fix mistranslations, awkward wording, broken word order, spacing, line breaks, and list/table-like layout.
- Preserve names, numbers, dates, units, and ordering.
- Do not add facts, remove facts, summarize, or paraphrase.
- Extract from Source only. The Reference translation is only for understanding meaning.
- word MUST be copied from Source exactly, or be a phrase/collocation copied from Source.
- Do NOT put translated words in "word". For example, if Source is English and Target is zh, "word" must be English, never Chinese.
- meaning MUST be written in ${message.target_language}.
- part_of_speech MUST be a short English label: noun, verb, adjective, adverb, phrase, idiom, phrasal verb, collocation, etc.
- context MUST be copied or lightly trimmed from Source, and should contain the word/phrase.
- grammar.pattern MUST be copied from Source or described using Source-language terms.
- grammar.explanation MUST be written in ${message.target_language}.
- grammar.example MUST be copied from Source when possible.
- Prefer useful source-language vocabulary, phrases, collocations, idioms, and sentence patterns.
- Return 3-10 vocabulary items when Source has learnable items.
- Return 1-5 grammar items only when Source has useful grammar patterns.
- Return empty arrays when Source is empty, unreadable, mostly numbers, names, dates, UI labels, or too trivial.
- Avoid extracting proper nouns, product names, company names, dates, standalone numbers, and generic UI labels unless they form a useful expression.
- Do not include markdown fences or commentary.`;
}

export function buildSelectedVocabularyPrompt(message: AiExtractionMessage, selectedWords: string[]): string {
  const words = selectedWords.map((word) => `- ${word}`).join('\n');

  return `You are an English learning assistant. Explain selected learnable vocabulary ONLY from the Source text.

Source language: ${message.source_language}
Target explanation language: ${message.target_language}

Source:
${message.source_text}

Reference translation:
${message.translated_text}

Selected source words:
${words}

Return ONLY valid JSON with this shape:
{
  "vocabulary": [
    { "word": "...", "meaning": "...", "part_of_speech": "...", "context": "..." }
  ]
}

Hard rules:
- Extract ONLY the selected source words.
- Do not add vocabulary items that are not in Selected source words.
- word MUST be copied from Source exactly, matching one of the selected source words as closely as possible.
- Do NOT put translated words in "word". For example, if Source is English and Target is zh, "word" must be English, never Chinese.
- meaning MUST be written in ${message.target_language}.
- part_of_speech MUST be a short English label: noun, verb, adjective, adverb, phrase, idiom, phrasal verb, collocation, etc.
- context MUST be copied or lightly trimmed from Source, and should contain the word.
- Return one vocabulary item for each selected source word that appears in Source.
- Return an empty vocabulary array when none of the selected words can be found in Source.
- Do not include grammar, markdown fences, or commentary.`;
}
