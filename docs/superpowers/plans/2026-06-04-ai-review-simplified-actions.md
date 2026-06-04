# AI Review Simplified Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify AI candidate review to accept/reject and update review UI locally after actions instead of refreshing the full page.

**Architecture:** Add a browser global helper in `worker/public/review-state.js` for status partitioning and local state transitions. Use that helper from `worker/public/app.js` to render active, rejected, and filtered sections and to repaint only review panels after actions.

**Tech Stack:** Plain browser JavaScript, static HTML, CSS, Vitest.

---

### Task 1: Review State Helper

**Files:**
- Create: `worker/public/review-state.js`
- Create: `worker/src/review-state.test.ts`
- Modify: `worker/public/index.html`

- [ ] Write tests that load `review-state.js` and verify partitioning, status transitions, and pending counts.
- [ ] Run `npm test -- src/review-state.test.ts` from `worker/` and confirm it fails because the helper is missing.
- [ ] Implement `ReviewState.partitionCandidates`, `ReviewState.applyReviewStatus`, and `ReviewState.countPending`.
- [ ] Add `<script src="/review-state.js"></script>` before `app.js`.
- [ ] Run `npm test -- src/review-state.test.ts` and confirm it passes.

### Task 2: Simplified Candidate Rendering

**Files:**
- Modify: `worker/public/app.js`
- Modify: `worker/public/style.css`

- [ ] Replace vocabulary candidate actions with `接受` and `拒绝`.
- [ ] Make vocabulary accept always send `{ familiarity: "unknown" }`.
- [ ] Hide rejected vocabulary and grammar in collapsed `已拒绝` blocks.
- [ ] Keep filtered mastered vocabulary in a separate collapsed block.
- [ ] Allow rejected vocabulary and grammar to be accepted from their collapsed blocks.

### Task 3: Local UI Refresh

**Files:**
- Modify: `worker/public/app.js`

- [ ] In Today, keep loaded translations in a closure.
- [ ] After review actions, update the matching local item through `ReviewState.applyReviewStatus`.
- [ ] Re-render Today tab panels and re-bind actions without reloading summary/date/header.
- [ ] In detail, keep the current translation object in a closure and re-render only the vocab/grammar panels after review actions.

### Task 4: Verification

**Files:**
- No source edits.

- [ ] Run `npm test` from `worker/`.
- [ ] Run `npx tsc --noEmit` from `worker/`.
- [ ] Do not run `npm run build`.
