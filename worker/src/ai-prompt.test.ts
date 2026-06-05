import { describe, expect, test } from 'vitest';
import { buildAiExtractionPrompt, buildSelectedVocabularyPrompt } from './ai-prompt';

describe('buildAiExtractionPrompt', () => {
  test('requires extracted vocabulary fields to come from the source text', () => {
    const prompt = buildAiExtractionPrompt({
      source_text: 'Net burn rate is the average net change.',
      translated_text: '燃烧率是平均净变化。',
      source_language: 'en',
      target_language: 'zh',
      translation_id: 'translation-1',
    });

    expect(prompt).toContain('word MUST be copied from Source');
    expect(prompt).not.toContain('"phonetic"');
    expect(prompt).toContain('Do NOT put translated words in "word"');
    expect(prompt).toContain('meaning MUST be written in zh');
    expect(prompt).toContain('context MUST be copied or lightly trimmed from Source');
  });

  test('asks the model to format source text and improve translated text without changing facts', () => {
    const prompt = buildAiExtractionPrompt({
      source_text: 'Starting balance Ending balance May 1 May 11 May 21',
      translated_text: '起始余额 结束余额 5月1日 5月11日 5月21日',
      source_language: 'en',
      target_language: 'zh',
      translation_id: 'translation-1',
    });

    expect(prompt).toContain('"formatted_source_text"');
    expect(prompt).toContain('"formatted_translated_text"');
    expect(prompt).toContain('Format Source into readable source-language text');
    expect(prompt).toContain('Improve the Reference translation using Source');
    expect(prompt).toContain('Do not add facts, remove facts, summarize, or paraphrase');
  });
});

describe('buildSelectedVocabularyPrompt', () => {
  test('limits extraction to the selected source words', () => {
    const prompt = buildSelectedVocabularyPrompt({
      source_text: "The burn-rate wasn't sustainable, but runway improved.",
      translated_text: '燃烧率不可持续，但跑道期改善了。',
      source_language: 'en',
      target_language: 'zh',
      translation_id: 'translation-1',
    }, ['burn-rate', "wasn't"]);

    expect(prompt).toContain('Selected source words');
    expect(prompt).toContain('burn-rate');
    expect(prompt).toContain("wasn't");
    expect(prompt).toContain('Extract ONLY the selected source words');
    expect(prompt).toContain('Do not add vocabulary items that are not in Selected source words');
    expect(prompt).toContain('meaning MUST be written in zh');
  });
});
