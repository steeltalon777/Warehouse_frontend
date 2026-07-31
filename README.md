# Warehouse_frontend

Этот компонент Quartermaster: Angular shell.

Angular content application that mounts inside the Django shell. Browser data access goes through Django BFF endpoints; the Angular app does not call SyncServer directly and does not receive SyncServer tokens.

See `docs/ARCHITECTURE_FRONTEND_SPA.md` for the canonical SPA architecture.

## Tests

- Unit tests: `npm run test:unit` (alias: `npx ng test --watch=false`, runs `@angular/build:unit-test` on top of vitest). Watch-mode: `npm test`.
- E2E tests: `make test-e2e` (Docker-backed Playwright, run from the workspace root).
