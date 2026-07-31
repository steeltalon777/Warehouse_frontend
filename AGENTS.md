# Warehouse_frontend Agent Contract

## Role

`Warehouse_frontend` is the high-priority Angular shell project for Django-hosted browser features.

## Functional Requirements Authority

- `Functional and WorkLogik.md` at the workspace root is the **canonical source** for operation types, user roles, screen layout rules, table behaviour, and business workflows.
- Before implementing any screen, modal, form, or user interaction, re-read the relevant section of `Functional and WorkLogik.md` and confirm alignment.
- If a screen spec or mockup contradicts `Functional and WorkLogik.md`, the functional requirements file takes precedence unless an ADR overrides it.

## Target Architecture

Browser -> Django route -> Angular shell -> Django BFF endpoint -> `Warehouse_web` sync client -> `SyncServer`.

Normative SPA architecture is documented in `docs/ARCHITECTURE_FRONTEND_SPA.md`.

Permanent standard:

- Django shell is permanent: topbar, brand/user/logout/admin controls, left navigation, session, CSRF, and authenticated layout.
- Angular content area is permanent: every Angular screen mounts only inside the Django content rectangle to the right of the menu and below the top bar.
- Business URLs open Angular screens after migration, for example `/nomenclature/` and `/operations/`; unrelated screens must not be mounted under another feature prefix such as `/nomenclature/operations/` as a final route.
- Legacy Django SSR screens move under explicit `/ssr/` fallback routes when replaced by Angular.
- All browser data access goes through Django same-origin BFF endpoints; `/nomenclature/api/*` is a temporary legacy exception until catalog is moved to unified BFF.

## Rules

- Build Angular here, not inside `Warehouse_web`.
- Do not call SyncServer directly from browser code.
- Do not store SyncServer user or device tokens in browser storage.
- Use Django same-origin requests, sessions, CSRF, and BFF endpoints.
- Do not redraw or restyle the Django topbar/sidebar from Angular.
- Do not introduce new Angular route/mount conventions without updating `docs/ARCHITECTURE_FRONTEND_SPA.md`.
- Start with the nomenclature workspace before broad SPA migration.
- Prefer Angular standalone components and feature-local state.

## Git Rules

- Parallel sessions are normal. `git status` may show unrelated modified/untracked files from other agents or the user; this is not a blocker by itself.
- Commit only from the `dev` branch.
- Switching from `dev` to another branch is forbidden by default.
- If the branch is not `dev`, warn the user and do not commit until the user gives an explicit command.
- Agents MUST commit their own completed frontend changes after relevant checks/tests pass.
- Stage and commit only files intentionally changed for the assigned task, using explicit pathspecs such as `git add -- path/to/file`. Do not use broad `git add .` or `git add -A` for task commits.
- Git does not auto-track new files by itself; untracked files become tracked only after staging. Keep local/service artifacts ignored and unstaged unless explicitly assigned.
- Before committing, inspect the staged diff and confirm it contains only task-owned files. Leave unrelated dirty files unstaged.
- If intended edits overlap with unrelated changes in the same file, stop and ask the user/orchestrator how to split ownership before committing.
- If checks/tests fail, are unavailable, or were not run, do not commit unless the user explicitly instructs to commit with that limitation documented.
- Git push is completely forbidden; the user pushes manually.

## Dev-стенд и тестирование

Агенты тестируют изменения на работающем dev-стенде. По умолчанию стенд запущен. Если нет — агент может запустить/перезапустить/пересобрать его через `make` из `/home/makc/AI_sandbox/warehouse_solution`.

- Полный список `make`-команд и протокол восстановления стенда: `AGENTS.md` в корне workspace.
- Основные команды: `make up` (запуск), `make restart` (перезапуск), `make build-angular` (ребилд фронтенда), `make status` (проверка), `make test-e2e` (Playwright в Docker).
- После сборки (`npm run build`) агент копирует актуальный bundle в `dist/`, который отдаёт Django.

## E2E тестирование (Playwright)

- Playwright spec и helpers лежат в `Warehouse_frontend/e2e/`.
- Полный Docker-backed прогон: `make test-e2e` из корня workspace.
- Локальная отладка браузера: `make test-e2e-headed`.
- HTML-отчёт последнего прогона: `make test-e2e-report`.
- CI использует тот же стек через `../.github/workflows/e2e-tests.yml`.

## Verification

- Run `npm run build` after frontend changes once Angular scripts exist.
- Use `make test-e2e` when the task touches Playwright coverage, browser flows, or CI parity.
- Run `npm run test:unit` (alias: `npx ng test --watch=false`, runs `@angular/build:unit-test` on top of vitest) for unit tests. The standalone `npx vitest` runner is removed — do not reintroduce `vitest.config.ts` or `src/test-setup.ts`. Watch-mode iteration is `npm test`; single-run is `npm run test:unit`. CI gating is `frontend-unit-tests.yml`.
