# My Sticky Notes

Nota adhesiva de escritorio (Electron) con tareas, subtareas y autoguardado. Basada en el mockup `docs/references/Artboard-cltk.dc.html`, con cambios propios: sin título, nota de 360 px libre y 308 px anclada, cabecera en dos filas, Fijar = anclar, "Siempre encima", botón para minimizar a la barra de tareas y anillo de progreso.

## Funciones

- Una lista de tareas por día. Pestañas "Ayer", "Hoy" y "Mañana" siempre visibles; el botón de historial (reloj) abre los días anteriores con tareas (hasta hoy − 5). Todos los días son editables. Al abrir, la pestaña activa es Hoy.
- Cambio de día (al abrir la app y a las 00:00 con la app abierta): las tareas pendientes de días pasados pasan a Hoy con sus subtareas; las hechas se quedan en su día. Se borran los días anteriores a hoy − 5 y los días pasados vacíos.
- Fecha corta del día activo en la cabecera (`Dom, 15 nov`): cambia con la pestaña y se ve también colapsada.
- Progreso: anillo pequeño, `N de M hechas` (tareas + subtareas) y barra, con el mismo porcentaje.
- Tareas con hora manual (0–23; vacío = hora actual), ordenadas por hora. Una sola capa de subtareas, contraíble. Edición con doble clic (texto y hora), borrado.
- Sin título de nota: el día se lee en la pestaña y en la fecha de la cabecera.
- Autoguardado en JSON (debounce 300 ms) en `userData/note.json` (formato `version: 2`, una lista por día). Un archivo `version: 1` se migra al leerlo: sus tareas pasan a Hoy.
- Alto ajustable arrastrando el borde superior o inferior de la nota (mín. 300 px, máx. el alto del área útil del monitor). La nota libre siempre cabe en pantalla: llega hasta el borde superior y su pie nunca queda bajo la barra de tareas. Colapsada no se redimensiona.
- Ancho fijo según el estado: 360 px libre, 308 px anclada (colapsada conserva el de su estado). Si al desfijar la nota no cabe por la derecha, se corre a la izquierda. Cabecera en dos filas: arriba engranaje, fecha, "Siempre encima", fijar, colapsar, minimizar a la barra de tareas y cerrar (zona para arrastrar la ventana); abajo "+" (nueva tarea) a la izquierda, "Ayer", "Hoy", "Mañana" centrados e historial a la derecha.
- Fijar = anclar: la nota se pega al borde derecho del monitor no principal más a la derecha (con un solo monitor, el principal), a todo el alto del área útil sin tapar la barra de tareas. Anclada tiene esquinas cuadradas, no se mueve ni cambia de alto: siempre ocupa todo el alto, sin importar el alto libre. Colapsada, la cabecera queda arriba. Si cambian los monitores, se vuelve a anclar. Fijar no implica "Siempre encima": sin él, las demás ventanas la tapan. Desfijar la devuelve a su posición y alto libres.
- Inicio automático con Windows ligado a Fijar: fijada, la app se abre sola (y anclada) al iniciar sesión; desfijada, no. Se registra `electron.exe` + la carpeta del proyecto, así que funciona con la app construida (`npm run build` + `npm start`) mientras la carpeta no se mueva ni se borre `out/`; si se mueve, desfijar y volver a fijar re-registra la ruta. No se registra con `npm run dev` ni con `--user-data-dir`.
- "Siempre encima" (icono de capas, junto a fijar): la ventana queda delante de las demás, libre o anclada. Se marca con el acento y se recuerda al reabrir.
- Engranaje de configuración: por ahora abre un menú "Próximamente". Colapsada, primero expande la nota.
- Colapsar (guion: deja solo la fila superior de la cabecera) y cerrar.
- Minimizar a la barra de tareas (flecha hacia abajo): minimizado nativo de Windows, libre o anclada. Se restaura con el icono de la barra (o Alt+Tab) tal como estaba. No se recuerda entre sesiones: si se cierra minimizada, abre normal.
- Se recuerda posición, alto, fijada, colapsada y "Siempre encima"; si la posición queda fuera de pantalla, se centra.
- `note.json` corrupto: arranca vacío y respalda el original como `note.corrupt-<timestamp>.json`.
- Nueva tarea con el "+" de la fila de días: la fila "Añadir nueva tarea…" está oculta por defecto; "+" la muestra con el foco (colapsada no hay "+"). Enter crea la tarea y deja el foco listo para la siguiente; clic fuera o Esc la ocultan y descartan lo no enviado.
- Sin función aún: la barra de formato del pie y las opciones del engranaje.

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
