# English Review Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Today daily review workflow, translation-level candidate review, and global Words notebook described in the Chinese design spec.

**Architecture:** Keep the existing Cloudflare Worker + D1 + static frontend architecture. Add focused backend helpers for word normalization, day range calculation, candidate review, and global word notebook reads while preserving the existing translation history endpoints. Update the static frontend router so Today becomes the default entry, with Words and History as sibling sections.

**Tech Stack:** Cloudflare Worker, Hono, D1, R2, Queue, TypeScript, Vitest for unit tests, plain HTML/CSS/JavaScript frontend.

---

### Task 1: Add Test Harness

**Files:**
- Modify: `worker/package.json`
- Create: `worker/vitest.config.ts`

- [ ] **Step 1: Add Vitest dependencies and scripts**

Update `worker/package.json`:

```json
{
  "scripts": {
    "deploy": "wrangler deploy",
    "dev": "wrangler dev",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20250528.0",
    "typescript": "^5.9.0",
    "vitest": "^3.2.0",
    "wrangler": "^4.97.0"
  }
}
```

- [ ] **Step 2: Add Vitest config**

Create `worker/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 3: Install dependencies**

Run: `npm install` from `worker/`.

Expected: package lock updates successfully.

### Task 2: Date and Word Utility Tests

**Files:**
- Create: `worker/src/review.test.ts`
- Create: `worker/src/review.ts`

- [ ] **Step 1: Write failing tests**

Create `worker/src/review.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { getShanghaiDayRange, normalizeWord } from './review';

describe('normalizeWord', () => {
  test('lowercases and trims simple words', () => {
    expect(normalizeWord('  Insight. ')).toBe('insight');
  });

  test('keeps inner apostrophes and hyphens', () => {
    expect(normalizeWord("State-of-the-art")).toBe('state-of-the-art');
    expect(normalizeWord("Don't")).toBe("don't");
  });
});

describe('getShanghaiDayRange', () => {
  test('converts local Shanghai day to UTC boundaries', () => {
    expect(getShanghaiDayRange('2026-06-03')).toEqual({
      startUtc: '2026-06-02 16:00:00',
      endUtc: '2026-06-03 16:00:00',
    });
  });
});
```

- [ ] **Step 2: Verify RED**

Run: `npm test -- src/review.test.ts` from `worker/`.

Expected: fails because `worker/src/review.ts` does not exist.

- [ ] **Step 3: Implement utilities**

Create `worker/src/review.ts`:

```ts
const SHANGHAI_UTC_OFFSET_HOURS = 8;

export function normalizeWord(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')
    .replace(/\s+/g, ' ');
}

export function getShanghaiDayRange(date: string): { startUtc: string; endUtc: string } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error('Invalid date format. Expected YYYY-MM-DD.');
  }

  const [year, month, day] = date.split('-').map(Number);
  const localStartAsUtc = Date.UTC(year, month - 1, day, 0, 0, 0);
  const start = new Date(localStartAsUtc - SHANGHAI_UTC_OFFSET_HOURS * 60 * 60 * 1000);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  return {
    startUtc: formatSqlDateTime(start),
    endUtc: formatSqlDateTime(end),
  };
}

function formatSqlDateTime(date: Date): string {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}
```

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- src/review.test.ts` from `worker/`.

Expected: tests pass.

### Task 3: Schema Migration

**Files:**
- Modify: `worker/schema.sql`
- Modify: `worker/src/types.ts`

- [ ] **Step 1: Add tables and columns**

Update `worker/schema.sql` to:

- Add `status` and `updated_at` to `grammar_notes`.
- Create `translation_vocabulary`.
- Create `words`.
- Create `word_occurrences`.
- Keep the old `vocabulary` table for compatibility.
- Add indexes and unique constraints from the spec.

- [ ] **Step 2: Update TypeScript types**

Add types:

```ts
export type VocabularyStatus = 'pending' | 'accepted' | 'rejected' | 'filtered';
export type GrammarStatus = 'pending' | 'accepted' | 'rejected';
export type Familiarity = 'unknown' | 'learning' | 'mastered';
```

Add interfaces for `TranslationVocabulary`, `Word`, `WordOccurrence`, day summary, and review payloads.

### Task 4: Backend Review Data Tests

**Files:**
- Modify: `worker/src/review.test.ts`
- Modify: `worker/src/review.ts`
- Modify: `worker/src/db.ts`

- [ ] **Step 1: Write failing tests for AI candidate classification**

Add tests using a tiny fake DB repository interface:

```ts
import { classifyVocabularyCandidate } from './review';

test('classifies mastered words as filtered', () => {
  expect(classifyVocabularyCandidate({ id: 1, familiarity: 'mastered' })).toBe('filtered');
});

test('classifies unknown words as pending', () => {
  expect(classifyVocabularyCandidate({ id: 1, familiarity: 'unknown' })).toBe('pending');
});

test('classifies new words as pending', () => {
  expect(classifyVocabularyCandidate(null)).toBe('pending');
});
```

- [ ] **Step 2: Verify RED**

Run: `npm test -- src/review.test.ts`.

Expected: fails because `classifyVocabularyCandidate` is missing.

- [ ] **Step 3: Implement candidate classification and DB helpers**

Add `classifyVocabularyCandidate` to `review.ts`.

Add DB helpers in `db.ts`:

- `saveAiExtractionCandidates`
- `listDayTranslations`
- `getDaySummary`
- `listDayWords`
- `updateTranslationVocabulary`
- `acceptTranslationVocabulary`
- `rejectTranslationVocabulary`
- `acceptGrammarNote`
- `rejectGrammarNote`
- `listWords`
- `getWord`
- `updateWord`

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- src/review.test.ts`.

Expected: tests pass.

### Task 5: API Routes

**Files:**
- Modify: `worker/src/index.ts`

- [ ] **Step 1: Add validation schemas**

Add zod schemas for:

- Updating vocabulary candidate fields.
- Accepting vocabulary candidate with familiarity.
- Updating global word.

- [ ] **Step 2: Add routes**

Add:

- `GET /api/days/:date/summary`
- `GET /api/days/:date/translations`
- `GET /api/days/:date/words`
- `PUT /api/translation-vocabulary/:id`
- `POST /api/translation-vocabulary/:id/accept`
- `POST /api/translation-vocabulary/:id/reject`
- `POST /api/grammar-notes/:id/accept`
- `POST /api/grammar-notes/:id/reject`
- `GET /api/words`
- `GET /api/words/:id`
- `PUT /api/words/:id`

- [ ] **Step 3: Update queue consumer**

Replace `saveAiExtraction` with `saveAiExtractionCandidates`, so AI extraction writes pending or filtered candidates instead of directly writing global words.

### Task 6: Frontend Navigation and Today

**Files:**
- Modify: `worker/public/index.html`
- Modify: `worker/public/app.js`
- Modify: `worker/public/style.css`

- [ ] **Step 1: Add top nav**

Header should show:

- Brand.
- `Today`
- `Words`
- `History`

- [ ] **Step 2: Make Today the default route**

Routes:

- `#/` and `#/today` render Today.
- `#/words` renders global Words.
- `#/history` renders old translation list.
- `#/translation/:id` renders old detail page.

- [ ] **Step 3: Implement Today**

Today should:

- Default to current Shanghai date.
- Load `/api/days/:date/summary`.
- Load `/api/days/:date/translations`.
- Show date controls.
- Show tabs for by translation and by word.
- Support accept as unknown, learning, mastered, reject, edit, and grammar accept/reject.

### Task 7: Frontend Words

**Files:**
- Modify: `worker/public/app.js`
- Modify: `worker/public/style.css`

- [ ] **Step 1: Implement Words list**

Words should:

- Load `/api/words`.
- Support search.
- Support familiarity filter.
- Support sorting.
- Show source contexts.
- Allow familiarity updates.

### Task 8: Verification

**Files:**
- No required source edits.

- [ ] **Step 1: Run tests**

Run from `worker/`:

```bash
npm test
```

Expected: all Vitest tests pass.

- [ ] **Step 2: Run TypeScript check**

Run from `worker/`:

```bash
npx tsc --noEmit
```

Expected: no TypeScript errors.

- [ ] **Step 3: Do not run build**

Do not run `npm run build`. The project instructions explicitly reserve build verification for the user.
