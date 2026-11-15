# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project state

Electron desktop sticky-note app (electron-vite, TypeScript, no UI framework), built spec by spec: `specs/01-nota-de-escritorio.md`, `02-hora-manual-y-orden.md`, `03-pestanas-por-dia.md`. UI copy is Spanish (`lang="es"`). See `README.md` for features.

## Commands

- `npm run dev` — run app with HMR
- `npm run build` — typecheck + build to `out/`
- `npm start` — run built app
- `npm test` — Vitest (`tests/**/*.test.ts`); `npm run test:watch`
- `npm run lint`, `npm run format`, `npm run typecheck`

## Architecture

Layered; respect the dependency direction.

- `src/core/` — pure domain + application. NO `electron`, NO DOM (`tsconfig.node.json` has no DOM lib, which enforces this). Never import from main/preload/renderer.
  - `domain/`: `note.ts` (`Note = { days: Record<DayKey, Task[]> }`, no title), `day.ts` (`DayKey` = local `YYYY-MM-DD`, `dayKey`, `dayDate`, `addDays`, `dayLabel`, `pastDays`, `HISTORY_DAYS = 5`), `window-prefs.ts`, `note-operations.ts` (pure, immutable; returns same object if nothing changed), `date-label.ts`, `validate-stored-data.ts` (strict; accepts v1 and v2, always returns v2).
  - `note-operations.ts`: `addTask(note, day, …)`, `tasksOf(note, day)`, `progress(tasks)`. Id-based ops (`toggleTask`, `editTask`, `deleteTask`, subtasks…) search all days; task ids are unique across the note. `rollOver(note, today)`: moves `done: false` tasks of past days to the end of today (with subtasks), keeps done ones, prunes days before today − 5 and empty past days; idempotent.
  - `application/`: `ports.ts` (`Clock`, `NoteRepository`), `note-store.ts` (state, subscribe, commands returning `boolean`, autosave debounce 300 ms, `flush()`, `onSaveError`, `rollOver()` using the `Clock`; `load()` calls it), `in-memory-note-repository.ts`.
  - Ids and time are injected (`NewItemContext {id, now}`, `today: DayKey`), never generated inside domain.
- `src/main/` — Electron main: `index.ts`, `window-controls.ts` (pin/collapse/position), `window-metrics.ts`, `json-note-repository.ts` (receives `today: () => DayKey` for v1 migration; atomic write tmp+rename, serialized queue, corrupt file backed up as `note.corrupt-<ts>.json`), `ipc.ts`.
- `src/preload/` — `contextBridge` exposes only `window.stickyApi`. Flags: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
- `src/renderer/` — vanilla TS: `main.ts` (composition; `activeDay` state, always today at startup and not persisted; 00:00 timer that calls `store.rollOver()` and moves the active tab to today), `ui/` (header with day tabs Ayer/Hoy/Mañana + history menu for days before yesterday, footer, progress with `setDate`, add-row, task-list with keyed row reconciliation), `styles/` (`tokens.css`, `app.css`), `infrastructure/ipc-note-repository.ts`.

### Window

Frameless, transparent, 480 px wide = note 360 + shadow margins (top 40, sides 60, bottom 84). Heights: expanded 663, collapsed 172. Margins must match `--margin-*` in `tokens.css`. Resizing a non-resizable window on Windows needs `setResizable(true)` around `setSize`.

### Persistence

One file `userData/note.json` holds note + window prefs (`pinned`, `collapsed`, `x`, `y`). Format `version: 2`: `note.days` maps `YYYY-MM-DD` to that day's tasks. A `version: 1` file (`note.title` + `note.tasks`) is migrated on read: tasks go to today, title is dropped; the next save (often the window position save on startup) writes v2. IPC channels: `note:load`, `note:save`, `window:get-prefs`, `window:set-pinned`, `window:set-collapsed`, `window:close`. `before-quit` persists position and awaits `repository.flush()`.

## Conventions

- Tests for core and main logic live in `tests/`; keep core testable without Electron.
- `New note` button and footer formatting buttons are intentionally inert (out of scope so far).
- E2E/manual runs against the built app: isolate data with `electron . --user-data-dir=<tmp>`. Overriding `APPDATA` does NOT work on Windows and would write the user's real `note.json`.
- Specs: implement only what the spec says; scope changes go into the spec. Never commit without being asked.

## Design reference

`docs/references/Artboard-cltk.dc.html` is the source of truth for the UI: a single dark-mode sticky-note window. It is a REFERENCE MOCKUP, not production code — replicate its values in the app's styling; do not copy the markup wholesale.

- Values live in inline `style="…"` attributes and the `<helmet><style>` block. `{{…}}`, `<sc-if>`, `<sc-for>` are the design tool's template syntax; the `class Component extends DCLogic` script is the behavior spec.
- It does not render from this folder: its runtime lives only in the sibling `../Mockup/` folder. To view, serve `../Mockup/` (e.g. `python -m http.server`) and open `Artboard-cltk.dc.html`.

### Behavior captured in the mockup

- Note: editable title, pin toggle ("Fijada" in footer when pinned), minimize (collapses everything below the header), close, "Nueva nota". The app deliberately drops the title (SPEC 03): its header place holds the day tabs.
- Tasks: `{ id, hour, text, done, subtasks: [{ id, text, done }] }`. One level of subtasks only, indented with a left border.
- Progress header: date label (`Jueves, 12 nov`), "`N de M hechas`", progress bar. Counts include tasks AND subtasks. Marking a task does not touch its subtasks.
- Footer formatting toggles: bold, italic, underline, strikethrough, bullet list, "Adjuntar imagen".
- Accent color `--accent`, default `#F5C451`; options `#F5C451`, `#60CDFF`, `#7EE0A8`, `#C4A7FF`.

### Key design tokens

- Font: Inter 400/500/600 (bundled locally), fallback `system-ui, sans-serif`.
- Page bg `#141416`; note bg `#252526`, 360px wide, radius 16px, border `rgba(255,255,255,0.08)`, shadow `0 24px 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(0,0,0,0.4)`; footer bg `#222223`.
- Text: primary `#f4f4f5` / `#e4e4e7`, subtask `#d4d4d8`, muted `#a1a1aa`, placeholder `#8b8b92`.
- Done items: line-through + opacity .5. Close button hover `#c42b1c`. Focus ring: 2px solid accent, offset 2px.
