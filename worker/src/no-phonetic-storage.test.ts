import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

function source(path: string): string {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

describe('phonetic lookup storage boundary', () => {
  test('does not declare phonetic columns in D1 schema or migrations', () => {
    const schema = source('../schema.sql');
    const migrationsUrl = new URL('../migrations/', import.meta.url);
    const migrations = readdirSync(migrationsUrl)
      .filter((name) => name.endsWith('.sql'))
      .map((name) => readFileSync(new URL(name, migrationsUrl), 'utf8'))
      .join('\n');

    expect(schema).not.toMatch(/\bphonetic\b/i);
    expect(migrations).not.toMatch(/ADD COLUMN\s+phonetic/i);
  });

  test('does not write phonetic values through database persistence code', () => {
    const dbSource = source('./db.ts');

    expect(dbSource).not.toContain('phonetic = ?');
    expect(dbSource).not.toMatch(/INSERT[^`]+phonetic/is);
  });
});
