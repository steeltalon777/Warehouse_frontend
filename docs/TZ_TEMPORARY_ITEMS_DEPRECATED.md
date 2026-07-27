# `TZ_TEMPORARY_ITEMS_ANGULAR.md` — DEPRECATED, moved to archive

> **Status:** Archived — legacy. Do not implement against this TZ.
> **Archived:** 2026-07-27
> **Superseded by:** [`docs/adr/0012-deprecate-temporary-items-review-flow.md`](../../docs/adr/0012-deprecate-temporary-items-review-flow.md)
> **Main flow (new):** review-items over the regular catalog (`Item.requires_review=true`), via `/api/v1/review-items/*` and the BFF. A new TZ is expected to cover the Angular screen for it (e.g. `TZ_REVIEW_ITEMS_ANGULAR.md`).

## Why

`TZ_TEMPORARY_ITEMS_ANGULAR.md` was authored on 2026-05-19 against
`AUDIT_IV_TEMPORARY_ITEMS_2026-05-19.md` and a 2026-05-19 user UX specification.
On 2026-06-01 the project accepted
[`docs/adr/0012-deprecate-temporary-items-review-flow.md`](../../docs/adr/0012-deprecate-temporary-items-review-flow.md),
which **deprecates the temporary-items flow for new operations**:

- For new operations, `submit` materialises inline payload as a **permanent catalog
  `Item`** with `requires_review=true` and `review_status="needs_review"`.
- Review moderation for these items goes through `/api/v1/review-items/*`.
- Legacy `/api/v1/temporary-items/*` endpoints stay supported **only** for already-existing
  `TemporaryItem` records and historical data.
- `Functional and WorkLogik.md` §IV is now explicitly «legacy-compatible, partially
  deprecated».

The TZ this notice replaces describes the legacy `approve_as_item` /
`merge_to_permanent` / soft-delete flow over `TemporaryItem` rows, which is **not
the target product flow** anymore.

## Where the old TZ is

The full historical TZ file (with a legacy banner prepended and the execution
checklist marked N/A) is kept at:

```
docs/archive/TZ_TEMPORARY_ITEMS_ANGULAR.md
```

(`docs/archive/` is a non-tracked workspace-level archive; it is intentionally
listed in `.gitignore` at the workspace root and exists only for human reference.)

The corresponding `AUDIT_IV_TEMPORARY_ITEMS_2026-05-19.md` is also in
`docs/archive/`. The associated `audit_2026-05-19` findings remain valid for
**legacy** data only and must not be used to justify new product work.

## State of partial implementation

At archival time, the legacy Angular code at
`src/app/features/temporary-items/` was roughly 55–60% in code:

- lazy route `/temporary-items` is wired in `app.routes.ts`
- `temp-items.models.ts`, `temp-items.service.ts`, BFF client exist
- table, filters, info-card, detail-modal, convert-form, merge-permanent-form,
  merge-temp-form, delete-form components exist as drafts
- the page header already reads «ТМЦ, требующие проверки» (a review-flow title
  grafted onto a temporary-items route) — further evidence of conceptual drift

Unit / component tests for the feature were red (NG0950 in
`temp-item-detail-modal.spec.ts`). The TZ's execution checklist was empty and
the evidence table was not filled.

## What this means for the workspace

- `src/app/features/temporary-items/` stays **only** as compatibility code for
  already-existing `TemporaryItem` rows (legacy data review). It is not the
  target product screen.
- The target product screen for "ТМЦ, требующие проверки" / inline-created
  items must be tracked under a **new TZ** that targets
  `/bff/api/v1/review-items/*` and the catalog with `requires_review=true`.
- Any future fix on the legacy temporary-items path (e.g. closing the
  `approve-as-item` body gap from `R1`, adding the missing `merge temp→temp`
  endpoint from `R2`, completing the dashboard card from §6) should be opened
  as a small, scoped maintenance ticket — not against this archived TZ.
