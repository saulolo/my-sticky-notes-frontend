# SPEC 04 — Alto ajustable y nota anclada al borde del monitor

> **Estado:** Implementado
> **Depende de:** SPEC 01
> **Fecha:** 2026-11-15
> **Objetivo:** El alto de la nota se ajusta arrastrando sus bordes, y al fijarla se ancla al borde derecho del monitor secundario a todo el alto, y vuelve así sola al iniciar Windows.

---

## Por qué existe esta spec

Hoy la ventana tiene un tamaño fijo (nota de 360 × 538 px). El usuario quiere más alto para ver más tareas. Además quiere la nota pegada al borde derecho de su segundo monitor, ocupando todo el alto, y que siga ahí después de reiniciar el equipo.

---

## Alcance

**Entra:**

- **Alto ajustable (nota libre, sin fijar):**
  - Zonas de agarre propias en el borde superior y en el borde inferior de la nota (no en el margen transparente). El cursor cambia a `ns-resize` sobre ellas.
  - Arrastrar cambia el alto de la nota. El ancho es fijo.
  - Alto mínimo de la nota: 300 px. Alto máximo: el alto del área útil del monitor donde está. La nota libre siempre cabe en vertical en el área útil.
  - El margen transparente superior de la sombra pasa a 0 px (antes 40): Windows no deja subir el borde superior de la ventana por encima del área útil, y con margen la nota no llegaba arriba. Encima de la nota no hay sombra; a los lados y abajo sigue.
  - El alto se guarda en `note.json` y se restaura al abrir.
  - La lista de tareas crece y se encoge con la nota (deja de medir 400 px fijos). Header, progreso, fila de añadir y footer no cambian de alto.
  - Colapsada no se puede redimensionar. Al expandir vuelve al alto guardado.
- **Fijar = anclar:**
  - Fijar (botón pin existente) ancla la ventana. Deja de ponerla siempre encima: fijada es una ventana normal, las demás ventanas la tapan y pasa al frente al hacerle clic.
  - Monitor de anclaje: entre los monitores no principales, el de mayor `bounds.x` (el más a la derecha). Con un solo monitor, el principal.
  - Anclada, la nota toca el borde derecho del área útil del monitor y ocupa siempre todo el alto del área útil (sin la barra de tareas), sin importar el alto libre.
  - Anclada, la ventana solo conserva el margen izquierdo de la sombra (60 px). Los márgenes superior, derecho e inferior pasan a 0, para no tapar clics del monitor vecino ni de la barra de tareas.
  - Anclada, la nota tiene esquinas cuadradas (radio 0) para encajar con el borde del monitor. Desfijada vuelve al radio de 16 px.
  - Anclada no se puede mover: la cabecera deja de arrastrar la ventana.
  - Anclada no se puede cambiar el alto: las zonas de agarre se ocultan.
  - Anclada y colapsada, la cabecera queda arriba del área útil. Expandir vuelve a todo el alto.
  - Desfijar devuelve la nota a su posición y alto libres guardados, con los márgenes normales.
  - Al abrir la app fijada, la ventana aparece ya anclada.
  - Si cambian los monitores con la app abierta y fijada (se conecta, desconecta o cambia de resolución uno), se vuelve a calcular el anclaje.
- **Nota más angosta y cabecera en dos filas** (añadido durante la implementación):
  - Ancho de la nota: 308 px (antes 360), igual que la otra app del usuario (385 px físicos con escala 125 %).
  - Fila superior (cabecera, zona de arrastre): "Nueva nota" a la izquierda; fijar, minimizar y cerrar a la derecha.
  - Fila inferior: pestañas "Ayer", "Hoy", "Mañana" y el botón de historial. El menú de historial se abre hacia la derecha bajo su botón.
  - Colapsada solo queda la fila superior (la fila de días se oculta con el resto).
- **Inicio automático con Windows ligado a Fijar:**
  - Fijar registra la app para abrirse al iniciar sesión. Desfijar quita el registro.
  - Al arrancar, el registro se sincroniza con `pinned` de `note.json`.
  - Se registra `process.execPath` (electron.exe) con argumento `app.getAppPath()`. Funciona con la app construida (`npm run build` + `npm start`) mientras la carpeta del proyecto no se mueva.
  - No se registra nada al correr con el servidor de Vite (`npm run dev`, existe `ELECTRON_RENDERER_URL`) ni con `--user-data-dir` en la línea de comandos (pruebas E2E).
- Actualizar la sección "Window" de `CLAUDE.md` y el `README.md`.
- Tests de `window-metrics.ts` y de la validación de `note.json`.

**Fuera de alcance:**

- Cambiar el ancho de la nota arrastrando.
- Redimensionar desde esquinas o bordes laterales.
- Anclar a otro borde (izquierdo, arriba, abajo).
- Elegir el monitor de anclaje a mano.
- Empaquetado e instalador (`electron-builder`, `.exe`). El autoarranque depende de la carpeta del proyecto hasta que llegue esa spec.
- Inicio automático independiente de Fijar (interruptor propio).
- Hacer que el margen transparente deje pasar los clics.

---

## Modelo de datos

```ts
interface WindowPrefs {
  pinned: boolean
  collapsed: boolean
  /** Posición libre de la ventana. null = centrar. */
  x: number | null
  y: number | null
  /** Alto libre de la nota, sin márgenes. null = 538 (DEFAULT_NOTE_HEIGHT). */
  height: number | null
}
```

- El archivo sigue en `version: 2`. `height` es opcional al leer: si falta, vale `null`. Un archivo de la SPEC 03 sigue siendo válido. Un `dock` de una versión intermedia se descarta.
- `validate-stored-data.ts` rechaza `height` menor que 300, y valores no enteros o negativos.

Nuevas funciones puras en `src/main/window-metrics.ts` (sin Electron, testeables):

- `MIN_NOTE_HEIGHT = 300`, `DEFAULT_NOTE_HEIGHT = 538`.
- `DOCKED_MARGIN = { top: 0, right: 0, bottom: 0, left: 60 }`.
- `pickDockDisplay(displays, primaryId)`: monitor no principal de mayor `bounds.x`; si no hay, el principal.
- `dockedBounds(workArea, collapsed): Rect`: borde derecho, todo el alto.
- `freeBounds(x, y, height, collapsed): Rect` (con `SHADOW_MARGIN`).
- `resizeHeight(start: Rect, edge: 'top' | 'bottom', deltaY, limits): Rect`: aplica mínimo y máximo.

IPC nuevos (preload `window.stickyApi`):

- `window:resize-start` (`edge: 'top' | 'bottom'`, `screenY`).
- `window:resize-move` (`screenY`).
- `window:resize-end`: guarda `height`. Anclada o colapsada el arrastre se ignora.
- `window:get-prefs` también devuelve `docked: boolean` para que el renderer ponga la clase `is-docked`.

Renderer: clase `is-docked` en la raíz. Con ella `--margin-top`, `--margin-side` derecho y `--margin-bottom` pasan a 0 y la cabecera pasa a `-webkit-app-region: no-drag`. `tokens.css` separa `--margin-left` y `--margin-right`.

---

## Plan de implementación

1. `WindowPrefs` con `height`, validación en `validate-stored-data.ts` y funciones puras en `window-metrics.ts`. Tests en `tests/`. La app no cambia.
2. Nota de alto variable: la nota llena la ventana menos los márgenes y la lista de tareas usa el espacio sobrante. `WindowControls` crea la ventana con `prefs.height`. Prueba manual: con `"height": 700` en `note.json` la nota abre más alta y la lista crece.
3. Zonas de agarre arriba y abajo (`src/renderer/ui/resize-handles.ts`, estilos en `app.css`) e IPC `window:resize-*`. `WindowControls` calcula el alto con `resizeHeight` y guarda `height` al soltar. Deshabilitadas colapsada. Prueba manual: arrastrar el borde inferior y reabrir conserva el alto.
4. Fijar = anclar: `setPinned` calcula `pickDockDisplay` y `dockedBounds`, bloquea el movimiento (`setMovable(false)`), no guarda `x`/`y` mientras está anclada y avisa al renderer (`is-docked`). Desfijar restaura los bounds libres. Al abrir fijada, la ventana se crea anclada. Escucha `display-added`, `display-removed` y `display-metrics-changed` de `screen`.
5. Alto anclado: siempre todo el alto; las zonas de agarre se ocultan anclada; colapsar anclada deja la cabecera arriba del área útil. (Al principio el alto anclado se podía cambiar y se guardaba en `dock`; el usuario lo descartó.)
6. Inicio automático (`src/main/auto-launch.ts`): `app.setLoginItemSettings` según `pinned`, al fijar, al desfijar y al arrancar. Salta el registro en dev y con `--user-data-dir`. Actualizar `CLAUDE.md` y `README.md`.

---

## Criterios de aceptación

- [x] Arrastrar el borde inferior de la nota cambia su alto. El ancho sigue en 308 px.
- [x] La nota mide 308 px de ancho; la cabecera tiene dos filas (acciones arriba, días e historial abajo) y nada se corta.
- [x] Arrastrar el borde superior cambia el alto y mueve el borde superior; el inferior se queda.
- [x] La nota no baja de 300 px ni supera el alto del área útil del monitor.
- [x] Con más alto, la lista muestra más tareas sin scroll.
- [x] Cerrar y abrir la app conserva el alto libre.
- [x] Colapsada, las zonas de agarre no hacen nada. Expandir vuelve al alto guardado.
- [x] Con dos monitores, fijar la nota la lleva al borde derecho del monitor no principal, a todo el alto del área útil, sin tapar la barra de tareas.
- [x] Con un solo monitor, fijar la ancla al borde derecho del principal.
- [x] Anclada, la nota toca el borde derecho del monitor y no se puede arrastrar desde la cabecera.
- [x] Anclada, las esquinas de la nota son cuadradas; desfijada vuelven a 16 px.
- [x] Fijada no queda siempre encima: otra ventana enfocada la tapa.
- [x] Anclada, el margen transparente no tapa clics del monitor vecino a la derecha ni de la barra de tareas.
- [x] Anclada, el alto no se puede cambiar (no hay zonas de agarre).
- [x] Desfijar devuelve la nota a su posición y alto libres anteriores.
- [x] Fijar siempre ancla a todo el alto del área útil, sin importar el alto libre.
- [x] Anclada y colapsada, la cabecera queda arriba del área útil.
- [x] Cerrar y abrir la app fijada la muestra anclada desde el primer cuadro.
- [x] Desconectar el monitor secundario con la app fijada la ancla al principal.
- [x] Con la app construida, fijar y reiniciar Windows abre la nota sola y anclada.
- [x] Desfijar y reiniciar Windows no abre la app.
- [x] `npm run dev` y las corridas con `--user-data-dir` no registran el inicio automático.
- [x] Un `note.json` de la SPEC 03 (sin `height`) carga con el alto por defecto.
- [x] `npm test`, `npm run lint` y `npm run typecheck` pasan.

---

## Decisiones

- **Sí:** solo el alto se arrastra. El ancho es fijo.
- **Sí:** ancho fijo de 308 px con cabecera en dos filas, por pedido del usuario (añadido durante la implementación): se aparta del mockup (360 px, una fila) para igualar su otra app.
- **No:** bordes laterales y esquinas. Pedido al inicio, descartado al fijar el ancho.
- **Sí:** zonas de agarre propias en la nota. El borde nativo de Windows caería en el margen transparente de la sombra, no en la nota.
- **Sí:** Fijar = anclar. Sin UI nueva; "fijada" ya significa "quiero la nota siempre ahí".
- **No:** botón "Anclar" aparte, ni anclar siempre al iniciar.
- **Sí:** monitor no principal más a la derecha, por pedido del usuario. **No:** guardar el monitor donde estaba la nota (era la recomendación; el usuario prefirió el no principal).
- **Sí:** anclada sin margen superior, derecho ni inferior. El usuario pidió la nota pegada al borde; quitar arriba y abajo evita tapar la barra de tareas y otro monitor. La sombra se corta en esos bordes.
- **Sí:** anclada no se mueve ni cambia de alto: siempre todo el alto, por pedido del usuario (al principio sí cambiaba de alto; descartado durante la implementación).
- **Sí:** anclada con esquinas cuadradas, por pedido del usuario (añadido durante la implementación).
- **Sí:** margen superior de sombra a 0 px, por pedido del usuario (añadido durante la implementación), para que la nota libre llegue al borde superior. **No:** quitarlo solo al tocar arriba; más complejo.
- **Sí:** fijada deja de estar siempre encima, por pedido del usuario (añadido durante la implementación): la nota anclada no debe tapar otras ventanas. **No:** siempre al fondo (tipo widget); Electron no lo ofrece y exigiría una dependencia nativa.
- **Sí:** autoarranque ligado a Fijar e incluido aquí, por pedido del usuario.
- **Sí:** autoarranque sin instalador (`electron.exe` + ruta del proyecto). **No:** empaquetado en esta spec; agranda mucho el alcance.
- **Sí:** `height` opcional en `version: 2`. No hace falta migrar.

---

## Riesgos

| Riesgo | Mitigación |
| ------ | ---------- |
| Mover o borrar la carpeta del proyecto, o borrar `out/`, rompe el autoarranque | Documentado en `README.md`. El instalador va en otra spec. Desfijar y volver a fijar re-registra la ruta. |
| Una corrida E2E fija la nota y registra el autoarranque con datos de prueba | No se registra con `--user-data-dir` ni en dev. |
| En Windows, `setSize`/`setBounds` se ignora con `resizable: false` | Habilitar `setResizable(true)` alrededor del cambio, como ya hace `resize()`. |
| Arrastre con IPC por cada `pointermove` va a saltos | El main calcula desde los bounds iniciales y el `screenY` absoluto (no deltas acumulados). El renderer usa `setPointerCapture`. |
| Escalado distinto (DPI) entre monitores | Se usan `workArea` de `screen` (en DIP) y `screenY` del puntero, ambos en DIP. |
| El margen izquierdo transparente (60 px) tapa clics de lo que hay debajo | Ya ocurre hoy. Fuera de alcance. |

---

## Qué **no** entra en esta spec

- Cambiar el ancho arrastrando.
- Esquinas y bordes laterales.
- Anclar a otros bordes o elegir el monitor.
- Instalador y empaquetado.
- Autoarranque sin fijar.
- Clics a través del margen transparente.

Cada una, si llega, va en su propia spec.
