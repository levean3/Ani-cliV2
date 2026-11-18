@echo off
rem Double-click this file to remove ani-tui from Windows.
rem Everything runs on one line: the uninstaller may delete this file, and cmd reads batch files line by line.
title ani-tui uninstaller
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0installers\uninstall-windows.ps1" & exit /b
