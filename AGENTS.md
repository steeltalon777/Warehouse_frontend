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
- Stage and commit only files intentionally changed for the assigned task. Use explicit pathspecs; do not use broad `git add .` when unrelated changes exist.
- Before committing, inspect the staged diff and confirm it contains only task-owned files. Leave unrelated dirty files unstaged.
- If intended edits overlap with unrelated changes in the same file, stop and ask the user/orchestrator how to split ownership before committing.
- If checks/tests fail, are unavailable, or were not run, do not commit unless the user explicitly instructs to commit with that limitation documented.
- Git push is completely forbidden; the user pushes manually.

## Verification

- Run `npm run build` after frontend changes once Angular scripts exist.
- Add frontend tests once Angular test tooling is initialized.
