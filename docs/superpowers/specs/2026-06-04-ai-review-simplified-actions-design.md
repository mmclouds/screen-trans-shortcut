# AI Review Simplified Actions Design

## Goal

AI-extracted vocabulary and grammar candidates should have only two review actions: accept or reject. Accepted vocabulary enters the global word notebook. Rejected vocabulary and grammar stay recorded, are hidden from the main review list by default, and can be expanded later so the user can accept them.

## UX

In Today and translation detail review surfaces:

- Pending vocabulary shows `接受` and `拒绝`.
- Accepting vocabulary calls the existing accept endpoint with `familiarity: "unknown"`.
- Pending grammar shows `接受` and `拒绝`.
- Rejected vocabulary and grammar are excluded from the main list.
- Rejected items appear in a collapsed `已拒绝` section.
- Rejected items still show `接受`, so the user can restore them into the accepted flow.
- Filtered mastered words remain collapsed separately.

Review actions must not refresh the entire current page. After an action succeeds, the client updates the current in-memory translation data, refreshes only the affected review panels, and leaves the route, scroll position, selected date, and active tab intact.

## Architecture

No database or API changes are needed. The existing accept and reject endpoints already model the required state transitions.

Add a small browser-safe review-state helper for:

- Partitioning active, rejected, and filtered candidates.
- Updating a candidate or grammar item status in the current translation list after a successful API call.
- Counting pending items for the current card summary.

`app.js` remains responsible for rendering and event binding, but action handlers will call local panel refresh functions instead of `renderToday` or `renderDetail`.

## Testing

Vitest should load the browser helper and verify:

- Rejected candidates are partitioned into the rejected bucket.
- Accept/reject status updates only the targeted item.
- Pending counts decrease after status changes.

Do not run `npm run build`.
