@echo off
title Bettencourt's POS - Silent Print Setup
color 0A

echo.
echo  =========================================================
echo   KareTech Solutions
echo   Bettencourt's POS - Terminal Setup
echo   Silent Printing + Fullscreen Kiosk
echo  =========================================================
echo.
echo  Scanning for Bettencourt's POS shortcuts...
echo.

powershell -ExecutionPolicy Bypass -Command ^
"$ErrorActionPreference = 'Stop'; ^
^
$pwaAppId   = 'nkngegcjpmjpnokicmecbicjianljdkh'; ^
$posUrls    = @('pos.bettencourtgy.com', 'pos.karetechsolutions.com'); ^
$kioskFlags = '--kiosk --kiosk-printing'; ^
^
$searchPaths = @( ^
    [Environment]::GetFolderPath('Desktop'), ^
    [Environment]::GetFolderPath('CommonDesktopDirectory'), ^
    [Environment]::GetFolderPath('ApplicationData') + '\Microsoft\Windows\Start Menu\Programs', ^
    [Environment]::GetFolderPath('CommonApplicationData') + '\Microsoft\Windows\Start Menu\Programs', ^
    [Environment]::GetFolderPath('LocalApplicationData') + '\Microsoft\Windows\Start Menu\Programs' ^
); ^
^
$shell   = New-Object -ComObject WScript.Shell; ^
$patched = 0; ^
$already = 0; ^
^
foreach ($dir in $searchPaths) { ^
    if (-not (Test-Path $dir)) { continue } ^
    Get-ChildItem -Path $dir -Filter '*.lnk' -Recurse -ErrorAction SilentlyContinue | ForEach-Object { ^
        try { ^
            $lnk  = $shell.CreateShortcut($_.FullName); ^
            $args = $lnk.Arguments; ^
            $isPwa    = $args -like \"*$pwaAppId*\"; ^
            $isChrome = (-not $isPwa) -and ($lnk.TargetPath -like '*chrome.exe') -and ($posUrls | Where-Object { $args -like \"*$_*\" }); ^
            if (-not $isPwa -and -not $isChrome) { return } ^
            $type = if ($isPwa) { 'PWA (installed app)' } else { 'Chrome browser shortcut' } ^
            Write-Host \"  Found : $($_.Name)\" -ForegroundColor Cyan; ^
            Write-Host \"  Type  : $type\" -ForegroundColor Cyan; ^
            Write-Host \"  Args  : $args\" -ForegroundColor DarkGray; ^
            if ($args -like '*--kiosk-printing*') { ^
                Write-Host \"  Status: Already configured.\" -ForegroundColor Yellow; ^
                $already++; ^
                Write-Host ''; ^
                return ^
            } ^
            if ($isPwa) { ^
                $lnk.Arguments = \"$args $kioskFlags\" ^
            } else { ^
                $lnk.Arguments = \"$kioskFlags $args\" ^
            } ^
            $lnk.Save(); ^
            Write-Host \"  Status: Patched OK.\" -ForegroundColor Green; ^
            Write-Host \"  New   : $($lnk.Arguments)\" -ForegroundColor DarkGray; ^
            $patched++; ^
            Write-Host '' ^
        } catch { ^
            Write-Host \"  Warning: Could not read $($_.Name)\" -ForegroundColor DarkYellow ^
        } ^
    } ^
} ^
^
Write-Host ''; ^
if ($patched -eq 0 -and $already -eq 0) { ^
    Write-Host '  ERROR: No Bettencourt POS shortcut was found.' -ForegroundColor Red; ^
    Write-Host '  Make sure the POS is installed as a PWA (Chrome install icon' -ForegroundColor Yellow; ^
    Write-Host '  in the address bar) or a Chrome shortcut exists on the Desktop' -ForegroundColor Yellow; ^
    Write-Host '  or Start Menu, then run this script again.' -ForegroundColor Yellow ^
} elseif ($patched -gt 0) { ^
    Write-Host \"  Done! $patched shortcut(s) configured.\" -ForegroundColor Green ^
} else { ^
    Write-Host '  Already set up - nothing to do.' -ForegroundColor Yellow ^
} ^
"

echo.
echo  =========================================================
echo   NEXT STEPS:
echo   1. Close Chrome completely
echo      (right-click Chrome in system tray ^> Exit)
echo   2. Reopen Bettencourt's POS from the desktop shortcut
echo   3. The POS will open fullscreen with silent printing
echo  =========================================================
echo.
pause
