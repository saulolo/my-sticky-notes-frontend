# SPEC 03 — Pestañas por día (Ayer, Hoy, Mañana y días pasados)

> **Estado:** Imlementado
> **Depende de:** SPEC 01, SPEC 02
> **Fecha:** 2026-11-14 (revisada el 2026-11-14: sin título, pestaña Ayer)
> **Objetivo:** La nota guarda una lista de tareas por día y muestra pestañas "Ayer", "Hoy" y "Mañana" en el header (sin título), con un menú para los días anteriores a ayer, y al cambiar de día lo pendiente pasa solo a Hoy.

---

## Por qué existe esta spec

Hoy la nota tiene una sola lista. El usuario quiere planear las tareas del día siguiente sin mezclarlas con las de hoy. También quiere conservar los días pasados como registro, y que lo que quedó pendiente no se pierda al cambiar de día.

---

## Alcance

**Entra:**

- Cada pestaña es un día del calendario local. Su nombre sale de la fecha, no lo escribe el usuario.
- La nota no tiene título: se quita el input "Today Task" del header y `title` del modelo.
- En el header, a la derecha del botón "Nueva nota", se ven siempre tres pestañas en este orden: "Ayer", "Hoy" y "Mañana". Ayer y Mañana existen aunque estén vacías.
- Un botón de historial (icono de reloj), a la derecha de las pestañas, abre un menú con los días anteriores a ayer (hoy − 2 a hoy − 5) que tienen tareas, del más reciente al más viejo, con `dateLabel` (`Miércoles, 11 nov`). Si no hay, muestra "Sin días anteriores".
- Al elegir un día del menú, ese día queda activo y el botón de historial se marca como activo.
- La pestaña activa se marca con el color `--accent`. Al abrir la app, la pestaña activa es siempre "Hoy" (no se guarda).
- La lista, la fila de añadir y el progreso ("N de M hechas", barra) muestran el día activo. La etiqueta de fecha del progreso muestra la fecha del día activo.
- Todos los días son editables, también los pasados: añadir, marcar, editar, cambiar hora, borrar, subtareas.
- **Rotación de día:** se ejecuta al abrir la app y a las 00:00 si la app sigue abierta.
  - Todas las tareas con `done: false` de cualquier día anterior a hoy se mueven a la lista de hoy, con sus subtareas tal cual (hechas o no). Conservan `id`, `hour`, `createdAt` y `collapsed`.
  - Una tarea con `done: true` no se mueve, aunque tenga subtareas pendientes.
  - Lo que era "Mañana" pasa a ser "Hoy" sin copiar nada: las listas van por fecha.
  - Después de mover, se borran los días anteriores a hoy − 5 y los días pasados que quedaron sin tareas.
- Migración del archivo: `note.json` en `version: 1` se lee y sus tareas quedan como la lista de hoy. El siguiente guardado escribe `version: 2`.
- Tests de dominio (`day.ts`, operaciones, rotación, validación y migración) y de `NoteStore`.

**Fuera de alcance:**

- Pestañas libres con nombre propio (Trabajo, Casa…).
- Planear días después de mañana. El botón "Nueva nota" (+) sigue inerte.
- Mover o copiar tareas entre días a mano (arrastrar, "pasar a mañana").
- Título de la nota (se quita).
- Recordar la pestaña activa entre sesiones.
- Más de 5 días de historial.

---

## Modelo de datos

```ts
/** Fecha local `YYYY-MM-DD`. Ej.: `2026-11-14`. */
type DayKey = string

interface Note {
  /** Una lista por día. Día sin entrada = lista vacía. Orden de inserción dentro de cada día. */
  days: Record<DayKey, Task[]>
}

interface StoredData {
  version: 2
  note: Note
  window: WindowPrefs
}
```

`Task` y `Subtask` no cambian. Los `id` de tarea siguen siendo únicos en toda la nota, no por día.

Nuevo módulo `src/core/domain/day.ts` (puro, sin `Date.now()`; la fecha llega por parámetro):

- `dayKey(date: Date): DayKey` — fecha local, no UTC.
- `addDays(key: DayKey, n: number): DayKey`.
- `dayLabel(key: DayKey, today: DayKey): string` — `"Hoy"`, `"Mañana"`, `"Ayer"` o `dateLabel` de esa fecha.
- `pastDays(note: Note, today: DayKey): DayKey[]` — días anteriores a hoy con al menos una tarea, del más reciente al más viejo.
- `HISTORY_DAYS = 5`.

Cambios en `note-operations.ts`:

- `addTask(note, day, text, ctx, hour?)`: añade al día `day`.
- `tasksOf(note, day): Task[]`: lista del día (vacía si no existe).
- Las demás operaciones (`toggleTask`, `editTask`, `setTaskHour`, `deleteTask`, subtareas…) buscan la tarea por `id` en todos los días. Su firma no cambia.
- `rollOver(note, today): Note`: mueve pendientes y poda días, según el Alcance. Si no cambia nada devuelve el mismo `Note`. Es idempotente.

`validate-stored-data.ts`: `validateStoredData(value, today)` acepta `version: 1` y `version: 2` y siempre devuelve `StoredData` v2. En v1, `note.tasks` pasa a `note.days[today]` (si está vacío, `days` queda `{}`) y `note.title` se descarta. En v2 se ignora un `title` sobrante.

Se eliminan `DEFAULT_TITLE`, `renameNote` (operación y `NoteStore`) y el input de título del header.

`NoteStore`:

- `addTask(day, text, hour?)`.
- `rollOver(): boolean` — usa el `Clock`. Si cambia algo, programa el autoguardado.
- `load()` llama a `rollOver()` después de cargar.

`json-note-repository.ts` recibe una función `today: () => DayKey` para la migración. El archivo vacío por defecto es `version: 2` con `days: {}`.

---

## Plan de implementación

1. Crear `src/core/domain/day.ts` con `dayKey`, `addDays`, `dayLabel`, `pastDays` y `HISTORY_DAYS`. Tests en `tests/`. La app no cambia.
2. Pasar el modelo a `Note.days` y `StoredData` v2: `note.ts`, `note-operations.ts` (`addTask` con día, `tasksOf`, búsqueda por id en todos los días), `window-prefs.ts`, `validate-stored-data.ts` con migración v1, `json-note-repository.ts` con `today`, `NoteStore.addTask(day, …)`. El renderer usa siempre el día de hoy. Prueba manual: la app se ve igual y un `note.json` v1 carga sus tareas.
3. Añadir `rollOver` en `note-operations.ts` y `NoteStore.rollOver()`, llamado desde `load()`. Tests: mover pendientes, no mover hechas, subtareas intactas, poda de días, idempotencia, salto de varios días.
4. Pestañas "Hoy" y "Mañana" en `header.ts` y estilos en `app.css`. Estado `activeDay` en `src/renderer/main.ts`. Lista, fila de añadir y progreso siguen al día activo (`progress.ts` gana `setDate(label)`). Prueba manual: añadir tareas en Mañana no las muestra en Hoy.
5. Botón de historial (`icons.history`) y menú de días pasados en `header.ts`. Cierra con Esc, con clic fuera o al elegir un día.
6. Temporizador en `src/renderer/main.ts` que dispara a las 00:00 locales: llama a `store.rollOver()`, refresca etiquetas y pestañas, pasa la pestaña activa a "Hoy" si estaba en el día que acaba de terminar o en Mañana, y se reprograma.
7. Revisión: quitar el título (`Note.title`, `DEFAULT_TITLE`, `renameNote`, input del header; la validación descarta `title` de v1 y v2) y añadir la pestaña "Ayer" antes de "Hoy". El menú de historial excluye ayer. Tests ajustados.

---

## Criterios de aceptación

- [x] Al abrir la app se ven, sin título, las pestañas "Ayer", "Hoy" (activa) y "Mañana" en ese orden, y el botón de historial.
- [x] Una tarea añadida en "Mañana" no aparece en "Hoy", y viceversa.
- [x] El progreso y la etiqueta de fecha cambian al cambiar de pestaña (en Mañana se ve la fecha de mañana).
- [x] Con la fecha del sistema avanzada un día y la app reabierta: lo que estaba en Mañana está en Hoy, y las tareas pendientes del día anterior también están en Hoy.
- [x] Tras esa rotación, la pestaña "Ayer" muestra solo las tareas que estaban hechas.
- [x] Una tarea hecha con una subtarea pendiente se queda en su día. Una tarea pendiente viaja con todas sus subtareas.
- [x] Con la app abierta al pasar las 00:00, la rotación ocurre sin reiniciar.
- [x] El menú de historial nunca muestra días anteriores a hoy − 5, ni días sin tareas.
- [x] Una tarea de un día pasado se puede marcar, editar y borrar desde la pestaña Ayer y desde el menú de historial.
- [x] El menú de historial no repite Ayer.
- [x] Un `note.json` con `version: 1` carga sus tareas en Hoy, y el siguiente guardado escribe `version: 2`.
- [x] Reiniciar la app el mismo día no cambia las listas (la rotación es idempotente).
- [x] `npm test`, `npm run lint` y `npm run typecheck` pasan.

---

## Decisiones

- **Sí:** pestañas = días del calendario. "Mañana pasa a Hoy" sale gratis porque las listas van por fecha.
- **No:** pestañas libres con nombre. Pedido inicialmente, pero mezclar dos tipos de pestaña agranda la spec. Si llega, va en otra spec.
- **Sí:** mover (no copiar) los pendientes al rotar. Evita duplicados.
- **Sí:** mover los pendientes de todos los días pasados, no solo de ayer. Cubre días sin abrir la app y tareas desmarcadas en días viejos.
- **Sí (revisión):** "Ayer", "Hoy" y "Mañana" visibles; los días anteriores a ayer van en un menú. Antes eran solo Hoy y Mañana con el título; se cambió a pedido del usuario.
- **Sí (revisión):** sin título. Libera el espacio para la tercera pestaña; el día ya se lee en la pestaña y en la etiqueta de fecha. Antes: título único editable.
- **Sí:** días pasados editables, por pedido del usuario. Consecuencia: una tarea desmarcada o añadida en un día pasado se mueve a Hoy en la siguiente rotación.
- **Sí:** `version: 2` con migración al leer. Las tareas actuales no se pierden.
- **Sí:** las operaciones por id buscan en todos los días. Menos cambios de firma; los ids ya son únicos.
- **No:** guardar la pestaña activa. Al abrir, lo útil es ver Hoy.

---

## Riesgos

| Riesgo | Mitigación |
| ------ | ---------- |
| El equipo suspende y el temporizador de 00:00 dispara tarde | `rollOver` es idempotente y usa la fecha actual del `Clock`. Disparar tarde da el mismo resultado. |
| Zona horaria o cambio de horario de verano | `DayKey` se calcula con fecha local, nunca UTC. El temporizador se recalcula en cada disparo. |
| Archivo v1 con datos inválidos | Se aplica la validación estricta actual antes de migrar. Si falla, se respalda como `note.corrupt-<ts>.json` (SPEC 01). |
| El header no cabe en 360 px | Sin título, un espaciador flexible separa pestañas y botones. Nada se encoge. |

---

## Qué **no** entra en esta spec

- Pestañas libres con nombre propio.
- Días después de mañana.
- Mover tareas entre días a mano.
- Título de la nota.
- Historial de más de 5 días.

Cada una, si llega, va en su propia spec.
