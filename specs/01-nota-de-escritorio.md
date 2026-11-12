# SPEC 01 — Nota adhesiva de escritorio con tareas y autoguardado

> **Estado:** Implementado
> **Depende de:** —
> **Fecha:** 2026-11-12
> **Objetivo:** Una ventana de escritorio Electron, idéntica al mockup, donde apunto tareas con su hora de creación y subtareas, las marco, edito o borro, y todo se guarda solo en disco.

---

## Por qué existe esta spec

El repo solo tiene el mockup (`docs/references/Artboard-cltk.dc.html`). Esta spec define el andamiaje del proyecto y su arquitectura por capas. También define la primera versión usable de la app. Por eso toma decisiones de stack que las specs siguientes heredan.

---

## Alcance

**Entra:**

- Andamiaje con Electron + electron-vite + TypeScript, sin framework de UI.
- Arquitectura por capas: dominio, aplicación, infraestructura y UI.
- Ventana sin marco (frameless) y con fondo transparente, que muestra solo la nota del mockup. Se arrastra desde la cabecera.
- Réplica visual fiel del mockup en modo oscuro, con el acento fijo `#F5C451`.
- Título de la nota editable.
- Fecha del día en la cabecera de progreso, con el formato `Jueves, 12 nov`.
- Crear tareas desde el input "Añadir nueva tarea…", con Enter o con el botón "+".
- La tarea guarda la hora de creación como entero de 0 a 23 (por ejemplo, `13` para la 1 PM).
- Crear subtareas con un botón "+" que aparece al pasar el mouse sobre una tarea. Solo hay un nivel de subtareas.
- Casilla independiente en cada tarea y subtarea. Al marcarla, el texto queda tachado y con opacidad .5, como en el mockup.
- Editar el texto de tareas y subtareas con doble clic.
- Eliminar tareas y subtareas con un icono de papelera que aparece al pasar el mouse. Eliminar una tarea elimina también sus subtareas.
- Contador "`N de M hechas`" y barra de progreso, que cuentan tareas y subtareas.
- Autoguardado en un archivo JSON versionado, dentro de la carpeta `userData` de la app.
- Botón Fijar: activa `alwaysOnTop`, resalta el icono y muestra "Fijada" en el pie.
- Botón Minimizar: colapsa la nota a solo la cabecera y achica la ventana. Pulsarlo de nuevo la expande.
- Botón Cerrar: guarda los cambios pendientes y sale de la app.
- Se recuerdan entre sesiones: la nota, el estado de fijado, el de colapsado y la posición de la ventana.
- Vitest para las capas de dominio y aplicación, y para la validación del archivo.
- ESLint y Prettier.

**Fuera de alcance (para specs futuras):**

- Varias notas. El botón "Nueva nota" se ve pero no hace nada.
- La barra inferior de formato (negrita, cursiva, subrayado, tachado, lista, adjuntar imagen). Se ve como en el mockup, pero no hace nada.
- Selector de color de acento.
- Archivar o reiniciar las tareas al cambiar de día.
- Reordenar tareas (arrastrar y soltar).
- Hora en subtareas, y editar la hora de una tarea.
- Empaquetar un instalador `.exe` (electron-builder).
- Modo claro.

---

## Modelo de datos

```ts
// src/core/domain/note.ts
export interface Subtask {
  id: string;        // crypto.randomUUID()
  text: string;      // no vacío, sin espacios en los extremos
  done: boolean;
}

export interface Task {
  id: string;
  hour: number;      // 0–23, hora local de creación; se muestra tal cual: "9", "13"
  text: string;
  done: boolean;
  subtasks: Subtask[];
  createdAt: string; // ISO 8601; desempata y queda para usos futuros
}

export interface Note {
  title: string;     // por defecto "Today Task"
  tasks: Task[];     // orden de inserción; las nuevas van al final
}

// src/core/domain/window-prefs.ts
export interface WindowPrefs {
  pinned: boolean;     // alwaysOnTop
  collapsed: boolean;  // solo la cabecera
  x: number | null;    // null = centrar en la pantalla principal
  y: number | null;
}

// Formato del archivo en disco
export interface StoredData {
  version: 1;
  note: Note;
  window: WindowPrefs;
}
```

Convenciones:

- Ruta del archivo: `path.join(app.getPath('userData'), 'note.json')`.
- La escritura es atómica: se escribe en `note.json.tmp` y luego se hace `rename` a `note.json`.
- Primer arranque, sin archivo: `{ title: 'Today Task', tasks: [] }`, sin fijar, expandida y centrada.
- Archivo corrupto o con un `version` desconocido: se renombra a `note.corrupt-<timestamp>.json` y la app arranca con los valores por defecto.
- Las funciones de dominio son puras e inmutables. Reciben un `Note` y devuelven uno nuevo.
- La hora se obtiene de un `Clock` inyectado (`now(): Date`) para que los tests sean deterministas.
- Contador: `M` = tareas + subtareas y `N` = las que tienen `done`. Progreso: `Math.round(N / M * 100)`, que vale 0 si `M` es 0.

---

## Arquitectura y estructura

```
src/
  core/                  # sin dependencias de Electron ni del DOM
    domain/              # note.ts, window-prefs.ts, note-operations.ts, date-label.ts
    application/         # note-store.ts (estado + comandos + suscripción), ports.ts (NoteRepository, Clock)
  main/                  # proceso principal de Electron
    index.ts             # creación de la ventana, ciclo de vida
    window-controls.ts   # pin, colapsar, cerrar, posición
    json-note-repository.ts  # lectura/escritura de note.json (infraestructura)
    ipc.ts               # handlers: note:load, note:save, window:*
  preload/
    index.ts             # contextBridge → window.stickyApi (API tipada mínima)
  renderer/
    index.html
    main.ts              # composición: store + repositorio IPC + vistas
    infrastructure/ipc-note-repository.ts  # implementa NoteRepository vía window.stickyApi
    ui/                  # vistas en TS sin framework: header, progress, task-list, add-row, footer
    styles/tokens.css    # tokens del mockup como variables CSS
    styles/app.css
tests/                   # Vitest: domain, application, validación del archivo
```

Reglas de capas:

- `core` no importa nada de `main`, `preload`, `renderer` ni `electron`.
- La UI solo habla con `NoteStore`. No conoce el IPC ni el disco.
- El renderer corre con `contextIsolation: true`, `nodeIntegration: false` y `sandbox: true`. Solo accede a lo que expone `window.stickyApi`.

Scripts de `package.json`: `dev`, `build`, `start` (vista previa del build), `test` (`vitest run`), `test:watch`, `lint`, `format`, `typecheck`.

---

## Plan de implementación

1. **Andamiaje.** Crear el proyecto con electron-vite (plantilla vanilla-ts) y npm. Agregar ESLint, Prettier, Vitest y los scripts de la sección anterior. Prueba manual: `npm run dev` abre una ventana vacía. `npm test`, `npm run lint` y `npm run typecheck` pasan.
2. **Ventana base.** Hacer la ventana frameless y transparente, de 360px de ancho más el margen para la sombra, y sin redimensionar. Activar las opciones de seguridad de la sección de arquitectura. Agregar un preload con `contextBridge` que expone `window.stickyApi` vacío. La cabecera usa `-webkit-app-region: drag`, y sus botones e input `no-drag`. Prueba manual: la ventana se arrastra desde la cabecera.
3. **Maqueta estática.** Pasar los colores, tamaños, radios y sombras del mockup a `styles/tokens.css`. Agregar Inter local con `@fontsource/inter` (400, 500 y 600). Renderizar la cabecera, la fecha, el progreso, la lista vacía, la fila de añadir y el pie con los valores exactos del mockup. Prueba manual: compararla lado a lado con `../Mockup/Artboard-cltk.dc.html`.
4. **Dominio.** Implementar los tipos del modelo de datos y `note-operations.ts`: `addTask`, `addSubtask`, `toggleTask`, `toggleSubtask`, `editTask`, `editSubtask`, `deleteTask`, `deleteSubtask`, `renameNote` y `progress`. Implementar también `date-label.ts` (`Jueves, 12 nov`). Escribir los tests de Vitest de cada operación, incluidos los casos de texto vacío y la hora tomada del `Clock`.
5. **Store y tareas en la UI.** Crear `NoteStore` con un repositorio en memoria. Conectar la UI: el título editable, crear tareas (Enter o "+", el texto se recorta y el vacío se ignora), la casilla con tachado, el contador y la barra. Escribir los tests de `NoteStore`. Prueba manual: crear y marcar tareas actualiza el progreso.
6. **Subtareas en la UI.** Al pasar el mouse sobre una tarea aparece un "+" (estilo `.ib`, 22px). Ese botón abre un input indentado debajo de la tarea, en el mismo bloque con borde izquierdo del mockup. Enter guarda y cierra el input. Esc o perder el foco con el input vacío lo cierran sin guardar.
7. **Editar y eliminar en la UI.** Doble clic sobre el texto lo cambia por un input. Enter o perder el foco guardan, y Esc cancela. Si el texto queda vacío, se conserva el anterior. Al pasar el mouse aparece una papelera (estilo `.ib`) que elimina al instante, sin pedir confirmación. Se aplica a tareas y subtareas.
8. **Repositorio JSON (main).** Implementar `json-note-repository.ts` con escritura atómica, validación de `StoredData` y respaldo del archivo corrupto. Exponer `note:load` y `note:save` por IPC. Escribir tests de la validación y del respaldo, usando una carpeta temporal.
9. **Autoguardado.** Implementar `ipc-note-repository.ts` en el renderer. `NoteStore` carga al iniciar y guarda con un debounce de 300ms tras cada cambio. Prueba manual: crear tareas, cerrar con Alt+F4 y reabrir; todo sigue ahí.
10. **Controles de ventana.** Fijar llama a `setAlwaysOnTop`, alterna `.is-on` y muestra "Fijada" en el pie. Minimizar oculta el cuerpo y cambia la altura de la ventana a la de la cabecera, y al revés al expandir. Cerrar hace flush del guardado pendiente y luego `app.quit()`. Guardar `pinned`, `collapsed` y la posición (`moved`, con debounce), y restaurarlos al arrancar.

---

## Criterios de aceptación

- [x] `npm run dev` abre una sola ventana sin marco, que muestra solo la nota y no da errores en la consola.
- [x] `npm test`, `npm run lint` y `npm run typecheck` terminan sin errores.
- [x] Al compararla con el mockup, coinciden los colores, la tipografía Inter, los tamaños, los radios, los bordes y la sombra de la cabecera, el progreso, las filas, la fila de añadir y el pie.
- [x] La ventana se arrastra desde la zona libre de la cabecera.
- [x] La cabecera de progreso muestra la fecha de hoy con el formato `Jueves, 12 nov`.
- [x] Escribir "Comprar pan" y pulsar Enter a las 13:40 crea una tarea al final con la etiqueta `13`.
- [x] El botón "+" de la fila de añadir crea la tarea igual que Enter.
- [x] Un input vacío o con solo espacios no crea ninguna tarea.
- [x] Al pasar el mouse sobre una tarea aparecen "+" y la papelera. Sin el mouse encima no se ven.
- [x] El "+" de una tarea permite escribir una subtarea, que aparece indentada y sin hora.
- [x] Marcar una casilla tacha su texto y le baja la opacidad. Desmarcarla lo revierte.
- [x] Marcar una tarea no cambia sus subtareas, y marcarlas todas no marca la tarea.
- [x] El contador y la barra reflejan tareas y subtareas (por ejemplo, 1 tarea con 2 subtareas y 1 hecha muestra `1 de 3 hechas` y 33%).
- [x] Doble clic sobre un texto permite editarlo. Esc deja el texto original, y dejarlo vacío conserva el anterior.
- [x] La papelera de una tarea elimina la tarea y sus subtareas, y la de una subtarea elimina solo esa subtarea.
- [x] El título editado se conserva después de reiniciar la app.
- [x] Después de cerrar con el botón Cerrar y reabrir, las tareas, subtareas, marcas y textos editados siguen iguales.
- [x] Fijar deja la ventana por encima de otras apps, resalta el icono en el color de acento y muestra "Fijada" en el pie. Al reiniciar sigue fijada.
- [x] Minimizar deja solo la cabecera y la ventana se achica. Pulsarlo de nuevo restaura la nota. El estado se conserva al reiniciar.
- [x] La ventana reabre en la posición donde se dejó.
- [x] Si `note.json` tiene JSON inválido, la app arranca vacía y queda un `note.corrupt-<timestamp>.json` con el contenido original.
- [x] Los botones "Nueva nota" y los de la barra inferior se ven como en el mockup y no cambian ningún dato.
- [x] `src/core` no importa `electron` ni usa APIs del DOM.

---

## Decisiones

- **Sí:** Electron. Hace falta una ventana real (cerrar, `alwaysOnTop`) y solo requiere Node.
- **No:** Tauri. Exige la toolchain de Rust a cambio de un binario más liviano, y eso no importa para uso local.
- **No:** app solo de navegador. Así no se podría cerrar ni dejar la ventana siempre encima.
- **Sí:** electron-vite. Da HMR y build separados para main, preload y renderer, sin configurarlos a mano.
- **Sí:** TypeScript sin framework de UI. La app es pequeña y el usuario descartó Angular.
- **Sí:** capas `core` (dominio y aplicación), infraestructura (`main/json-note-repository`, `renderer/infrastructure`) y UI. Así el dominio se testea sin Electron.
- **Sí:** archivo JSON en `userData`, con `version: 1`. Se puede respaldar, sobrevive aunque se limpie la caché y permite migraciones futuras.
- **No:** localStorage. Los datos quedarían ocultos en el perfil de Chromium.
- **Sí:** escritura atómica (tmp + rename) y respaldo del archivo corrupto, para no perder datos si la app se cierra a mitad de una escritura.
- **Sí:** una sola nota. Varias notas o ventanas quedan para otra spec.
- **Sí:** hora como entero de 0 a 23, sin minutos, tomada al crear la tarea. Es lo que pidió el usuario. El mockup usaba `HH:MM` con "última + 1h", y eso se descarta.
- **Sí:** las subtareas no llevan hora, como en el mockup.
- **Sí:** casillas independientes. Es el comportamiento del mockup, y el autocompletado se descartó.
- **Sí:** las tareas se acumulan entre días y la fecha siempre muestra hoy. Reiniciar por día se descartó por ahora.
- **Sí:** "+" de subtarea y papelera al pasar el mouse. El mockup no tiene UI para eso, y así su aspecto en reposo no cambia.
- **Sí:** eliminar sin confirmación. Los diálogos rompen el flujo rápido. Deshacer queda para otra spec si hace falta.
- **Sí:** Inter empaquetada con `@fontsource/inter`, en vez de Google Fonts. Así la app funciona sin conexión.
- **Sí:** acento fijo `#F5C451`. El selector de color queda fuera.
- **Sí:** Minimizar colapsa la nota, como en el mockup, y no la manda a la barra de tareas.
- **No:** instalador `.exe` en esta spec. Se ejecuta con `npm run dev` o `npm start`.

---

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Una ventana transparente y frameless recorta la sombra o los bordes redondeados en Windows | La ventana deja un margen transparente alrededor de la nota del tamaño de la sombra (`0 24px 60px`). Se verifica en el paso 2. |
| Al cerrar antes de que venza el debounce se pierde el último cambio | Cerrar hace flush del guardado pendiente antes de `app.quit()`. Alt+F4 dispara `before-unload` con el mismo flush. |
| `Intl` en español da `nov.` o un día en minúscula según el runtime | `date-label.ts` arma la cadena con tablas propias de días y meses. Tiene un test con la fecha fija 2026-11-12, que debe dar `Jueves, 12 nov`. |
| Ventana restaurada fuera de pantalla tras cambiar de monitor | Al arrancar se valida la posición con `screen.getAllDisplays()`. Si queda fuera, se centra. |
| Esquema futuro incompatible | `version` en el archivo. Hoy un `version` desconocido se respalda y la app arranca vacía, y las migraciones van en specs futuras. |

---

## Qué **no** entra en esta spec

- Varias notas ni el botón "Nueva nota" funcional.
- Barra de formato funcional (negrita, cursiva, subrayado, tachado, lista, imagen).
- Selector de color de acento ni modo claro.
- Archivar o reiniciar al cambiar de día.
- Reordenar tareas, hora en subtareas, editar la hora.
- Instalador `.exe`.

Cada una de esas, si llega, va en su propia spec.
