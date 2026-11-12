# My Sticky Notes

Nota adhesiva de escritorio (Electron) con tareas, subtareas y autoguardado. Réplica fiel del mockup `docs/references/Artboard-cltk.dc.html`.

## Funciones

- Título editable, fecha en cabecera y progreso (`N de M hechas`, tareas + subtareas).
- Tareas con hora (hora local al crearlas), una sola capa de subtareas, edición con doble clic, borrado.
- Autoguardado en JSON (debounce 300 ms) en `userData/note.json`.
- Fijar (siempre encima), minimizar (colapsa bajo la cabecera) y cerrar.
- Se recuerda posición, fijada y colapsada; si la posición queda fuera de pantalla, se centra.
- `note.json` corrupto: arranca vacío y respalda el original como `note.corrupt-<timestamp>.json`.
- Sin función aún: "Nueva nota" y la barra de formato del pie.

## Requisitos

Node 24+ y npm 11+.

## Comandos

| Comando             | Acción                                  |
| ------------------- | --------------------------------------- |
| `npm install`       | Instala dependencias y Electron         |
| `npm run dev`       | Arranca la app con recarga en caliente  |
| `npm run build`     | Typecheck + build a `out/`              |
| `npm start`         | Ejecuta el build (`electron-vite preview`) |
| `npm test`          | Tests (Vitest)                          |
| `npm run lint`      | ESLint                                  |
| `npm run typecheck` | `tsc` para node y web                   |
| `npm run format`    | Prettier                                |

## Arquitectura

```
src/
  core/        dominio + aplicación puros (sin electron ni DOM)
    domain/      Note, Task, operaciones inmutables, validación, etiqueta de fecha
    application/ NoteStore (estado, autoguardado), puertos (Clock, NoteRepository)
  main/        proceso principal: ventana, IPC, JsonNoteRepository
  preload/     puente seguro: expone window.stickyApi
  renderer/    UI en TypeScript vanilla (ui/, styles/, infrastructure/)
tests/         domain, application, main
specs/         especificaciones (01-nota-de-escritorio.md)
```

Seguridad: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`. El renderer solo ve `window.stickyApi`.

## Stack

Electron 44, electron-vite 6, Vite 8, TypeScript 5.9, Vitest 3, ESLint 10, Prettier. Fuente Inter local (`@fontsource/inter`).
