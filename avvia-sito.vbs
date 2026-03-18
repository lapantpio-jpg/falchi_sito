Option Explicit

Dim shell
Dim scriptDir
Dim psScript
Dim command

Set shell = CreateObject("WScript.Shell")
scriptDir = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
psScript = scriptDir & "\avvia-sito-silenzioso.ps1"
command = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File """ & psScript & """"

' 0 = hidden window, False = do not wait
shell.Run command, 0, False
