# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project state

Electron desktop sticky-note app, implemented per `specs/01-nota-de-escritorio.md` (electron-vite, TypeScript, no UI framework). UI copy is Spanish (`lang="es"`). See `README.md` for features.

## Commands

- `npm run dev` — run app with HMR
- `npm run build` — typecheck + build to `out/`
- `npm start` — run built app
- `npm test` — Vitest (`tests/**/*.test.ts`); `npm run test:watch`
- `npm run lint`, `npm run format`, `npm run typecheck`

## Architecture

Layered; respect the dependency direction.

- `src/core/` — pure domain + application. NO `electron`, NO DOM (`tsconfig.node.json` has no DOM lib, which enforces this). Never import from main/preload/renderer.
  - `domain/`: `note.ts`, `window-prefs.ts`, `note-operations.ts` (pure, immutable; returns same object if nothing changed), `date-label.ts`, `validate-stored-data.ts` (strict v1).
  - `application/`: `ports.ts` (`Clock`, `NoteRepository`), `note-store.ts` (state, subscribe, commands returning `boolean`, autosave debounce 300 ms, `flush()`, `onSaveError`), `in-memory-note-repository.ts`.
  - Ids and time are injected (`NewItemContext {id, now}`), never generated inside domain.
- `src/main/` — Electron main: `index.ts`, `window-controls.ts` (pin/collapse/position), `window-metrics.ts`, `json-note-repository.ts` (atomic write tmp+rename, serialized queue, corrupt file backed up as `note.corrupt-<ts>.json`), `ipc.ts`.
- `src/preload/` — `contextBridge` exposes only `window.stickyApi`. Flags: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
- `src/renderer/` — vanilla TS: `main.ts` (composition), `ui/` (header, footer, progress, add-row, task-list with keyed row reconciliation), `styles/` (`tokens.css`, `app.css`), `infrastructure/ipc-note-repository.ts`.

### Window

Frameless, transparent, 480 px wide = note 360 + shadow margins (top 40, sides 60, bottom 84). Heights: expanded 663, collapsed 172. Margins must match `--margin-*` in `tokens.css`. Resizing a non-resizable window on Windows needs `setResizable(true)` around `setSize`.

### Persistence

One file `userData/note.json` holds note + window prefs (`pinned`, `collapsed`, `x`, `y`). IPC channels: `note:load`, `note:save`, `window:get-prefs`, `window:set-pinned`, `window:set-collapsed`, `window:close`. `before-quit` persists position and awaits `repository.flush()`.

## Conventions

- Tests for core and main logic live in `tests/`; keep core testable without Electron.
- `New note` button and footer formatting buttons are intentionally inert (out of scope of spec 01).
- Specs: implement only what the spec says; scope changes go into the spec. Never commit without being asked.

## Design reference

`docs/references/Artboard-cltk.dc.html` is the source of truth for the UI: a single dark-mode sticky-note window. It is a REFERENCE MOCKUP, not production code — replicate its values in the app's styling; do not copy the markup wholesale.

- Values live in inline `style="…"` attributes and the `<helmet><style>` block. `{{…}}`, `<sc-if>`, `<sc-for>` are the design tool's template syntax; the `class Component extends DCLogic` script is the behavior spec.
- It does not render from this folder: its runtime lives only in the sibling `../Mockup/` folder. To view, serve `../Mockup/` (e.g. `python -m http.server`) and open `Artboard-cltk.dc.html`.

### Behavior captured in the mockup

- Note: editable title, pin toggle ("Fijada" in footer when pinned), minimize (collapses everything below the header), close, "Nueva nota".
- Tasks: `{ id, hour, text, done, subtasks: [{ id, text, done }] }`. One level of subtasks only, indented with a left border.
- Progress header: date label (`Jueves, 12 nov`), "`N de M hechas`", progress bar. Counts include tasks AND subtasks. Marking a task does not touch its subtasks.
- Footer formatting toggles: bold, italic, underline, strikethrough, bullet list, "Adjuntar imagen".
- Accent color `--accent`, default `#F5C451`; options `#F5C451`, `#60CDFF`, `#7EE0A8`, `#C4A7FF`.

### Key design tokens

- Font: Inter 400/500/600 (bundled locally), fallback `system-ui, sans-serif`.
- Page bg `#141416`; note bg `#252526`, 360px wide, radius 16px, border `rgba(255,255,255,0.08)`, shadow `0 24px 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(0,0,0,0.4)`; footer bg `#222223`.
- Text: primary `#f4f4f5` / `#e4e4e7`, subtask `#d4d4d8`, muted `#a1a1aa`, placeholder `#8b8b92`.
- Done items: line-through + opacity .5. Close button hover `#c42b1c`. Focus ring: 2px solid accent, offset 2px.
