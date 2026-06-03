# English Review Workflow Design

## Goal

Turn the current screen translation tool into a daily English review system.

The product should still support fast screen translation, but the main value should become reviewing and organizing what was learned from those translations. The first version should prioritize a daily review workflow and also support a global word notebook.

## User Experience

The app has three primary areas:

1. **Today**
   - Default entry point.
   - Shows one selected day, defaulting to today.
   - Supports switching to previous or future dates.
   - Contains two review dimensions:
     - By translation: review each translated screenshot and confirm AI-extracted vocabulary and grammar.
     - By word: review the day's candidate words grouped by word.

2. **Words**
   - Global word notebook.
   - Shows accepted words across all days and translations.
   - Supports search, familiarity filtering, and source-context review.

3. **History**
   - Keeps the existing translation history behavior.
   - Used for browsing all translation records and inspecting original/translated screenshots.
   - Remains the source trace for vocabulary and grammar items.

Dates in the Today workflow use the user's local learning timezone, currently Asia/Shanghai. API date parameters use `YYYY-MM-DD` and should be interpreted as local-day boundaries in that timezone, even though D1 stores timestamps in UTC.

## Today: By Translation

This is the default workflow inside Today.

Each translation card shows:

- Screenshot thumbnail.
- Source text summary.
- Translated text summary.
- AI-extracted vocabulary candidates.
- AI-extracted grammar candidates.
- Review state for the translation.

Each vocabulary candidate supports these actions:

- **Accept as unknown**: primary action. Adds or updates the word in the global notebook with `unknown` familiarity.
- **Accept as learning**: adds or updates the word with `learning` familiarity.
- **Mark mastered**: adds or updates the word with `mastered` familiarity.
- **Reject**: marks this candidate as not useful and does not add it to the notebook.
- **Edit**: allows correcting word, meaning, part of speech, and context before accepting.

Mastered words filtered during AI extraction are hidden by default under a collapsed "filtered mastered words" area. This keeps the review list clean while still making the filtering auditable.

A translation is considered processed when all vocabulary and grammar candidates are no longer pending.

## Today: By Word

This view groups the selected day's vocabulary candidates by normalized word.

It is used for fast review after or instead of reviewing each translation.

Each grouped word shows:

- Word.
- Meaning.
- Part of speech.
- Number of occurrences that day.
- Candidate statuses.
- Available familiarity actions.

Changing a grouped word's familiarity applies to all pending candidates for that normalized word on the selected day, unless a candidate has already been manually rejected.

## Words

The global word notebook stores only confirmed learning items.

Each word entry shows:

- Word.
- Normalized word.
- Meaning.
- Part of speech.
- Familiarity: `unknown`, `learning`, or `mastered`.
- First seen date.
- Last seen date.
- Occurrence count.
- Source contexts linked back to translation records.

Words supports:

- Search by word or meaning.
- Filter by familiarity.
- Sort by last seen date, first seen date, or occurrence count.
- Update familiarity directly.

## Familiarity Model

Use three familiarity levels:

- `unknown`: unfamiliar and should be reviewed often.
- `learning`: partly known but still needs reinforcement.
- `mastered`: known well enough to hide from daily AI candidate lists by default.

AI extraction must use the local familiarity state:

- If a normalized extracted word matches a `mastered` word, create a filtered candidate and do not show it in the main pending list.
- If it matches an `unknown` or `learning` word, create a pending candidate linked to the existing word.
- If it does not match any word, create a pending candidate.

## Data Model

The current `vocabulary` table should no longer be treated as the global word notebook. The new model separates translation-level candidates from confirmed global words.

### `translation_vocabulary`

Stores AI-extracted or manually added vocabulary candidates for a single translation.

Fields:

- `id`
- `translation_id`
- `word`
- `normalized_word`
- `meaning`
- `part_of_speech`
- `context`
- `status`: `pending`, `accepted`, `rejected`, or `filtered`
- `matched_word_id`
- `created_at`
- `updated_at`

Constraints and indexes:

- Unique candidate per `translation_id` and `normalized_word`.
- Index by `translation_id`.
- Index by `status`.
- Index by `matched_word_id`.

Status meaning:

- `pending`: waiting for user review.
- `accepted`: confirmed and connected to a global word.
- `rejected`: manually excluded from the notebook.
- `filtered`: hidden because it matched a mastered global word.

### `words`

Stores global word notebook entries. One normalized word should have one primary entry.

Fields:

- `id`
- `word`
- `normalized_word`
- `meaning`
- `part_of_speech`
- `familiarity`: `unknown`, `learning`, or `mastered`
- `occurrence_count`
- `first_seen_at`
- `last_seen_at`
- `created_at`
- `updated_at`

Constraints and indexes:

- Unique `normalized_word`.
- Index by `familiarity`.
- Index by `last_seen_at`.

### `word_occurrences`

Connects global words to translation records and contexts.

Fields:

- `id`
- `word_id`
- `translation_id`
- `translation_vocab_id`
- `context`
- `created_at`

Constraints and indexes:

- Unique occurrence per `word_id` and `translation_vocab_id`.
- Index by `word_id`.
- Index by `translation_id`.

### `grammar_notes`

Keep grammar attached to translations in the first version.

Add:

- `status`: `pending`, `accepted`, or `rejected`
- `updated_at`

Do not introduce a global grammar notebook in the first version. It can be added later if grammar review becomes important enough.

## AI Extraction Flow

1. The shortcut sends a screenshot to the Worker.
2. Worker translates the screenshot and saves the translation record.
3. Worker sends a Queue message for AI extraction.
4. AI returns vocabulary and grammar candidates.
5. Worker normalizes extracted words and deduplicates repeated words within the same translation.
6. Worker checks `words` by `normalized_word`.
7. Worker writes candidates to `translation_vocabulary`:
   - No match: `pending`.
   - Match with `unknown` or `learning`: `pending` with `matched_word_id`.
   - Match with `mastered`: `filtered` with `matched_word_id`.
8. Worker writes grammar candidates to `grammar_notes` with `pending` status.

AI should not directly create global word notebook entries. The user confirms candidates first.

## Review Flow

When accepting a candidate:

1. If `matched_word_id` exists, update that word's meaning, part of speech, familiarity, `last_seen_at`, and `occurrence_count`.
2. If no matching word exists, create a new `words` row.
3. Create a `word_occurrences` row.
4. Mark the candidate as `accepted`.

When rejecting a candidate:

1. Mark it as `rejected`.
2. Do not create or update a global word.

When marking a candidate as mastered:

1. Create or update the global word as `mastered`.
2. Create a `word_occurrences` row.
3. Mark the candidate as `accepted`.
4. Future AI extractions for the same normalized word should be filtered.

## API Surface

Add endpoints for daily review:

- `GET /api/days/:date/summary`
- `GET /api/days/:date/translations`
- `GET /api/days/:date/words`

`:date` is a local date string in `YYYY-MM-DD` format. The backend converts it to UTC start/end timestamps for querying `translations.created_at`.

Add endpoints for candidate review:

- `PUT /api/translation-vocabulary/:id`
- `POST /api/translation-vocabulary/:id/accept`
- `POST /api/translation-vocabulary/:id/reject`
- `POST /api/grammar-notes/:id/accept`
- `POST /api/grammar-notes/:id/reject`

Add endpoints for global words:

- `GET /api/words`
- `GET /api/words/:id`
- `PUT /api/words/:id`

Existing translation history endpoints should remain available.

## UI Navigation

Use restrained, content-first navigation consistent with the current product direction.

Recommended top navigation:

- `Today`
- `Words`
- `History`

Today date controls:

- Previous day.
- Current selected date.
- Next day.
- Optional date picker.

Today status controls:

- Show pending only.
- Show all.
- Show filtered mastered words inside each translation when expanded.

## Migration

For existing data:

1. Create `translation_vocabulary`, `words`, and `word_occurrences`.
2. Migrate existing `vocabulary` rows into `translation_vocabulary` with `accepted` status.
3. For each migrated vocabulary row, create or update a global `words` entry with `unknown` familiarity.
4. Create a `word_occurrences` row for each migrated vocabulary row.
5. Add `status` and `updated_at` to `grammar_notes`; set existing rows to `accepted`.

The old `vocabulary` table can be kept temporarily during migration, but new reads and writes should use the new tables.

## Testing

Backend tests or manual API verification should cover:

- AI extraction creates pending candidates for new words.
- AI extraction filters mastered words.
- Accepting a candidate creates or updates a global word.
- Rejecting a candidate does not create a global word.
- Today summary counts pending, accepted, rejected, and filtered items correctly.
- Words list filters by familiarity.

Frontend verification should cover:

- Today defaults to the current day.
- Date switching loads the selected day.
- By translation review actions update the UI.
- By word grouping reflects multiple occurrences.
- Words search and familiarity filters work.
- History still opens translation details.

Do not run `npm run build` as part of implementation verification. Build verification should be left to the user.

## Initial Scope

Implement version B:

- Today daily review workflow.
- Translation-level candidate review.
- Day-level word grouping.
- Global Words notebook.
- Three-level familiarity model.
- Local mastered-word filtering during AI extraction.

Explicitly out of scope for the first version:

- Spaced repetition scheduling.
- Quiz mode.
- Global grammar notebook.
- Multi-user support.
- Complex analytics or streaks.
