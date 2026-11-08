Unicode true
!include MUI2.nsh
!include LogicLib.nsh
!include x64.nsh
!include FileFunc.nsh
Var PreviousInstallDir
Name "Paper Reader"
OutFile "${OUTPUT}"
InstallDir "$LOCALAPPDATA\Programs\Paper Reader"
RequestExecutionLevel user
SetCompressor /SOLID zlib
VIProductVersion "${VERSION}.${INSTALLER_REVISION}"
VIAddVersionKey "ProductName" "Paper Reader"
VIAddVersionKey "FileDescription" "Paper Reader Setup"
VIAddVersionKey "FileVersion" "${VERSION}.${INSTALLER_REVISION}"
VIAddVersionKey "ProductVersion" "${VERSION}"
VIAddVersionKey "LegalCopyright" "Paper Reader contributors"
!define UNINSTALL_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\PaperReader"
!define MUI_ABORTWARNING
!define MUI_FINISHPAGE_RUN "$INSTDIR\Paper Reader.exe"
!define MUI_FINISHPAGE_RUN_NOTCHECKED
!define MUI_FINISHPAGE_TEXT "安装完成。个人文献库与程序分开保存；卸载程序会保留文献库。"
!insertmacro MUI_PAGE_WELCOME
!define MUI_PAGE_CUSTOMFUNCTION_LEAVE ValidateInstallDir
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "SimpChinese"
!insertmacro MUI_LANGUAGE "English"

!macro CheckClosed PREFIX
Function ${PREFIX}CheckClosed
  IfFileExists "$INSTDIR\Paper Reader.exe" 0 done
  retry:
  System::Call 'kernel32::CreateFileW(w "$INSTDIR\Paper Reader.exe", i 0x40000000, i 0, p 0, i 3, i 0, p 0) p .r0'
  ${If} $0 == -1
    MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "请先退出 Paper Reader，再点击重试。 / Please close Paper Reader and retry." IDRETRY retry
    Abort
  ${EndIf}
  System::Call 'kernel32::CloseHandle(p r0)'
  done:
FunctionEnd
!macroend
!insertmacro CheckClosed ""
!insertmacro CheckClosed "un."

Function .onInit
  ${IfNot} ${RunningX64}
    MessageBox MB_OK|MB_ICONSTOP "需要 64 位 Windows。 / 64-bit Windows is required."
    Abort
  ${EndIf}
  SetShellVarContext current
  SetRegView 64
  ReadRegStr $0 HKCU "${UNINSTALL_KEY}" "InstallLocation"
  StrCpy $PreviousInstallDir $0
  ${If} $0 != ""
    StrCpy $INSTDIR $0
  ${EndIf}
FunctionEnd

Function ValidateInstallDir
  ${If} $PreviousInstallDir != ""
  ${AndIf} $INSTDIR != $PreviousInstallDir
    IfFileExists "$PreviousInstallDir\Paper Reader.exe" 0 done
    MessageBox MB_OK|MB_ICONEXCLAMATION "检测到已有安装：$PreviousInstallDir。更换安装位置前请先卸载旧程序，文献库会保留。 / Uninstall the existing copy before changing its location. Your library will be kept."
    Abort
  ${EndIf}
  done:
FunctionEnd

Function .onVerifyInstDir
  ; Keep application files out of drive roots and the separate personal library.
  ${GetRoot} "$INSTDIR" $0
  ${If} $INSTDIR == "$0\"
  ${OrIf} $INSTDIR == "$0"
  ${OrIf} $INSTDIR == "$APPDATA\Paper Reader"
    Abort
  ${EndIf}
FunctionEnd

Section "Paper Reader"
  ; Also validate silent /D= installs, which skip the directory page.
  Call ValidateInstallDir
  Call CheckClosed
  SetOutPath "$INSTDIR"
  File /r "${PAYLOAD}/*"
  File /oname=NSIS-COPYING.txt "${NSIS_LICENSE}"
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  CreateDirectory "$SMPROGRAMS\Paper Reader"
  CreateShortcut "$SMPROGRAMS\Paper Reader\Paper Reader.lnk" "$INSTDIR\Paper Reader.exe"
  CreateShortcut "$SMPROGRAMS\Paper Reader\卸载 Paper Reader.lnk" "$INSTDIR\Uninstall.exe"
  CreateShortcut "$DESKTOP\Paper Reader.lnk" "$INSTDIR\Paper Reader.exe"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "DisplayName" "Paper Reader"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "DisplayIcon" "$INSTDIR\Paper Reader.exe"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "UninstallString" '$\"$INSTDIR\Uninstall.exe$\"'
  WriteRegDWORD HKCU "${UNINSTALL_KEY}" "NoModify" 1
  WriteRegDWORD HKCU "${UNINSTALL_KEY}" "NoRepair" 1
SectionEnd

Section "Uninstall"
  SetShellVarContext current
  SetRegView 64
  Call un.CheckClosed
  ; Generated from the packaged file list: never recursively remove a user directory.
  !include "${UNINSTALL_FILES}"
  Delete "$INSTDIR\NSIS-COPYING.txt"
  Delete "$INSTDIR\Uninstall.exe"
  RMDir "$INSTDIR"
  Delete "$DESKTOP\Paper Reader.lnk"
  Delete "$SMPROGRAMS\Paper Reader\Paper Reader.lnk"
  Delete "$SMPROGRAMS\Paper Reader\卸载 Paper Reader.lnk"
  RMDir "$SMPROGRAMS\Paper Reader"
  DeleteRegKey HKCU "${UNINSTALL_KEY}"
  ; No operations on $APPDATA\Paper Reader: PDFs, notes and keys remain intact.
SectionEnd
