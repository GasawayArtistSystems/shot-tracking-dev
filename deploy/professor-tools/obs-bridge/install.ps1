param(
  # Fixed install location for consistency across machines:
  [string]$InstallDir = "C:\Cincy\obs-bridge",
  [string]$PythonExe  = ""
)

Write-Host "Installing OBS Bridge to $InstallDir" -ForegroundColor Cyan

# --- Ask where to save Reviews ---
Add-Type -AssemblyName System.Windows.Forms
$defaultReviews = Join-Path $env:USERPROFILE "Videos\Reviews"
$dlg = New-Object System.Windows.Forms.FolderBrowserDialog
$dlg.Description  = "Choose the folder where review videos will be saved"
$dlg.ShowNewFolderButton = $true
$dlg.SelectedPath = $defaultReviews

$reviewsRoot = $null
if ($dlg.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
  $reviewsRoot = $dlg.SelectedPath
} else {
  Write-Host "No folder selected. Using default: $defaultReviews" -ForegroundColor Yellow
  $reviewsRoot = $defaultReviews
}

# Ensure Reviews folder exists and is writable
try {
  New-Item -ItemType Directory -Force -Path $reviewsRoot | Out-Null
  $testPath = Join-Path $reviewsRoot ".write_test"
  Set-Content -Path $testPath -Value "ok" -ErrorAction Stop
  Remove-Item $testPath -Force -ErrorAction Stop
} catch {
  throw "Cannot write to '$reviewsRoot'. Choose a writable folder (local drive or reachable network share) and run again."
}

# --- Optional: ask for OBS password and Bridge port (defaults provided) ---
$obsPassword = Read-Host "Enter OBS WebSocket password [`changeme` default]" 
if ([string]::IsNullOrWhiteSpace($obsPassword)) { $obsPassword = "changeme" }

$bridgePort = Read-Host "Enter Bridge port [`5001` default]" 
if (-not [int]::TryParse($bridgePort, [ref]([int]$null))) { $bridgePort = "5001" }

# --- Create install dir (fixed path) ---
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null

# --- Copy files from this script folder ---
Copy-Item -Path "$PSScriptRoot\obs_bridge.py","$PSScriptRoot\requirements.txt" -Destination $InstallDir -Force

# --- Find Python (PS5-safe) ---
if (-not $PythonExe) {
  $cmd = Get-Command python.exe -ErrorAction SilentlyContinue
  if ($cmd) {
    $PythonExe = $cmd.Source
  } else {
    $pyLauncher = Get-Command py.exe -ErrorAction SilentlyContinue
    if ($pyLauncher) {
      try {
        $ver = & py -3 -c "import sys;print(sys.executable)" 2>$null
        if ($LASTEXITCODE -eq 0 -and $ver) { $PythonExe = $ver.Trim() }
      } catch {}
    }
    if (-not $PythonExe) {
      throw "Python not found. Please install Python 3.11+ (or ensure 'python' is on PATH) and re-run."
    }
  }
}

# --- Create venv & install deps ---
& $PythonExe -m venv "$InstallDir\venv"
& "$InstallDir\venv\Scripts\python.exe" -m pip install --upgrade pip
& "$InstallDir\venv\Scripts\pip.exe" install -r "$InstallDir\requirements.txt"

# --- Write config.json using chosen inputs ---
$config = @{
  OBS_HOST     = "127.0.0.1"
  OBS_PORT     = 4455
  OBS_PASSWORD = $obsPassword
  BRIDGE_HOST  = "127.0.0.1"  # local-only to avoid firewall prompts
  BRIDGE_PORT  = [int]$bridgePort
  REVIEWS_ROOT = $reviewsRoot
}
($config | ConvertTo-Json -Depth 4) | Set-Content -Path (Join-Path $InstallDir "config.json") -Encoding UTF8
Write-Host ("Wrote config.json → {0}" -f (Join-Path $InstallDir "config.json")) -ForegroundColor Green

# --- Create Desktop shortcut to start the bridge ---
$WScriptShell = New-Object -ComObject WScript.Shell
$Shortcut = $WScriptShell.CreateShortcut("$([Environment]::GetFolderPath('Desktop'))\Start OBS Bridge.lnk")
$Shortcut.TargetPath = "$InstallDir\venv\Scripts\pythonw.exe"
$Shortcut.Arguments  = "`"$InstallDir\obs_bridge.py`""
$Shortcut.WorkingDirectory = $InstallDir
$Shortcut.IconLocation = "shell32.dll, 24"
$Shortcut.Save()

Write-Host "Done." -ForegroundColor Green
Write-Host "→ Start the bridge via Desktop shortcut: 'Start OBS Bridge'." -ForegroundColor Green
Write-Host "→ Reviews will save under: $reviewsRoot\YYYY-MM-DD" -ForegroundColor Green
Write-Host "→ In OBS: Tools > WebSocket Server Settings > set Password to '$obsPassword' (or edit config.json)." -ForegroundColor Yellow
