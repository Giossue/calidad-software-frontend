# Rediseño de la interfaz (estilo silabos)

Objective: redo the whole interface (look, layout, navigation, feedback) copying the reference system `~/Documentos/proyecto-grado-silabos` (`resources/js`, `resources/css/app.css`), without touching business logic. Branch: `feat/rediseno-ui`. Delivery: work-unit commits on the branch; the user decides merge/push to `main`. Runner: `npm test` (vitest), `npm run lint` (oxlint), `npm run build`.

## Specs

- **S1 — Solo interfaz.** "sería solo la interfaz, no quiero anda de logica, porque supuestamente todo está al día". API modules (`src/lib/*-api.ts`), auth, data shaping and permissions keep their behavior. Moving inline page state into hooks is allowed only when needed to rewrite a view, with identical behavior.
- **S2 — Intuitivo.** "se quejaron que es poco intuitivo". Navigation and screens follow silabos patterns: neutral inset sidebar with icons grouped by role, header with breadcrumb that carries the page title, page description + actions on the right, create/edit in a right-side sheet with sticky footer, row actions in a "⋯" menu, filter toolbar (search → filters → "Quitar filtros"), pagination "1–15 de 42", back navigation that works.
- **S3 — No "IA Slop".** "se ve muy IA Slop". Adopt silabos tokens: neutral grayscale + one institutional blue (`hsl(207.7 100% 30%)`), Instrument Sans (400/500/600), radius 0.5rem, semantic shadows (control/surface/menu/modal, none for menu/modal in dark), cards `rounded-xl ring-1 ring-surface-ring shadow-surface`. Remove gradients, glows, grid overlays, pulsing pills, tinted icon tiles, raw Tailwind palette colors, arbitrary `text-[Npx]` sizes and emoji. Lucide icons at size-4 only.
- **S4 — Buen feedback.** "y que no da buen feedback, mi sistema de silabos si lo hace, eso quería que copiaramos". Every mutation shows pending (spinner replaces the button icon, button disabled), success (one toast, top-center, past-participle phrase) and error (one signal: inline in the open form/sheet, toast otherwise; field errors inline under the field with `role=alert`). No success toast for plain refresh. Destructive actions confirm with a dialog whose description states the consequence and whose action label is verb + consequence. Empty states use the `Empty` pattern with a plain sentence that changes with filters. No blank screen while loading.
- **S5 — Conservar lo que ya funciona.** Spanish accessible names used by tests and by the driver.js tours (`data-tour`, `data-tour-view`, `data-slot`, `aria-label`s, button texts in `src/features/help/page-tours.ts`) stay stable, or tests/tours are updated in the same commit. Official print reports (`src/features/reports`, `.print-root`) keep their printed layout. `npm test`, `npm run lint` and `npm run build` pass after every commit.
- **S6 — Docs.** A frontend UI conventions doc (`docs/frontend/ui-conventions.md`) describes the adopted patterns; `AGENTS.md` points to it.

## Tasks

| ID | Specs | Scope | Route | Status | Commit |
|---|---|---|---|---|---|
| T1 | S3,S4,S5 | Foundations: tokens/font/shadows in `src/index.css`, ui primitives (card, table, badge, sonner, spinner, label, dialog, button sizes) | inline | pending | |
| T2 | S2,S3,S5 | App shell: sidebar, header + breadcrumb title, user menu in sidebar footer, page frame replacing `AdminSectionHeader`, loading state instead of blank | inline | pending | |
| T3 | S3 | Auth screens: one sober `AuthShell` for login/forgot/reset/2FA/verify | inline | pending | |
| T4 | S2,S4 | Shared feedback/CRUD components: FormSheet, ConfirmModal, error flow of `useOperation`/`FormDialog`, Empty in tables, TableActionsMenu, FilterToolbar, pagination | inline | pending | |
| T5 | S2-S5 | Admin screens (users, periods, faculties, careers) | tbd | pending | |
| T6 | S2-S5 | Coordinador de carrera screens (`features/tutoring`) | tbd | pending | |
| T7 | S2-S5 | Coordinador de titulación screens (`features/degree-coordination`) | tbd | pending | |
| T8 | S2-S5 | Docente screens (`features/teacher`) | tbd | pending | |
| T9 | S2-S5 | Estudiante screens (`features/student*`) | tbd | pending | |
| T10 | S5,S6 | Tours check + `docs/frontend/ui-conventions.md` + `AGENTS.md` pointer | inline | pending | |

T5-T9 are independent units with disjoint edit surfaces once T1-T4 land; they may run as parallel writers (Writer trigger a).

## Log

- **L1 (2026-11-09, user):** "Ayúdame con algo, debemos rehacer todo el frontend, te puedo mostrar un ejemplo de cómo es que tengo hecho en otro sistema proyecto-grado-silabos-frontend, porque el sistema actual es pésimamente nada intuitivo"
- **L2 (2026-11-09, user):** "sería solo la interfaz, no quiero anda de logica, porque supuestamente todo está al día, pero como digo, se quejaron que es poco intuitivo y que se ve muy IA Slop y que no da buen feedback, mi sistema de silabos si lo hace, eso quería que copiaramos"
- **L3 (analysis):** Reference is a Laravel+Inertia+Vue monolith (shadcn-vue new-york-v4); current app is React 19 + Vite + Tailwind 4 + shadcn/Radix, so patterns port almost 1:1. Current slop sources: brand-blue filled sidebar, gradient/glow login (`auth-shell.tsx`), tinted icon tiles, raw palette colors (~25 files), arbitrary text sizes (29), triple error signal (toast + ErrorNotice + ErrorModal), refresh success toasts, help text hidden in tooltips, three table systems. Tests couple to Spanish accessible names, not CSS. RDD is off (global). Decided: keep React; feature branch because the team pushes to `main` directly and a half-done redesign must not reach it.
