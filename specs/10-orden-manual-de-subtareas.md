# SPEC 10 — Orden manual de subtareas (arrastrar y soltar)

> **Estado:** Implementado
> **Depende de:** SPEC 08, SPEC 09
> **Fecha:** 2026-11-23
> **Objetivo:** Las subtareas de una tarea se reordenan entre sí arrastrándolas con clic sostenido, con el mismo comportamiento que ya tienen las tareas principales (SPEC 08).

---

## Por qué existe esta spec

La SPEC 08 dejó fuera "reordenar subtareas entre sí": hoy las subtareas quedan en el orden en que se crearon y solo se mueven junto con su tarea. El usuario quiere colocarlas a mano igual que las tareas: mantener presionada una subtarea y moverla hacia arriba o abajo.

Esta spec solo añade el arrastre de subtareas. No cambia el arrastre de tareas de la SPEC 08 ni el resto del comportamiento de las subtareas (SPEC 01 y SPEC 09).

---

## Alcance

**Entra:**

- **Orden manual de subtareas.** El orden de las subtareas es el orden de `task.subtasks`, que ya se guarda tal cual. Subtarea nueva: al final (como hoy). Marcarla o editarla no la mueve.
- **Arrastrar una subtarea con clic sostenido en su fila (`.sub-row`):**
  - Mismo gesto que una tarea: se presiona en cualquier parte libre de la fila (fondo o texto) y empieza a moverse tras desplazar el puntero ~4 px. Un clic o doble clic sin desplazamiento sigue funcionando igual (doble clic edita el texto).
  - Check, botones (papelera) y el input de edición no inician arrastre.
  - Dentro de su tarea la subtarea se reordena entre sus hermanas. **Añadido durante la implementación:** también puede soltarse en otra tarea **del mismo día** (ver "Mover a otra tarea"). No se convierte en tarea ni cruza de día.
  - Mientras se arrastra: la fila sigue al puntero en vertical, las hermanas se apartan para mostrar el hueco y la lista se desplaza sola cerca de los bordes (como SPEC 08).
  - Mientras el puntero esté dentro del grupo de su tarea, la fila no sale de él: por encima de la primera hermana o por debajo de la última se queda en el extremo del grupo y el hueco es la primera o la última posición. Al salir hacia otra tarea del día pasa a la regla de "Mover a otra tarea".
  - Al soltar queda en el hueco mostrado y se guarda. Esc o `pointercancel` cancela y todo vuelve a su sitio.
  - Con una sola subtarea en un día con una sola tarea no se inicia el arrastre (no hay a dónde ir). Si el día tiene 2 o más tareas, una única subtarea sí puede pasar a otra tarea. Soltar en el mismo sitio no cambia nada ni guarda.
  - Funciona aunque el día tenga una sola tarea (el límite `< 2` de la SPEC 08 aplica solo a tareas).
  - Solo con las subtareas visibles (tarea expandida). Funciona en cualquier pestaña (Ayer, Hoy, Mañana e historial), libre y anclada.
- **Mover a otra tarea (añadido durante la implementación):**
  - Solo entre tareas del mismo día (la pestaña visible). No cruza días.
  - Mientras se arrastra, el puntero decide el destino: sobre las subtareas visibles de otra tarea, el hueco aparece entre ellas; sobre la fila de una tarea sin subtareas o contraída, la subtarea pasa a ser su última subtarea y la tarea se expande.
  - La subtarea se pinta dentro del grupo destino mientras se arrastra (el DOM se reordena en vivo) y la lista se desplaza sola cerca de los bordes, como con las tareas.
  - Conserva su `done` y su texto; los chips `hechas/total` de la tarea origen y de la destino se recalculan. Si la origen se queda sin subtareas, queda como tarea sin subtareas.
  - Al soltar se guarda en una sola operación; Esc o `pointercancel` devuelven todo a su sitio.
- **Sin interferencias con la SPEC 08 / 09:**
  - Presionar en una subtarea no arrastra la tarea padre; presionar en la fila de la tarea sigue arrastrando la tarea entera con sus subtareas.
  - Soltar una subtarea no dispara el clic que alterna las subtareas (SPEC 09) ni marca nada.
  - El chip `hechas/total` no cambia al reordenar (mismo total, mismas hechas).
  - "Traer tareas de ayer" (SPEC 07) copia las subtareas en el orden manual del día de origen (ya lo hace: copia el arreglo).
- **Textos:** `README.md` (reordenar subtareas) y `CLAUDE.md` (`moveSubtask`, arrastre de subtareas).
- Tests de dominio (`moveSubtask`) y de `NoteStore`.

**Fuera de alcance:**

- Mover una subtarea a una tarea de otro día.
- Convertir una subtarea en tarea o una tarea en subtarea.
- Mover tareas o subtareas entre días.
- Reordenar con teclado, asa de arrastre visible o botones subir/bajar.
- Cambiar el arrastre de tareas de la SPEC 08.
- Cambiar el formato de `note.json` o su `version`.
- Subir la versión de la app o generar un instalador nuevo.

---

## Modelo de datos

No hay campos nuevos ni cambio de `version`: el orden manual de las subtareas es el orden del arreglo `task.subtasks`, que ya se guarda y se valida tal cual (`note.json` sigue en `version: 3`).

`src/core/domain/note-operations.ts` (pura, inmutable):

- `moveSubtask(note, taskId, subtaskId, toIndex: number): Note` — mueve la subtarea dentro de `task.subtasks` a la posición final `toIndex` (0 = primera), limitada a `[0, n − 1]`. Busca la tarea en todos los días (como el resto de operaciones por id). Devuelve el mismo `Note` si la tarea o la subtarea no existen, `toIndex` no es entero o la subtarea ya está en esa posición. No toca las demás tareas ni otros días.

- `moveSubtaskToTask(note, fromTaskId, subtaskId, toTaskId, toIndex: number): Note` (añadida): quita la subtarea de `fromTaskId` y la inserta en `toTaskId` en la posición `toIndex`, limitada a `[0, m]` con `m` = subtareas del destino. Conserva `id`, `text` y `done`; el destino queda expandido (`collapsed` fuera). Ambas tareas deben existir y estar en el mismo día. Devuelve el mismo `Note` si la tarea origen o destino o la subtarea no existen, si `toIndex` no es entero, si son la misma tarea (para eso está `moveSubtask`) o si están en días distintos. No muta la original ni toca otras tareas.

`src/core/application/note-store.ts`:

- `moveSubtaskToTask(fromTaskId, subtaskId, toTaskId, toIndex): boolean` (añadido) con el mismo patrón.
- `moveSubtask(taskId: string, subtaskId: string, toIndex: number): boolean` con el patrón de los demás comandos (`false` si no cambió nada; autoguardado si cambió).

Renderer:

- `src/renderer/ui/task-list.ts`: nuevo handler `onMoveSubtask(taskId, subtaskId, toIndex)`. La lógica de arrastre de la SPEC 08 se generaliza para que el elemento arrastrado sea una tarea (`.task` dentro de la lista) o una subtarea (`.sub-row` dentro de su `.subtasks`): el contenedor y las hermanas dependen del tipo; los límites de posición son los del grupo de subtareas en lugar de la lista visible.
- `src/renderer/main.ts`: conecta `onMoveSubtask` con `store.moveSubtask`.
- `src/renderer/styles/app.css`: estado "arrastrando" para `.sub-row` (mismo aspecto que la tarea levantada, adaptado a la fila de subtarea).

---

## Plan de implementación

1. **Dominio.** `moveSubtask` en `note-operations.ts` y `NoteStore.moveSubtask`. Tests: mover arriba, abajo, a los extremos, `toIndex` fuera de rango (se limita), no entero, mismo sitio, tarea o subtarea inexistente (mismo objeto), no muta la nota original, no toca otras tareas ni días; `NoteStore` devuelve `false` sin cambio y programa autoguardado con cambio. La app no cambia de aspecto.
2. **Arrastrar subtareas.** Generalizar el arrastre en `task-list.ts`, `onMoveSubtask` en `main.ts` y estilos en `app.css`. Prueba manual con `--user-data-dir` temporal, libre (360 px) y anclada (308 px): mover una subtarea arriba, abajo, al principio y al final; pasar el puntero por encima/debajo del grupo la deja en el extremo; con una sola subtarea no se levanta; con una sola tarea en el día sí se reordenan sus subtareas; Esc cancela; autodesplazamiento con la lista más larga que la ventana; el check, la papelera y el doble clic para editar siguen funcionando; soltar no alterna las subtareas del padre; arrastrar la tarea sigue llevándose sus subtareas; el orden se conserva al reiniciar.
3. **Mover a otra tarea (añadido).** `moveSubtaskToTask` en dominio y `NoteStore`, con tests (otra tarea al principio/medio/final, `toIndex` fuera de rango, destino expandido, conserva `done`, origen queda vacío, misma tarea, otro día, ids inexistentes, no muta). Después, en `task-list.ts`: el arrastre de subtarea ya no se limita a su grupo; el destino se calcula bajo el puntero (otra tarea del día) y se llama `onMoveSubtaskToTask`; cableado en `main.ts`; estilos del grupo destino. Prueba manual: pasar una subtarea a una tarea con subtareas, a una sin subtareas y a una contraída; vaciar la tarea origen; una única subtarea con 2+ tareas; Esc; el chip de ambas tareas; guardado y reinicio.
4. **Textos.** `README.md` y `CLAUDE.md` (incluye mover a otra tarea).

---

## Criterios de aceptación

- [x] Mantener presionada una subtarea y arrastrarla hacia arriba o abajo la mueve entre sus hermanas; al soltar queda en el hueco mostrado.
- [x] Mientras se arrastra, la subtarea sigue al puntero y las hermanas se apartan para mostrar dónde caerá.
- [x] Dentro de su grupo, llevar el puntero por encima de la primera hermana o por debajo de la última deja la subtarea en el extremo del grupo.
- [x] Una subtarea puede soltarse en otra tarea del mismo día: entre sus subtareas, o al final si la tarea no tiene subtareas o está contraída (queda expandida).
- [x] Al pasar a otra tarea conserva su texto y su estado `done`; los chips de la tarea origen y de la destino se recalculan.
- [x] No puede pasar a una tarea de otro día ni convertirse en tarea.
- [x] Una única subtarea solo se levanta si el día tiene 2 o más tareas.
- [x] En un día con una sola tarea, sus subtareas se pueden reordenar.
- [x] Esc durante el arrastre devuelve la subtarea a su lugar y no guarda nada.
- [x] Soltar en el mismo sitio no cambia la lista ni dispara guardado.
- [x] Clic en el check, papelera y doble clic en el texto de la subtarea siguen funcionando sin iniciar un arrastre.
- [x] Soltar una subtarea no contrae ni expande las subtareas del padre ni marca nada.
- [x] Arrastrar la fila de la tarea sigue moviendo la tarea entera con sus subtareas en su orden manual.
- [x] El chip `hechas/total` no cambia al reordenar.
- [x] El orden de las subtareas se conserva al reiniciar la app.
- [x] Funciona en Ayer, Hoy, Mañana y días del historial, libre (360 px) y anclada (308 px).
- [x] "Traer tareas de ayer" copia las subtareas en el orden manual del día de origen.
- [x] `moveSubtask` y `moveSubtaskToTask` no mutan la nota original y devuelve el mismo objeto cuando no cambia nada.
- [x] `npm test`, `npm run lint` y `npm run typecheck` pasan.

---

## Decisiones

- **Sí:** mismo gesto que las tareas (clic sostenido en la fila, umbral ~4 px, eventos de puntero), por pedido del usuario. **No:** asa, teclado ni botones subir/bajar.
- **Sí (añadido durante la implementación, a pedido del usuario):** la subtarea puede pasar a otra tarea del mismo día. Destino sin subtareas o contraído: pasa a ser su última subtarea y la tarea se expande. Conserva su `done`. **No:** cruzar de día, ni convertir tarea ↔ subtarea; si llega, va en otra spec. Reemplaza la decisión original "solo dentro de su tarea".
- **Sí:** dentro de su propio grupo la fila se queda en el extremo al salir por arriba o por abajo, con el hueco siempre visible. Al salir hacia otra tarea del día aplica el movimiento a otra tarea.
- **Sí:** con una sola subtarea en un día de una sola tarea no se inicia arrastre; si hay otra tarea sí, para poder pasarla.
- **Sí:** el orden es el del arreglo `task.subtasks`. **No:** campo `order`/`position` ni subir `version`: el formato v3 ya guarda el orden.
- **Sí:** generalizar la lógica de arrastre de la SPEC 08 en `task-list.ts`. **No:** duplicar un segundo arrastre independiente (dos copias del mismo cálculo de hueco y autodesplazamiento).
- **No:** subir la versión de la app ni generar instalador en esta spec.

---

## Riesgos

| Riesgo | Mitigación |
| ------ | ---------- |
| Presionar en una subtarea arrastra la tarea padre (o al revés) | El inicio del arrastre decide por el elemento más cercano: `.sub-row` → subtarea, `.task-row` → tarea. Se prueba a mano. |
| Soltar dispara el clic que alterna subtareas (SPEC 09) | Reutilizar `suppressClick` tras soltar, como en SPEC 08. |
| Re-render durante el arrastre (00:00, cambios del store) destruye la fila | Mismo trato que SPEC 08: render diferido mientras hay arrastre; se cancela si la tarea o la subtarea desaparecen. |
| Generalizar el arrastre rompe el de tareas | Repetir la prueba manual de la SPEC 08 (arriba, abajo, Esc, autodesplazamiento, subtareas viajan) en el paso 2. |
| Grupos de subtareas cortos hacen difícil acertar el hueco | Hueco calculado con el centro de cada fila (`getBoundingClientRect`) en cada movimiento, como SPEC 08. |

---

## Qué **no** entra en esta spec

- Convertir subtareas en tareas (y al revés).
- Mover tareas o subtareas entre días.
- Teclado, asa o botones subir/bajar.
- Nueva versión de la app o instalador.

Cada una, si llega, va en su propia spec.
