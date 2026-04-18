@echo off
title Bettencourt's POS - Terminal Setup  (KareTech Solutions)
color 0A
setlocal

:: ── Self-elevate to Administrator ────────────────────────────────────────
:: Uses /k so the elevated window stays open after the script finishes.
:: fltmc is a reliable elevation check (net session can be blocked by policy).
fltmc >nul 2>&1
if %errorLevel% neq 0 (
    echo.
    echo  Requesting administrator privileges...
    echo  Please click YES on the UAC prompt.
    echo.
    powershell -WindowStyle Normal -Command "Start-Process cmd -ArgumentList '/k \"\"%~f0\"\"' -Verb RunAs"
    exit /b
)

echo.
echo  =========================================================
echo   KareTech Solutions
echo   Bettencourt's POS  -  Terminal Setup v3
echo   Silent Printing + Fullscreen Kiosk
echo  =========================================================
echo.
echo  Running as administrator...
echo.

powershell -ExecutionPolicy Bypass -NonInteractive -Command ^
"$ErrorActionPreference = 'Continue'; ^
^
$pwaAppId   = 'nkngegcjpmjpnokicmecbicjianljdkh'; ^
$posUrl     = 'https://pos.bettencourtgy.com'; ^
$posUrls    = @('pos.bettencourtgy.com', 'pos.karetechsolutions.com'); ^
$kioskFlags = '--kiosk --kiosk-printing'; ^
^
$chromePaths = @( ^
    \"$env:PROGRAMFILES\Google\Chrome\Application\chrome.exe\", ^
    \"${env:PROGRAMFILES(X86)}\Google\Chrome\Application\chrome.exe\", ^
    \"$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe\" ^
); ^
^
$searchPaths = @( ^
    [Environment]::GetFolderPath('Desktop'), ^
    [Environment]::GetFolderPath('CommonDesktopDirectory'), ^
    [Environment]::GetFolderPath('ApplicationData')        + '\Microsoft\Windows\Start Menu\Programs', ^
    [Environment]::GetFolderPath('CommonApplicationData')  + '\Microsoft\Windows\Start Menu\Programs', ^
    [Environment]::GetFolderPath('LocalApplicationData')   + '\Microsoft\Windows\Start Menu\Programs' ^
); ^
^
$shell   = New-Object -ComObject WScript.Shell; ^
$patched = 0; ^
$already = 0; ^
^
Write-Host '  Step 1: Scanning for existing POS shortcuts...' -ForegroundColor White; ^
Write-Host ''; ^
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
            if ($args -like '*--kiosk*') { ^
                Write-Host \"  Status: Already configured\" -ForegroundColor Yellow; ^
                $already++; Write-Host ''; return ^
            } ^
            if ($isPwa) { ^
                $lnk.Arguments = \"$args $kioskFlags\" ^
            } else { ^
                $lnk.Arguments = \"$kioskFlags $args\" ^
            } ^
            $lnk.Save(); ^
            Write-Host \"  Status: Patched OK\" -ForegroundColor Green; ^
            $patched++; Write-Host '' ^
        } catch { ^
            Write-Host \"  Warning: Could not update $($_.Name)\" -ForegroundColor DarkYellow ^
        } ^
    } ^
} ^
^
if ($patched -eq 0 -and $already -eq 0) { ^
    Write-Host '  No existing POS shortcut found.' -ForegroundColor Yellow; ^
    Write-Host '  Creating PWA kiosk shortcut on Desktop...' -ForegroundColor Cyan; ^
    $chromePath = $chromePaths | Where-Object { Test-Path $_ } | Select-Object -First 1; ^
    if ($null -ne $chromePath) { ^
        $shortcutPath = [Environment]::GetFolderPath('Desktop') + \"\\\Bettencourt's POS.lnk\"; ^
        $lnk = $shell.CreateShortcut($shortcutPath); ^
        $lnk.TargetPath       = $chromePath; ^
        $lnk.Arguments        = \"$kioskFlags --app-id=$pwaAppId\"; ^
        $lnk.Description      = \"Bettencourt's POS - Kiosk Mode (KareTech Solutions)\"; ^
        $lnk.IconLocation     = \"$chromePath,0\"; ^
        $lnk.WorkingDirectory = Split-Path $chromePath; ^
        $lnk.Save(); ^
        Write-Host \"  Created: Bettencourt's POS.lnk on Desktop\" -ForegroundColor Green; ^
        Write-Host \"  Flags  : $kioskFlags --app-id=$pwaAppId\" -ForegroundColor DarkGray; ^
        $patched++ ^
    } else { ^
        Write-Host '  ERROR: Chrome not found. Install Chrome first.' -ForegroundColor Red ^
    } ^
} ^
^
Write-Host ''; ^
Write-Host '  Step 2: Setting Windows taskbar to auto-hide...' -ForegroundColor White; ^
try { ^
    $regPath  = 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\StuckRects3'; ^
    $settings = (Get-ItemProperty -Path $regPath -ErrorAction Stop).Settings; ^
    if ($settings[8] -ne 3) { ^
        $settings[8] = 3; ^
        Set-ItemProperty -Path $regPath -Name Settings -Value $settings; ^
        Stop-Process -Name explorer -Force -ErrorAction SilentlyContinue; ^
        Start-Sleep -Milliseconds 1500; ^
        Start-Process explorer; ^
        Write-Host '  Taskbar auto-hide enabled (Explorer restarted)' -ForegroundColor Green ^
    } else { ^
        Write-Host '  Taskbar auto-hide already enabled' -ForegroundColor Yellow ^
    } ^
} catch { ^
    Write-Host '  Could not set taskbar auto-hide (non-critical)' -ForegroundColor DarkYellow ^
} ^
^
Write-Host ''; ^
Write-Host '  =======================================================' -ForegroundColor White; ^
if ($patched -gt 0) { ^
    Write-Host \"  SUCCESS: $patched shortcut(s) configured for kiosk mode\" -ForegroundColor Green; ^
    Write-Host ''; ^
    Write-Host '  NEXT STEPS:' -ForegroundColor White; ^
    Write-Host '    1. Fully close Chrome (right-click taskbar icon -> Exit)' -ForegroundColor White; ^
    Write-Host '    2. Open POS from the Desktop shortcut (NOT from Chrome)' -ForegroundColor White; ^
    Write-Host '    3. Printing will now be silent and fullscreen' -ForegroundColor White ^
} elseif ($already -gt 0) { ^
    Write-Host '  Already configured - no changes needed.' -ForegroundColor Yellow ^
} else { ^
    Write-Host '  Setup could not complete. See messages above.' -ForegroundColor Red ^
} ^
Write-Host '  =======================================================' -ForegroundColor White; ^
"

echo.
color 2F
echo  =========================================================
echo   Setup complete. Press any key to close this window.
echo  =========================================================
echo.
pause
