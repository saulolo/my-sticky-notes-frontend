# SPEC 11 — Aviso sonoro al llegar la hora de una tarea

> **Estado:** Implementado
> **Depende de:** SPEC 02, SPEC 03, SPEC 09
> **Fecha:** 2026-11-24
> **Objetivo:** A cada hora en punto en que hoy haya una tarea pendiente con esa hora, suena un mp3 propio y aparece una notificación de Windows, y un interruptor en el bloque de progreso activa o desactiva el aviso.

---

## Por qué existe esta spec

Cada tarea tiene una hora (entero 0–23, SPEC 02). El usuario trabaja en una tarea y pierde la noción del tiempo: quiere que al empezar la hora de la siguiente tarea suene un sonido suyo que le recuerde cambiar. Como no todos quieren sonidos, el aviso se puede apagar con un interruptor visible y empieza apagado.

---

## Alcance

**Entra:**

- **Regla del aviso:**
  - Se evalúa a cada hora en punto (`HH:00`, hora local).
  - Avisa si en el día de **hoy** hay al menos una tarea **no hecha** (`done: false`) con `hour === HH`. Las subtareas no cuentan (no tienen hora).
  - Varias tareas con la misma hora producen **un solo** aviso.
  - Mira siempre las tareas de hoy, sea cual sea la pestaña activa.
  - El orden manual (SPEC 08) no influye: solo la hora.
  - Con el interruptor apagado no suena ni aparece notificación.
- **Qué hace el aviso:**
  - Reproduce el mp3 del usuario una vez.
  - Muestra una notificación de Windows (toast) **silenciosa** (solo suena nuestro mp3):
    - Título: `Es hora: 14:00` (hora con dos dígitos de minutos).
    - Cuerpo: el texto de las tareas pendientes de esa hora, una por línea, en el orden de la lista; máximo 3 y, si hay más, una última línea `…y N más`.
    - Clic en el toast: muestra/restaura la ventana (también desde la barra de tareas), la expande si está colapsada, la enfoca y pone la pestaña activa en Hoy.
- **Avisos perdidos:** no se recuperan. Si el temporizador se dispara tarde (PC suspendido), solo avisa si la hora local sigue siendo la misma `HH` programada (despierta 14:10 → avisa de las 14; despierta 15:02 → nada de las 14). Al abrir la app no avisa de horas ya pasadas.
- **Funciona en cualquier estado de la ventana:** libre o anclada, expandida o colapsada, minimizada a la barra o tapada por otras ventanas.
- **Interruptor en el bloque de progreso:**
  - En el mismo renglón que `○ N de M hechas [✓✓]`, alineado a la derecha: icono de campana de 14 px y un switch tipo píldora (pista gris, botón blanco; encendido = pista en `--accent`, botón a la derecha; transición 150 ms).
  - Siempre visible con la nota expandida, en todas las pestañas, aunque el día no tenga tareas (el bloque de progreso no se ve con la nota colapsada, como hoy).
  - `role="switch"`, `aria-checked`, `title` y `aria-label`: "Activar aviso por hora" (apagado) / "Desactivar aviso por hora" (encendido). Se activa con clic, Espacio o Enter; foco visible con el anillo de la app.
  - **Vista previa:** al encenderlo suena el mp3 una vez (sin toast). Al apagarlo no suena nada.
  - El estado se guarda y se restaura al abrir. Por defecto apagado.
- **Archivo de sonido:** el usuario coloca su mp3 en `src/renderer/assets/sounds/task-alert.mp3` (carpeta nueva). Se carga con `import.meta.glob` como el logo del autor: si el archivo no está, la app compila igual, el switch funciona y el toast se muestra, pero no suena nada.
- **Textos:** `README.md` (aviso por hora, switch, dónde va el mp3) y `CLAUDE.md` (regla del aviso, pref, IPC, ubicación del mp3).
- Tests de dominio (regla, tiempo hasta la próxima hora, mensaje del toast) y de validación de la pref.

**Fuera de alcance:**

- Minutos en la hora de las tareas (siguen siendo enteros 0–23).
- Avisos a horas distintas de `HH:00` (antelación, "faltan 5 minutos", repetir, posponer).
- Avisos de días distintos de hoy o de subtareas.
- Elegir otro sonido desde la app, control de volumen o varios sonidos.
- Recuperar avisos perdidos.
- Mover el interruptor al menú del engranaje o a la cabecera.
- Subir la versión de la app o generar un instalador nuevo.

---

## Modelo de datos

### Pref nueva

`src/core/domain/window-prefs.ts`: `WindowPrefs` gana `hourAlerts: boolean` (por defecto `false`).

`note.json` sigue en `version: 3`. En la lectura `hourAlerts` es opcional (ausente → `false`, como `alwaysOnTop`); `null` o un valor no booleano invalidan el archivo (`validate-stored-data.ts`).

```json
{ "version": 3, "note": { … }, "window": { "pinned": false, …, "alwaysOnTop": false, "hourAlerts": true } }
```

### Dominio (puro, `src/core/domain/hour-alert.ts`)

- `dueAlertTasks(note, today: DayKey, hour: number): Task[]` — tareas de `today` con `done: false` y `hour === hour`, en el orden de la lista. Vacío si no hay.
- `msUntilNextHour(now: Date): number` — milisegundos hasta el próximo `HH:00:00.000` local (siempre > 0).
- `alertMessage(hour: number, tasks: Task[]): { title: string; body: string }` — `title` = `Es hora: 14:00`; `body` = textos (máx. 3 líneas) + `…y N más` si sobran.

El reloj y el día se inyectan; el dominio no lee `Date.now()` ni toca DOM/Electron.

### IPC

- `window:set-hour-alerts` (invoke, `boolean`) — guarda la pref, como `window:set-always-on-top`. `window:get-prefs` ya devuelve todas las prefs (incluye `hourAlerts`).
- `alert:notify` (send, `{ title, body }`) — main muestra `new Notification({ title, body, silent: true, icon })`. Clic → muestra/restaura, expande si estaba colapsada, enfoca y envía `alert:open-today` al renderer.
- `alert:open-today` (main → renderer) — el renderer pone la pestaña activa en Hoy.
- `preload` expone `setHourAlerts`, `notifyAlert` y `onOpenToday` en `window.stickyApi`.

### Ventana (`src/main/index.ts`)

`webPreferences` añade `backgroundThrottling: false` (temporizadores puntuales con la ventana minimizada u oculta) y `autoplayPolicy: 'no-user-gesture-required'` (el mp3 suena sin gesto del usuario).

### Renderer

- `src/renderer/assets/sounds/task-alert.mp3` — lo coloca el usuario.
- `src/renderer/ui/alert-sound.ts` — carga el mp3 con `import.meta.glob(…, { eager: true, query: '?url', import: 'default' })`; `playAlert()` crea/reusa un `HTMLAudioElement` y lo reproduce desde 0; no hace nada si no hay archivo; un fallo de `play()` se ignora (sin excepción).
- `src/renderer/ui/progress.ts` — switch `.alert-switch` + icono `bell` en `.progress-head`; `setAlertsOn(on)` y callback `onToggleAlerts(on)`.
- `src/renderer/ui/icons.ts` — `bell(size)` (estilo Lucide).
- `src/renderer/main.ts` — estado `hourAlerts` leído de `getPrefs()`; temporizador encadenado con `msUntilNextHour` (se reprograma tras cada disparo); al dispararse comprueba que la hora local sea la programada, calcula `dueAlertTasks(store.note, today, hour)` y, con el switch encendido y tareas, llama `playAlert()` y `notifyAlert(alertMessage(…))`. `onOpenToday` pone `activeDay` en hoy.
- `src/renderer/styles/app.css` — estilos del switch.

---

## Plan de implementación

1. **Dominio.** `hour-alert.ts` (`dueAlertTasks`, `msUntilNextHour`, `alertMessage`) con tests: solo hoy, solo pendientes, misma hora en varias tareas, otra hora, día sin tareas, orden de la lista; `msUntilNextHour` a `13:59:59.999`, `14:00:00.000` (→ 1 h) y en medio; mensaje con 1, 3 y 5 tareas (`…y 2 más`), hora `9` → `09:00`. La app no cambia.
2. **Pref `hourAlerts`.** `WindowPrefs`, `validate-stored-data.ts` (ausente → `false`; `null`/no booleano → inválido), canal `window:set-hour-alerts` en `ipc.ts` y preload. Tests de validación. La app no cambia de aspecto.
3. **Switch y sonido.** Carpeta `src/renderer/assets/sounds/`, `alert-sound.ts`, icono `bell`, switch en `progress.ts`, estilos y cableado en `main.ts` (leer pref, guardar al cambiar, vista previa al encender). Prueba manual: el switch se ve en todas las pestañas, libre (360) y anclado (308) sin desbordar el renglón; encender suena; reiniciar conserva el estado; sin mp3 no hay error.
4. **Aviso por hora.** `webPreferences` (`backgroundThrottling`, `autoplayPolicy`), canales `alert:notify` / `alert:open-today` en main y preload, temporizador en `main.ts`. Prueba manual con `--user-data-dir` temporal y una tarea con la hora siguiente (o reloj del sistema adelantado a `HH:59`): suena y aparece el toast con los textos; tarea hecha no avisa; switch apagado no avisa; minimizada y colapsada avisa; clic en el toast restaura, expande y va a Hoy.
5. **Textos.** `README.md` y `CLAUDE.md`.

---

## Criterios de aceptación

- [x] A las `HH:00`, con el switch encendido y una tarea de hoy no hecha con hora `HH`, suena el mp3 una vez y aparece un toast `Es hora: HH:00` con su texto.
- [x] Con varias tareas pendientes a la misma hora suena una sola vez y el toast lista hasta 3 textos más `…y N más`.
- [x] Tareas hechas, tareas de otros días y subtareas no producen aviso.
- [x] Con la pestaña activa en otro día, el aviso de las tareas de hoy sigue sonando.
- [x] Con el switch apagado no suena nada ni aparece toast.
- [x] El toast no reproduce el sonido de Windows (solo el mp3).
- [x] Clic en el toast muestra la nota (también si estaba minimizada a la barra), la expande si estaba colapsada y deja activa la pestaña Hoy.
- [x] El aviso funciona con la nota libre, anclada, colapsada, minimizada a la barra y tapada por otra ventana.
- [x] Al abrir la app no suena ningún aviso de horas ya pasadas.
- [x] Si el temporizador se dispara después de que haya cambiado la hora (PC suspendido), no avisa.
- [x] El switch aparece a la derecha del renglón `N de M hechas` en todas las pestañas, también con el día vacío, libre (360 px) y anclada (308 px), sin desbordar.
- [x] Encender el switch reproduce el mp3 una vez; apagarlo no.
- [x] El switch responde a clic, Espacio y Enter; `aria-checked` y `title` cambian según el estado.
- [x] El estado del switch se conserva al reiniciar; un `note.json` sin `hourAlerts` arranca apagado.
- [x] `hourAlerts: null` o no booleano en `note.json` hace el archivo inválido (copia `note.corrupt-<ts>.json`).
- [x] Sin `src/renderer/assets/sounds/task-alert.mp3`, `npm run build` funciona y la app no lanza errores (no suena, el toast sí aparece).
- [x] `npm test`, `npm run lint` y `npm run typecheck` pasan.

---

## Decisiones

- **Sí:** avisar a la hora en punto si hay alguna tarea **pendiente** con esa hora. **No:** avisar también por tareas hechas (ya terminadas, el aviso sobra). **No:** seguir el orden manual ("la siguiente de la lista"): con orden manual y horas libres la "siguiente" es ambigua.
- **Sí:** un solo aviso por hora aunque haya varias tareas.
- **Sí:** switch en el bloque de progreso, a la derecha, siempre visible (elección del usuario). **No:** menú del engranaje ni botón en la cabecera (la cabecera anclada no tiene sitio).
- **Sí:** apagado por defecto y guardado en `note.json` como pref de ventana (`hourAlerts`), con el mismo trato que `alwaysOnTop`. **No:** subir `version`: la pref es opcional.
- **Sí:** vista previa del sonido al encender el switch, para comprobar que el archivo funciona.
- **Sí:** toast de Windows silencioso con los textos; clic abre la nota en Hoy. **No:** toast con sonido del sistema (sonarían dos cosas).
- **Sí:** el mp3 vive en `src/renderer/assets/sounds/task-alert.mp3`, empaquetado por Vite, cargado con `import.meta.glob` para que su ausencia no rompa el build. **No:** `resources/` (habría que cargarlo por `file://` desde main y añadirlo a `electron-builder.yml`).
- **Sí:** temporizador en el renderer (como el de 00:00, tiene la nota en memoria) con `backgroundThrottling: false`. **No:** temporizador en main: tendría que leer la nota del renderer o del disco, duplicando estado.
- **Sí:** no recuperar avisos perdidos; un aviso tarde de una hora ya pasada confunde.
- **No:** subir la versión de la app ni generar instalador en esta spec.

---

## Riesgos

| Riesgo | Mitigación |
| ------ | ---------- |
| Chromium retrasa temporizadores con la ventana minimizada u oculta | `backgroundThrottling: false`; el disparo comprueba la hora local antes de avisar. Prueba manual minimizada. |
| La política de autoplay bloquea el audio sin gesto del usuario | `autoplayPolicy: 'no-user-gesture-required'`; `play()` con `catch` para que un fallo no rompa nada. |
| El toast no aparece en desarrollo (Windows exige AppUserModelId/acceso directo) | Ya se llama `setAppUserModelId(APP_ID)`. Si en `npm run dev` no aparece, se verifica con `npm run dist` instalado; el sonido no depende del toast. |
| "Asistente de concentración" / notificaciones desactivadas en Windows ocultan el toast | Comportamiento del sistema; el mp3 suena igual. Se documenta en `README.md`. |
| Deriva del temporizador o cambio de hora del sistema | Se reprograma con `msUntilNextHour` tras cada disparo, nunca con un intervalo fijo. |
| El switch desborda el renglón a 308 px | Prueba manual anclada en el paso 3; el texto `N de M hechas` puede recortarse antes que el switch. |

---

## Qué **no** entra en esta spec

- Minutos en las tareas, avisos antes de la hora, repetir o posponer.
- Avisos de otros días o de subtareas.
- Elegir sonido o volumen desde la app.
- Recuperar avisos perdidos.
- Nueva versión de la app o instalador.

Cada una, si llega, va en su propia spec.
