# SPEC 08 — Orden manual de tareas (arrastrar y soltar)

> **Estado:** Implementado
> **Depende de:** SPEC 02, SPEC 03, SPEC 07
> **Fecha:** 2026-11-19
> **Objetivo:** Las tareas de cada día se reordenan arrastrándolas con clic sostenido, como tarjetas de un kanban, y la hora deja de ordenar la lista: cada tarea se queda donde el usuario la puso.

---

## Por qué existe esta spec

La SPEC 02 muestra la lista ordenada por hora, y al cambiar la hora la tarea salta a otro sitio. El usuario quiere mandar él: poner la hora como una etiqueta informativa y colocar las tareas a mano, moviéndolas hacia arriba o abajo.

Esta spec reemplaza la regla "la lista se muestra ordenada por hora" de la SPEC 02 (y la frase equivalente de la SPEC 07 sobre las tareas traídas). Se mantiene todo lo demás de la SPEC 02: hora entera 0–23, hora vacía = hora actual, edición con doble clic.

---

## Alcance

**Entra:**

- **Orden manual.** El orden de cada día es el orden de su lista en `note.days[día]`. Ya no se ordena por hora al mostrar.
  - Tarea nueva: al final de la lista del día.
  - Cambiar la hora de una tarea no la mueve.
  - Marcar una tarea como hecha no la mueve.
  - "Traer tareas de ayer" (SPEC 07) copia las tareas en el mismo orden que tienen en el día de origen, al final de Hoy.
- **Arrastrar con clic sostenido en la fila:**
  - Se presiona en cualquier parte libre de la fila de la tarea (fondo, texto o etiqueta de hora) y se arrastra. La fila empieza a moverse tras desplazar el puntero unos 4 px; un clic o doble clic sin desplazamiento sigue funcionando igual (marcar, editar texto, editar hora).
  - Check, botones (contraer, "+", papelera) y los inputs de edición no inician arrastre.
  - Se arrastra la tarea completa: sus subtareas viajan con ella y conservan su orden interno.
  - Mientras se arrastra: la tarea sigue al puntero en vertical, las demás se apartan para mostrar dónde caerá, y si el puntero se acerca al borde superior o inferior de la lista, esta se desplaza sola.
  - Al soltar, la tarea queda en el hueco mostrado y se guarda. Esc durante el arrastre lo cancela y todo vuelve a su sitio.
  - Funciona en cualquier pestaña (Ayer, Hoy, Mañana e historial), libre y anclada, solo dentro de la lista de ese día.
  - Con una sola tarea, o si se suelta en su mismo sitio, no cambia nada ni se guarda.
- **Migración única de las notas actuales:** un archivo guardado con la versión anterior se ordena por hora una sola vez al leerlo (misma regla que hoy: hora, `createdAt`, inserción), de modo que el usuario ve lo mismo que ve hoy. El siguiente guardado escribe `version: 3` y desde ahí el orden es el que dejó el usuario.
- **Textos:**
  - `README.md`: líneas que dicen que las tareas se ordenan por hora; descripción de reordenar.
  - `CLAUDE.md`: `tasksByHour` ya no se usa al mostrar, `moveTask`, formato `version: 3`, comportamiento de arrastre.
  - El "Acerca de" no menciona el orden por hora y no cambia.
- Tests de dominio (`moveTask`, migración en la validación), de `NoteStore` y del repositorio JSON.

**Fuera de alcance:**

- Reordenar subtareas entre sí.
- Mover una tarea a otro día arrastrándola entre pestañas.
- Asa de agarre visible o icono de arrastre.
- Reordenar con teclado.
- Botones "subir" / "bajar".
- Botón o ajuste para volver a ordenar por hora.
- Cambiar el formato, la hora, o la forma de crear tareas y subtareas.
- Subir la versión de la app o publicar un instalador nuevo.

---

## Modelo de datos

No hay campos nuevos en `Task` ni en `Note`: el orden manual es el orden del arreglo `note.days[día]`, que ya se guarda tal cual.

`note.json` pasa a `version: 3`. La estructura es idéntica a la v2 (`note.days`, `lastCarryOver?`); solo cambia el significado del orden y sirve de marca de "ya migrado".

`validate-stored-data.ts`:

- Acepta v1, v2 y v3, y devuelve siempre v3.
- v3: se devuelve la nota tal cual, sin reordenar.
- v2: cada lista de `days` se ordena por hora con `tasksByHour` (una sola vez); el resto igual (SPEC 07).
- v1: sus tareas pasan a `days[today]` ordenadas por hora, como en v2.

`window-prefs.ts`: `StoredData.version` pasa de `2` a `3`. `json-note-repository.ts`: el archivo por defecto se crea con `version: 3`.

`note-operations.ts` (pura, inmutable):

- `moveTask(note, taskId, toIndex: number): Note` — mueve la tarea dentro de la lista de su día a la posición `toIndex` (índice final, 0 = primera). `toIndex` se limita a `[0, n − 1]`. Devuelve el mismo `Note` si el id no existe, `toIndex` no es un entero o la tarea ya está en esa posición.
- `tasksByHour` se conserva, pero solo lo usa la migración; el renderer ya no lo llama.

`NoteStore`: `moveTask(taskId: string, toIndex: number): boolean` con el patrón de los demás comandos (devuelve `false` si no cambió nada, programa el autoguardado si cambió).

Renderer:

- `src/renderer/ui/task-list.ts`: nuevo handler `onMoveTask(taskId, toIndex)` y la lógica de arrastre con eventos de puntero (`pointerdown` / `pointermove` / `pointerup` / `pointercancel`, con captura del puntero y umbral de ~4 px).
- `src/renderer/main.ts`: deja de llamar a `tasksByHour`; pasa `tasks` tal cual a `taskList.render` y conecta `onMoveTask` con `store.moveTask`.
- `src/renderer/styles/app.css`: estilos del estado "arrastrando" (la fila levantada, hueco/indicador de destino).

---

## Plan de implementación

1. **Dominio y datos.** `moveTask` en `note-operations.ts`; `NoteStore.moveTask`; `StoredData.version` = 3, migración v1/v2 → v3 con orden por hora en `validate-stored-data.ts`; archivo por defecto v3 en `json-note-repository.ts`. Tests: `moveTask` (arriba, abajo, extremos, límites, mismo sitio, id inexistente, no muta), migración (v2 queda ordenado por hora, v3 no se reordena, v1 ordenado, resultado siempre v3), `NoteStore` (devuelve `false` si no cambia, autoguardado) y repositorio (lee v2 y escribe v3). La app aún muestra ordenado por hora; no cambia de aspecto.
2. **Mostrar el orden guardado.** `main.ts` deja de usar `tasksByHour`. Prueba manual con `--user-data-dir` temporal: una nota con tareas 15, 8, 12 abre mostrándose 8, 12, 15 (migración); una tarea nueva con hora 7 queda al final; cambiar la hora de una tarea no la mueve.
3. **Arrastrar.** Lógica de arrastre en `task-list.ts`, `onMoveTask` en `main.ts` y estilos en `app.css`. Prueba manual libre (360 px) y anclada (308 px): mover una tarea arriba, abajo, al principio y al final; con subtareas; Esc cancela; autodesplazamiento con la lista más larga que la ventana; clic en el check, doble clic para editar texto y hora y los botones siguen funcionando; el orden se conserva al reiniciar.
4. **Textos.** `README.md` y `CLAUDE.md`.

---

## Criterios de aceptación

- [x] Una nota guardada con tareas de horas 15, 8 y 12 (versión anterior) se abre mostrando 8, 12, 15 y, tras el primer guardado, `note.json` tiene `version: 3`.
- [x] Un archivo `version: 3` se muestra en el orden guardado, sin reordenar por hora.
- [x] Una tarea nueva con hora 7 queda al final de la lista, debajo de tareas con hora mayor.
- [x] Cambiar la hora de una tarea (doble clic) no la mueve de lugar.
- [x] Marcar una tarea como hecha no la mueve de lugar.
- [x] Mantener presionada una tarea y arrastrarla hacia arriba o abajo la mueve; al soltar queda en el hueco mostrado.
- [x] Mientras se arrastra, la tarea sigue al puntero y se ve dónde caerá.
- [x] La tarea movida lleva sus subtareas, con el mismo orden y estado.
- [x] Esc durante el arrastre devuelve la tarea a su lugar original y no guarda nada.
- [x] Soltar en el mismo sitio no cambia la lista ni dispara guardado.
- [x] Con más tareas que alto de lista, arrastrar cerca del borde desplaza la lista.
- [x] Clic en el check, doble clic en texto u hora, y botones (contraer, "+", papelera) siguen funcionando sin iniciar un arrastre.
- [x] El orden elegido se conserva al reiniciar la app.
- [x] Se puede reordenar en Ayer, Hoy, Mañana y días del historial, libre (360 px) y anclada (308 px).
- [x] "Traer tareas de ayer" copia en el mismo orden manual del día de origen.
- [x] `moveTask` no muta la nota original y devuelve el mismo objeto cuando no cambia nada.
- [x] `npm test`, `npm run lint` y `npm run typecheck` pasan.

---

## Decisiones

- **Sí:** el orden manual es el orden del arreglo `days[día]`. No hay campo `order`: ya se guarda así y evita desfasar dos fuentes de orden. **No:** campo `position` por tarea.
- **Sí:** arrastrar con clic sostenido en la fila, por pedido del usuario. **No:** asa de agarre (ocuparía sitio a 308 px).
- **Sí:** eventos de puntero con umbral de ~4 px. Conserva el clic y el doble clic de editar. **No:** drag and drop nativo de HTML5 (`draggable`): interfiere con la selección de texto y el doble clic, y su imagen fantasma no se puede estilar bien en una ventana sin marco.
- **Sí:** tarea nueva al final. Coincide con el orden de inserción actual; el usuario la sube si quiere.
- **Sí:** migrar una sola vez ordenando por hora, con `version: 3` como marca. El usuario ve lo mismo que hoy. **No:** mostrar las notas en orden de inserción (se verían distintas); **No:** migración repetida en cada arranque (borraría el orden manual).
- **Sí:** solo se reordenan tareas, no subtareas. Las subtareas viajan con su tarea.
- **Sí:** reordenar dentro del día. Mover entre días es otra spec.
- **Sí:** la hora pasa a ser solo una etiqueta; se sigue pidiendo y editando como en la SPEC 02.
- **Sí:** `tasksByHour` se conserva para la migración. **No:** borrarla.
- **Sí:** copiar el orden manual al "traer tareas de ayer". **No:** reordenar por hora al copiar.
- **No:** subir la versión de la app ni generar instalador en esta spec.

---

## Riesgos

| Riesgo | Mitigación |
| ------ | ---------- |
| Arrastres sin querer al hacer clic en la fila | Umbral de ~4 px; el check, los botones y los inputs no inician arrastre; Esc cancela. |
| El arrastre interfiere con el doble clic de editar | El umbral deja pasar clic y doble clic; en edición (input abierto) no hay arrastre. Se prueba a mano. |
| Re-render durante el arrastre (reloj de las 00:00, cambios del store) destruye la fila arrastrada | Mientras hay un arrastre activo, el render difiere o conserva el nodo arrastrado; se cancela con seguridad si la tarea desaparece. |
| Una versión anterior de la app no abre un `note.json` `version: 3` | Cambio de formato aceptado; solo importa si el usuario vuelve a una versión vieja. Al estar instalada y en dev con datos separados (SPEC 06), cada una migra su propia carpeta. |
| El cursor y las coordenadas se descuadran con el autodesplazamiento de la lista | Calcular la posición del hueco con las coordenadas actuales de cada fila (`getBoundingClientRect`) en cada movimiento, no con medidas cacheadas. |

---

## Qué **no** entra en esta spec

- Reordenar subtareas.
- Mover tareas entre días arrastrando.
- Asa de arrastre, teclado o botones subir/bajar.
- Volver a ordenar por hora con un botón.
- Nueva versión de la app o instalador.

Cada una, si llega, va en su propia spec.
