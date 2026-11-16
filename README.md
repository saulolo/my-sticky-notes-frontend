# My Sticky Notes

Nota adhesiva de escritorio (Electron) con tareas, subtareas y autoguardado. Basada en el mockup `docs/references/Artboard-cltk.dc.html`, con cambios propios: sin título, nota de 308 px, cabecera en dos filas y Fijar = anclar.

## Funciones

- Una lista de tareas por día. Pestañas "Ayer", "Hoy" y "Mañana" siempre visibles; el botón de historial (reloj) abre los días anteriores con tareas (hasta hoy − 5). Todos los días son editables. Al abrir, la pestaña activa es Hoy.
- Cambio de día (al abrir la app y a las 00:00 con la app abierta): las tareas pendientes de días pasados pasan a Hoy con sus subtareas; las hechas se quedan en su día. Se borran los días anteriores a hoy − 5 y los días pasados vacíos.
- Fecha del día activo y progreso (`N de M hechas`, tareas + subtareas).
- Tareas con hora manual (0–23; vacío = hora actual), ordenadas por hora. Una sola capa de subtareas, contraíble. Edición con doble clic (texto y hora), borrado.
- Sin título de nota: el día se lee en la pestaña y en la fecha.
- Autoguardado en JSON (debounce 300 ms) en `userData/note.json` (formato `version: 2`, una lista por día). Un archivo `version: 1` se migra al leerlo: sus tareas pasan a Hoy.
- Alto ajustable arrastrando el borde superior o inferior de la nota (mín. 300 px, máx. el alto del área útil del monitor). La nota libre siempre cabe en pantalla: llega hasta el borde superior y su pie nunca queda bajo la barra de tareas. Colapsada no se redimensiona.
- Ancho fijo de 308 px. Cabecera en dos filas: arriba "Nueva nota", fijar, minimizar y cerrar (zona para arrastrar la ventana); abajo "Ayer", "Hoy", "Mañana" e historial.
- Fijar = anclar: la nota se pega al borde derecho del monitor no principal más a la derecha (con un solo monitor, el principal), a todo el alto del área útil sin tapar la barra de tareas. Anclada tiene esquinas cuadradas, no se mueve ni cambia de alto: siempre ocupa todo el alto, sin importar el alto libre. Colapsada, la cabecera queda arriba. Si cambian los monitores, se vuelve a anclar. Fijada es una ventana normal (no siempre encima): las demás ventanas la tapan. Desfijar la devuelve a su posición y alto libres.
- Inicio automático con Windows ligado a Fijar: fijada, la app se abre sola (y anclada) al iniciar sesión; desfijada, no. Se registra `electron.exe` + la carpeta del proyecto, así que funciona con la app construida (`npm run build` + `npm start`) mientras la carpeta no se mueva ni se borre `out/`; si se mueve, desfijar y volver a fijar re-registra la ruta. No se registra con `npm run dev` ni con `--user-data-dir`.
- Minimizar (colapsa la nota a la fila superior de la cabecera) y cerrar.
- Se recuerda posición, alto, fijada y colapsada; si la posición queda fuera de pantalla, se centra.
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
  main/        proceso principal: ventana (alto, anclaje), inicio automático, IPC, JsonNoteRepository
  preload/     puente seguro: expone window.stickyApi
  renderer/    UI en TypeScript vanilla (ui/, styles/, infrastructure/)
tests/         domain, application, main (lógica de ventana y autoarranque sin Electron)
specs/         especificaciones (01 nota de escritorio, 02 hora manual y orden, 03 pestañas por día, 04 alto ajustable y anclaje)
```

Seguridad: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`. El renderer solo ve `window.stickyApi`.

## Stack

Electron 44, electron-vite 6, Vite 8, TypeScript 5.9, Vitest 3, ESLint 10, Prettier. Fuente Inter local (`@fontsource/inter`).
