# SPEC 12 — Pestaña Plantillas con grupos de tareas para copiar a Hoy

> **Estado:** Implementado
> **Depende de:** SPEC 03, SPEC 07, SPEC 08, SPEC 09, SPEC 10, SPEC 11
> **Fecha:** 2026-11-25
> **Objetivo:** Una pestaña "Plantillas" después de "Mañana" guarda grupos de tareas con nombre (p. ej. uno por empresa), apilados y plegables, y el botón "Copiar a Hoy" de cada grupo añade todas sus tareas al final de Hoy, desmarcadas.

---

## Por qué existe esta spec

El usuario repite cada día listas fijas que dependen de dónde trabaja (empresa A, empresa B). Hoy las escribe una por una o usa "Traer tareas de ayer" (SPEC 07), que solo sirve si ayer fue un día igual y Hoy está vacío. Quiere guardar esas listas una vez, por grupos, y copiarlas a Hoy con un clic.

Las plantillas no son un día: no tienen fecha, no se marcan como hechas, no cuentan para el progreso ni para el aviso por hora (SPEC 11) y la poda del historial (SPEC 07) no las toca.

---

## Alcance

**Entra:**

- **Pestaña "Plantillas"** en la fila de días (`dayRow`), después de "Mañana":
  - Ícono de plantilla (estilo Lucide) + texto "Plantillas", separada de Mañana por un divisor.
  - Con la nota anclada (308 px) o con la nota libre más estrecha que 360 px solo se ve el ícono, con `title` y `aria-label` "Plantillas".
  - Activa = mismo marcado con `--accent` y `aria-pressed="true"` que las pestañas de día.
  - Elegir un día (pestaña o historial) sale de Plantillas.
  - Al arrancar la app la pestaña activa sigue siendo Hoy (no se guarda).
  - Con la pestaña Plantillas activa, la fecha corta del header muestra la de hoy.
  - A las 00:00, si la pestaña activa es Plantillas, se queda en Plantillas.
- **Bloque de progreso:** en Plantillas no se ven el anillo, `N de M hechas`, "Marcar todas" ni el switch de aviso. No hay barra en su sitio: la lista empieza bajo la fila de días.
- **Grupos apilados** (cambio durante la implementación: sustituye a la barra con selector y menú de grupos de la primera versión). La lista de Plantillas muestra todos los grupos, uno debajo del otro, en el orden guardado:
  - **Cabecera de grupo:** chevron (abajo = desplegado, derecha = plegado), nombre y número de tareas. A la derecha, botón "Copiar a Hoy" siempre visible, solo con el ícono de copiar; el texto "Copiar a Hoy" va en su tooltip (`title`) y en su `aria-label` (cambio durante la implementación: antes llevaba ícono + texto); al pasar el ratón (o con foco dentro) aparecen "+" (añadir tarea), lápiz (renombrar) y papelera (borrar), sin mover el resto de la cabecera.
  - El nombre largo se recorta con `…`; el botón "Copiar a Hoy" siempre cabe a 308 px.
  - **Plegar / desplegar:** clic en la cabecera (no en sus botones ni en el campo de renombrar, no tras un arrastre) alterna el grupo. Plegado = solo la cabecera. El estado se guarda en `note.json` (`collapsed` del grupo). Un grupo nuevo nace desplegado.
  - Grupo desplegado sin tareas: texto "Sin tareas" bajo la cabecera.
  - **Ordenar grupos:** mantener pulsada la cabecera (no sus botones) y arrastrar (pointer events, umbral ~4 px, igual que las tareas en SPEC 08) mueve el grupo entero con sus tareas. Esc durante el arrastre restaura el orden.
- **Crear grupo:** el "+" de la fila de días (en Plantillas, título "Nuevo grupo") muestra un campo de texto al final de la lista. No hay botón "Nuevo grupo" al final de la lista (cambio durante la implementación: repetía el "+"). Enter crea el grupo al final, desplegado, y lo deja a la vista; Esc o perder el foco descarta. Nombre vacío (tras quitar espacios) no crea nada. Máximo 40 caracteres. Se permiten nombres repetidos.
- **Renombrar:** el lápiz convierte el nombre de la cabecera en un campo con el nombre actual. Enter guarda; Esc o perder el foco descarta. Nombre vacío no cambia nada.
- **Borrar:** la papelera muestra una confirmación dentro de la nota (no diálogos nativos): "¿Borrar «Empresa A» y sus N tareas?" (con 0 tareas "¿Borrar «Empresa A»?", con 1 "… y su tarea?") con botones "Borrar" y "Cancelar". Esc = Cancelar.
- **Sin grupos:** la lista muestra "Sin plantillas" y un botón "Crear grupo" (mismo campo que el "+"). El "+" de la fila de días también crea un grupo.
- **Tareas del grupo:** bajo cada cabecera desplegada, las tareas del grupo con las mismas filas que un día, **sin check** (ni en tareas ni en subtareas). Se permite lo mismo que en un día:
  - Añadir con el "+" de la cabecera: abre la fila de añadir de SPEC 05 al final de ese grupo (si estaba plegado, se despliega). Hora vacía = hora actual.
  - Editar texto y hora, borrar.
  - Subtareas: añadir, editar, borrar, plegar/desplegar (chip `hechas/total` de SPEC 09 sin parte "hechas": muestra solo el total).
  - Arrastrar tareas para ordenarlas dentro de su grupo (SPEC 08) y subtareas para ordenarlas o pasarlas a otra tarea del mismo grupo (SPEC 10). Una tarea o subtarea no sale de su grupo.
- **Copiar a Hoy** (botón de cada cabecera; deshabilitado si el grupo no tiene tareas):
  - Copia todas las tareas del grupo, en su orden, al final de la lista de Hoy, aunque Hoy ya tenga tareas.
  - Cada copia y cada subtarea copiada tiene `id` nuevo y `done: false`.
  - Conservan `text`, `hour` y `collapsed`; `createdAt` = momento de la copia.
  - El grupo no cambia.
  - Se puede copiar el mismo grupo (u otro) las veces que se quiera; no hay límite por día.
  - Tras copiar, la pestaña activa pasa a Hoy.
  - Si Hoy estaba vacío, después de copiar ya no se ve "Traer tareas de ayer" (Hoy tiene tareas, SPEC 07).
- **Crear la tarea al perder el foco** (añadido durante la implementación): en la fila de añadir (la del "+", en un día o en un grupo), si el foco sale de la fila (clic fuera, otra ventana) con texto escrito, la tarea se crea con ese texto, igual que con Enter, y la fila se oculta. Hora vacía o no válida = hora actual. Texto vacío (tras quitar espacios) no crea nada. Esc sigue descartando lo escrito sin crear nada.
- **Borrar todas las tareas de un día** (añadido durante la implementación):
  - En el bloque de progreso, a la derecha del botón "Marcar todas"/"Desmarcar todas" (SPEC 09), un botón de papelera (`.progress-delete-all`, mismo tamaño, tooltip y `aria-label` "Borrar todas"). Se oculta, como el de marcar, cuando el día no tiene tareas. Al pasar el ratón, el ícono en rojo (`--bg-close-hover`).
  - Funciona en cualquier pestaña de día (Hoy, Ayer, Mañana, días del historial) y borra solo las tareas de ese día, con sus subtareas, estén marcadas o no. "Marcar todas" no influye. En Plantillas no se ve (el bloque de progreso está oculto).
  - Pide confirmación dentro de la nota (la misma caja que al borrar un grupo): "¿Borrar las N tareas de Hoy?" (con 1: "¿Borrar la tarea de Hoy?"). El día se nombra como su pestaña: "de Hoy", "de Ayer", "de Mañana"; para un día del historial, "del" + la fecha en minúscula ("del jueves, 12 nov"). Botones "Borrar" y "Cancelar"; foco en "Cancelar"; Esc = Cancelar.
  - Tras borrar, el día queda vacío ("0 de 0 hechas" y ambos botones ocultos). En Hoy, si se cumplen las reglas de SPEC 07 (no se usó hoy y hay un día anterior con tareas), vuelve a verse "Traer tareas de ayer". `lastCarryOver` no cambia. Las plantillas no cambian.
- **Textos:** `README.md` (pestaña Plantillas, borrar todas) y `CLAUDE.md` (modelo `templates`, operaciones, UI).
- Tests de dominio (operaciones de grupos, operaciones por id dentro de grupos, copia, validación) y de `NoteStore`.

**Fuera de alcance:**

- Crear un grupo a partir de la lista de Hoy ("Guardar Hoy como plantilla").
- Copiar tareas sueltas de un grupo, o elegir qué tareas copiar.
- Copiar a Mañana u otro día distinto de Hoy.
- Aplicar un grupo automáticamente cada día o según el día de la semana.
- Marcar tareas de plantilla como hechas.
- Mover tareas entre un grupo y un día, o entre grupos, arrastrando.
- Deshacer una copia (se borran a mano en Hoy).
- Exportar/importar plantillas.
- Subir la versión de la app o generar un instalador nuevo.

---

## Modelo de datos

`src/core/domain/note.ts`: tipo nuevo y campo opcional en `Note`. `note.json` sigue en `version: 3`.

```ts
export interface TemplateGroup {
  id: string
  /** No vacío, sin espacios en los extremos, máx. 40 caracteres. */
  name: string
  /** Mismo formato que las tareas de un día; `done` siempre false (la UI no lo cambia). */
  tasks: Task[]
  /** Grupo plegado (solo la cabecera). Ausente = desplegado. (Cambio durante la implementación.) */
  collapsed?: boolean
}

export interface Note {
  days: Record<DayKey, Task[]>
  lastCarryOver?: DayKey
  /** Grupos de plantillas en el orden del usuario. Ausente = ninguno. */
  templates?: TemplateGroup[]
}
```

- Los `id` de tareas y subtareas siguen siendo únicos en toda la nota, **incluidas las plantillas**. Los `id` de grupo son únicos entre grupos.
- `rollOver` no toca `templates`.
- `TEMPLATE_NAME_MAX = 40` en `note.ts`.

```json
{ "version": 3, "note": { "days": { … }, "templates": [ { "id": "g1", "name": "Empresa A", "tasks": [ … ] } ] }, "window": { … } }
```

### Validación (`validate-stored-data.ts`)

- `note.templates` ausente es válido. Si existe debe ser un array; cada grupo con `id` string no vacío, `name` string recortado no vacío de ≤ 40 caracteres, `tasks` válidas como las de un día (mismas reglas) y `collapsed` ausente o booleano. Cualquier otro valor (incluido `null`) invalida el archivo (respaldo `note.corrupt-<ts>.json`, SPEC 01).
- v1/v2 migran sin `templates`.

### Operaciones (`note-operations.ts`, puras, ids y tiempo inyectados)

- Las operaciones por id existentes (`editTask`, `setTaskHour`, `deleteTask`, `addSubtask`, `editSubtask`, `deleteSubtask`, `toggleSubtasksCollapsed`, `moveTask`, `moveSubtask`, `moveSubtaskToTask`) encuentran la tarea esté en un día o en un grupo. `moveTask` mueve dentro de su lista; `moveSubtaskToTask` solo entre tareas de la misma lista (mismo día o mismo grupo).
- `addTemplateGroup(note, name, id): Note` — al final; mismo objeto si el nombre limpio es vacío.
- `renameTemplateGroup(note, groupId, name): Note` — mismo objeto si el id no existe, el nombre limpio es vacío o no cambia.
- `deleteTemplateGroup(note, groupId): Note`.
- `moveTemplateGroup(note, groupId, toIndex): Note` — índice acotado a `[0, n-1]`; mismo objeto si id desconocido, índice no entero o misma posición.
- `addTemplateTask(note, groupId, text, ctx: NewItemContext, hour?): Note` — al final del grupo, `done: false`; si el grupo estaba plegado, lo despliega (como `addSubtask` con la tarea).
- `toggleTemplateGroupCollapsed(note, groupId): Note` — alterna `collapsed`; mismo objeto si el id no existe. (Cambio durante la implementación.)
- `templateGroups(note): TemplateGroup[]` — `note.templates ?? []`.
- `copyTemplateToDay(note, groupId, day, newId: () => string, now: string): Note` — añade las copias al final de `days[day]`; mismo objeto si el grupo no existe o no tiene tareas.
- Nombres recortados y cortados a 40 caracteres en todas las operaciones que reciben nombre.
- `deleteAllTasks(note, day): Note` (añadido durante la implementación) — deja `days[day]` vacío (`[]`, como `deleteTask` con la última tarea; `rollOver` poda los días pasados vacíos); mismo objeto si el día no tiene tareas. No toca otros días, `templates` ni `lastCarryOver`.

### `NoteStore`

`addTemplateGroup(name)`, `renameTemplateGroup(id, name)`, `deleteTemplateGroup(id)`, `moveTemplateGroup(id, toIndex)`, `toggleTemplateGroupCollapsed(id)`, `addTemplateTask(groupId, text, hour?)`, `copyTemplateToToday(groupId)` (con el `Clock` y `deps.newId`), `deleteAllTasks(day)` (añadido durante la implementación). Devuelven `boolean` y programan el autoguardado si cambia algo, como los comandos actuales. `addTemplateGroup` devuelve el id creado o `null`.

### Renderer

- `src/renderer/ui/header.ts` — pestaña Plantillas, divisor, estado activo, `onSelectTemplates`, "+" deshabilitable.
- `src/renderer/ui/template-list.ts` (nuevo, sustituye a `template-bar.ts`) — lista de grupos apilados: cabeceras (plegar, "Copiar a Hoy", "+", renombrar, borrar), arrastre de cabeceras, campo de nombre del grupo nuevo al final, "Sin plantillas" + "Crear grupo", "Sin tareas" y confirmación de borrado. Cada grupo desplegado reutiliza una lista de tareas de `task-list.ts` con sus tareas.
- `src/renderer/ui/task-list.ts` — modo plantilla: sin checks, chip con solo el total, mismo arrastre (limitado a su lista); variante incrustada (sin scroll propio) para usarla dentro de un grupo.
- `src/renderer/ui/name-input.ts` (nuevo) — campo de nombre de grupo (crear y renombrar).
- `src/renderer/ui/icons.ts` — íconos de plantilla, lápiz y copiar si faltan.
- `src/renderer/main.ts` — vista activa `{ kind: 'day', day } | { kind: 'templates' }` en vez de solo `activeDay`, cableado con `NoteStore`; muestra la lista de grupos o la lista del día y el bloque de progreso según la vista.
- `src/renderer/ui/confirm.ts` (nuevo, añadido durante la implementación) — caja de confirmación dentro de la nota (texto, "Cancelar", "Borrar"; Esc, Tab entre los dos botones, foco de vuelta al cancelar), sacada de `template-list.ts` para usarla también al borrar todas las tareas.
- `src/renderer/ui/progress.ts` — botón "Borrar todas" junto a "Marcar todas" (añadido durante la implementación).
- `src/renderer/styles/app.css` — estilos de la pestaña, las cabeceras de grupo, la confirmación y el botón "Borrar todas".

---

## Plan de implementación

1. **Modelo y validación.** `TemplateGroup`, `Note.templates?`, `TEMPLATE_NAME_MAX`, validación en `validate-stored-data.ts`. Tests: archivo sin `templates` válido; con grupos válido; `null`, no array, nombre vacío/largo, tarea inválida → inválido. La app no cambia.
2. **Operaciones.** Localizar tareas por id en días y grupos; operaciones de grupos; `copyTemplateToDay`; métodos de `NoteStore`. Tests: crear/renombrar/borrar/mover grupo (incluidos los casos "mismo objeto"); editar, borrar, mover tareas y subtareas dentro de un grupo; `moveSubtaskToTask` no cruza de grupo a día; copia con ids nuevos, `done: false`, al final de Hoy con tareas previas, grupo intacto, dos copias seguidas; `rollOver` no toca grupos; `dueAlertTasks` y `progress` de Hoy ignoran plantillas. La app no cambia.
3. **Pestaña y vista vacía.** Pestaña en `header.ts` (ícono + texto, solo ícono anclada o < 360 px), vista activa en `main.ts`, bloque de progreso oculto, "Sin plantillas" + "Crear grupo" (crea el grupo con el campo de nombre). Prueba manual: libre 360 px, libre 308 px y anclada; la fila de días no desborda; elegir un día sale de Plantillas; a las 00:00 sigue en Plantillas.
> Los pasos 4–6 se implementaron con una barra con selector y menú de grupos. Durante la implementación se cambió a grupos apilados y plegables (pasos 8–11): la barra y el menú se quitan; se conservan el modo plantilla de `task-list.ts`, el campo de nombre, la confirmación de borrado y la acción de copiar.

4. **Barra y tareas del grupo.** `template-bar.ts` con selector, menú (elegir y "Nuevo grupo") y "Copiar a Hoy" (aún sin acción, deshabilitado); `task-list.ts` en modo plantilla (sin check, chip solo total, arrastre de tareas y subtareas); "+" añade al grupo activo. Prueba manual: dos grupos con tareas distintas, cambiar entre ellos, reiniciar y comprobar que se guardaron.
5. **Renombrar, borrar y ordenar grupos.** Lápiz, papelera con confirmación en la nota, arrastre de filas del menú. Prueba manual: Esc cancela renombrar, borrar y arrastrar; borrar el activo deja activo el primero; borrar el último muestra "Sin plantillas".
6. **Copiar a Hoy.** Acción del botón con `store.copyTemplateToToday`, cambio a la pestaña Hoy. Prueba manual: Hoy vacío y Hoy con tareas; copiar dos veces; marcar una copia no cambia la plantilla; el aviso por hora suena por las copias de Hoy.
7. **Crear la tarea al perder el foco** (añadido durante la implementación). `add-row.ts`: al salir el foco de la fila con texto, crear la tarea (hora no válida = hora actual) y ocultar la fila; Esc descarta. Prueba manual: en Hoy y en un grupo, escribir y hacer clic fuera crea la tarea; con hora "25" se crea con la hora actual; solo espacios no crea nada; Esc no crea nada; Enter sigue creando y deja la fila abierta para la siguiente.
8. **Grupos plegables en el modelo** (cambio durante la implementación). `TemplateGroup.collapsed?`, validación (ausente o booleano), `toggleTemplateGroupCollapsed`, `addTemplateTask` despliega el grupo, método en `NoteStore`. Tests: alternar, id desconocido, añadir tarea a un grupo plegado lo despliega, validación (`collapsed: null` o no booleano → inválido). La app no cambia.
9. **Grupos apilados.** `template-list.ts`: cabecera (chevron, nombre, número de tareas), clic en la cabecera pliega/despliega, tareas de cada grupo desplegado con una lista incrustada de `task-list.ts` en modo plantilla, "Sin tareas", "+" de la cabecera abre la fila de añadir de ese grupo, "Nuevo grupo" al final y "+" de la fila de días crean grupo; "Sin plantillas" + "Crear grupo". Se quitan la barra y el menú (`template-bar.ts`). Prueba manual: tres grupos visibles a la vez; plegar uno y reiniciar (sigue plegado); añadir tareas a dos grupos distintos; arrastrar tareas y subtareas sin salir de su grupo; 308 px y anclada.
10. **Acciones de la cabecera.** Lápiz (renombrar en la cabecera), papelera (confirmación en la nota) y "Copiar a Hoy" (deshabilitado si el grupo está vacío; copia y cambia a Hoy). Prueba manual: Esc cancela renombrar y borrar; borrar el último grupo muestra "Sin plantillas"; copiar dos grupos distintos a Hoy deja ambas listas en orden; nombre largo con `…` y "Copiar a Hoy" visible a 308 px.
11. **Ordenar grupos arrastrando la cabecera.** Mismo gesto que las tareas (umbral ~4 px, Esc restaura, autodesplazamiento en los bordes de la lista); un clic sin moverse sigue plegando/desplegando. Prueba manual: mover el primer grupo al final y el último al principio, con grupos plegados y desplegados; reiniciar y comprobar el orden.
12. **Cabecera más compacta y sin "Nuevo grupo"** (cambio durante la implementación). "Copiar a Hoy" pasa a botón de solo ícono (tamaño de los botones de la cabecera) con tooltip y `aria-label` "Copiar a Hoy"; se quita el botón "Nuevo grupo" del final de la lista (el campo del grupo nuevo sigue apareciendo al final al pulsar el "+" de la fila de días). Prueba manual: tooltip visible; el nombre gana el espacio liberado a 308 px; el "+" crea grupos con y sin grupos previos; "Crear grupo" sigue en "Sin plantillas"; deshabilitado con el grupo vacío.
13. **Borrar todas: modelo** (añadido durante la implementación). `deleteAllTasks` y `NoteStore.deleteAllTasks(day)`. Tests: día con tareas queda `[]`; mismo objeto con el día vacío o inexistente; otros días, plantillas y `lastCarryOver` intactos; el store guarda y devuelve `true`/`false`. La app no cambia.
14. **Borrar todas: interfaz** (añadido durante la implementación). Sacar la confirmación a `ui/confirm.ts` (borrar grupo sigue igual); botón de papelera en el bloque de progreso con confirmación; frase según número de tareas y día. Prueba manual: Hoy con tareas marcadas y sin marcar → se borran todas; Esc y "Cancelar" no borran; Ayer y un día del historial (frase "del …"); Hoy vacío tras borrar muestra "Traer tareas de ayer" si aplica; el botón se oculta sin tareas; borrar un grupo sigue funcionando; 308 px.
15. **Textos.** `README.md` y `CLAUDE.md`.

---

## Criterios de aceptación

- [x] La pestaña Plantillas aparece después de Mañana con ícono y texto en la nota libre de 360 px, y solo con ícono (con `title` "Plantillas") anclada y libre a 308 px, sin desbordar la fila de días.
- [x] Al abrir la app la pestaña activa es Hoy.
- [x] Sin grupos, Plantillas muestra "Sin plantillas" y "Crear grupo"; el "+" de la fila de días también crea un grupo.
- [x] Crear un grupo ("Crear grupo" o "+" de la fila de días) lo añade al final, desplegado; con nombre vacío no se crea nada; un nombre de más de 40 caracteres se corta a 40.
- [x] En Plantillas no se ven el anillo de progreso, `N de M hechas`, "Marcar todas" ni el switch de aviso.
- [x] Todos los grupos se ven a la vez, uno debajo del otro, cada uno con su cabecera (chevron, nombre, número de tareas, botón de ícono "Copiar a Hoy" con tooltip).
- [x] Clic en la cabecera pliega o despliega el grupo; el estado se conserva al reiniciar.
- [x] Las tareas y subtareas de un grupo no tienen check; el chip de subtareas muestra solo el total.
- [x] En un grupo se pueden añadir (con el "+" de su cabecera), editar texto y hora, borrar, añadir subtareas, plegar y arrastrar tareas y subtareas, igual que en un día.
- [x] Una tarea o subtarea de un grupo no se puede soltar en otro grupo ni en un día.
- [x] Desde la cabecera se renombra (Enter guarda, Esc descarta) y se borra con confirmación en la nota; borrar el último grupo muestra "Sin plantillas".
- [x] Los grupos se reordenan arrastrando la cabecera (Esc restaura); el orden se conserva al reiniciar.
- [x] A 308 px (libre y anclada) un nombre largo se recorta con `…` y el botón "Copiar a Hoy" se ve entero.
- [x] "Copiar a Hoy" está deshabilitado con el grupo vacío.
- [x] "Copiar a Hoy" añade todas las tareas del grupo al final de Hoy, en su orden, con subtareas, todas desmarcadas, con la misma hora y texto, y cambia a la pestaña Hoy.
- [x] Con Hoy ya con tareas, las copias van detrás de ellas y las existentes no cambian.
- [x] Copiar el mismo grupo dos veces deja dos juegos de copias en Hoy.
- [x] Marcar, editar o borrar una copia en Hoy no cambia la plantilla.
- [x] Las tareas de plantilla no cuentan en el progreso de ningún día ni producen aviso por hora; las copias en Hoy sí.
- [x] A las 00:00 la pestaña Plantillas sigue activa si lo estaba y los grupos no cambian.
- [x] Un `note.json` sin `templates` carga bien; uno con `templates: null`, un grupo sin nombre o una tarea inválida dentro de un grupo se respalda como corrupto.
- [x] Los grupos y sus tareas se conservan al reiniciar la app.
- [x] En la fila de añadir (día o grupo), escribir una tarea y hacer clic fuera la crea con el texto escrito; con hora vacía o no válida usa la hora actual; Esc la descarta; solo espacios no crea nada.
- [x] En cualquier pestaña de día, la papelera junto a "Marcar todas" pide confirmación ("¿Borrar las N tareas de Hoy?") y, al confirmar, borra todas las tareas de ese día (marcadas o no, con sus subtareas); Esc o "Cancelar" no borran nada; otros días y las plantillas no cambian.
- [x] La papelera de "Borrar todas" no se ve con el día sin tareas ni en Plantillas.
- [x] `npm test`, `npm run lint` y `npm run typecheck` pasan.

---

## Decisiones

- **Sí:** pestaña después de Mañana con ícono + texto; solo ícono cuando no cabe (anclada o < 360 px). **No:** texto siempre (no cabe a 308 px). **No:** solo ícono en ambos anchos (se descubre menos).
- **Sí:** grupos con nombre y tareas con hora y subtareas, mismo formato `Task`. Se reutilizan filas, edición y arrastre. **No:** tareas sin hora o sin subtareas.
- ~~**Sí:** selector desplegable + lista del grupo activo. **No:** grupos apilados en secciones.~~ Cambiado durante la implementación (ver abajo).
- **Sí** (cambio durante la implementación): grupos apilados, uno debajo del otro, plegables con clic en la cabecera. Se ven y se comparan todos a la vez; plegar evita que la lista crezca sin fin. **No:** selector + menú con un solo grupo visible (primera versión: había que abrir el menú para ver otro grupo). **No:** fila de chips (scroll horizontal con 3+ grupos).
- **Sí:** acciones en la cabecera de cada grupo: "Copiar a Hoy" siempre visible (acción principal); "+", lápiz y papelera al pasar el ratón. **No:** menú ⋯ por grupo (un clic más).
- **Sí** (cambio durante la implementación): "Copiar a Hoy" solo con ícono y el texto en el tooltip, para dejar más sitio al nombre del grupo. **No:** ícono + texto (unos 110 px de cabecera a 308 px).
- **Sí** (cambio durante la implementación): sin botón "Nuevo grupo" al final de la lista; se crea con el "+" de la fila de días, que en Plantillas ya se llama "Nuevo grupo". **Sí:** "Sin plantillas" mantiene "Crear grupo" (la lista vacía necesita una indicación visible). **No:** dos controles para lo mismo.
- **Sí:** estado plegado guardado en `note.json` (`collapsed` del grupo, como en las tareas). **No:** solo en memoria (al reabrir se perdería cómo los dejó el usuario).
- **Sí:** reordenar grupos arrastrando la cabecera, mismo gesto que las tareas. **No:** quitar el reordenado.
- **Sí:** en Plantillas el "+" de la fila de días crea un grupo; las tareas se añaden con el "+" de cada cabecera. **No:** "+" deshabilitado. **No:** "+" añade al último grupo (ambiguo con varios grupos).
- **Sí:** cada grupo desplegado reutiliza una lista de `task-list.ts` (modo plantilla, sin scroll propio): mismas filas, edición y arrastre; el arrastre queda dentro de su grupo sin lógica nueva. **No:** una sola lista con cabeceras intercaladas (el arrastre tendría que saber de grupos).
- **Sí:** copiar todo el grupo al final de Hoy aunque Hoy tenga tareas; permite combinar grupos. **No:** solo con Hoy vacío. **No:** reemplazar Hoy (pérdida de datos).
- **Sí:** copias libres, sin límite por día; un duplicado se borra a mano. **No:** confirmación ni una vez por día.
- **Sí:** copiar todo el grupo. **No:** copiar tareas sueltas (más botones en la fila).
- **Sí:** tras copiar, cambiar a Hoy para ver el resultado. **No:** quedarse en Plantillas con un aviso.
- **Sí:** las plantillas no tienen check ni progreso; el bloque de progreso se oculta. El aviso por hora y "Marcar todas" ignoran las plantillas.
- **Sí:** crear, renombrar, borrar con confirmación dentro de la nota y reordenar grupos. **No:** diálogos nativos (`confirm`). **No** (fuera de alcance): "Guardar Hoy como plantilla".
- **Sí:** `note.templates` opcional en `note.json`, sin subir `version` (como `lastCarryOver`). Los archivos actuales siguen válidos. **No:** `version: 4`. **No:** archivo aparte `templates.json` (más IPC y otro repositorio).
- **Sí:** ids de tareas únicos en toda la nota, incluidas plantillas, para que las operaciones por id sigan funcionando sin saber dónde está la tarea.
- **Sí:** `createdAt` de la copia = momento de copiar (la tarea nace ese día). **No:** heredar el `createdAt` de la plantilla (en SPEC 07 se hereda porque copia tareas reales de otro día).
- **Sí:** pestaña Plantillas solo en memoria; al abrir, Hoy. Coherente con SPEC 03 (pestaña activa no persistida). (Con los grupos apilados ya no hay "grupo activo".)
- **Sí:** nombres de grupo de máx. 40 caracteres, repetidos permitidos. Límite para que la cabecera no crezca sin fin.
- **Sí:** la confirmación de borrado ajusta la frase al número de tareas ("¿Borrar «X»?", "… y su tarea?", "… y sus N tareas?").
- **Sí:** a las 00:00 la vista Plantillas no cambia (no es un día).
- **No:** subir la versión ni generar instalador en esta spec.
- **Sí** (añadido durante la implementación): botón "Borrar todas" junto a "Marcar todas" que borra todas las tareas del día activo, marcadas o no, en cualquier pestaña de día, con confirmación dentro de la nota. Se hace en esta spec a petición del usuario aunque no es de plantillas. **No:** borrar solo las hechas (el usuario quiere vaciar el día de una vez). **No:** modo selección con casillas (más complejo). **No:** borrar sin confirmar (no hay deshacer).
- **Sí** (añadido durante la implementación): en la fila de añadir, perder el foco con texto crea la tarea (antes lo descartaba, SPEC 05). Así no se pierde lo escrito al hacer clic fuera; es coherente con editar texto o subtareas, que ya guardan al perder el foco. Hora no válida al perder el foco = hora actual (no se pierde la tarea por una hora mal escrita). **Sí:** Esc sigue descartando (forma explícita de cancelar). **No:** Esc también crea (no quedaría forma de cancelar). **No:** dejar la fila abierta con la hora en rojo (el clic fuera debe cerrarla).

---

## Riesgos

| Riesgo | Mitigación |
| ------ | ---------- |
| La fila de días desborda a 308 px con la cuarta pestaña | Solo ícono anclada o < 360 px; prueba manual en el paso 3 a 308 libre y anclada. |
| Generalizar la búsqueda por id rompe operaciones de días | Tests existentes de `note-operations` siguen pasando; tests nuevos de operaciones dentro de grupos (paso 2). |
| `task-list.ts` (764 líneas) se complica con el modo plantilla | El modo solo quita checks y cambia el chip; el arrastre recibe la lista activa sin saber si es día o grupo. |
| Un `note.json` con plantillas abierto por una versión anterior de la app | El validador estricto anterior podría rechazar el campo y respaldar el archivo como corrupto. Aceptado: no se vuelve a versiones anteriores; el respaldo conserva los datos. |
| Borrar un grupo por error | Confirmación dentro de la nota con nombre y número de tareas. |
| Borrar todas las tareas de un día por error (no hay deshacer) | Confirmación dentro de la nota con el número de tareas y el día; foco en "Cancelar". |
| Varias listas de tareas incrustadas (una por grupo): arrastre y autodesplazamiento pensados para una lista con scroll propio | La lista incrustada usa como zona de autodesplazamiento el contenedor con scroll de Plantillas; prueba manual de arrastre en grupos largos (paso 9). |
| Cabecera a 308 px con nombre, contador, botón "Copiar a Hoy" y tres botones | Los tres botones flotan sobre el final del nombre al pasar el ratón (como las acciones de fila); el nombre se recorta con `…`. Prueba a 308 px (paso 10). |

---

## Qué **no** entra en esta spec

- "Guardar Hoy como plantilla".
- Copiar tareas sueltas o elegir cuáles copiar.
- Copiar a Mañana u otros días.
- Aplicar plantillas automáticamente.
- Marcar tareas de plantilla como hechas.
- Arrastrar tareas entre grupos o entre un grupo y un día.
- Deshacer la copia.
- Exportar/importar plantillas.
- Nueva versión de la app o instalador.

Cada una, si llega, va en su propia spec.
