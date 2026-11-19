# Installs ani-tui on Windows: Node.js and mpv (through winget) if missing, the app itself
# in %LOCALAPPDATA%\ani-tui, an `ani-tui` command, and Desktop + Start menu shortcuts.
# Started by "Install on Windows.cmd". Running it again updates the app.
# Keep this file ASCII-only: Windows PowerShell 5.1 misreads UTF-8 without a BOM.

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$Source = Split-Path -Parent $PSScriptRoot
$InstallDir = Join-Path $env:LOCALAPPDATA 'ani-tui'
$AppDir = Join-Path $InstallDir 'app'
$BinDir = Join-Path $InstallDir 'bin'
# winget packages this installer added, so the uninstaller only offers to remove those
$RecordFile = Join-Path $InstallDir 'installed-by-ani-tui.txt'
$UninstallKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\ani-tui'

function Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Ok($msg) { Write-Host "    $msg" -ForegroundColor Green }
function Note($msg) { Write-Host "    $msg" -ForegroundColor Yellow }
function Finish($code) {
    Write-Host ''
    Read-Host 'Press Enter to close this window'
    exit $code
}
function Fail($msg) {
    Write-Host "`n$msg" -ForegroundColor Red
    Finish 1
}
function Refresh-Path {
    $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
                [Environment]::GetEnvironmentVariable('Path', 'User')
}
function Winget-Install($id, $name) {
    Note "Installing $name. If Windows asks for permission, click Yes."
    & winget install --id $id --exact --silent --accept-package-agreements --accept-source-agreements
    # winget returns non-zero when the package is already installed; the caller checks for the program instead
    Refresh-Path
}
# Edit the user PATH in the registry directly. [Environment]::SetEnvironmentVariable would
# rewrite it as a plain string, expanding entries like %USERPROFILE%\... into fixed paths.
function Get-UserPath {
    $key = Get-Item 'HKCU:\Environment'
    $kind = 'ExpandString'
    if ($key.GetValueNames() -contains 'Path') { $kind = $key.GetValueKind('Path') }
    return @{ Value = [string]$key.GetValue('Path', '', 'DoNotExpandEnvironmentNames'); Kind = $kind }
}
function Set-UserPath($value, $kind) {
    Set-ItemProperty -Path 'HKCU:\Environment' -Name Path -Value $value -Type $kind
    # setting any variable through .NET tells Explorer the environment changed, so new windows see it
    [Environment]::SetEnvironmentVariable('ANI_TUI_REFRESH', '1', 'User')
    [Environment]::SetEnvironmentVariable('ANI_TUI_REFRESH', $null, 'User')
}
function Record($id) {
    New-Item -ItemType Directory -Force $InstallDir | Out-Null
    $ids = @()
    if (Test-Path $RecordFile) { $ids = @(Get-Content $RecordFile) }
    @($ids + $id) | Sort-Object -Unique | Set-Content -Path $RecordFile -Encoding ASCII
}
function Find-Node {
    $cmd = Get-Command node.exe -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    $p = Join-Path $env:ProgramFiles 'nodejs\node.exe'
    if (Test-Path $p) { return $p }
    return $null
}
function Find-Mpv {
    $cmd = Get-Command mpv.exe -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    $dirs = @(
        (Join-Path $env:ProgramFiles 'mpv'),
        (Join-Path $env:ProgramFiles 'MPV Player'),
        (Join-Path $env:LOCALAPPDATA 'Programs\mpv'),
        (Join-Path $env:USERPROFILE 'scoop\apps\mpv\current')
    )
    foreach ($d in $dirs) {
        $p = Join-Path $d 'mpv.exe'
        if (Test-Path $p) { return $p }
    }
    return $null
}

Write-Host 'ani-tui installer for Windows' -ForegroundColor Magenta
Write-Host 'This installs everything ani-tui needs. It takes a few minutes.'

try {
    # --- winget -----------------------------------------------------------------
    Step 'Checking for winget (the Windows package installer)'
    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
        Note 'winget is missing. Opening the Microsoft Store page for "App Installer", which includes it.'
        Start-Process 'ms-windows-store://pdp/?productid=9NBLGGH4NNS1'
        Fail 'Install "App Installer" from the Store, then run this installer again.'
    }
    Ok 'winget found'

    # --- Node.js ----------------------------------------------------------------
    Step 'Checking for Node.js'
    $node = Find-Node
    $major = 0
    if ($node) { $major = [int](((& $node --version) -replace '^v', '').Split('.')[0]) }
    if ($major -lt 18) {
        Winget-Install 'OpenJS.NodeJS.LTS' 'Node.js'
        $node = Find-Node
        if (-not $node) { Fail 'Node.js could not be installed. Restart your PC and run this installer again.' }
        Record 'OpenJS.NodeJS.LTS'
    }
    $nodeDir = Split-Path -Parent $node
    $env:Path = "$nodeDir;$env:Path"
    Ok "Node.js $(& $node --version)"

    # --- mpv --------------------------------------------------------------------
    Step 'Checking for mpv (the video player)'
    $mpv = Find-Mpv
    if (-not $mpv) {
        Winget-Install 'shinchiro.mpv' 'mpv'
        $mpv = Find-Mpv
        if ($mpv) { Record 'shinchiro.mpv' }
    }
    if ($mpv) {
        Ok "mpv found: $mpv"
    } else {
        Note 'mpv was not found after installing. ani-tui will also use VLC if you have it,'
        Note 'or you can pick a player later in ani-tui > Settings.'
    }

    # --- the app ----------------------------------------------------------------
    Step "Copying ani-tui to $AppDir"
    New-Item -ItemType Directory -Force $AppDir, $BinDir | Out-Null
    & robocopy $Source $AppDir /MIR /XD node_modules .git /NFL /NDL /NJH /NJS /NP | Out-Null
    if ($LASTEXITCODE -ge 8) { Fail "Copying files failed (robocopy code $LASTEXITCODE)." }
    Ok 'Files copied'

    Step 'Installing ani-tui libraries'
    Push-Location $AppDir
    & (Join-Path $nodeDir 'npm.cmd') ci --omit=dev --no-fund --no-audit --loglevel=error --update-notifier=false
    $npmCode = $LASTEXITCODE
    Pop-Location
    if ($npmCode -ne 0) { Fail 'Installing libraries failed. Check your internet connection and run this installer again.' }
    Ok 'Libraries installed'

    # --- command + shortcuts ----------------------------------------------------
    Step 'Adding the ani-tui command and shortcuts'
    $launcher = Join-Path $BinDir 'ani-tui.cmd'
    $script = Join-Path $AppDir 'bin\ani-tui.js'
    Set-Content -Path $launcher -Encoding ASCII -Value "@echo off`r`n`"$node`" `"$script`" %*"

    $userPath = Get-UserPath
    $present = $userPath.Value.Split(';') |
        Where-Object { [Environment]::ExpandEnvironmentVariables($_).TrimEnd('\') -eq $BinDir }
    if (-not $present) {
        $newPath = (@($userPath.Value.TrimEnd(';'), $BinDir) | Where-Object { $_ }) -join ';'
        Set-UserPath $newPath $userPath.Kind
    }
    Ok 'The ani-tui command works in new terminal windows'

    $shell = New-Object -ComObject WScript.Shell
    $startMenu = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'
    foreach ($dir in @([Environment]::GetFolderPath('Desktop'), $startMenu)) {
        $lnk = $shell.CreateShortcut((Join-Path $dir 'ani-tui.lnk'))
        $lnk.TargetPath = Join-Path $env:SystemRoot 'System32\cmd.exe'
        $lnk.Arguments = "/c `"$launcher`""
        $lnk.WorkingDirectory = $env:USERPROFILE
        $lnk.Description = 'Search and watch anime'
        $lnk.Save()
    }
    # Run the uninstall script with PowerShell directly, not through the .cmd file: the
    # uninstaller deletes this folder, and cmd fails ("cannot find the path") when the
    # batch file it's running disappears. PowerShell reads the whole script up front.
    $powershell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
    $uninstallArgs = "-NoProfile -ExecutionPolicy Bypass -File `"$(Join-Path $AppDir 'installers\uninstall-windows.ps1')`""
    $lnk = $shell.CreateShortcut((Join-Path $startMenu 'Uninstall ani-tui.lnk'))
    $lnk.TargetPath = $powershell
    $lnk.Arguments = $uninstallArgs
    $lnk.WorkingDirectory = $env:USERPROFILE
    $lnk.Description = 'Remove ani-tui from this PC'
    $lnk.Save()
    Ok 'Shortcuts added to your Desktop and Start menu'

    # list it in Settings > Apps so it can be removed like any other program
    $version = (Get-Content (Join-Path $AppDir 'package.json') -Raw | ConvertFrom-Json).version
    New-Item -Path $UninstallKey -Force | Out-Null
    $entries = @{
        DisplayName     = 'ani-tui'
        DisplayVersion  = $version
        Publisher       = 'Ani-cliV2'
        InstallLocation = $InstallDir
        UninstallString = "`"$powershell`" $uninstallArgs"
    }
    foreach ($k in $entries.Keys) { Set-ItemProperty -Path $UninstallKey -Name $k -Value $entries[$k] }
    Set-ItemProperty -Path $UninstallKey -Name NoModify -Value 1 -Type DWord
    Set-ItemProperty -Path $UninstallKey -Name NoRepair -Value 1 -Type DWord
    Ok 'Listed in Settings > Apps'

    Write-Host "`nDone! Open ani-tui from the shortcut on your Desktop or in the Start menu." -ForegroundColor Green
    Write-Host 'Tip: make the window bigger (or maximize it) for the best view.'
    Write-Host 'To update later, download the newest version and run this installer again.'
    Write-Host 'To remove it, use "Uninstall ani-tui" in the Start menu, or Settings > Apps.'
    Finish 0
} catch {
    Fail "Something went wrong: $($_.Exception.Message)"
}
