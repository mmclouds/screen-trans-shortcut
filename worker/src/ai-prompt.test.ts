import { describe, expect, test } from 'vitest';
import { buildAiExtractionPrompt } from './ai-prompt';

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

  test('asks the model to improve only translated text without changing source text', () => {
    const prompt = buildAiExtractionPrompt({
      source_text: 'Starting balance Ending balance May 1 May 11 May 21',
      translated_text: '起始余额 结束余额 5月1日 5月11日 5月21日',
      source_language: 'en',
      target_language: 'zh',
      translation_id: 'translation-1',
    });

    expect(prompt).toContain('"formatted_translated_text"');
    expect(prompt).not.toContain('"formatted_source_text"');
    expect(prompt).toContain('Improve the Reference translation using Source');
    expect(prompt).toContain('Do not rewrite or format Source');
    expect(prompt).toContain('Do not add facts, remove facts, summarize, or paraphrase');
  });
});
