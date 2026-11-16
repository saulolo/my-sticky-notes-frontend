# SPEC 05 — Ancho libre de 360 px y botón para minimizar a la barra de tareas

> **Estado:** Implementado
> **Depende de:** SPEC 01, SPEC 04
> **Fecha:** 2026-11-15
> **Objetivo:** La nota libre mide 360 px de ancho (fijada sigue en 308 px) y la cabecera suma un botón con flecha hacia abajo que minimiza la ventana a la barra de tareas, sin cambiar el botón actual de colapsar. Añadido durante la implementación: "+" = nueva tarea en la fila de días; engranaje, fecha corta y botón "Siempre encima" en la fila superior; anillo de progreso.

---

## Por qué existe esta spec

La SPEC 04 dejó la nota en 308 px para igualar otra app del usuario cuando está anclada. Libre, el usuario la quiere más ancha (360 px, el ancho del mockup). Además, hoy "Minimizar" solo colapsa la nota a la cabecera: no hay forma de quitarla de la pantalla sin cerrarla.

---

## Alcance

**Entra:**

- **Ancho según el estado:**
  - Libre (sin fijar): la nota mide 360 px de ancho. La ventana mide 480 px (360 + 60 + 60 de márgenes).
  - Fijada (anclada): la nota sigue en 308 px. La ventana mide 368 px (308 + 60 de margen izquierdo).
  - Fijar cambia a 308 px; desfijar vuelve a 360 px. Colapsada conserva el ancho de su estado.
  - El ancho sigue fijo: no se arrastra.
  - La posición libre guardada (`x`, `y`) es la de la ventana, como hoy. Desfijar restaura la ventana libre en `x`, `y` con 480 px de ancho.
  - Una nota libre de 360 px sigue cabiendo en su área útil (`fitFreeBounds`). Si al pasar de 308 a 360 queda fuera por la derecha, se corre a la izquierda hasta caber.
  - El renderer toma el ancho de `--note-width`: 360 px por defecto, 308 px con `is-docked`.
- **Botón "Minimizar a la barra de tareas":**
  - Botón nuevo en la fila superior de la cabecera, con icono de flecha hacia abajo.
  - Orden a la derecha: fijar, colapsar (botón actual, guion), minimizar a la barra (nuevo), cerrar.
  - El botón actual (guion) no cambia de icono ni de comportamiento: colapsa y expande la nota. Su `aria-label`/`title` pasa a "Colapsar" para no repetir "Minimizar".
  - El botón nuevo tiene `aria-label`/`title` "Minimizar a la barra de tareas".
  - Clic: la ventana se minimiza con el minimizado nativo de Windows (`BrowserWindow.minimize()`). La app sigue en la barra de tareas.
  - Se restaura con clic en su icono de la barra de tareas (o Alt+Tab). Vuelve tal como estaba: libre o anclada, colapsada o expandida, misma posición y alto.
  - Funciona libre y fijada, colapsada y expandida.
  - Al restaurar, `WindowControls` vuelve a aplicar los bounds calculados (como en `ready-to-show`). Si los monitores cambiaron mientras estaba minimizada, el anclaje se recalcula al restaurar.
  - Minimizar no guarda nada nuevo en `note.json`. Si la app se cierra minimizada, al abrir se muestra normal (no minimizada).
- **Botón "+" = nueva tarea** (añadido durante la implementación):
  - El botón "+" (antes "Nueva nota", inerte, en la fila superior) pasa a `aria-label`/`title` "Nueva tarea".
  - El "+" se muda a la fila de días: "+" a la izquierda, "Ayer", "Hoy", "Mañana" centrados y el historial a la derecha. El menú de historial se abre hacia la izquierda (alineado al borde derecho del botón).
  - La fila superior pierde el "+" (ver "Fila superior" abajo).
  - La fila "Añadir nueva tarea…" queda oculta por defecto: la lista solo muestra las tareas.
  - Clic en "+": aparece la fila al final de la lista, con el foco en la hora (como tras Enter, SPEC 02).
  - Enter crea la tarea y la fila sigue visible con el foco en la siguiente.
  - La fila se oculta al perder el foco (clic fuera, cambiar de ventana) o con Esc. Lo escrito sin Enter se descarta.
  - Colapsada no hay "+": la fila de días se oculta al colapsar (SPEC 04).
  - Funciona en cualquier día activo (como la fila de hoy).
- **Fila superior: engranaje, fecha y "Siempre encima"** (añadido durante la implementación):
  - Orden: engranaje, fecha, hueco (zona de arrastre), "Siempre encima", fijar, divisor, colapsar, minimizar a la barra, cerrar.
  - **Engranaje** (`aria-label`/`title` "Configuración"): abre un menú vacío con el texto "Próximamente". Se cierra con clic fuera, Esc o clic en el engranaje (como el menú de historial). Las opciones llegan en otra spec.
  - **Fecha** del día activo en formato corto `Mié, 11 nov` (día abreviado a 3 letras con tilde: Dom, Lun, Mar, Mié, Jue, Vie, Sáb), en los dos anchos. Cambia con la pestaña activa y a las 00:00, como hoy. Es texto: se puede arrastrar la ventana desde ella. Se ve también colapsada (la fila superior no se oculta).
  - **"Siempre encima"** (`aria-label`/`title` "Siempre encima", `aria-pressed`): activa `win.setAlwaysOnTop()`. Encendido se marca con `--accent` como fijar. Se combina con fijar: funciona libre y anclada. Se guarda en `note.json` y se aplica al abrir.
- **Bloque de progreso: anillo** (añadido durante la implementación):
  - La fecha sale del bloque de progreso. En su lugar, a la izquierda, un anillo de progreso pequeño (14 px, trazo `--accent` sobre `--bg-track`) con el mismo porcentaje que la barra.
  - Se mantienen "N de M hechas" a la derecha y la barra lineal debajo.
- Actualizar la sección "Window" de `CLAUDE.md` y el `README.md`.
- Tests de `window-metrics.ts` para los dos anchos.

**Fuera de alcance:**

- Ancho ajustable arrastrando.
- Ancho libre configurable por el usuario.
- Minimizar a la bandeja del sistema (icono junto al reloj) o ocultar la ventana de la barra de tareas.
- Atajo de teclado para minimizar.
- Icono propio de la app en la barra de tareas (sigue el de Electron hasta la spec de empaquetado).
- Recordar entre sesiones que la ventana estaba minimizada.
- Cambiar el icono o el comportamiento del botón de colapsar.
- Varias notas: "+" añade una tarea a la nota actual, no crea otra nota.
- Opciones dentro del engranaje (acento, inicio con Windows, etc.).

---

## Modelo de datos

`note.json` sigue en `version: 2`. Única preferencia nueva (añadido durante la implementación):

```ts
interface WindowPrefs {
  // …pinned, collapsed, x, y, height
  /** Ventana siempre encima de las demás. Independiente de `pinned`. */
  alwaysOnTop: boolean
}
```

- Opcional al leer: un archivo de la SPEC 04 sin `alwaysOnTop` carga con `false` (como `height` → `null`). Si existe y no es booleano, el archivo es inválido (igual que el resto de prefs).
- `DEFAULT_WINDOW_PREFS.alwaysOnTop = false`.

Fecha corta en `src/core/domain/date-label.ts` (pura, testeada): `shortDateLabel(date)` → `Mié, 11 nov`.

Cambios en `src/main/window-metrics.ts` (puro, testeable):

```ts
/** Ancho de la nota libre. */
export const FREE_NOTE_WIDTH = 360
/** Ancho de la nota anclada (antes NOTE_WIDTH). */
export const DOCKED_NOTE_WIDTH = 308
/** Ventana libre: 360 + 60 + 60 = 480. */
export const WINDOW_WIDTH = FREE_NOTE_WIDTH + SHADOW_MARGIN.left + SHADOW_MARGIN.right
```

- `NOTE_WIDTH` se reemplaza por `FREE_NOTE_WIDTH` y `DOCKED_NOTE_WIDTH`.
- `freeBounds`, `fitFreeBounds` y el cálculo del monitor de la nota usan `FREE_NOTE_WIDTH`.
- `dockedBounds` usa `DOCKED_NOTE_WIDTH`.

IPC nuevo (preload `window.stickyApi`):

- `window:minimize` (send, sin argumentos): el main llama `win.minimize()`.
- `window:set-always-on-top` (invoke, booleano): el main guarda la pref y llama `win.setAlwaysOnTop()`. `window:get-prefs` ya devuelve `alwaysOnTop` dentro de las prefs.

Renderer:

- `tokens.css`: `--note-width: 360px` por defecto y `--note-width: 308px` dentro de `.is-docked`.
- `icons.ts`: icono nuevo `arrowDown` (flecha hacia abajo).
- `header.ts`: handler nuevo `onMinimizeToTaskbar()`.
- `icons.ts` (añadido durante la implementación): `settings` (engranaje) y `layers` (siempre encima), estilo Lucide.
- `header.ts`: `setDate(label)`, `setAlwaysOnTop(on)`, handler `onToggleAlwaysOnTop()`, menú del engranaje.
- `progress.ts`: sin fecha; anillo SVG + "N de M hechas" + barra.

---

## Plan de implementación

1. `window-metrics.ts`: `FREE_NOTE_WIDTH` y `DOCKED_NOTE_WIDTH` en lugar de `NOTE_WIDTH`; `freeBounds`/`fitFreeBounds` con 360 y `dockedBounds` con 308. `tokens.css` con `--note-width` 360 y 308 en `.is-docked`. Tests en `tests/`. Prueba manual: libre la nota mide 360 px; fijar la deja en 308 pegada al borde; desfijar vuelve a 360 en su posición.
2. Botón nuevo en `header.ts` con icono `arrowDown` (`icons.ts`), en el orden fijar, colapsar, barra, cerrar. El botón de colapsar pasa a `aria-label`/`title` "Colapsar". IPC `window:minimize` en `ipc.ts`, preload y `main.ts`. Prueba manual: clic minimiza a la barra; clic en el icono de la barra la restaura.
3. Al restaurar (`restore` de `BrowserWindow`), `WindowControls` vuelve a aplicar los bounds calculados (libre o anclada, colapsada o no). Prueba manual: minimizar anclada, restaurar y ver que sigue pegada al borde a todo el alto.
4. Actualizar `CLAUDE.md` (sección "Window": anchos 360/308, ventana 480/368, botón de minimizar) y `README.md`.
5. (Añadido durante la implementación.) "+" de la cabecera = "Nueva tarea": `add-row.ts` oculta la fila por defecto y la muestra con `open()`; se oculta al perder el foco o con Esc. `task-list.ts` expone `openAddRow()`; `header.ts` handler `onNewTask()`. Actualizar `CLAUDE.md` y `README.md`. Prueba manual: la fila no aparece; "+" la muestra con foco; Enter crea y deja el foco en la siguiente; clic fuera o Esc la ocultan.
6. (Añadido durante la implementación.) "+" a la izquierda de la fila de días, pestañas centradas, historial a la derecha con su menú hacia la izquierda.
7. (Añadido durante la implementación.) Fila superior: `shortDateLabel` en `date-label.ts` con tests; engranaje con menú "Próximamente" y fecha corta a la izquierda de `header.ts`; `main.ts` pasa la fecha a la cabecera en vez de al progreso. Prueba manual: engranaje y fecha a la izquierda, también colapsada; la fecha cambia con la pestaña; el menú abre y cierra.
8. (Añadido durante la implementación.) Anillo de progreso en `progress.ts` en lugar de la fecha. Prueba manual: el anillo y la barra muestran el mismo porcentaje al marcar tareas.
9. (Añadido durante la implementación.) "Siempre encima": `alwaysOnTop` en `WindowPrefs` y `validate-stored-data.ts` (opcional al leer) con tests; `WindowControls.setAlwaysOnTop` y aplicarla al crear; IPC `window:set-always-on-top`, preload; botón en `header.ts` antes de fijar. Prueba manual: encendido queda encima de otras ventanas, libre y anclada; se recuerda al reabrir; un `note.json` de la SPEC 04 carga con el botón apagado.
10. (Añadido durante la implementación.) Actualizar `CLAUDE.md` y `README.md` con los pasos 5–9.

---

## Criterios de aceptación

- [x] Libre, la nota mide 360 px de ancho y la ventana 480 px.
- [x] Fijada, la nota mide 308 px y toca el borde derecho del área útil.
- [x] Desfijar devuelve la nota a 360 px en su posición libre guardada.
- [x] Una nota libre pegada al borde derecho del área útil sigue entera en pantalla con 360 px.
- [x] Colapsada libre mide 360 px; colapsada fijada, 308 px.
- [x] A 308 px la fila superior muestra fijar, colapsar, minimizar a la barra y cerrar sin cortarse.
- [x] A 308 px la fila de días muestra "+" a la izquierda, "Ayer", "Hoy", "Mañana" centrados y el historial a la derecha, sin cortarse.
- [x] El menú de historial se abre hacia la izquierda y queda dentro de la nota.
- [x] El botón con guion sigue colapsando y expandiendo la nota, con título "Colapsar".
- [x] El botón con flecha hacia abajo está entre colapsar y cerrar, con título "Minimizar a la barra de tareas".
- [x] Clic en la flecha minimiza la ventana a la barra de tareas.
- [x] Clic en el icono de la barra de tareas restaura la nota.
- [x] Restaurada vuelve igual: libre o anclada, colapsada o expandida, misma posición y alto. _(pendiente: intermitente; libre colapsada volvió una vez con el alto expandido, falló 1 de 2 ejecuciones)_
- [x] Minimizar y restaurar fijada la deja anclada a todo el alto del área útil.
- [x] Cerrar la app minimizada y abrirla la muestra normal.
- [x] La fila "Añadir nueva tarea…" no aparece por defecto.
- [x] El "+" de la fila de días tiene título "Nueva tarea" y muestra la fila con el foco puesto.
- [x] Enter crea la tarea y deja el foco en la fila para la siguiente.
- [x] Clic fuera de la fila o Esc la ocultan y descartan lo escrito sin Enter.
- [x] Colapsada, el "+" no se ve (se oculta con la fila de días).
- [x] A 308 px la fila superior muestra engranaje, fecha corta, "Siempre encima", fijar, colapsar, minimizar a la barra y cerrar sin cortarse.
- [x] La fecha corta (`Mié, 11 nov`) es la del día activo, cambia con la pestaña y se ve también colapsada.
- [x] El engranaje ("Configuración") abre un menú "Próximamente" que se cierra con clic fuera o Esc. _(pendiente: colapsada, una vez expandió sin abrir el menú, falló 1 de 2 ejecuciones)_
- [x] El bloque de progreso ya no muestra la fecha: anillo a la izquierda, "N de M hechas" a la derecha y la barra debajo, con el mismo porcentaje.
- [x] "Siempre encima" deja la ventana por encima de las demás, libre y anclada, y se marca con el acento.
- [x] "Siempre encima" se recuerda al cerrar y abrir la app.
- [x] `note.json` sigue en `version: 2`: un archivo de la SPEC 04 (sin `alwaysOnTop`) carga igual, con "Siempre encima" apagado.
- [x] `npm test`, `npm run lint` y `npm run typecheck` pasan.

---

## Decisiones

- **Sí:** ancho libre 360 px y anclado 308 px, por pedido del usuario. Libre recupera el ancho del mockup; anclada mantiene el ancho de su otra app.
- **No:** el mismo ancho en los dos estados, ni ancho arrastrable. Más alcance sin pedido.
- **Sí:** se guarda la posición de la ventana como hoy. **No:** guardar la posición de la nota; cambiaría el formato sin necesidad.
- **Sí:** botón nuevo aparte para minimizar a la barra; el de colapsar no cambia, por pedido del usuario.
- **No:** un solo botón con dos gestos (clic/doble clic), ni reemplazar el botón actual. Menos descubrible.
- **Sí:** icono de flecha hacia abajo para el botón nuevo y guion para colapsar, por pedido del usuario. **No:** chevron para colapsar y guion para minimizar (estilo Windows); el usuario prefirió no tocar el botón actual.
- **Sí:** orden fijar, colapsar, barra, cerrar: minimizar junto a cerrar, como en Windows.
- **Sí:** el botón de colapsar cambia su `aria-label`/`title` a "Colapsar" para no tener dos botones "Minimizar". Solo texto; icono y comportamiento iguales. Si el usuario prefiere conservar "Minimizar", se revierte en la revisión.
- **Sí:** minimizado nativo (`win.minimize()`), permitido también fijada. Restaura tal como estaba.
- **No:** bandeja del sistema ni ocultar de la barra de tareas. Otra spec si llega.
- **Sí** (añadido durante la implementación, por pedido del usuario): "+" de la cabecera abre la fila de nueva tarea, que queda oculta por defecto para que la nota se vea más limpia. Se oculta al perder el foco o con Esc y descarta lo no enviado. Título "Nueva tarea". **No:** varias notas.
- **Sí** (añadido durante la implementación, por pedido del usuario): el "+" va a la izquierda de la fila de días, con las pestañas centradas y el historial a la derecha. Colapsada no hay "+" (se oculta con la fila de días). **No:** mostrar la fila de días colapsada; cambiaría `COLLAPSED_HEIGHT`.
- **Sí** (añadido durante la implementación, por pedido del usuario): engranaje y fecha a la izquierda de la fila superior, anillo de progreso donde estaba la fecha, y botón "Siempre encima" junto a fijar. **No:** dejar estos cambios para una SPEC 06; el usuario prefirió meterlos aquí.
- **Sí:** fecha corta (`Mié, 11 nov`) en los dos anchos: a 308 px, con 7 elementos en la fila, la fecha larga (`Miércoles, 11 nov`) no cabe (quedan ~79 px). **No:** larga libre y corta fijada (cambia según el estado), ni recortarla con "…".
- **Sí:** el engranaje abre un menú vacío "Próximamente". **No:** meter "Siempre encima" dentro del engranaje; va como botón propio.
- **Sí:** "Siempre encima" se guarda y se combina con fijar. Contradice a propósito la nota de SPEC 04 "fijar no es siempre encima": siguen siendo cosas distintas, ahora con un botón para cada una.
- **Sí:** el anillo convive con "N de M hechas" y la barra, por pedido del usuario, aunque repite el porcentaje de la barra.
- **Sí:** reaplicar bounds al restaurar, por lo mismo que en `ready-to-show` (Windows redondea mal tamaños de ventanas transparentes y sin marco).
- **Sí** (añadido durante la implementación): minimizada no se guarda la posición (Windows informa -32000, -32000 y dispara `move`), y antes de minimizar se guarda la posición libre pendiente del debounce. Así minimizar no escribe nada nuevo y cerrar minimizada abre normal.
- **Sí** (añadido durante la implementación): `fitFreeBounds` solo corrige el borde derecho de la nota (la corre a la izquierda); el izquierdo se deja como antes.

---

## Riesgos

| Riesgo | Mitigación |
| ------ | ---------- |
| Windows restaura una ventana sin marco y transparente con tamaño o posición distintos | Reaplicar los bounds calculados en el evento `restore`. |
| Cambian los monitores con la ventana minimizada y anclada | El listener de `screen` ya recalcula; además se recalcula al restaurar. |
| Una nota libre guardada cerca del borde derecho queda cortada al crecer de 308 a 360 | `fitFreeBounds` al crear, expandir y desfijar la corre hasta caber. |
| Los botones no caben en la fila superior o en la de días a 308 px | Criterio de aceptación explícito; botones de icono (`.ib`) del mismo tamaño que los actuales. |
| Un `note.json` de la SPEC 04 se rechaza por no tener `alwaysOnTop` | `alwaysOnTop` opcional al leer (`false` si falta), con test. |
| La fecha y 7 botones no caben a 308 px | Fecha corta y criterio de aceptación explícito. |
| `setResizable(false)` impide cambiar el ancho al fijar/desfijar | Ya se envuelve `setBounds` con `setResizable(true)` (SPEC 04). |

---

## Qué **no** entra en esta spec

- Ancho arrastrable o configurable.
- Bandeja del sistema u ocultar de la barra de tareas.
- Atajo de teclado para minimizar.
- Icono propio en la barra de tareas.
- Recordar el estado minimizado entre sesiones.
- Opciones del menú de configuración.
- Cambios al botón de colapsar más allá de su texto.

Cada una, si llega, va en su propia spec.
