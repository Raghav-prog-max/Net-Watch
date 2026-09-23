# =============================================================================
# setup.ps1  –  Bootstrap the NetWatch Python virtual environment (Windows)
# Usage (from repo root, in PowerShell):
#   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
#   .\setup.ps1
# =============================================================================
param(
    [string]$Python = "python"
)

$VenvDir = ".venv"
$ErrorActionPreference = "Stop"

Write-Host "==> Checking Python version ..." -ForegroundColor Cyan
& $Python --version

Write-Host "==> Creating virtual environment in $VenvDir ..." -ForegroundColor Cyan
& $Python -m venv $VenvDir

Write-Host "==> Upgrading pip / setuptools / wheel ..." -ForegroundColor Cyan
& "$VenvDir\Scripts\python.exe" -m pip install --upgrade pip setuptools wheel

Write-Host "==> Installing project requirements ..." -ForegroundColor Cyan
& "$VenvDir\Scripts\pip.exe" install -r requirements.txt

Write-Host ""
Write-Host "✅  Environment ready." -ForegroundColor Green
Write-Host "   Activate with:  .\.venv\Scripts\Activate.ps1"
Write-Host "   Or run scripts with:  .\run.ps1 <command>"
