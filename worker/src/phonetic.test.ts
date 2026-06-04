import { describe, expect, test } from 'vitest';
import { extractPhoneticAudio, extractPhoneticText, normalizeDictionaryLookupWord } from './phonetic';

describe('normalizeDictionaryLookupWord', () => {
  test('keeps simple English dictionary lookup words', () => {
    expect(normalizeDictionaryLookupWord(' Insight. ')).toBe('insight');
    expect(normalizeDictionaryLookupWord("don't")).toBe("don't");
  });

  test('skips phrases and non-English words', () => {
    expect(normalizeDictionaryLookupWord('burn rate')).toBe('');
    expect(normalizeDictionaryLookupWord('摘要')).toBe('');
  });
});

describe('extractPhoneticText', () => {
  test('uses the first phonetic text available', () => {
    expect(extractPhoneticText([{
      phonetic: '',
      phonetics: [{ audio: 'hello.mp3' }, { text: '/həˈləʊ/' }],
    }])).toBe('/həˈləʊ/');
  });

  test('falls back to top-level phonetic', () => {
    expect(extractPhoneticText([{ phonetic: '/ˈɪnsaɪt/', phonetics: [] }])).toBe('/ˈɪnsaɪt/');
  });
});

describe('extractPhoneticAudio', () => {
  test('uses the first audio URL available', () => {
    expect(extractPhoneticAudio([{
      phonetics: [{ text: '/həˈləʊ/', audio: '' }, { audio: 'https://audio.example/hello.mp3' }],
    }])).toBe('https://audio.example/hello.mp3');
  });
});
