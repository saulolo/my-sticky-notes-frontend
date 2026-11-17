# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project state

Electron desktop sticky-note app (electron-vite, TypeScript, no UI framework), built spec by spec: `specs/01-nota-de-escritorio.md`, `02-hora-manual-y-orden.md`, `03-pestanas-por-dia.md`, `04-alto-ajustable-y-anclaje.md`, `05-ancho-libre-y-minimizar-a-barra.md`, `06-instalador-windows.md`, `07-traer-tareas-de-ayer.md` (replaces the SPEC 03 rule "pending tasks move to today": today starts clean, each past day keeps its tasks, a once-a-day button copies yesterday's list). UI copy is Spanish (`lang="es"`). See `README.md` for features.

## Commands

- `npm run dev` — run app with HMR
- `npm run build` — typecheck + build to `out/`
- `npm start` — run built app
- `npm test` — Vitest (`tests/**/*.test.ts`); `npm run test:watch`
- `npm run lint`, `npm run format`, `npm run typecheck`
- `npm run dist` — build + NSIS installer `dist/My Sticky Notes Setup <version>.exe` (electron-builder, `electron-builder.yml`). Close any open installer first: it locks the `.exe` and the build hangs.
- `npm run art` — `scripts/make-installer-art.mjs` (runs under Electron): regenerates `build/author-logo.ico` (from `build/author-logo.png`) and `build/installer-header.bmp` (white, app icon only). The app icon is NOT generated: `build/icon.ico` is provided by the user and `resources/icon.png` is its 256 px image.

## Architecture

Layered; respect the dependency direction.

- `src/core/` — pure domain + application. NO `electron`, NO DOM (`tsconfig.node.json` has no DOM lib, which enforces this). Never import from main/preload/renderer.
  - `domain/`: `note.ts` (`Note = { days: Record<DayKey, Task[]> }`, no title), `day.ts` (`DayKey` = local `YYYY-MM-DD`, `dayKey`, `dayDate`, `addDays`, `dayLabel`, `pastDays`, `HISTORY_DAYS = 5`), `window-prefs.ts` (`WindowPrefs` with optional `height` and `alwaysOnTop`, `WindowState` = prefs + `docked`, `MIN_NOTE_HEIGHT = 300`), `note-operations.ts` (pure, immutable; returns same object if nothing changed), `date-label.ts` (`dateLabel` = `Jueves, 12 nov`, `shortDateLabel` = `Jue, 12 nov`), `validate-stored-data.ts` (strict; accepts v1 and v2, always returns v2).
  - `note-operations.ts`: `addTask(note, day, …)`, `tasksOf(note, day)`, `progress(tasks)`. Id-based ops (`toggleTask`, `editTask`, `deleteTask`, subtasks…) search all days; task ids are unique across the note. `rollOver(note, today)` (SPEC 07): only prunes days before today − 5 and empty past days, moves nothing (each past day keeps its done and pending tasks); idempotent, same object if nothing changes. `carryOverSource(note, today)` = latest day `< today` with tasks; `canCarryOver` = `lastCarryOver !== today` && today empty && source exists; `carryOver(note, today, newId)` copies (not moves) all source tasks to today with new ids (tasks and subtasks), `done: false`, keeps text/hour/createdAt/collapsed, sets `lastCarryOver = today`; same object if it does not apply.
  - `application/`: `ports.ts` (`Clock`, `NoteRepository`), `note-store.ts` (state, subscribe, commands returning `boolean`, autosave debounce 300 ms, `flush()`, `onSaveError`, `rollOver()` using the `Clock`, prune only; `load()` calls it; `canCarryOver()` / `carryOver()` using the `Clock` and `deps.newId`), `in-memory-note-repository.ts`.
  - Ids and time are injected (`NewItemContext {id, now}`, `today: DayKey`), never generated inside domain.
- `src/main/` — Electron main: `index.ts` (sets `userData` via `app-paths.ts` before ready, single-instance lock: `second-instance` restores/shows/focuses the window; `setAppUserModelId(APP_ID)`), `app-paths.ts` (pure: packaged → `%APPDATA%\my-sticky-notes`, unpackaged → `my-sticky-notes-dev`, `--user-data-dir` respected), `app-identity.ts` (`APP_ID` = appId in `electron-builder.yml`, `LOGIN_ITEM_NAME`), `external-links.ts` (allow-listed `email`/`github`/`repo`; renderer sends only the key via `app:open-link`, main validates and calls `shell.openExternal`), `window-controls.ts` (pin = dock, always on top, collapse, minimize, position, height drag), `window-metrics.ts` (pure, tested: `freeBounds`, `fitFreeBounds`, `freeResizeLimits`, `dockedBounds`, `pickDockDisplay`, `resizeHeight`), `auto-launch.ts` (pure helpers, `app` injected), `json-note-repository.ts` (receives `today: () => DayKey` for v1 migration; atomic write tmp+rename, serialized queue, corrupt file backed up as `note.corrupt-<ts>.json`), `ipc.ts`.
- `src/preload/` — `contextBridge` exposes only `window.stickyApi`. Flags: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
- `src/renderer/` — vanilla TS (`__APP_VERSION__` defined in `electron.vite.config.ts`: package version, `-dev` suffix under `serve`): `main.ts` (composition; `activeDay` state, always today at startup and not persisted; mounts `ui/carry-over.ts` inside the task list ("Sin tareas para hoy" + "Traer tareas de ayer" button), shown only when the active tab is today and `store.canCarryOver()`; 00:00 timer that calls `store.rollOver()` and moves the active tab to today), `ui/` (`resize-handles.ts` top/bottom drag zones, header in two rows: top = settings gear (menu with one item "Acerca de My Sticky Notes" → `about.ts` overlay inside the note: icon, version, description, author card with logo from `build/author-logo.png` via `import.meta.glob` (fallback "SE"), email/GitHub/repo buttons; closes with Esc, outside pointerdown or ×, scrolls if it does not fit; collapsed, `beforeOpenSettings` expands first) + short date (`setDate`) on the left, drag region, then always-on-top/pin/collapse/minimize-to-taskbar/close; `dayRow` = "+" (new task) left, day tabs Ayer/Hoy/Mañana centered (grid `1fr auto 1fr`), history menu right, opening leftwards, for days before yesterday (hidden when collapsed), footer, progress (14 px SVG ring + `N de M hechas` + bar, same percent; no date), add-row (hidden by default; the day-row "+" ("Nueva tarea") calls `taskList.openAddRow()`; Enter adds and keeps focus on the hour for the next one; focus leaving the row or Esc hides it and discards unsent text), task-list with keyed row reconciliation), `styles/` (`tokens.css`, `app.css`), `infrastructure/ipc-note-repository.ts`.

### Window

Frameless, transparent. Width depends on the state and is fixed (no drag): free = note 360 (`FREE_NOTE_WIDTH`) + `SHADOW_MARGIN` = window 480; docked = note 308 (`DOCKED_NOTE_WIDTH`) + `DOCKED_MARGIN` = window 368; collapsed keeps its state's width. The renderer reads `--note-width` (360, 308 under `.is-docked`). `SHADOW_MARGIN`: top 0 so the free note can reach the screen top — the top shadow is cut; left/right 60, bottom 84). Margins must match `--margin-*` in `tokens.css`. Resizing a non-resizable window on Windows needs `setResizable(true)` around `setSize`/`setBounds`. On `ready-to-show` and on `restore` (back from the taskbar) the computed bounds are applied again: Windows clamps the initial height and rounds sizes badly across monitors with different scaling; docked, `restore` also recomputes the dock display.

- Height: the note fills the window minus margins; the task list (`.scroll`) takes the leftover space. Note height 300 (`MIN_NOTE_HEIGHT`) to the work area height, default 538; collapsed note is the header (48, window 132).
- Height drag: own 6 px handles at the note's top/bottom edges (not the transparent margin). Renderer sends absolute `screenY` (pointer capture); main computes from the start bounds with `resizeHeight`. Disabled when collapsed. A free note always fits in its work area: if the note sticks out on the right (e.g. going 308 → 360) it is shifted left (the right shadow may stay outside); window top ≥ work area top (Windows clamps it there when dragging), note bottom ≤ work area bottom (`maxFreeNoteHeight` = work area − top margin = full height). `fitFreeBounds` on create, expand and unpin; `freeResizeLimits` while dragging.
- Pinned = docked (does not imply always on top; that is a separate toggle): anchored to the right edge of the work area of `pickDockDisplay` (rightmost non-primary display; primary if only one). Margins become `DOCKED_MARGIN` (only left 60), corners square (`--note-radius: 0`), and the root gets `is-docked` (main passes `?docked=1` on load for the first frame, then `window:docked` events). Not movable (`setMovable(false)`, header `no-drag`); `x`/`y` are not saved while docked. Always full work-area height; the resize handles are hidden and ignored while docked. Unpin restores the free position/height.
- Header gap is 2 px: at 308 px the top row fits gear, short date (~76 px) and 5 buttons with ~11 px to spare. The date is short (`Dom, 15 nov`) in both widths because the long one does not fit docked.
- Always on top (`alwaysOnTop` pref, button `.on-top` before pin, `window:set-always-on-top`): independent of pin, works free and docked, saved and passed to the constructor. `reapplyAlwaysOnTop()` turns it off and on again on `show` and `restore`: on Windows the constructor flag (window created hidden) is not always applied, and if Electron already thinks it is on top, `setAlwaysOnTop(true)` is a no-op.
- Header buttons on the top row, right side: always on top, pin, collapse (dash icon, title "Colapsar": collapses/expands to the header), minimize to taskbar (`arrowDown`, title "Minimizar a la barra de tareas": native `win.minimize()` via `window:minimize`, works free/docked, collapsed/expanded), close. Minimizing saves nothing new (pending free position is flushed first; `persistPosition` skips while minimized because Windows reports -32000); a quit while minimized reopens normal.
- Auto-launch (`auto-launch.ts`): login item follows `pinned` (on startup, pin, unpin), registering `process.execPath` (installed exe, no args) with name `My Sticky Notes`. Only when packaged: skipped if `!app.isPackaged` (dev and `npm start`), with `ELECTRON_RENDERER_URL` or `--user-data-dir` (E2E). The uninstaller removes the `HKCU\...\Run` value.

### Installer (SPEC 06)

- electron-builder NSIS x64, assisted (`oneClick: false`, per-user by default, per-machine with admin), Spanish only, license `LICENSE`, desktop + Start menu shortcuts, run after finish. Package contains only `out/**` and `package.json`.
- `build/installer.nsh` (must stay UTF-8 with BOM; `-WX` makes NSIS warnings fatal): Windows 10+ check in `customInit`; own welcome text; the welcome/finish sidebar (installer and uninstaller) is drawn with native nsDialogs labels/icons, not a bitmap: full-width `#252526` rows (app icon, name, version, "CREADO POR", author logo from `author-logo.ico`, name, email) with no gaps; uninstaller page with "Borrar también mis notas" (unchecked) that deletes `%APPDATA%\my-sticky-notes` only when checked and never on updates.
- Data folders: installed `%APPDATA%\my-sticky-notes\` (the user's real notes), dev/`npm start` `%APPDATA%\my-sticky-notes-dev\`. Installed and dev can run at the same time.
- Windows Explorer caches file icons: after rebuilding the `.exe` with a new icon, run `ie4uinit.exe -show`.

### Persistence

One file `userData/note.json` holds note + window prefs (`pinned`, `collapsed`, `x`, `y`, `height`, `alwaysOnTop`; on read `height` is optional → `null` and `alwaysOnTop` is optional → `false`, but `null` or a non-boolean `alwaysOnTop` makes the file invalid). Format `version: 2`: `note.days` maps `YYYY-MM-DD` to that day's tasks; optional `note.lastCarryOver` (`YYYY-MM-DD`, day the "Traer tareas de ayer" button was used; absent = never, `null` or a bad format makes the file invalid). A `version: 1` file (`note.title` + `note.tasks`) is migrated on read: tasks go to today, title is dropped; the next save (often the window position save on startup) writes v2. IPC channels: `note:load`, `note:save`, `window:get-prefs` (prefs + `docked`), `window:set-pinned`, `window:set-collapsed`, `window:set-always-on-top`, `window:resize-start`/`-move`/`-end` (send), `window:minimize` (send), `window:close`, `app:open-link` (send, `ExternalLinkKey`); main → renderer `window:docked`. `before-quit` persists position and awaits `repository.flush()`.

## Conventions

- Tests for core and main logic live in `tests/`; keep core testable without Electron.
- Footer formatting buttons are intentionally inert (out of scope so far); the gear menu only has "Acerca de". The day-row "+" adds a task (SPEC 05), it does not create another note. Nothing moves between days on its own (SPEC 07): the only way to repeat a past list is the "Traer tareas de ayer" button (copy, not move).
- `npm run dev` hot-reloads only the renderer: changes in `src/main` or `src/preload` need a restart of `npm run dev` (the UI may show a new button whose IPC does not exist yet in the running main).
- E2E/manual runs against the built app: isolate data with `electron . --user-data-dir=<tmp>`. Overriding `APPDATA` does NOT work on Windows and would write the user's real `note.json`. The user's own instance is often running from the same `electron.exe`: only stop processes whose command line has your `--user-data-dir`.
- Driving the app without the real mouse: launch with `--remote-debugging-port=<n>` and use CDP (`Runtime.evaluate`, `Input.dispatchMouseEvent`). Synthetic pointer coords are relative to the window, so compensate when a top-edge drag moves it. Measure window bounds with Win32 `GetWindowRect` (DPI-aware): the renderer's `outerHeight`/`innerHeight` go stale while the window is covered. Screenshots of the transparent window need `PrintWindow(…, 2)` or `BitBlt` with `CAPTUREBLT`.
- Working-copy files are CRLF (ESLint shows many pre-existing `Delete ␍` warnings, 0 errors). Run Prettier only on files you touched; running it on whole folders rewrites line endings of unrelated files.
- Specs: implement only what the spec says; scope changes go into the spec (mark them "añadido durante la implementación" in Decisiones). Never commit without being asked.

## Design reference

`docs/references/Artboard-cltk.dc.html` is the source of truth for the UI: a single dark-mode sticky-note window. It is a REFERENCE MOCKUP, not production code — replicate its values in the app's styling; do not copy the markup wholesale.

- Values live in inline `style="…"` attributes and the `<helmet><style>` block. `{{…}}`, `<sc-if>`, `<sc-for>` are the design tool's template syntax; the `class Component extends DCLogic` script is the behavior spec.
- It does not render from this folder: its runtime lives only in the sibling `../Mockup/` folder. To view, serve `../Mockup/` (e.g. `python -m http.server`) and open `Artboard-cltk.dc.html`.

### Behavior captured in the mockup

- Note: editable title, pin toggle ("Fijada" in footer when pinned), minimize (collapses everything below the header), close, "Nueva nota". The app deliberately drops the title (SPEC 03) and, since SPEC 04, splits the header in two rows (actions on top, day tabs + history below) and pin means dock (not always on top). Since SPEC 05 the free note is 360 px (docked 308), the mockup's minimize is called "Colapsar", a separate button minimizes to the taskbar, the mockup's "Nueva nota" (+) is "Nueva tarea" in the day row: it opens the add-task row, hidden by default. The date moved from the progress block to the top row (short form), the progress block gained a ring, and the top row gained a settings gear and an always-on-top button.
- Tasks: `{ id, hour, text, done, subtasks: [{ id, text, done }] }`. One level of subtasks only, indented with a left border.
- Progress header: date label (`Jueves, 12 nov`), "`N de M hechas`", progress bar (in the app since SPEC 05: ring + count + bar; the date is in the header). Counts include tasks AND subtasks. Marking a task does not touch its subtasks.
- Footer formatting toggles: bold, italic, underline, strikethrough, bullet list, "Adjuntar imagen".
- Accent color `--accent`, default `#F5C451`; options `#F5C451`, `#60CDFF`, `#7EE0A8`, `#C4A7FF`.

### Key design tokens

- Font: Inter 400/500/600 (bundled locally), fallback `system-ui, sans-serif`.
- Page bg `#141416`; note bg `#252526`, 360px wide (the app uses 360 free, 308 docked, SPEC 05), radius 16px, border `rgba(255,255,255,0.08)`, shadow `0 24px 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(0,0,0,0.4)`; footer bg `#222223`.
- Text: primary `#f4f4f5` / `#e4e4e7`, subtask `#d4d4d8`, muted `#a1a1aa`, placeholder `#8b8b92`.
- Done items: line-through + opacity .5. Close button hover `#c42b1c`. Focus ring: 2px solid accent, offset 2px.
