# SPEC 02 — Hora manual de las tareas y orden por hora

> **Estado:** Implementado
> **Depende de:** SPEC 01
> **Fecha:** 2026-11-14
> **Objetivo:** Escribo yo la hora de cada tarea (entero 0–23), puedo cambiarla después, y la lista se muestra ordenada de menor a mayor hora.

---

## Por qué existe esta spec

En la SPEC 01 la hora se toma sola del reloj al crear la tarea y no se puede editar. El usuario quiere fijarla a mano, como un entero, y ver las tareas ordenadas por esa hora.

---

## Alcance

**Entra:**

- Campo numérico de hora en la fila de añadir, a la izquierda de "Añadir nueva tarea…". Placeholder: la hora actual.
- Si el campo queda vacío, la tarea usa la hora actual (comportamiento de la SPEC 01).
- Hora válida: entero de 0 a 23. Con un valor inválido (decimal, negativo, mayor que 23) no se crea la tarea y el campo se marca en error.
- Tras crear la tarea se vacían el texto y la hora, y el cursor queda en el campo de hora, listo para la próxima tarea.
- Tras crear una subtarea con Enter, el input de subtarea queda abierto y vacío para la siguiente. Esc, o perder el foco con el input vacío, lo cierran.
- Editar la hora de una tarea existente con doble clic sobre la etiqueta de hora. Enter o perder el foco guardan, Esc cancela. Un valor inválido o vacío conserva la hora anterior.
- La lista se muestra ordenada por hora ascendente. A igual hora, por `createdAt` (y luego por orden de inserción). Al cambiar una hora, la tarea se reubica.
- Contraer/expandir subtareas con un clic. Las tareas con subtareas muestran un botón con chevron y la cantidad de subtareas, junto al texto. El estado se guarda (`Task.collapsed`). Agregar una subtarea expande la tarea. El progreso no cambia.
- Las subtareas también muestran un "+" junto a la papelera al pasar el mouse. Abre el input de nueva subtarea de la misma tarea (sigue habiendo un solo nivel).
- Tests de dominio y de `NoteStore`.

**Fuera de alcance:**

- Minutos u horas fuera de 0–23.
- Hora en subtareas.
- Reordenar con arrastrar y soltar.

---

## Modelo de datos

`Task.hour` sigue siendo entero 0–23 y el archivo sigue en `version: 1`. Se agrega `Task.collapsed?: boolean` (opcional, así los archivos de la SPEC 01 siguen siendo válidos). `Note.tasks` conserva el orden de inserción en disco; el orden por hora se aplica al mostrar.

Nuevas funciones de dominio:

- `isValidHour(value: number): boolean` en `note.ts` (la usa también `validate-stored-data.ts`).
- `addTask(note, text, ctx, hour?)`: `hour` opcional; si falta usa `now.getHours()`; si es inválida devuelve el mismo `Note`.
- `setTaskHour(note, taskId, hour)`: inválida, igual o id inexistente devuelve el mismo `Note`.
- `tasksByHour(tasks)`: copia ordenada (hora, `createdAt`, inserción). No muta.

`NoteStore`: `addTask(text, hour?)` y `setTaskHour(taskId, hour)`.

---

## Criterios de aceptación

- [x] Escribir `9` en la hora y "Comprar pan" crea la tarea con la etiqueta `9`.
- [x] Con la hora vacía, la tarea toma la hora actual.
- [x] Con hora `24`, `-1` o `9.5` no se crea la tarea.
- [x] Tareas con horas 15, 8 y 12 se muestran 8, 12, 15.
- [x] Doble clic en la etiqueta de hora permite cambiarla; la tarea se reubica. Esc o un valor inválido conservan la hora anterior.
- [x] Enter al crear una tarea deja el cursor en la hora de la próxima tarea.
- [x] Enter al crear una subtarea deja abierto un input vacío para la siguiente subtarea de la misma tarea.
- [x] Un clic en el chevron de una tarea con subtareas las oculta; otro clic las muestra. Se conserva al reiniciar.
- [x] El "+" de una subtarea abre el input para agregar otra subtarea a la misma tarea.
- [x] Las tareas guardadas con la SPEC 01 cargan sin cambios y se muestran ordenadas.
- [x] `npm test`, `npm run lint` y `npm run typecheck` pasan.

---

## Decisiones

- **Sí:** campo aparte en vez de prefijo en el texto: evita ambigüedad con textos que empiezan por número.
- **Sí:** hora vacía = hora actual, para no frenar la captura rápida.
- **Sí:** ordenar al mostrar y no al guardar: el archivo no cambia de formato y no hace falta migración.
