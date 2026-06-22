param([string]$InstallDir = "C:\myapp\obs-bridge")

# stop background pythonw for this venv
Get-Process pythonw -ErrorAction SilentlyContinue | Where-Object {
  $_.Path -like "$InstallDir\venv\Scripts\pythonw.exe"
} | Stop-Process -Force -ErrorAction SilentlyContinue

# remove files
Remove-Item -Recurse -Force $InstallDir

# remove desktop shortcut
$shortcut = Join-Path ([Environment]::GetFolderPath('Desktop')) "Start OBS Bridge.lnk"
if (Test-Path $shortcut) { Remove-Item $shortcut -Force }

Write-Host "OBS Bridge uninstalled." -ForegroundColor Green
