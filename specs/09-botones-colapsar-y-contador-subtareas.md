# SPEC 09 — Botones de colapsar/minimizar claros y contador de subtareas

> **Estado:** Implementado
> **Depende de:** SPEC 05, SPEC 01
> **Fecha:** 2026-11-19
> **Objetivo:** Que no se confundan "Colapsar" y "Minimizar a la barra" en la cabecera, que el contador de subtareas muestre cuántas están hechas de cuántas sin saltar al pasar el mouse, y poder ajustar el ancho de la nota libre arrastrando sus bordes.

---

## Por qué existe esta spec

Hoy la fila de arriba de la cabecera termina en `[—][↓][×]`: "Colapsar" usa la raya y "Minimizar a la barra de tareas" usa una flecha abajo. En Windows la raya significa minimizar, así que el usuario confunde un botón con el otro. Además "Colapsar" dice siempre lo mismo aunque la nota ya esté colapsada.

El botón de las subtareas (chevron + número) solo muestra el total, sin decir cuántas faltan. Además, al pasar el mouse por la fila el contador salta 46 px a la izquierda para dejar sitio a "+" y papelera: es abrupto y a anchos pequeños se vería peor.

Por último, el ancho de la nota es fijo (SPEC 05) y el usuario quiere ajustarlo como ya ajusta el alto. *(Añadido durante la implementación.)*

---

## Alcance

**Entra:**

- **Iconos de la cabecera:**
  - "Minimizar a la barra de tareas" pasa a usar la raya `—` (icono `minimize`, convención de Windows). Se deja de usar `arrowDown` en la cabecera.
  - "Colapsar" usa un chevron: hacia arriba con la nota expandida (plegar al header) y hacia abajo con la nota colapsada (desplegar).
- **Orden de la fila de arriba:** siempre encima, fijar, colapsar, divisor, minimizar a la barra, cerrar. El grupo de la derecha queda `[—][×]`, como una ventana de Windows.
  - Expandida: `[⚙] Jue, 19 nov … [≡][📌][︿] | [—][×]`
  - Colapsada: `[⚙] Jue, 19 nov … [≡][📌][﹀] | [—][×]`
- **Texto del botón Colapsar según el estado:** `title` y `aria-label` = "Colapsar" con la nota expandida y "Expandir" con la nota colapsada; `aria-expanded` refleja el estado. Al arrancar colapsada ya muestra "Expandir" y el chevron abajo.
- **Contador de subtareas:**
  - Muestra `hechas/total` (p. ej. `1/3`, `0/2`) en lugar del total.
  - Con todas hechas (`3/3`) el número va en color de acento (`--accent`). Sin icono extra.
  - El chevron sigue igual: abajo expandida, girado a la derecha contraída. Ningún otro cambio de estilo al contraer.
  - `title` y `aria-label`: "Contraer subtareas (1 de 3 hechas)" / "Expandir subtareas (1 de 3 hechas)".
  - Se actualiza al marcar o desmarcar una subtarea, al añadirla y al borrarla.
  - Marcar la tarea padre no cambia el contador (regla de SPEC 01: no toca sus subtareas).
- **Acciones de fila sin salto** *(añadido durante la implementación)*: al pasar el mouse (o con el foco dentro) por una fila de tarea o subtarea, "+" y papelera flotan encima del final de la fila con un fondo degradado del color de la nota; el contador de subtareas no se mueve. Se elimina el `margin-right: 46px` del hover.
- **Ancho ajustable de la nota libre** *(añadido durante la implementación; reemplaza la regla "ancho fijo" de SPEC 05 solo para la nota libre)*:
  - Manijas propias de 6 px en los bordes izquierdo y derecho de la nota (no en el margen transparente), como las de alto. Se ocultan e ignoran anclada y colapsada.
  - Rango de la nota: mínimo 308 px (`DOCKED_NOTE_WIDTH`, cabe la cabecera) y máximo el ancho del área de trabajo menos márgenes de sombra. Por defecto 360 (`FREE_NOTE_WIDTH`).
  - Arrastrar el borde izquierdo mueve la ventana (la nota crece hacia la izquierda y el borde derecho queda fijo); el borde derecho crece hacia la derecha. La nota siempre cabe en su área de trabajo (se desplaza como `fitFreeBounds` hace con el alto).
  - El ancho se guarda en `note.json` (pref `width`, opcional como `height`) y se restaura al abrir. Anclada sigue en 308 fijos; al desanclar vuelve el ancho libre guardado. Colapsada conserva el ancho del estado en que está.
  - El token `--note-width` se elimina: la nota llena la ventana menos los márgenes, así que sigue el ancho real.
- **Clic en la tarea alterna sus subtareas** *(añadido durante la implementación)*: un clic simple sobre la fila de una tarea que tiene subtareas las contrae o expande (igual que el botón del contador, que se mantiene). Solo en zonas que no son botones ni inputs. Para no chocar con el doble clic (editar texto u hora), el clic simple espera ~250 ms y el doble clic lo cancela. Tareas sin subtareas: el clic no hace nada. Arrastrar para reordenar no alterna.
- **Efecto de "se puede expandir"** *(añadido durante la implementación)*: las tareas con subtareas (clase `has-subtasks`) muestran `cursor: pointer` y, al pasar el mouse, se levantan 1 px con sombra suave y un fondo más claro (transición 150 ms); al pulsar vuelven a su sitio. Las tareas sin subtareas no cambian. No se aplica durante un arrastre ni con la fila en edición.
- **Contador como chip** *(añadido durante la implementación; cambia el estilo, no el texto)*: el contador pasa a píldora (fondo `rgba(255,255,255,0.06)`, borde de 1 px, radio completo) con chevron de 10 px. El fondo se llena de izquierda a derecha con el acento (~22 %) según `hechas/total` (variable `--sub-progress`, transición 250 ms). Con todas hechas, el chip entero va en acento (fondo, borde y texto), no solo el número. Sigue sin haber icono extra.
- **Botón contraer/expandir en la fila padre** *(añadido durante la implementación)*: las tareas con subtareas muestran, entre las acciones de hover y antes del "+", un botón con un chevron que indica el estado y gira 180° (250 ms) al alternar: abajo con las subtareas contraídas ("Expandir subtareas"), arriba con ellas visibles ("Contraer subtareas"). El "+" conserva su función (añadir subtarea). Hace lo mismo que el clic en la fila y que el chip. Solo el botón de la tarea que se acaba de alternar anima.
- **Marcar / desmarcar todas** *(añadido durante la implementación)*: botón en el bloque de progreso, a la derecha de "N de M hechas" (icono de doble check, 14 px, `.ib sm`).
  - Un solo botón que alterna: si falta alguna tarea o subtarea por marcar, marca todas las del día activo; si ya están todas hechas, las desmarca todas.
  - Afecta a las tareas y a sus subtareas del día de la pestaña activa (el progreso cuenta ambas). Es la única acción que cambia las subtareas al marcar una tarea; marcar una tarea a mano sigue sin tocarlas (SPEC 01).
  - `title` y `aria-label`: "Marcar todas" o "Desmarcar todas" según el estado. Oculto si el día no tiene tareas.
  - Funciona en cualquier pestaña (Ayer, Hoy, Mañana, historial), libre y anclada. Es un cambio normal de la nota: se guarda con el autoguardado.
- **Textos:** `README.md` (tabla de la cabecera: orden de botones; sección de subtareas: contador `hechas/total`; ancho ajustable) y `CLAUDE.md` (iconos y orden de los botones de la cabecera, contador, ancho libre ajustable, regla de la ventana).

**Fuera de alcance:**

- Quitar o fusionar Colapsar y Minimizar a la barra; cambiar lo que hacen.
- Cambiar el contador de progreso del día (anillo, `N de M hechas`, barra).
- Resaltar el contador cuando las subtareas están contraídas.
- Mover el chevron a la izquierda de la fila o cambiar la posición del contador.
- Atajos de teclado para colapsar o minimizar.
- Ancho ajustable de la nota anclada.
- Cambiar datos guardados, IPC o el proceso main **salvo lo necesario para el ancho ajustable** (pref `width`, canales de arrastre de ancho y `window-metrics`).
- Subir la versión de la app o generar un instalador nuevo.

---

## Modelo de datos

Los pasos 1 a 3 son solo renderer y no cambian `note.json`. El paso 4 (ancho) añade la pref opcional `width` a `note.json` (ver al final de esta sección).

Renderer:

- `src/renderer/ui/icons.ts`: nuevo `chevronUp(size)` (estilo Lucide, `m18 15-6-6-6 6`). `arrowDown` se borra si queda sin uso.
- `src/renderer/ui/header.ts`:
  - Orden nuevo de los botones; `.collapse` usa `chevronUp`/`chevronDown`, `.to-taskbar` usa `minimize`.
  - Nuevo método en el objeto que devuelve el header: `setCollapsed(collapsed: boolean)`, que cambia icono, `title`, `aria-label` y `aria-expanded` del botón Colapsar.
- `src/renderer/main.ts`: llama a `header.setCollapsed(collapsed)` donde hoy aplica `is-collapsed` (arranque y cada cambio).
- `src/renderer/ui/task-list.ts`: el botón `.sub-toggle` muestra `<span>hechas/total</span>`, clase `is-complete` si `hechas === total`, y el texto del tooltip con el detalle. `hechas` = subtareas con `done: true`.
- `src/renderer/styles/app.css`: `.sub-toggle.is-complete` con `color: var(--accent)` (también en hover). Se quita el `margin-right: 46px` de `.task-row:hover .sub-toggle`; `.row-actions` (ya `position: absolute`) gana un fondo degradado `transparent → var(--note-bg)` a su izquierda.

**Ancho ajustable (paso 4):**

- `src/core/domain/window-prefs.ts`: `width: number | null` en `WindowPrefs` (por defecto `null` = `FREE_NOTE_WIDTH`); `validate-stored-data.ts` lo acepta opcional (ausente o `null` → `null` (ancho por defecto, como `height`); un valor que no sea entero ≥ 308 es inválido). Sin subir `version`.
- `src/main/window-metrics.ts`: `freeBounds`, `fitFreeBounds`, `freeResizeLimits` reciben el ancho de la nota; nueva `resizeWidth` (pura, como `resizeHeight`) con lado izquierdo/derecho y límites 308 – área de trabajo.
- `src/main/window-controls.ts` e `ipc.ts`: canales de arrastre de ancho (`window:resize-width-start`/`-move`/`-end`, send) con `screenX` absoluto; guarda `width` en prefs; `restore` y `ready-to-show` recalculan con el ancho guardado.
- `src/preload/` y `src/renderer/ui/resize-handles.ts`: manijas izquierda/derecha; el token `--note-width` desaparece (la nota llena la ventana). El arrastre de ancho reutiliza los canales `window:resize-start`/`-move`/`-end` con `edge` `left`/`right` y `screenX`, en lugar de canales nuevos.

---

## Plan de implementación

1. **Cabecera.** `chevronUp` en `icons.ts`; nuevo orden, iconos y `setCollapsed` en `header.ts`; llamada desde `main.ts`. Prueba manual con `--user-data-dir` temporal, libre (360 px) y anclada (308 px): el orden es `[≡][📌][︿] | [—][×]`; la raya minimiza a la barra; el chevron colapsa y pasa a apuntar abajo con tooltip "Expandir"; otro clic expande y vuelve a "Colapsar"; arrancar colapsada muestra "Expandir"; a 308 px la fila sigue cabiendo sin cortar la fecha.
2. **Contador de subtareas.** `task-list.ts` y `app.css`. Prueba manual: una tarea con 3 subtareas muestra `0/3`; marcar una → `1/3`; marcar todas → `3/3` en acento; desmarcar → vuelve a gris; añadir y borrar subtareas actualiza el total; contraer/expandir sigue funcionando y el tooltip dice "(N de M hechas)"; marcar la tarea padre no cambia el contador; con `10/12` la fila no se rompe a 308 px ni al pasar el mouse (botones "+" y papelera).
3. **Acciones de fila sin salto** *(añadido)*. `app.css`: quitar el desplazamiento del contador y hacer flotar "+" y papelera con degradado. Prueba manual: el contador no se mueve al pasar el mouse ni con foco por teclado; "+" y papelera siguen legibles sobre texto largo; filas de tarea y de subtarea; a 308 px y con `10/12`.
4. **Ancho ajustable** *(añadido)*. Pref `width` y validación (core, con tests), `window-metrics` (`resizeWidth`, límites, ancho en `freeBounds`/`fitFreeBounds`), controles y IPC en main/preload, manijas en el renderer, `--note-width` dinámico. Tests de `resizeWidth`, límites y validación. Prueba manual con `--user-data-dir` temporal: arrastrar borde derecho e izquierdo; mínimo 308 y máximo del área de trabajo; el borde opuesto no se mueve; no se sale de la pantalla; anclada y colapsada sin manijas; el ancho se guarda y se restaura al reabrir; desanclar vuelve al ancho guardado; la cabecera y la fila de días no se rompen a 308 px.
5. **Clic en la tarea alterna subtareas** *(añadido)*. `task-list.ts`: clic simple diferido (~250 ms) sobre `.task-row` fuera de botones e inputs, cancelado por doble clic. Prueba manual: clic muestra/oculta; doble clic en texto y en hora sigue editando sin cambiar el estado de las subtareas; clic en el check, "+", papelera y contador sigue haciendo lo suyo; arrastrar no alterna; tarea sin subtareas no hace nada.
6. **Efecto al pasar el mouse** *(añadido)*. `task-list.ts` (clase `has-subtasks`) y `app.css`. Prueba manual: solo las tareas con subtareas se levantan y muestran la mano; "+" y papelera suben con la fila y el degradado casa con el nuevo fondo; sin efecto al arrastrar ni al editar; se ve bien a 308 px.
7. **Contador como chip** *(añadido)*. `task-list.ts` (`--sub-progress`) y `app.css`. Prueba manual: `0/2` vacío, `1/2` medio relleno, `2/2` chip en acento; el relleno anima al marcar; chevron gira al contraer; `10/12` cabe a 308 px.
8. **Botón contraer/expandir en la fila padre** *(añadido)*. `task-list.ts` (botón `.toggle-subs`, `flipTaskId`) y `app.css`. Prueba manual: aparece solo en tareas con subtareas, antes del "+"; el chevron gira al alternar por el botón, por el chip o por clic en la fila; el resto de tareas no anima; "+" y papelera siguen en su sitio; a 308 px las tres acciones no se salen de la fila.
9. **Marcar / desmarcar todas** *(añadido)*. `note-operations.ts` (`setAllDone(note, day, done)`: mismo objeto si nada cambia), `NoteStore.setAllDone`, botón en `progress.ts`, conexión en `main.ts` y estilos en `app.css`. Tests de dominio y de `NoteStore`. Prueba manual: con tareas y subtareas mezcladas, el botón dice "Marcar todas" y marca todo (progreso `M de M`); pulsar otra vez dice "Desmarcar todas" y deja `0 de M`; con el día vacío no se ve; funciona en Ayer y Mañana; se conserva al reiniciar; cabe a 308 px.
10. **Textos.** `README.md` y `CLAUDE.md`.

---

## Criterios de aceptación

- [x] La fila de arriba de la cabecera muestra, de izquierda a derecha tras la fecha: siempre encima, fijar, colapsar, divisor, minimizar a la barra, cerrar.
- [x] El botón "Minimizar a la barra de tareas" usa la raya `—` y minimiza la ventana a la barra, libre y anclada.
- [x] Con la nota expandida, el botón Colapsar muestra un chevron hacia arriba y su tooltip dice "Colapsar".
- [x] Con la nota colapsada, el botón muestra un chevron hacia abajo y su tooltip dice "Expandir"; `aria-expanded` es `false`.
- [x] Si la app arranca colapsada, el botón ya muestra el chevron abajo y "Expandir".
- [x] Ningún botón de la cabecera usa la flecha abajo.
- [x] A 308 px (anclada) la fila de arriba cabe completa con la fecha corta.
- [x] El contador de una tarea con subtareas muestra `hechas/total` y se actualiza al marcar, desmarcar, añadir o borrar subtareas.
- [x] Con todas las subtareas hechas, el contador se ve en color de acento; si se desmarca una, vuelve al gris.
- [x] El tooltip del contador dice "Contraer subtareas (N de M hechas)" o "Expandir subtareas (N de M hechas)" según el estado.
- [x] Marcar la tarea padre no cambia el contador.
- [x] Contraer y expandir subtareas funciona como antes (chevron que gira).
- [x] Un contador de dos cifras (`10/12`) no rompe la fila a 308 px, tampoco con los botones "+" y papelera visibles al pasar el mouse.
- [x] Al pasar el mouse o enfocar una fila, el contador de subtareas no se mueve; "+" y papelera aparecen encima del final de la fila y se leen bien sobre texto largo.
- [x] La nota libre se puede ensanchar y estrechar arrastrando sus bordes izquierdo y derecho, entre 308 px y el ancho del área de trabajo; el borde opuesto queda fijo.
- [x] La nota libre nunca se sale de su área de trabajo al cambiar el ancho.
- [x] Anclada (308 px fijos) y colapsada no muestran ni aceptan manijas de ancho.
- [x] El ancho se guarda y se restaura al reabrir; al desanclar vuelve al ancho libre guardado.
- [x] A 308 px la cabecera y la fila de días no se rompen.
- [x] Un `note.json` sin `width` se lee bien (ancho 360) y uno con `width` inválido se rechaza.
- [x] Un clic en una tarea con subtareas las oculta o muestra; otro clic las devuelve.
- [x] El doble clic sobre el texto o la hora sigue editando y no cambia el estado de las subtareas.
- [x] Clic en el check, "+", papelera o contador hace lo suyo y no alterna dos veces; arrastrar para reordenar no alterna.
- [x] Al pasar el mouse, solo las tareas con subtareas se levantan (cursor mano, sombra y fondo más claro); las demás no cambian.
- [x] El efecto no aparece mientras se arrastra una tarea ni con la fila en edición.
- [x] El contador es un chip cuyo fondo se llena según las subtareas hechas; con todas hechas el chip entero va en acento.
- [x] En una tarea con subtareas, al pasar el mouse aparece un botón con chevron antes del "+": abajo si están contraídas, arriba si están visibles, y gira al alternar. Tareas sin subtareas no lo muestran.
- [x] El bloque de progreso muestra un botón "Marcar todas" cuando falta alguna tarea o subtarea por marcar; al pulsarlo quedan hechas todas las tareas y subtareas del día activo (`M de M hechas`).
- [x] Con todo hecho, el botón dice "Desmarcar todas"; al pulsarlo todo queda sin marcar (`0 de M hechas`).
- [x] El botón no se ve si el día no tiene tareas; el cambio se conserva al reiniciar y no toca otros días.
- [x] `README.md` y `CLAUDE.md` describen el nuevo orden de la cabecera, el contador `hechas/total` y el ancho ajustable.
- [x] `npm test`, `npm run lint` y `npm run typecheck` pasan.

---

## Decisiones

- **Sí:** raya `—` para minimizar a la barra, porque es lo que Windows usa para minimizar y es lo que el usuario espera. **No:** dejar la raya en Colapsar (origen de la confusión).
- **Sí:** chevron arriba/abajo para Colapsar: indica plegar o desplegar la nota. **No:** icono tipo "fold" (menos reconocible a 15 px).
- **Sí:** Colapsar antes del divisor, para que `[—][×]` queden juntos como en cualquier ventana. **No:** mantener el orden actual.
- **No:** quitar Colapsar; el usuario lo usa, solo lo confundía.
- **Sí:** tooltip "Colapsar"/"Expandir" según el estado, más `aria-expanded`.
- **Sí:** contador `hechas/total`. **No:** solo el total con otro estilo; **No:** chevron a la izquierda (tipo árbol).
- **Sí:** acento cuando están todas hechas, sin icono de check (más ancho a 308 px).
- **Sí:** el tooltip del contador incluye el detalle "(N de M hechas)".
- **No:** resaltar el contador cuando las subtareas están contraídas; basta el chevron girado.
- **Sí:** cálculo en el renderer (`task-list.ts`); no se añade función al dominio por ser un conteo de presentación.
- **No:** subir la versión de la app ni generar instalador en esta spec.
- **Añadido durante la implementación — acciones de fila:** **Sí:** "+" y papelera flotan encima con degradado y el contador queda quieto (funciona a cualquier ancho). **No:** reemplazar el contador por las acciones al hacer hover (pierde el conteo); **No:** mantener el desplazamiento con transición (sigue moviéndose).
- **Añadido durante la implementación — clic en la tarea:** **Sí:** clic simple en la fila alterna las subtareas (el contador deja de ser la única vía: en hover queda tapado por "+" y papelera), con retardo de ~250 ms para convivir con el doble clic. **No:** cambiar el doble clic de edición; **No:** cambiar que por defecto las subtareas se vean expandidas.
- **Añadido durante la implementación — botón de la fila padre:** **Sí:** botón extra con chevron animado antes del "+", que conserva su función. **No:** convertir el "+" en "−" (perdería añadir subtarea desde la fila padre); **No:** solo animar el "+".
- **Añadido durante la implementación — chip del contador:** **Sí:** píldora con relleno de progreso y chip en acento al completar (más estético, sin ancho extra). **No:** icono de check ni anillo aparte (la fila va justa a 308 px). Esto matiza la decisión previa "acento solo en el número".
- **Añadido durante la implementación — efecto hover:** **Sí:** levantar la fila (1 px, sombra, fondo más claro) y cursor mano solo en tareas con subtareas. **No:** chevron nuevo a la izquierda (no cabe a 308 px); **No:** solo cambiar el fondo (no distingue las expandibles).
- **Añadido durante la implementación — ancho:** **Sí:** ancho ajustable solo en la nota libre, 308 px a ancho del área de trabajo, guardado en `note.json` (pref opcional `width`, sin subir `version`). **No:** ajustable anclada (sigue 308 fijos); **No:** otro rango. Reemplaza la regla "ancho fijo, sin arrastre" de SPEC 05 para la nota libre.

- **Añadido durante la implementación — marcar todas:** **Sí:** un botón que alterna en el bloque de progreso (junto al conteo que resume, sin ocupar la cabecera a 308 px); afecta tareas y subtareas del día activo, para que el progreso llegue a `M de M`. **No:** dos botones; **No:** menú ni confirmación (se deshace pulsando otra vez); **No:** afectar otros días.

---

## Riesgos

| Riesgo | Mitigación |
| ------ | ---------- |
| El usuario ya se acostumbró a la raya como Colapsar | Tooltip "Colapsar"/"Expandir" y chevron que cambia de dirección; se anota en `README.md`. |
| El contador más ancho (`10/12`) choca con los botones "+" y papelera al pasar el mouse a 308 px | `font-variant-numeric: tabular-nums` ya está; se prueba a 308 px con dos cifras y se ajusta el `margin-right` del hover si hace falta. |
| Al ensanchar, la ventana (nota + márgenes) se sale del área de trabajo o Windows redondea mal el tamaño entre monitores con distinta escala | Reutilizar `fitFreeBounds`/`freeResizeLimits`, `setResizable(true)` alrededor de `setBounds` y recalcular en `ready-to-show` y `restore`, como con el alto. |
| Arrastrar el borde izquierdo mueve la ventana y el puntero se desfasa | Calcular desde los bounds iniciales con `screenX` absoluto (como `resizeHeight`) y compensar en las pruebas por CDP. |
| Las acciones flotantes tapan el final del texto de la tarea | Degradado corto y solo con hover/foco; el texto largo ya se recorta o salta de línea como antes. |
| El retardo del clic simple se siente lento o el doble clic dispara el alternado | ~250 ms (menos que el intervalo de doble clic de Windows, 500 ms por defecto); el doble clic cancela el pendiente y se prueba a mano. |
| El botón Colapsar se queda con icono o texto viejo si el estado cambia por otra vía (p. ej. "Acerca de" expande primero) | Toda vía de cambio pasa por `setCollapsed` en `main.ts`, que llama a `header.setCollapsed`. |

---

## Qué **no** entra en esta spec

- Quitar o fusionar Colapsar y Minimizar a la barra.
- Cambios en el progreso del día.
- Mover el chevron o resaltar subtareas contraídas.
- Atajos de teclado.
- Nueva versión de la app o instalador.
- Ancho ajustable de la nota anclada.

Cada una, si llega, va en su propia spec.
