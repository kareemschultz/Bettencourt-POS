@echo off
title Bettencourt's POS - Silent Print Setup
color 0A

echo.
echo  =========================================================
echo   KareTech Solutions - Bettencourt's POS Setup
echo   Silent Receipt Printing - One-Click Installer
echo  =========================================================
echo.
echo  This will automatically configure the POS shortcut
echo  for silent printing and fullscreen mode.
echo.
pause

powershell -ExecutionPolicy Bypass -Command ^
"$ErrorActionPreference = 'Stop'; ^
$appId = 'nkngegcjpmjpnokicmecbicjianljdkh'; ^
$addFlags = '--kiosk --kiosk-printing'; ^
$locations = @( ^
    [Environment]::GetFolderPath('Desktop'), ^
    [Environment]::GetFolderPath('CommonDesktopDirectory'), ^
    [Environment]::GetFolderPath('ApplicationData') + '\Microsoft\Windows\Start Menu\Programs', ^
    [Environment]::GetFolderPath('CommonApplicationData') + '\Microsoft\Windows\Start Menu\Programs', ^
    [Environment]::GetFolderPath('LocalApplicationData') + '\Microsoft\Windows\Start Menu\Programs' ^
); ^
$shell = New-Object -ComObject WScript.Shell; ^
$found = $false; ^
foreach ($loc in $locations) { ^
    if (Test-Path $loc) { ^
        Get-ChildItem -Path $loc -Filter '*.lnk' -Recurse -ErrorAction SilentlyContinue | ForEach-Object { ^
            try { ^
                $lnk = $shell.CreateShortcut($_.FullName); ^
                if ($lnk.Arguments -like \"*$appId*\") { ^
                    Write-Host \"`n  Found shortcut: $($_.Name)\" -ForegroundColor Cyan; ^
                    Write-Host \"  Current args:   $($lnk.Arguments)\" -ForegroundColor Gray; ^
                    $args = $lnk.Arguments; ^
                    if ($args -notlike '*--kiosk-printing*') { ^
                        $lnk.Arguments = \"$args $addFlags\"; ^
                        $lnk.Save(); ^
                        Write-Host \"  Updated to:     $($lnk.Arguments)\" -ForegroundColor Green; ^
                        Write-Host \"`n  Done! Shortcut patched successfully.\" -ForegroundColor Green; ^
                    } else { ^
                        Write-Host \"  Already configured - no changes needed.\" -ForegroundColor Yellow; ^
                    } ^
                    $found = $true; ^
                } ^
            } catch {} ^
        } ^
    } ^
}; ^
if (-not $found) { ^
    Write-Host \"`n  ERROR: Shortcut not found automatically.\" -ForegroundColor Red; ^
    Write-Host \"  Please follow the manual steps in the PDF guide.\" -ForegroundColor Yellow; ^
} ^
"

echo.
echo  =========================================================
echo   Next step: Close Chrome completely (right-click Chrome
echo   in the system tray at bottom-right ^> Exit), then
echo   reopen Bettencourt's POS from the desktop shortcut.
echo  =========================================================
echo.
pause
