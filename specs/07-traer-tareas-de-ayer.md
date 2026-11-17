# SPEC 07 — Hoy empieza limpio y botón "Traer tareas de ayer"

> **Estado:** Aprobado
> **Depende de:** SPEC 02, SPEC 03, SPEC 05
> **Fecha:** 2026-11-17
> **Objetivo:** Al cambiar de día ya no se mueve ninguna tarea: Hoy empieza vacío, cada día conserva sus tareas hechas o no, y un botón "Traer tareas de ayer" copia una vez al día, sin marcar, la lista del último día con tareas.

---

## Por qué existe esta spec

La SPEC 03 mueve a Hoy las tareas pendientes de los días pasados y deja en Ayer solo las hechas. El usuario quiere otra cosa: ver cada día pasado tal como terminó (hechas y pendientes) y decidir él si quiere repetir la lista. Hoy debe empezar limpio, y traer la lista anterior debe ser una acción explícita.

Esta spec reemplaza la regla "los pendientes pasan solos a Hoy" de la SPEC 03. La poda del historial (5 días) se mantiene.

---

## Alcance

**Entra:**

- **Rotación de día sin mover tareas.** `rollOver` (al abrir la app y a las 00:00, como en la SPEC 03) ya no mueve nada:
  - Cada día pasado conserva todas sus tareas, hechas o no, con sus subtareas tal cual.
  - Se siguen borrando los días anteriores a hoy − 5 y los días pasados sin tareas.
  - Lo planeado en "Mañana" pasa a "Hoy" igual que antes (las listas van por fecha).
- **Botón "Traer tareas de ayer"** en la pestaña Hoy:
  - Aparece dentro de la lista, centrado, bajo el texto "Sin tareas para hoy".
  - Solo se ve si se cumplen las tres condiciones: la pestaña activa es Hoy, Hoy no tiene tareas, y el botón no se usó hoy y existe un día de origen.
  - En las demás pestañas, o si alguna condición falla, no se ve nada nuevo (la lista vacía queda como hoy).
  - Si el usuario borra todas las tareas de Hoy después de usarlo, el botón no vuelve hasta el día siguiente.
- **Día de origen:** el día más reciente anterior a hoy que tiene al menos una tarea (ej. hoy lunes, ayer vacío → el viernes). El texto del botón es "Traer tareas de ayer" en todos los casos.
- **Qué copia:** todas las tareas del día de origen, hechas o no, al final de la lista de Hoy (se muestran ordenadas por hora, SPEC 02).
  - Cada copia tiene un `id` nuevo; cada subtarea copiada también.
  - Tareas y subtareas copiadas quedan con `done: false`.
  - Conservan `text`, `hour`, `createdAt` y `collapsed`.
  - El día de origen no cambia.
- **Una vez por día:** al usarlo se guarda en la nota el día en que se usó (`lastCarryOver`).
- **Primer arranque con esta versión:** no hace nada especial. Si Hoy ya tiene tareas (movidas por la regla vieja), el botón no aparece.
- **Textos:**
  - "Acerca de" (`src/renderer/ui/about.ts`): "Las tareas pendientes pasan solas al día siguiente." pasa a "Cada día empieza limpio; con un clic traes las tareas de ayer, sin marcar.".
  - `README.md`: líneas que describen la regla vieja (intro, tabla de funciones "Nada se queda atrás", "Tus datos" → Historial, notas adicionales).
  - `CLAUDE.md`: descripción de `rollOver`, operaciones nuevas, botón y campo `lastCarryOver`.
- Tests de dominio (`rollOver`, `carryOverSource`, `canCarryOver`, `carryOver`, validación) y de `NoteStore`.

**Fuera de alcance:**

- Traer tareas a Mañana u otros días, o desde un día elegido a mano.
- Elegir qué tareas traer (se traen todas).
- Botón en el header, en la fila de días o en el menú de historial.
- Traer tareas cuando Hoy ya tiene alguna.
- Deshacer la copia (se borran a mano).
- Cambiar los 5 días de historial.
- Subir la versión de la app o publicar un instalador nuevo.

---

## Modelo de datos

`Note` gana un campo opcional. `note.json` sigue en `version: 2`.

```ts
interface Note {
  days: Record<DayKey, Task[]>
  /** Día (local `YYYY-MM-DD`) en que se usó "Traer tareas de ayer". Ausente = nunca. */
  lastCarryOver?: DayKey
}
```

`Task` y `Subtask` no cambian.

`validate-stored-data.ts`:

- v2: `note.lastCarryOver` ausente es válido. Si existe, debe ser un string `YYYY-MM-DD`; cualquier otro valor (incluido `null`) hace inválido el archivo (respaldo `note.corrupt-<ts>.json`, SPEC 01). Se devuelve en el `Note`.
- v1: migra sin `lastCarryOver`.

`note-operations.ts` (puras; ids inyectados):

- `rollOver(note, today): Note` — solo poda (días anteriores a hoy − `HISTORY_DAYS` y días pasados vacíos). No mueve tareas. Mismo objeto si no cambia nada. Idempotente.
- `carryOverSource(note, today): DayKey | null` — día más reciente `< today` con tareas.
- `canCarryOver(note, today): boolean` — `lastCarryOver !== today`, `tasksOf(note, today)` vacío y `carryOverSource` no es `null`.
- `carryOver(note, today, newId: () => string): Note` — si `canCarryOver` es falso devuelve el mismo `Note`. Si no, añade las copias a `days[today]` y fija `lastCarryOver = today`.

`NoteStore`:

- `canCarryOver(): boolean` y `carryOver(): boolean` con la fecha del `Clock` y `deps.newId`. `carryOver` programa el autoguardado si cambia algo.
- `rollOver()` no cambia de firma.

Renderer: componente nuevo `src/renderer/ui/carry-over.ts` (bloque "Sin tareas para hoy" + botón), estilos en `src/renderer/styles/app.css`, montado desde `src/renderer/main.ts`.

---

## Plan de implementación

1. **Rotación sin mover.** `rollOver` en `note-operations.ts` solo poda; comentario de `NoteStore.rollOver` actualizado. Tests de `tests/domain/roll-over.test.ts` reescritos: nada se mueve, Ayer conserva hechas y pendientes, poda de días viejos y vacíos, idempotencia. Prueba manual: con `--user-data-dir` temporal y un `note.json` con tareas pendientes de ayer, al abrir Hoy está vacío y Ayer muestra todo.
2. **Modelo y operaciones.** `Note.lastCarryOver?`, validación (v1/v2, valores inválidos), `carryOverSource`, `canCarryOver`, `carryOver` y los métodos de `NoteStore`. Tests: copia con ids nuevos y todo desmarcado, origen intacto, salto de días vacíos, no copia si Hoy tiene tareas, una vez por día, mismo objeto si no aplica. La app no cambia de aspecto.
3. **Botón.** `carry-over.ts` + estilos (texto en color muted `#a1a1aa`, botón con foco 2 px `--accent`). `main.ts` lo muestra u oculta en cada cambio de nota y de pestaña, y al pulsar llama `store.carryOver()`. Prueba manual: libre (360 px) y anclada (308 px); pulsar trae las tareas desmarcadas y el botón desaparece; borrar todas no lo hace volver; a las 00:00 (o cambiando la fecha del sistema y reabriendo) vuelve a aparecer.
4. **Textos.** Frase del "Acerca de", `README.md` y `CLAUDE.md`.

---

## Criterios de aceptación

- [x] Con la fecha avanzada un día y la app reabierta, Hoy está vacío (salvo lo planeado en Mañana) y Ayer muestra todas sus tareas, hechas y pendientes, con su check tal como quedó.
- [x] Una tarea pendiente de hace 2–5 días sigue en su día del historial y no aparece en Hoy.
- [x] Los días anteriores a hoy − 5 y los días pasados vacíos se siguen borrando.
- [x] Con Hoy vacío y Ayer con tareas, la pestaña Hoy muestra "Sin tareas para hoy" y el botón "Traer tareas de ayer".
- [x] El botón no aparece en las pestañas Ayer, Mañana ni en días del historial.
- [x] El botón no aparece si Hoy tiene al menos una tarea.
- [x] Pulsarlo copia a Hoy todas las tareas del origen con sus subtareas, todas desmarcadas, con la misma hora y texto; el progreso de Hoy queda en `0 de M hechas`.
- [x] Tras pulsarlo, Ayer sigue igual (mismas tareas y mismos checks).
- [x] Marcar, editar o borrar una copia en Hoy no cambia la tarea original de Ayer.
- [x] Tras usarlo, borrar todas las tareas de Hoy no hace reaparecer el botón ese día; reiniciar la app tampoco.
- [x] Con ayer vacío y el día anterior con tareas, el botón trae las de ese día.
- [x] Sin ningún día pasado con tareas, el botón no aparece.
- [x] Al pasar las 00:00 con la app abierta, Hoy queda vacío y el botón aparece si hay origen.
- [x] El botón se ve completo libre (360 px) y anclada (308 px).
- [x] Un `note.json` sin `lastCarryOver` carga bien; uno con `lastCarryOver: null` o con formato inválido se respalda como corrupto.
- [x] El "Acerca de" muestra la frase nueva y ya no dice que las pendientes pasan solas.
- [x] `npm test`, `npm run lint` y `npm run typecheck` pasan.

---

## Decisiones

- **Sí:** Hoy empieza limpio y nada se mueve solo, por pedido del usuario. **No:** la regla de la SPEC 03 (mover pendientes a Hoy).
- **No** (descartado durante la definición): copiar sola toda la lista a Hoy al cambiar de día. El usuario prefirió que Hoy empiece limpio y traer la lista con un botón.
- **Sí:** copiar, no mover. Ayer queda como registro de cómo terminó el día.
- **Sí:** copias desmarcadas (tareas y subtareas). Hoy arranca con progreso 0. **No:** conservar el check de ayer.
- **Sí:** origen = último día anterior con tareas. Cubre fines de semana y días sin abrir la app. **No:** solo ayer exacto.
- **Sí:** botón dentro de la lista vacía de Hoy. No ocupa sitio en el header (a 308 px va justo, SPEC 05). Consecuencia: si Hoy ya tiene tareas (p. ej. planeadas en Mañana), no se puede traer la lista ese día. **No:** ícono en la fila de días ni ítem en el menú de historial.
- **Sí:** una vez por día, con `lastCarryOver` guardado en la nota. Evita duplicados por doble clic o al borrar todo. **No:** uso libre con duplicados.
- **Sí:** campo opcional en `version: 2`, sin subir versión de formato. Los archivos actuales siguen siendo válidos.
- **Sí:** ids nuevos para cada copia. Los ids son únicos en toda la nota (SPEC 03).
- **Sí:** se mantiene la poda de 5 días y de días pasados vacíos.
- **Sí:** el primer arranque con esta versión no hace nada especial.
- **No:** subir la versión ni generar instalador en esta spec.

---

## Riesgos

| Riesgo | Mitigación |
| ------ | ---------- |
| El usuario planea en Mañana y al día siguiente no puede traer la lista anterior | Comportamiento aceptado (botón solo con Hoy vacío). Queda en Decisiones; si molesta, otra spec. |
| Reloj del sistema atrasado: `lastCarryOver` queda en el futuro | `canCarryOver` compara igualdad con hoy; en otro día el botón vuelve a estar disponible. |
| Tareas pendientes "olvidadas" en el historial tras la poda de 5 días | Aceptado por el usuario: cada día conserva sus tareas y él decide qué traer. |
| Tests de la SPEC 03 que esperan mover pendientes | Se reescriben en el paso 1. |

---

## Qué **no** entra en esta spec

- Traer tareas a otros días o desde un día elegido.
- Elegir qué tareas traer.
- Botón fuera de la lista vacía de Hoy.
- Deshacer la copia.
- Cambiar el historial de 5 días.
- Nueva versión o instalador.

Cada una, si llega, va en su propia spec.
