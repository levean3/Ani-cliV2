@echo off
rem Double-click this file to remove ani-tui from WSL Ubuntu.
title ani-tui uninstaller (WSL Ubuntu)

wsl -d Ubuntu -e true >nul 2>&1
if errorlevel 1 goto no_ubuntu

wsl -d Ubuntu --cd "%~dp0." -e bash installers/uninstall-ubuntu.sh
echo.
pause
exit /b

:no_ubuntu
echo Ubuntu for WSL is not installed on this PC, so there is nothing to remove.
echo.
pause
