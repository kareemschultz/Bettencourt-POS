@echo off
title Bettencourt's POS - Terminal Setup  (KareTech Solutions)
color 0A
setlocal

echo.
echo  =========================================================
echo   KareTech Solutions
echo   Bettencourt's POS  -  Terminal Setup v2
echo   Silent Printing + Fullscreen Kiosk
echo  =========================================================
echo.

:: ── Self-elevate to Administrator if needed ───────────────────────────────
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo  Requesting administrator privileges...
    echo  Please click YES on the UAC prompt that appears.
    echo.
    powershell -WindowStyle Hidden -Command "Start-Process cmd -ArgumentList '/c \"%~f0\"' -Verb RunAs"
    exit /b
)

echo  Running as administrator. Searching for shortcuts...
echo.

powershell -ExecutionPolicy Bypass -Command ^
"$ErrorActionPreference = 'Continue'; ^
^
$pwaAppId   = 'nkngegcjpmjpnokicmecbicjianljdkh'; ^
$posUrls    = @('pos.bettencourtgy.com', 'pos.karetechsolutions.com'); ^
$kioskFlags = '--kiosk --kiosk-printing'; ^
^
$searchPaths = @( ^
    [Environment]::GetFolderPath('Desktop'), ^
    [Environment]::GetFolderPath('CommonDesktopDirectory'), ^
    [Environment]::GetFolderPath('ApplicationData')   + '\Microsoft\Windows\Start Menu\Programs', ^
    [Environment]::GetFolderPath('CommonApplicationData') + '\Microsoft\Windows\Start Menu\Programs', ^
    [Environment]::GetFolderPath('LocalApplicationData')  + '\Microsoft\Windows\Start Menu\Programs' ^
); ^
^
$chromePaths = @( ^
    \"$env:PROGRAMFILES\Google\Chrome\Application\chrome.exe\", ^
    \"${env:PROGRAMFILES(X86)}\Google\Chrome\Application\chrome.exe\", ^
    \"$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe\" ^
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
                Write-Host \"  Status: Already configured  (no changes needed)\" -ForegroundColor Yellow; ^
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
            Write-Host \"  Status: Patched successfully\" -ForegroundColor Green; ^
            Write-Host \"  New   : $($lnk.Arguments)\" -ForegroundColor DarkGray; ^
            $patched++; ^
            Write-Host '' ^
        } catch { ^
            Write-Host \"  Warning: Could not update $($_.Name) - $($_.Exception.Message)\" -ForegroundColor DarkYellow ^
        } ^
    } ^
} ^
^
Write-Host ''; ^
if ($patched -eq 0 -and $already -eq 0) { ^
    Write-Host '  No existing POS shortcut found.' -ForegroundColor Yellow; ^
    Write-Host '  Searching for Chrome to create one...' -ForegroundColor Cyan; ^
    $chromePath = $chromePaths | Where-Object { Test-Path $_ } | Select-Object -First 1; ^
    if ($null -ne $chromePath) { ^
        Write-Host \"  Chrome found: $chromePath\" -ForegroundColor DarkGray; ^
        $shortcutPath = [Environment]::GetFolderPath('Desktop') + \"\\\Bettencourt's POS.lnk\"; ^
        $lnk = $shell.CreateShortcut($shortcutPath); ^
        $lnk.TargetPath    = $chromePath; ^
        $lnk.Arguments     = \"--kiosk --kiosk-printing https://pos.bettencourtgy.com\"; ^
        $lnk.Description   = \"Bettencourt's POS - Kiosk Mode (KareTech Solutions)\"; ^
        $lnk.IconLocation  = \"$chromePath,0\"; ^
        $lnk.WorkingDirectory = Split-Path $chromePath; ^
        $lnk.Save(); ^
        Write-Host \"  Created : Bettencourt's POS.lnk on Desktop\" -ForegroundColor Green; ^
        Write-Host \"  Mode    : Chrome kiosk + silent printing\" -ForegroundColor DarkGray; ^
        $patched++ ^
    } else { ^
        Write-Host '  Chrome not found. Please install Chrome or the POS as a PWA first.' -ForegroundColor Red ^
    } ^
} ^
^
Write-Host ''; ^
Write-Host '  =======================================================' -ForegroundColor White; ^
if ($patched -gt 0) { ^
    Write-Host \"  SUCCESS: $patched shortcut(s) configured for kiosk mode.\" -ForegroundColor Green; ^
    Write-Host ''; ^
    Write-Host '  Next steps:' -ForegroundColor White; ^
    Write-Host '    1. Fully close Chrome (right-click taskbar icon -> Exit)' -ForegroundColor White; ^
    Write-Host '    2. Reopen Bettencourt''s POS from the desktop shortcut' -ForegroundColor White; ^
    Write-Host '    3. Printing will now be silent and fullscreen' -ForegroundColor White ^
} elseif ($already -gt 0) { ^
    Write-Host '  Already configured - no changes needed.' -ForegroundColor Yellow ^
} else { ^
    Write-Host '  Setup could not complete. See messages above.' -ForegroundColor Red ^
} ^
Write-Host '  =======================================================' -ForegroundColor White; ^
"

echo.
echo  =========================================================
echo   Setup complete. Press any key to close this window.
echo  =========================================================
echo.
pause >nul
