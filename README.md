# My Sticky Notes

Nota adhesiva de escritorio (Electron) con tareas, subtareas y autoguardado. Réplica fiel del mockup `docs/references/Artboard-cltk.dc.html`.

## Funciones

- Una lista de tareas por día. Pestañas "Ayer", "Hoy" y "Mañana" siempre visibles; el botón de historial (reloj) abre los días anteriores con tareas (hasta hoy − 5). Todos los días son editables. Al abrir, la pestaña activa es Hoy.
- Cambio de día (al abrir la app y a las 00:00 con la app abierta): las tareas pendientes de días pasados pasan a Hoy con sus subtareas; las hechas se quedan en su día. Se borran los días anteriores a hoy − 5 y los días pasados vacíos.
- Fecha del día activo y progreso (`N de M hechas`, tareas + subtareas).
- Tareas con hora manual (0–23; vacío = hora actual), ordenadas por hora. Una sola capa de subtareas, contraíble. Edición con doble clic (texto y hora), borrado.
- Sin título de nota: el día se lee en la pestaña y en la fecha.
- Autoguardado en JSON (debounce 300 ms) en `userData/note.json` (formato `version: 2`, una lista por día). Un archivo `version: 1` se migra al leerlo: sus tareas pasan a Hoy.
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
    domain/      Note (días), Task, operaciones inmutables, rotación de día, validación y migración, días y etiquetas de fecha
    application/ NoteStore (estado, autoguardado, rotación), puertos (Clock, NoteRepository)
  main/        proceso principal: ventana, IPC, JsonNoteRepository
  preload/     puente seguro: expone window.stickyApi
  renderer/    UI en TypeScript vanilla (ui/, styles/, infrastructure/)
tests/         domain, application, main
specs/         especificaciones (01 nota de escritorio, 02 hora manual y orden, 03 pestañas por día)
```

Seguridad: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`. El renderer solo ve `window.stickyApi`.

## Stack

Electron 44, electron-vite 6, Vite 8, TypeScript 5.9, Vitest 3, ESLint 10, Prettier. Fuente Inter local (`@fontsource/inter`).
