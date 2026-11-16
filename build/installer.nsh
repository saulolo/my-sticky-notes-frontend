; Macros NSIS propias de My Sticky Notes (SPEC 06). electron-builder las incluye con
; `nsis.include`. Guardar en UTF-8 con BOM (textos con tildes).

!include nsDialogs.nsh
!include LogicLib.nsh

; Windows 10 o superior: Electron 44 ya no funciona en Windows 7/8. `CurrentMajorVersionNumber`
; solo existe desde Windows 10 (WinVer.nsh de esta versión de NSIS no tiene AtLeastWin10).
!macro customInit
  ClearErrors
  ReadRegDWORD $0 HKLM "SOFTWARE\Microsoft\Windows NT\CurrentVersion" "CurrentMajorVersionNumber"
  ${If} ${Errors}
  ${OrIf} $0 < 10
    MessageBox MB_OK|MB_ICONSTOP "My Sticky Notes necesita Windows 10 o superior." /SD IDOK
    Quit
  ${EndIf}
!macroend

; ---------------------------------------------------------------------------------------------
; Lateral de Bienvenida y Final (instalador y desinstalador), dibujado con controles nativos en
; lugar de una imagen: texto de Windows (nítido con cualquier escalado) y solo dos imágenes, el
; icono de la app y el logo del autor, como .ico con transparencia (`npm run art`).
; Medidas en unidades de diálogo: el lateral de Modern UI ocupa 0u 0u 109u 193u.

; Texto centrado: color de texto y fondo (RRGGBB), tamaño en puntos y peso.
!macro msnText CTL FG BG SIZE WEIGHT
  ${NSD_AddStyle} ${CTL} ${SS_CENTER}
  SetCtlColors ${CTL} ${FG} ${BG}
  CreateFont $R9 "Segoe UI" ${SIZE} ${WEIGHT}
  SendMessage ${CTL} ${WM_SETFONT} $R9 0
!macroend

; Franja de color de fondo.
!macro msnRect X Y W H BG
  ${NSD_CreateLabel} ${X} ${Y} ${W} ${H} ""
  Pop $R8
  SetCtlColors $R8 ${BG} ${BG}
!macroend

; Fila con un .ico centrado: el control ocupa todo el ancho y el icono es cuadrado, del alto real
; del control (píxeles, ya escalado por DPI) menos 4 px de aire, para que ninguna franja vecina
; lo recorte.
!macro msnIconRow Y H FILE
  ${NSD_CreateIcon} 0u ${Y} 109u ${H} ""
  Pop $R7
  ${NSD_AddStyle} $R7 ${SS_CENTERIMAGE}
  SetCtlColors $R7 252526 252526
  System::Call '*(i,i,i,i)p.R6'
  System::Call 'user32::GetClientRect(p $R7, p $R6)'
  System::Call '*$R6(i,i,i,i.R5)'
  System::Free $R6
  IntOp $R5 $R5 - 4
  System::Call 'user32::LoadImage(p 0, t "${FILE}", i 1, i $R5, i $R5, i 0x10) p.R6'
  SendMessage $R7 ${STM_SETIMAGE} 1 $R6
!macroend

; Fila de texto centrado a todo el ancho.
!macro msnLabel Y H TEXT FG SIZE WEIGHT
  ${NSD_CreateLabel} 0u ${Y} 109u ${H} "${TEXT}"
  Pop $R8
  !insertmacro msnText $R8 ${FG} 252526 ${SIZE} ${WEIGHT}
!macroend

; El lateral se arma con filas a todo el ancho, todas del mismo color (#252526), que no dependen
; del orden de apilado. Cada fila pisa 1u a la siguiente para que el redondeo de unidades a
; píxeles no deje rendijas blancas. Texto F4F4F5 / A1A1AA.
!macro msnSidebar IMAGE
  ShowWindow ${IMAGE} ${SW_HIDE}
  InitPluginsDir
  File "/oname=$PLUGINSDIR\msn-icon.ico" "${BUILD_RESOURCES_DIR}\icon.ico"
  File "/oname=$PLUGINSDIR\msn-author.ico" "${BUILD_RESOURCES_DIR}\author-logo.ico"

  ; App: icono, nombre y versión.
  !insertmacro msnRect 0u 0u 109u 19u 252526
  !insertmacro msnIconRow 18u 32u "$PLUGINSDIR\msn-icon.ico"
  !insertmacro msnRect 0u 49u 109u 6u 252526
  !insertmacro msnLabel 54u 14u "My Sticky Notes" F4F4F5 11 700
  !insertmacro msnLabel 67u 12u "Versión ${VERSION}" A1A1AA 8 400
  !insertmacro msnRect 0u 78u 109u 34u 252526

  ; "CREADO POR": logo en círculo, nombre y correo.
  !insertmacro msnLabel 111u 11u "CREADO POR" A1A1AA 7 700
  !insertmacro msnRect 0u 121u 109u 5u 252526
  !insertmacro msnIconRow 125u 30u "$PLUGINSDIR\msn-author.ico"
  !insertmacro msnRect 0u 154u 109u 4u 252526
  !insertmacro msnLabel 157u 13u "Saul Echeverri" F4F4F5 9 700
  !insertmacro msnLabel 169u 12u "saulolo@gmail.com" A1A1AA 8 400
  !insertmacro msnRect 0u 180u 109u 13u 252526
!macroend
; Las variables de las páginas de Modern UI se declaran al insertar cada página; se declaran
; aquí antes para que las funciones del lateral puedan usarlas (los macros están protegidos).
!include MUI2.nsh
!insertmacro MUI_WELCOMEPAGE_INTERFACE
!insertmacro MUI_FINISHPAGE_INTERFACE
!ifndef BUILD_UNINSTALLER
  Function msnWelcomeShow
    !insertmacro msnSidebar $mui.WelcomePage.Image
  FunctionEnd

  Function msnFinishShow
    !insertmacro msnSidebar $mui.FinishPage.Image
  FunctionEnd

  ; Bienvenida con texto propio (el asistente de electron-builder no trae página de Bienvenida).
  !macro customWelcomePage
    !define MUI_WELCOMEPAGE_TEXT "My Sticky Notes es una nota adhesiva de escritorio para organizar tus tareas del día.$\r$\n$\r$\nPulsa Siguiente para continuar."
    !define MUI_PAGE_CUSTOMFUNCTION_SHOW msnWelcomeShow
    !insertmacro MUI_PAGE_WELCOME
  !macroend

  ; Final: el mismo de electron-builder ("Ejecutar My Sticky Notes") con el lateral nativo.
  !macro customFinishPage
    Function StartApp
      ${if} ${isUpdated}
        StrCpy $1 "--updated"
      ${else}
        StrCpy $1 ""
      ${endif}
      ${StdUtils.ExecShellAsUser} $0 "$launchLink" "open" "$1"
    FunctionEnd

    !define MUI_FINISHPAGE_RUN
    !define MUI_FINISHPAGE_RUN_FUNCTION "StartApp"
    !define MUI_PAGE_CUSTOMFUNCTION_SHOW msnFinishShow
    !insertmacro MUI_PAGE_FINISH
  !macroend
!endif

; ---------------------------------------------------------------------------------------------
; Desinstalador: lateral nativo, casilla "Borrar también mis notas" (desmarcada) y limpieza del
; inicio automático. Las funciones `un.` solo existen al compilar el desinstalador (-WX trata los
; avisos como errores).
!ifdef BUILD_UNINSTALLER

  Var deleteNotes
  Var deleteNotesCheckbox

  Function un.msnWelcomeShow
    !insertmacro msnSidebar $mui.WelcomePage.Image
  FunctionEnd

  Function un.msnFinishShow
    !insertmacro msnSidebar $mui.FinishPage.Image
  FunctionEnd

  ; Bienvenida estándar con el lateral nativo y después la página de la casilla.
  !macro customUnWelcomePage
    !define MUI_PAGE_CUSTOMFUNCTION_SHOW un.msnWelcomeShow
    !insertmacro MUI_UNPAGE_WELCOME
    UninstPage custom un.deleteNotesPage un.deleteNotesPageLeave
  !macroend

  ; Va justo antes del Final del desinstalador (MUI_UNPAGE_FINISH): le pone el lateral nativo.
  !macro customUninstallPage
    !define MUI_PAGE_CUSTOMFUNCTION_SHOW un.msnFinishShow
  !macroend

  Function un.deleteNotesPage
    ; En una actualización el desinstalador corre en silencio (/S): la página no aparece,
    ; $deleteNotes queda vacía y customUnInstall comprueba además `isUpdated`.
    !insertmacro MUI_HEADER_TEXT "Tus notas" "Elige si quieres conservar tus notas."
    nsDialogs::Create 1018
    Pop $0
    ${If} $0 == error
      Abort
    ${EndIf}
    ${NSD_CreateLabel} 0u 0u 300u 36u "Tus notas están en $APPDATA\my-sticky-notes. Si no marcas la casilla, se conservan y vuelven a aparecer si instalas de nuevo My Sticky Notes."
    Pop $0
    ${NSD_CreateCheckbox} 0u 44u 300u 12u "Borrar también mis notas"
    Pop $deleteNotesCheckbox
    ${NSD_Uncheck} $deleteNotesCheckbox
    nsDialogs::Show
  FunctionEnd

  Function un.deleteNotesPageLeave
    ${NSD_GetState} $deleteNotesCheckbox $0
    ${If} $0 == ${BST_CHECKED}
      StrCpy $deleteNotes "1"
    ${Else}
      StrCpy $deleteNotes "0"
    ${EndIf}
  FunctionEnd

  !macro customUnInstall
    ; Inicio automático que escribe la app al fijar (LOGIN_ITEM_NAME en app-identity.ts).
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "My Sticky Notes"

    ; Notas: solo si se marcó la casilla y no es una actualización. Siempre por usuario.
    ${If} $deleteNotes == "1"
    ${AndIfNot} ${isUpdated}
      ${If} $installMode == "all"
        SetShellVarContext current
      ${EndIf}
      RMDir /r "$APPDATA\my-sticky-notes"
      ${If} $installMode == "all"
        SetShellVarContext all
      ${EndIf}
    ${EndIf}
  !macroend
!endif