# SPEC 06 — Instalador de Windows y "Acerca de"

> **Estado:** Implementado
> **Depende de:** SPEC 01, SPEC 04, SPEC 05
> **Fecha:** 2026-11-16
> **Objetivo:** Un instalador de Windows con asistente clásico ("Siguiente > Siguiente > Instalar") instala My Sticky Notes 0.1.0 para usarla a diario y compartirla, sin mezclar sus datos con la versión de desarrollo, y la app muestra un "Acerca de" con los créditos del autor.

---

## Por qué existe esta spec

La app ya es funcional en lo básico (SPEC 01–05), pero solo corre desde la carpeta del proyecto (`npm start`). El usuario quiere instalarla como un programa profesional, usarla a diario y compartirla con otras personas. Mientras tanto sigue desarrollando en la versión de desarrollo.

La revisión del código encontró cinco problemas para empaquetar:

1. **Datos compartidos.** `note.json` vive en `%APPDATA%\my-sticky-notes\` (`app.getPath('userData')`), que sale del nombre de la app. La versión de desarrollo y la instalada escribirían el mismo archivo. Además, empaquetada con `productName: My Sticky Notes`, Electron cambiaría la carpeta a `%APPDATA%\My Sticky Notes\` y las notas actuales del usuario no aparecerían.
2. **Sin instancia única.** Abrir la app dos veces (acceso directo + inicio automático) crea dos ventanas que escriben el mismo `note.json`.
3. **Inicio automático.** `auto-launch.ts` registra `electron.exe` + la ruta del proyecto. Empaquetada, `process.execPath` ya es el `.exe` de la app y no lleva argumentos.
4. **AppUserModelId.** `index.ts` fija `com.my-sticky-notes`. Debe coincidir con el `appId` del instalador para que la barra de tareas y los accesos directos agrupen bien.
5. **Sin configuración de empaquetado.** No hay empaquetador, ni `author`, ni licencia, ni `.ico`.

---

## Alcance

**Entra:**

- **Carpetas de datos separadas:**
  - Instalada (`app.isPackaged`): `%APPDATA%\my-sticky-notes\` (la actual). Conserva las notas que el usuario ya tiene, sin migración.
  - Desarrollo (`npm run dev` y `npm start`, no empaquetada): `%APPDATA%\my-sticky-notes-dev\`. Empieza vacía.
  - Si el proceso trae `--user-data-dir` (E2E), se respeta y no se toca.
  - La ruta se fija al arrancar, antes de leer `note.json` y antes del bloqueo de instancia única.
- **Instancia única:**
  - `app.requestSingleInstanceLock()`. Si ya hay una instancia con la misma carpeta de datos, la segunda se cierra.
  - La primera recibe `second-instance`: si está minimizada la restaura, la muestra y le da el foco.
  - Desarrollo e instalada pueden correr a la vez (carpetas distintas).
- **Inicio automático empaquetado:**
  - Solo la app instalada registra el inicio automático. Sin empaquetar (dev y `npm start`) no lo toca.
  - Registra `process.execPath` sin argumentos, con nombre de entrada `My Sticky Notes`.
  - Sigue ligado a fijar (SPEC 04): fijada se abre al iniciar sesión, desfijada no.
- **AppUserModelId** = `com.saulecheverri.mystickynotes`, igual que el `appId` del instalador.
- **Empaquetado** con electron-builder, target NSIS x64, en modo asistido (`oneClick: false`):
  - Script `npm run dist` = `npm run build` + `electron-builder --win`. Deja `dist/My Sticky Notes Setup 0.1.0.exe` en local.
  - El paquete solo lleva `out/**` y `package.json` (sin `src`, `specs`, `docs`, `tests`, `build`).
  - Nombre visible `My Sticky Notes`. Editor `Saul Echeverri`. Versión desde `package.json` (`0.1.0`).
- **Asistente de instalación**, en español:
  1. Bienvenida, con imagen lateral propia y texto propio (en lugar del genérico de NSIS): "My Sticky Notes es una nota adhesiva de escritorio para organizar tus tareas del día." seguido de la indicación de pulsar "Siguiente" para continuar.
  2. Acuerdo de licencia (MIT).
  3. Tipo de instalación: "Solo para mí" (por defecto, sin admin, en `%LOCALAPPDATA%\Programs\My Sticky Notes`) o "Para todos los usuarios" (pide admin, en `Program Files`).
  4. Carpeta de destino, con "Examinar…".
  5. Progreso.
  6. Final, con imagen lateral y casilla "Ejecutar My Sticky Notes" marcada.
  - Las pantallas sin imagen lateral llevan imagen de cabecera propia.
  - Crea accesos directos en el escritorio y en el menú Inicio.
  - Aparece en "Agregar o quitar programas" con nombre, icono, versión y editor.
  - Instalar una versión más nueva encima actualiza la app y conserva las notas.
- **Desinstalador**, en español:
  - Quita la app, los accesos directos y la entrada de inicio automático `My Sticky Notes` (`HKCU\...\Run`).
  - Pantalla con casilla "Borrar también mis notas", desmarcada por defecto. Marcada, borra `%APPDATA%\my-sticky-notes\` del usuario que desinstala.
  - En una actualización (el instalador nuevo corre el desinstalador viejo en silencio) nunca borra notas.
- **Recursos gráficos**, generados por script (`npm run art`) y guardados en git:
  - Icono propio de la app (añadido durante la implementación, por pedido del usuario): `build/icon.ico` lo aporta el usuario ya hecho (16, 32, 48, 64, 128, 256 px; nota dorada con chincheta, "N" y checks sobre baldosa oscura redondeada). `resources/icon.png` es su imagen de 256 px (el "Acerca de" y la cabecera del asistente). No se generan con `npm run art`. Reemplaza el logo de Electron. Icono del `.exe`, accesos directos, barra de tareas y "Agregar o quitar programas".
  - Lateral de Bienvenida y Final (instalador y desinstalador), **dibujado con controles nativos de NSIS, no con una imagen** (añadido durante la implementación, por pedido del usuario). Arriba: icono de la app y "My Sticky Notes" con su versión. Abajo: tarjeta "CREADO POR" con el logo del autor en círculo, "Saul Echeverri" (sin "Ingeniero", también por pedido del usuario) y `saulolo@gmail.com`. Todo del mismo tono `#252526` (la sección "CREADO POR" sin fondo propio, por pedido del usuario), texto `#f4f4f5` / `#a1a1aa`, fuente Segoe UI (la del sistema). Las únicas imágenes son `build/icon.ico` y `build/author-logo.ico`.
  - `build/author-logo.ico` (24–128 px): logo del autor recortado en círculo, fondo transparente.
  - `build/installer-header.bmp` (150 × 57): solo el icono de la app, a la derecha, sobre fondo blanco como el resto de la franja de cabecera (añadido durante la implementación, por pedido del usuario: sin bloque oscuro ni texto).
  - Fuente del logo: `build/author-logo.png`, que pone el usuario (PNG con fondo amarillo; el aportado mide 173 × 180).
- **"Acerca de" en la app:**
  - El menú del engranaje deja de mostrar "Próximamente" y muestra un ítem "Acerca de My Sticky Notes".
  - Clic: se cierra el menú y aparece un panel sobre la nota (dentro de la nota, no ventana nueva) con:
    - icono de la app, "My Sticky Notes" y "Versión 0.1.0";
    - descripción breve (añadido en la revisión de la spec):
      - "My Sticky Notes es una nota adhesiva de escritorio para organizar tus tareas del día."
      - "Cada día tiene sus tareas: Ayer, Hoy, Mañana e historial de los últimos días."
      - "Las tareas pendientes pasan solas al día siguiente."
      - "Fija la nota para anclarla al borde derecho de la pantalla y que se abra al iniciar Windows."
      - "Todo se guarda automáticamente y solo en este equipo: sin cuenta, sin nube y sin internet."
      - "Se conservan los últimos 5 días; los anteriores se borran."
    - tarjeta "CREADO POR": logo en círculo, "Ingeniero Saul Echeverri", `saulolo@gmail.com`;
    - enlaces "github.com/saulolo" (perfil) y "Código del proyecto" (repo `saulolo/my-sticky-notes-frontend`).
  - El correo y los enlaces son clicables: abren el cliente de correo o el navegador por defecto.
  - El panel se cierra con Esc, clic fuera del panel o el botón × ("Cerrar").
  - Colapsada, el engranaje ya expande la nota antes de abrir el menú (SPEC 05); el panel se ve con la nota expandida.
  - Funciona libre (360 px) y anclada (308 px) sin cortarse. Si el contenido no cabe en el alto de la nota (mínimo 300 px), el panel hace scroll.
  - La versión sale de `package.json` al compilar. En desarrollo muestra `0.1.0-dev`.
- `LICENSE` (MIT, `Copyright (c) 2026 Ingeniero de Software Saul Echeverri`, por pedido del usuario durante la implementación) en la raíz. `package.json` gana `author`, `license` y `homepage`.
- **Distribución:** el `.exe` queda en `dist/` en local. Además, Release manual en GitHub: tag `v0.1.0` y el `.exe` adjunto. Los pasos van en el `README.md`.
- `README.md`: sección "Instalación" (descarga, aviso de SmartScreen, desinstalar), sección "Tus datos" y sección "Publicar una versión".
- **Requisitos** (añadido en la revisión de la spec):
  - Sección "Requisitos" del README, antes de "Instalación":
    - Windows 10 u 11 de 64 bits (x64). En Windows 11 ARM funciona por emulación x64, sin probar.
    - Espacio en disco: el que ocupe la app instalada, medido en el paso 4 y redondeado hacia arriba. Tamaño de descarga: el del `.exe`, medido igual.
    - Memoria: la que use la app abierta (Administrador de tareas), medida en el paso 4 y redondeada hacia arriba.
    - Permisos: ninguno para "Solo para mí"; administrador para "Para todos los usuarios".
    - Internet: no hace falta (solo para descargar el instalador).
    - Pantalla: alto mínimo útil de 300 px para la nota; con varios monitores, la nota fijada se ancla al de más a la derecha.
  - El instalador comprueba la versión de Windows al arrancar (`build/installer.nsh`). En Windows anterior a 10 muestra "My Sticky Notes necesita Windows 10 o superior." y se cierra sin instalar nada.
- **Sección "Tus datos" del README** (añadido en la revisión de la spec). Documenta la persistencia actual, sin cambiarla:
  - Todo es local: un solo archivo `%APPDATA%\my-sticky-notes\note.json` con tareas y preferencias de ventana. Sin cuenta, nube ni conexión.
  - Guardado automático unos 300 ms después de cada cambio y al cerrar la app.
  - Escritura segura: archivo temporal y luego renombrado. Un archivo dañado se respalda como `note.corrupt-<fecha>.json` y la app arranca vacía.
  - Historial: se conservan hoy y los 5 días anteriores. Los pendientes pasan a hoy y los días más antiguos se borran.
  - Copia de seguridad: copiar `note.json` con la app cerrada; restaurar = volver a ponerlo en su sitio.
  - Desinstalar conserva las notas salvo que se marque "Borrar también mis notas". Reinstalar las recupera.
  - La versión de desarrollo usa otra carpeta (`my-sticky-notes-dev`).
- `CLAUDE.md`: comandos `dist`/`art`, carpetas de datos, instancia única, inicio automático empaquetado, "Acerca de".
- Tests de la lógica pura nueva (carpeta de datos, inicio automático, enlaces permitidos).

**Fuera de alcance:**

- Firma de código. Sin firma, SmartScreen muestra "Windows protegió su PC" / editor desconocido. Se documenta cómo continuar.
- Actualización automática (`electron-updater`).
- Publicar automáticamente con GitHub Actions.
- macOS y Linux.
- Microsoft Store / MSIX, versión portable.
- Migrar notas de una carpeta a otra (no hace falta: la instalada usa la actual).
- Otras opciones en el menú del engranaje (acento, inicio con Windows, etc.).
- Icono propio en la ventana de la versión de desarrollo (sigue el de Electron).
- Elegir componentes o idioma en el asistente.

---

## Modelo de datos

`note.json` no cambia (sigue en `version: 2`). Solo cambia su carpeta en desarrollo.

Carpeta de datos, pura y testeable (`src/main/app-paths.ts`):

```ts
export const DATA_DIR_NAME = 'my-sticky-notes'
export const DEV_DATA_DIR_NAME = 'my-sticky-notes-dev'

/** null = no tocar (se respeta `--user-data-dir`). */
export function userDataDir(ctx: { isPackaged: boolean; argv: string[]; appData: string }): string | null
```

Identidad (`src/main/app-identity.ts`):

```ts
export const APP_ID = 'com.saulecheverri.mystickynotes' // appId y AppUserModelId
export const LOGIN_ITEM_NAME = 'My Sticky Notes' // valor en HKCU\...\Run
```

Inicio automático (`src/main/auto-launch.ts`): `LaunchContext` gana `isPackaged: boolean`. `canRegisterAutoLaunch` devuelve `false` si `!isPackaged` o hay `--user-data-dir`. `syncAutoLaunch` registra `{ openAtLogin, path: execPath, args: [], name: LOGIN_ITEM_NAME }`.

Enlaces del "Acerca de" (`src/main/external-links.ts`): el renderer no manda URLs, manda una clave. El main solo abre estas:

```ts
export const EXTERNAL_LINKS = {
  email: 'mailto:saulolo@gmail.com',
  github: 'https://github.com/saulolo',
  repo: 'https://github.com/saulolo/my-sticky-notes-frontend'
} as const
export type ExternalLinkKey = keyof typeof EXTERNAL_LINKS
```

IPC nuevo:

- `app:open-link` (send, `ExternalLinkKey`): el main valida la clave y llama `shell.openExternal`. Claves desconocidas se ignoran.
- Preload: `window.stickyApi.openLink(key)`.

Versión en el renderer: `electron.vite.config.ts` define `__APP_VERSION__` en `renderer` (`package.json` `version`, con sufijo `-dev` en modo desarrollo). Declaración en un `.d.ts` del renderer.

Archivos nuevos de empaquetado:

```
electron-builder.yml          # appId, productName, files, win/nsis
LICENSE                       # MIT
build/icon.ico                # lo aporta el usuario (icono de la app)
build/author-logo.ico         # generado (logo en círculo para el lateral nativo)
build/installer-header.bmp    # generado
build/author-logo.png         # lo aporta el usuario
build/installer.nsh           # macros NSIS: comprobar Windows 10+, texto de Bienvenida, lateral nativo, casilla de borrar notas, quitar entrada Run
scripts/make-installer-art.*  # genera los tres archivos de arriba
```

Opciones NSIS: `oneClick: false`, `perMachine: false`, `allowElevation: true`, `allowToChangeInstallationDirectory: true`, `createDesktopShortcut: true`, `createStartMenuShortcut: true`, `runAfterFinish: true`, `deleteAppDataOnUninstall: false`, `license: LICENSE`, `installerLanguages: [es_ES]`, `language: '3082'`, `installerIcon`/`uninstallerIcon`, `installerHeader`, `include: build/installer.nsh`. Sin `installerSidebar`/`uninstallerSidebar`: el lateral lo dibuja `installer.nsh`.

---

## Plan de implementación

1. **Carpeta de datos.** `app-paths.ts` con `userDataDir` + tests (empaquetada → `my-sticky-notes`; sin empaquetar → `my-sticky-notes-dev`; con `--user-data-dir` → `null`). `index.ts` llama `app.setPath('userData', …)` al principio, antes de `whenReady`. Prueba manual: `npm run dev` crea `%APPDATA%\my-sticky-notes-dev\note.json`; `%APPDATA%\my-sticky-notes\note.json` no cambia.
2. **Instancia única.** `requestSingleInstanceLock` en `index.ts` (después del paso 1); si falla, `app.quit()`. `second-instance` restaura, muestra y enfoca la ventana. Prueba manual: abrir `npm start` dos veces deja una sola nota.
3. **Identidad e inicio automático.** `app-identity.ts`; `setAppUserModelId(APP_ID)`; `auto-launch.ts` con `isPackaged`, sin argumentos y con `name`. Tests actualizados. Prueba manual: con `npm start`, fijar no escribe nada en `HKCU\...\Run`.
4. **Empaquetado básico.** `electron-builder` como devDependency; `electron-builder.yml` (appId, productName, `files`, `directories.buildResources: build`, `directories.output: dist`, win nsis x64, icono temporal `resources/icon.png`); `package.json` con `author`, `license: MIT`, `homepage` y script `dist`; `LICENSE`. Prueba manual: `npm run dist` genera el `.exe`; instala, abre y muestra las notas actuales. Anotar el tamaño del `.exe`, el de la carpeta instalada y la memoria de la app abierta, para la sección "Requisitos".
5. **Asistente completo.** Opciones NSIS del modelo de datos (español, licencia, tipo de instalación, carpeta, accesos directos, ejecutar al final) texto propio de Bienvenida y comprobación de Windows 10+ en `build/installer.nsh`. Prueba manual: recorrer el asistente "Solo para mí" y "Para todos"; la Bienvenida muestra la descripción.
6. **Desinstalador.** `build/installer.nsh`: casilla "Borrar también mis notas" (desmarcada) en el desinstalador; borra la carpeta solo si está marcada y no es una actualización. Siempre quita el valor `My Sticky Notes` de `HKCU\...\Run`. Prueba manual: desinstalar con y sin la casilla; instalar 0.1.0 encima de 0.1.0 conserva las notas.
7. **Recursos gráficos.** Script `npm run art` que genera `build/author-logo.ico` y `build/installer-header.bmp` desde `resources/icon.png` y `build/author-logo.png`; `build/icon.ico` lo aporta el usuario (el lateral nativo va en `build/installer.nsh`, añadido durante la implementación) (render con Inter; sin dependencias nuevas si se puede hacer con Electron, si no, la mínima). `electron-builder.yml` apunta a ellos. Prueba manual: el asistente y el desinstalador muestran la imagen lateral y la cabecera; el `.exe` y los accesos directos tienen el icono.
8. **"Acerca de".** `__APP_VERSION__` en la config de electron-vite; `external-links.ts` + test; IPC `app:open-link` y `openLink` en el preload; ítem en el menú del engranaje (`header.ts`); panel nuevo (`src/renderer/ui/about.ts` + estilos en `app.css`) con logo e icono importados como assets y la descripción breve. Prueba manual: abrir y cerrar el panel (Esc, clic fuera, ×) libre y anclada; correo y enlaces abren fuera; dev muestra `0.1.0-dev`.
9. **Documentación.** `README.md` (Requisitos, Instalación, SmartScreen, desinstalar, Tus datos, Publicar una versión) y `CLAUDE.md`.
10. **Release v0.1.0** (con aprobación del usuario): `npm run dist`, tag `v0.1.0`, Release en GitHub con el `.exe`.

---

## Criterios de aceptación

- [x] `npm test`, `npm run lint` y `npm run typecheck` pasan.
- [x] `npm run dist` termina sin errores y deja `dist/My Sticky Notes Setup 0.1.0.exe`.
- [x] El asistente está en español y muestra, en orden: Bienvenida, Licencia (MIT), Tipo de instalación, Carpeta, Progreso, Final.
- [x] La Bienvenida muestra el texto propio con la descripción de la app (no el texto genérico de NSIS).
- [x] Bienvenida y Final muestran el lateral nativo (no una imagen) con el icono, "My Sticky Notes", la versión y la tarjeta "Creado por" con logo, "Saul Echeverri" y correo.
- [x] Las pantallas intermedias muestran la imagen de cabecera propia.
- [x] "Solo para mí" instala sin pedir admin en `%LOCALAPPDATA%\Programs\My Sticky Notes`.
- [x] "Para todos los usuarios" pide admin e instala en `Program Files`.
- [x] "Examinar…" permite cambiar la carpeta y la app queda instalada ahí.
- [x] Se crean accesos directos en el escritorio y en el menú Inicio, con el icono de la app.
- [x] La casilla "Ejecutar My Sticky Notes" del Final abre la app.
- [x] "Agregar o quitar programas" lista "My Sticky Notes", versión 0.1.0, editor "Saul Echeverri" e icono.
- [x] La app instalada abre con las notas que había en `%APPDATA%\my-sticky-notes\note.json`.
- [x] `npm run dev` usa `%APPDATA%\my-sticky-notes-dev\note.json`; editar notas en dev no cambia las de la instalada.
- [x] La instalada y `npm run dev` pueden estar abiertas a la vez.
- [x] Abrir la instalada por segunda vez no crea otra ventana: enfoca (y restaura si estaba minimizada) la existente.
- [x] Fijada, la instalada se abre al iniciar sesión desde su `.exe`, una sola vez.
- [x] Sin empaquetar (`npm run dev`, `npm start`), fijar no escribe nada en `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`.
- [x] Instalar el `.exe` encima de una instalación existente conserva las notas.
- [x] Desinstalar con la casilla desmarcada quita app, accesos directos y la entrada `My Sticky Notes` de `Run`, y deja `note.json`.
- [x] Desinstalar con la casilla marcada borra además `%APPDATA%\my-sticky-notes\`.
- [x] El menú del engranaje muestra "Acerca de My Sticky Notes" (ya no "Próximamente").
- [x] El panel "Acerca de" muestra icono, nombre, "Versión 0.1.0" (instalada) o "Versión 0.1.0-dev" (dev), logo, "Ingeniero Saul Echeverri", correo y los dos enlaces de GitHub.
- [x] El panel muestra la descripción breve (frase + 5 puntos, incluido que los datos se guardan solo en el equipo y el historial de 5 días) entre la versión y la tarjeta "Creado por".
- [x] El panel cabe sin cortarse a 360 px y a 308 px; con la nota a 300 px de alto, hace scroll y se lee todo.
- [x] El panel se cierra con Esc, con clic fuera y con el botón ×.
- [x] Clic en el correo abre el cliente de correo con `saulolo@gmail.com`; clic en cada enlace abre la página en el navegador.
- [x] `README.md` explica cómo instalar, qué hacer ante el aviso de SmartScreen, cómo desinstalar y cómo publicar una versión.
- [x] `README.md` tiene la sección "Requisitos" (Windows 10/11 x64, disco, descarga, memoria, permisos, internet, pantalla) con los tamaños medidos del build real.
- [x] `build/installer.nsh` aborta con el mensaje "My Sticky Notes necesita Windows 10 o superior." cuando la versión de Windows es anterior a 10 (revisión del código: no hay Windows antiguo para probar).
- [x] `README.md` tiene la sección "Tus datos": ubicación de `note.json`, guardado automático, respaldo de archivo dañado, historial de 5 días, copia de seguridad manual y qué pasa al desinstalar.

---

## Decisiones

- **Sí:** electron-builder + NSIS en modo asistido. Es el estándar con electron-vite y da el asistente clásico con opciones.
- **No:** portable (arranque lento, inicio automático frágil), Electron Forge/Squirrel (instalación silenciosa sin opciones), MSIX/Store (cuenta de desarrollador y revisión), Inno Setup (script aparte; NSIS basta).
- **Sí:** la instalada usa la carpeta actual `my-sticky-notes` y conserva las notas del usuario. La de desarrollo pasa a `my-sticky-notes-dev` y empieza vacía. **No:** carpeta nueva con migración, ni instalada vacía.
- **Sí:** fijar la carpeta con `app.setPath('userData')` explícito en los dos casos. **No:** depender del nombre de la app; con `productName` Electron usaría `My Sticky Notes` y las notas no aparecerían.
- **Sí:** instancia única en esta spec. Sin ella, acceso directo + inicio automático = dos ventanas escribiendo el mismo archivo.
- **Sí:** solo la app instalada registra el inicio automático. **No:** que `npm start` siga registrándolo; dejaría entradas apuntando a `electron.exe` que chocan con la instalada.
- **Sí:** licencia MIT con pantalla de licencia, por pedido del usuario.
- **Sí:** elegir "Solo para mí" (por defecto) o "Para todos los usuarios". Con "Para todos" las notas siguen siendo por usuario (`%APPDATA%`).
- **Sí:** casilla "Borrar también mis notas" desmarcada al desinstalar. **No:** borrar siempre (se pierden notas al reinstalar) ni conservar siempre sin preguntar.
- **Sí:** gráficos generados por script y guardados en git, reemplazables a mano después. **No:** diseñarlos a mano ahora, ni usar las imágenes genéricas de NSIS.
- **Sí:** editor "Saul Echeverri" en Windows; "Ingeniero Saul Echeverri" solo en la tarjeta "Creado por" del "Acerca de" de la app, por pedido del usuario. En el instalador la tarjeta dice "Saul Echeverri" (añadido durante la implementación, por pedido del usuario).
- **Sí** (añadido durante la implementación, por pedido del usuario): lateral de Bienvenida y Final dibujado con controles nativos de NSIS (rectángulos de color, etiquetas con Segoe UI e iconos `.ico`), en lugar de `installer-sidebar.bmp`. El texto queda nítido con cualquier escalado de Windows. Se arma con filas a todo el ancho, del mismo color, para no depender del orden de apilado de Windows; los iconos llevan 2 px de aire para que ninguna fila vecina los recorte. **No:** imagen lateral generada.
- **Sí:** nombre "My Sticky Notes" y `appId` `com.saulecheverri.mystickynotes`, también como AppUserModelId.
- **Sí:** "Acerca de" como ítem del menú del engranaje que abre un panel dentro de la nota. **No:** mostrar la tarjeta directamente en el menú; el menú queda listo para más opciones.
- **Sí:** correo clicable (`mailto:`) y dos enlaces: perfil de GitHub y repo del proyecto (público). El usuario pidió GitHub sin elegir cuál; van los dos. El correo clicable no lo confirmó: si prefiere solo texto, se cambia en la revisión.
- **Sí** (añadido en la revisión de la spec, por pedido del usuario): descripción breve de la app. Frase + 4 puntos de cómo funciona en el "Acerca de"; solo la frase en la Bienvenida del instalador. **No:** guía de uso completa ni tutorial al primer arranque; otra spec si llega.
- **Sí** (añadido en la revisión de la spec, por pedido del usuario): sección "Requisitos" en el README, con tamaños medidos del build real (no estimados). El instalador bloquea Windows anterior a 10: Electron 44 ya no funciona en Windows 7/8. **No:** instalador de 32 bits ni ARM64 nativo; otra spec si alguien lo necesita.
- **Sí** (añadido en la revisión de la spec): explicar la persistencia local: una línea en el "Acerca de" y la sección "Tus datos" en el README. Solo documenta lo que ya existe. **No:** botón "Abrir carpeta de datos", exportar/importar ni copia automática; otra spec si llega.
- **Sí** (añadido durante la implementación, por pedido del usuario): icono propio que aporta el usuario como `.ico` (`build/icon.ico`), usado tal cual. Se descartaron antes un icono en SVG hecho durante la implementación (no le gustó el color) y una imagen PNG del usuario procesada por script. **No:** seguir con el logo de Electron en la v0.1.0. La ventana de desarrollo sigue sin icono propio en Windows (fuera de alcance).
- **Sí:** el main abre solo URLs de una lista fija por clave. **No:** pasar URLs libres desde el renderer (seguridad).
- **Sí:** versión desde `package.json`, con `-dev` en desarrollo para distinguirlas.
- **Sí:** el `.exe` siempre queda en `dist/` en local, y además Release manual en GitHub. **No:** GitHub Actions por ahora.
- **No:** firma de código ni actualización automática en esta versión. Se documenta el aviso de SmartScreen.

---

## Riesgos

| Riesgo | Mitigación |
| ------ | ---------- |
| La instalada no encuentra las notas actuales | `userData` explícito a `%APPDATA%\my-sticky-notes` cuando `app.isPackaged`; criterio de aceptación explícito. Hacer copia de `note.json` antes de la primera prueba. |
| `app.setPath('userData')` pisa el `--user-data-dir` de las pruebas E2E | `userDataDir` devuelve `null` con ese argumento y no se toca. Test. |
| La actualización (desinstalador viejo en silencio) borra las notas | Borrar solo si la casilla está marcada y no es actualización (`--updated`); en silencio la casilla no se marca. Probar instalar encima. |
| Quedan entradas viejas de inicio automático (`electron.exe` + ruta del proyecto) de cuando se usaba `npm start` | Sin empaquetar ya no registra. Antes de instalar, revisar `HKCU\...\Run` y quitar a mano la entrada vieja si existe (paso documentado). |
| SmartScreen bloquea el instalador sin firma | Documentar "Más información → Ejecutar de todas formas" en el README. Firma en otra spec. |
| La casilla del desinstalador necesita página NSIS propia (nsDialogs) | Si electron-builder no deja insertarla limpia, usar un cuadro Sí/No ("¿Borrar también tus notas?", por defecto No) y anotarlo en Decisiones. |
| `Program Files` (todos los usuarios) y la entrada `Run` en `HKCU` del usuario que instaló | La entrada la escribe la app por usuario al fijar; el desinstalador quita la del usuario que desinstala. |
| Las imágenes BMP se ven borrosas con escalado alto de Windows | Tamaños exactos de NSIS (164 × 314, 150 × 57); aceptable en esta versión. |
| El panel "Acerca de" no cabe a 308 px o con la nota a 300 px de alto | Criterio explícito; textos cortos ("Código del proyecto"); scroll dentro del panel. |
| El texto propio de Bienvenida no se aplica (electron-builder define su propio `MUI_WELCOMEPAGE_TEXT`) | Definirlo desde `build/installer.nsh` con el macro que electron-builder ofrece para eso; criterio de aceptación explícito. |

---

## Qué **no** entra en esta spec

- Firma de código.
- Actualización automática.
- Publicación automática con GitHub Actions.
- macOS, Linux, Microsoft Store, versión portable.
- Migración de notas entre carpetas.
- Otras opciones del menú del engranaje.
- Exportar/importar notas, copia automática o botón para abrir la carpeta de datos.
- Icono propio en la ventana de desarrollo.

Cada una, si llega, va en su propia spec.
