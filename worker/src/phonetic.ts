type DictionaryEntry = {
  phonetic?: string;
  phonetics?: { text?: string; audio?: string }[];
};

export type Pronunciation = {
  phonetic: string;
  audio: string;
};

export function normalizeDictionaryLookupWord(word: string): string {
  const normalized = word
    .trim()
    .toLowerCase()
    .replace(/^[^a-z]+|[^a-z]+$/g, '');

  if (!/^[a-z][a-z'-]*$/.test(normalized)) return '';
  return normalized;
}

export function extractPhoneticText(entries: DictionaryEntry[]): string {
  for (const entry of entries) {
    const phonetic = entry.phonetics?.find((item) => item.text)?.text;
    if (phonetic) return phonetic;
  }
  return entries.find((entry) => entry.phonetic)?.phonetic || '';
}

export function extractPhoneticAudio(entries: DictionaryEntry[]): string {
  for (const entry of entries) {
    const audio = entry.phonetics?.find((item) => item.audio)?.audio;
    if (audio) return audio;
  }
  return '';
}

export async function fetchPronunciation(word: string): Promise<Pronunciation> {
  const lookupWord = normalizeDictionaryLookupWord(word);
  if (!lookupWord) return { phonetic: '', audio: '' };

  try {
    const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(lookupWord)}`);
    if (!response.ok) return { phonetic: '', audio: '' };
    const data = await response.json<unknown>();
    if (!Array.isArray(data)) return { phonetic: '', audio: '' };
    const entries = data as DictionaryEntry[];
    return {
      phonetic: extractPhoneticText(entries),
      audio: extractPhoneticAudio(entries),
    };
  } catch {
    return { phonetic: '', audio: '' };
  }
}

export async function fetchPhonetic(word: string): Promise<string> {
  return (await fetchPronunciation(word)).phonetic;
}
