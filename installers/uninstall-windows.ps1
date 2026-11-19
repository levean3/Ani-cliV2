# Removes ani-tui from Windows: the app, the ani-tui command, shortcuts and the Settings > Apps
# entry. Asks before deleting personal data (history, watch later, settings) and before
# removing Node.js or mpv, and only offers the ones the installer added itself.
# Started by "Uninstall from Windows.cmd", the Start menu shortcut, or Settings > Apps.
# Keep this file ASCII-only: Windows PowerShell 5.1 misreads UTF-8 without a BOM.

$ErrorActionPreference = 'Stop'
# the uninstaller may run from inside the folder it deletes; Windows can't delete the current folder
Set-Location $env:USERPROFILE

$InstallDir = Join-Path $env:LOCALAPPDATA 'ani-tui'
$BinDir = Join-Path $InstallDir 'bin'
$RecordFile = Join-Path $InstallDir 'installed-by-ani-tui.txt'
$UninstallKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\ani-tui'
$StartMenu = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'
$Shortcuts = @(
    (Join-Path ([Environment]::GetFolderPath('Desktop')) 'ani-tui.lnk'),
    (Join-Path $StartMenu 'ani-tui.lnk'),
    (Join-Path $StartMenu 'Uninstall ani-tui.lnk')
)
# same locations src/store.js and src/settings.js use
$StateBase = if ($env:XDG_STATE_HOME) { $env:XDG_STATE_HOME } else { Join-Path $env:USERPROFILE '.local\state' }
$StateDir = if ($env:ANI_CLI_HIST_DIR) { $env:ANI_CLI_HIST_DIR } else { Join-Path $StateBase 'ani-cli' }
$ConfigBase = if ($env:XDG_CONFIG_HOME) { $env:XDG_CONFIG_HOME } else { Join-Path $env:USERPROFILE '.config' }
$ConfigDir = Join-Path $ConfigBase 'ani-cli'
$Names = @{ 'OpenJS.NodeJS.LTS' = 'Node.js'; 'shinchiro.mpv' = 'mpv (video player)' }

function Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Ok($msg) { Write-Host "    $msg" -ForegroundColor Green }
function Note($msg) { Write-Host "    $msg" -ForegroundColor Yellow }
function Ask($question) {
    $answer = Read-Host "$question [y/N]"
    return $answer -match '^\s*(y|yes)\s*$'
}
function Finish($code) {
    Write-Host ''
    Read-Host 'Press Enter to close this window'
    exit $code
}
# Edit the user PATH in the registry directly, keeping its type and any %VARIABLE% entries
# (see the same functions in install-windows.ps1).
function Get-UserPath {
    $key = Get-Item 'HKCU:\Environment'
    $kind = 'ExpandString'
    if ($key.GetValueNames() -contains 'Path') { $kind = $key.GetValueKind('Path') }
    return @{ Value = [string]$key.GetValue('Path', '', 'DoNotExpandEnvironmentNames'); Kind = $kind }
}
function Set-UserPath($value, $kind) {
    Set-ItemProperty -Path 'HKCU:\Environment' -Name Path -Value $value -Type $kind
    [Environment]::SetEnvironmentVariable('ANI_TUI_REFRESH', '1', 'User')
    [Environment]::SetEnvironmentVariable('ANI_TUI_REFRESH', $null, 'User')
}
function Remove-IfEmpty($dir) {
    if ((Test-Path $dir) -and -not (Get-ChildItem -Force $dir)) { Remove-Item -Force $dir }
}

Write-Host 'ani-tui uninstaller for Windows' -ForegroundColor Magenta

try {
    $installed = (Test-Path $InstallDir) -or (Test-Path $UninstallKey) -or ($Shortcuts | Where-Object { Test-Path $_ })
    if (-not $installed) {
        Note "ani-tui doesn't seem to be installed (nothing found in $InstallDir)."
        Finish 0
    }
    if (-not (Ask 'Remove ani-tui from this PC?')) {
        Write-Host 'Nothing was changed.'
        Finish 0
    }
    $recorded = @()
    if (Test-Path $RecordFile) { $recorded = @(Get-Content $RecordFile | Where-Object { $_ }) }

    Step 'Removing shortcuts'
    foreach ($s in $Shortcuts) { if (Test-Path $s) { Remove-Item -Force $s } }
    if (Test-Path $UninstallKey) { Remove-Item -Recurse -Force $UninstallKey }
    Ok 'Desktop, Start menu and Settings > Apps entries removed'

    Step 'Removing the ani-tui command'
    $userPath = Get-UserPath
    $entries = $userPath.Value.Split(';')
    # remove only our entry; keep everything else exactly as it was, empty entries included
    $kept = @($entries | Where-Object { [Environment]::ExpandEnvironmentVariables($_).TrimEnd('\') -ne $BinDir })
    if ($kept.Count -ne $entries.Count) { Set-UserPath ($kept -join ';') $userPath.Kind }
    Ok 'Done'

    Step 'Removing app files'
    if (Test-Path $InstallDir) {
        try {
            Remove-Item -Recurse -Force $InstallDir
            Ok "Deleted $InstallDir"
        } catch {
            Note "Some files are in use. Close any ani-tui windows and run the uninstaller again."
            Note "Or delete this folder yourself: $InstallDir"
        }
    } else {
        Ok 'Already gone'
    }

    Step 'Your watch history, watch later list and settings'
    $dataFiles = @(
        (Join-Path $StateDir 'ani-hsts'),
        (Join-Path $StateDir 'watch-later.json'),
        (Join-Path $ConfigDir 'ani-tui.json')
    ) | Where-Object { Test-Path $_ }
    if ($dataFiles) {
        Note 'Keep these if you might install ani-tui again and want to continue where you left off.'
        if (Ask 'Delete your history, watch later list and settings too?') {
            foreach ($f in $dataFiles) { Remove-Item -Force $f }
            Remove-IfEmpty $StateDir
            Remove-IfEmpty $ConfigDir
            Ok 'Deleted'
        } else {
            Ok 'Kept'
        }
    } else {
        Ok 'None found'
    }

    if ($recorded) {
        Step 'Programs the installer added'
        foreach ($id in $recorded) {
            $name = if ($Names[$id]) { $Names[$id] } else { $id }
            if (Ask "Also remove $name? Say no if anything else on this PC uses it.") {
                Note "Removing $name. If Windows asks for permission, click Yes."
                & winget uninstall --id $id --exact --silent --accept-source-agreements
                if ($LASTEXITCODE -eq 0) { Ok "$name removed" } else { Note "$name could not be removed automatically. You can remove it in Settings > Apps." }
            } else {
                Ok "Kept $name"
            }
        }
    }

    Write-Host "`nani-tui has been removed." -ForegroundColor Green
    Finish 0
} catch {
    Write-Host "`nSomething went wrong: $($_.Exception.Message)" -ForegroundColor Red
    Finish 1
}
