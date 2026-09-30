<#
    Fix_ProRigs_Trust.ps1

    Prepares a lab machine so the ProRigs licence plug-in loads correctly for
    every student. Pair with the updated launcher.py, which is what actually
    loads the plug-in at OPEN time (from the trusted path this script sets up).

    WHAT IT DOES  (all machine-wide, all reversible)
      1. Repairs C:\Cincy\MayaApp\<year>\prefs\pluginPrefs.mel if an earlier
         version of this fix appended a broken "PRLicensePlugin" line.
      2. Removes STALE PRLicensePlugin.mll copies from the folders on
         MAYA_PLUG_IN_PATH (C:\Cincy\plug-ins, C:\Cincy\MayaApp\<year>\plug-ins).
         Old machines have a copy there built for a different Maya year; Maya
         finds it by name before the good one and dies with "specified
         procedure could not be found".
      3. Copies the CURRENT PRLicensePlugin.mll from
             C:\ProgramData\ProRigs\maya\<year>\plug-ins\
         into  <MayaInstall>\bin\plug-ins\  -- a location Maya trusts by
         default (no Secure Plugin Loading prompt) and the exact path
         launcher.py loads.
      4. Removes any PRLicensePlugin load line an earlier version of this fix
         added to userSetup.mel (that approach fought Maya's Safe Mode hash
         check; launcher.py handles the load now).

    DOES NOT TOUCH: C:\ProgramData\ProRigs\ (licence, machine ID, config),
    the ProRigs.mod files, or any Maya file other than the added .mll.

    IMPORTANT: also delete the stale plug-in from the DEPLOY SHARE
        \\artscifs1.ad.uc.edu\Departments\GAA\UC_GAA\plug-ins\PRLicensePlugin.mll
    or the installer's /MIR copy will put it back on every machine. This
    script cannot do that for you (it may not have write access to the share);
    it only reports whether the share copy is present.

    USAGE:  right-click Fix_ProRigs_Trust.bat -> Run as administrator
    Safe to re-run.
#>

$ErrorActionPreference = 'Stop'
$years    = 2024,2025,2026,2027
$progData = Join-Path $env:ProgramData 'ProRigs\maya'
$didWork  = $false
$errors   = @()

function Write-Step($msg) { Write-Host "  $msg" }

Write-Host ""
Write-Host " ProRigs plug-in fix"
Write-Host " ==================="
Write-Host ""

if (-not (Test-Path $progData)) {
    Write-Host " ERROR: $progData not found."
    Write-Host " Run the ProRigs lab installer on this machine first, then re-run this."
    Read-Host " Press Enter to close"
    exit 1
}

# --- Global: clear stale PRLicensePlugin.mll off the plug-in search path -----
$staleDirs = @('C:\Cincy\plug-ins') + ($years | ForEach-Object { "C:\Cincy\MayaApp\$_\plug-ins" })
foreach ($d in $staleDirs) {
    $stale = Join-Path $d 'PRLicensePlugin.mll'
    if (Test-Path $stale) {
        try {
            Remove-Item -LiteralPath $stale -Force
            Write-Host " [stale] removed $stale"
            $didWork = $true
        } catch {
            $errors += "could not remove $stale : $_"
            Write-Host " [stale] *** ERROR removing $stale : $_"
        }
    }
}
$share = '\\artscifs1.ad.uc.edu\Departments\GAA\UC_GAA\plug-ins\PRLicensePlugin.mll'
if (Test-Path $share) {
    Write-Host ""
    Write-Host " *** ACTION NEEDED: a stale PRLicensePlugin.mll is on the deploy share:"
    Write-Host "       $share"
    Write-Host "     Delete it there too, or the installer's /MIR will restore it."
}
Write-Host ""

foreach ($year in $years) {

    $srcMll = Join-Path $progData "$year\plug-ins\PRLicensePlugin.mll"
    if (-not (Test-Path $srcMll)) { continue }   # ProRigs not installed for this year

    Write-Host " [$year]"

    # --- 1. Repair a mangled pluginPrefs.mel -------------------------------
    $prefs = "C:\Cincy\MayaApp\$year\prefs\pluginPrefs.mel"
    if (Test-Path $prefs) {
        $lines = Get-Content -LiteralPath $prefs
        $bad   = $lines | Where-Object { $_ -match 'PRLicensePlugin' }
        if ($bad) {
            try { attrib -R $prefs 2>$null } catch {}
            Set-Content -LiteralPath $prefs -Value ($lines | Where-Object { $_ -notmatch 'PRLicensePlugin' }) -Encoding Ascii
            Write-Step "repaired pluginPrefs.mel (removed $($bad.Count) line(s))"
            $didWork = $true
        }
    }

    # --- 2. Undo the old userSetup.mel edit ------------------------------
    $uset = "C:\Cincy\MayaApp\$year\scripts\userSetup.mel"
    if ((Test-Path $uset) -and (Select-String -LiteralPath $uset -Pattern 'PRLicensePlugin' -Quiet)) {
        try { attrib -R $uset 2>$null } catch {}
        $keep = Get-Content -LiteralPath $uset | Where-Object { $_ -notmatch 'PRLicensePlugin' -and $_ -notmatch 'ProRigs licence plug-in' }
        Set-Content -LiteralPath $uset -Value $keep -Encoding Ascii
        Write-Step "removed the old PRLicensePlugin load from userSetup.mel (launcher.py does it now)"
        $didWork = $true
    }

    # --- 3. Locate Maya and copy the plug-in into the trusted folder -----
    $key = "HKLM:\SOFTWARE\Autodesk\Maya\$year\Setup\InstallPath"
    $mayaDir = $null
    if (Test-Path $key) {
        $mayaDir = (Get-ItemProperty -Path $key -Name 'MAYA_INSTALL_LOCATION' -ErrorAction SilentlyContinue).MAYA_INSTALL_LOCATION
    }
    if (-not $mayaDir -or -not (Test-Path (Join-Path $mayaDir 'bin\maya.exe'))) {
        Write-Step "ProRigs plug-in present but Maya $year is not installed/registered - skipping"
        continue
    }

    $destDir = Join-Path $mayaDir 'bin\plug-ins'
    if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir | Out-Null }
    $destMll = Join-Path $destDir 'PRLicensePlugin.mll'

    $copy = $true
    if (Test-Path $destMll) {
        $copy = (Get-Item $srcMll).LastWriteTimeUtc -gt (Get-Item $destMll).LastWriteTimeUtc
    }
    if ($copy) {
        try {
            Copy-Item -LiteralPath $srcMll -Destination $destMll -Force
            Write-Step "copied current PRLicensePlugin.mll -> $destDir"
            $didWork = $true
        } catch {
            $errors += "[$year] copy to $destDir failed: $_"
            Write-Step "*** ERROR copying to $destDir : $_"
        }
    } else {
        Write-Step "trusted copy already up to date ($destMll)"
    }
}

Write-Host ""
if ($errors.Count) {
    Write-Host " FINISHED WITH PROBLEMS:"
    $errors | ForEach-Object { Write-Host "   - $_" }
} elseif ($didWork) {
    Write-Host " Done. Deploy the updated launcher.py to C:\Cincy\scripts\, then have a"
    Write-Host " student log in fresh and click OPEN. Check C:\Cincy\logs\launcher_log.txt"
    Write-Host " and that a ProRigs rig loads live."
} else {
    Write-Host " Nothing needed changing."
}
Write-Host ""
Read-Host " Press Enter to close"
