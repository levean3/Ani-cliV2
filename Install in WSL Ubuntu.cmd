@echo off
rem Double-click this file to install ani-tui inside WSL Ubuntu.
title ani-tui installer (WSL Ubuntu)

wsl -d Ubuntu -e true >nul 2>&1
if errorlevel 1 goto no_ubuntu

wsl -d Ubuntu --cd "%~dp0." -e bash installers/install-ubuntu.sh
echo.
pause
exit /b

:no_ubuntu
echo Ubuntu for WSL is not installed on this PC.
echo.
echo Installing it needs administrator permission and may need a restart.
echo After it finishes, Ubuntu asks you to create a username and password.
echo Then run this installer again.
echo.
choice /m "Install Ubuntu now"
if errorlevel 2 exit /b
wsl --install -d Ubuntu
echo.
echo When Ubuntu is set up (restart first if Windows asks), run this installer again.
pause
