# =============================================================================
# run.ps1  –  Run any NetWatch command inside the .venv (Windows PowerShell)
# Usage:
#   .\run.ps1 ml\train.py
#   .\run.ps1 -m pytest tests\
# =============================================================================
param(
    [Parameter(Position=0, ValueFromRemainingArguments=$true)]
    [string[]]$Args
)

$VenvDir   = ".venv"
$VenvPy    = "$VenvDir\Scripts\python.exe"
$ErrorActionPreference = "Stop"

if (-not (Test-Path $VenvPy)) {
    Write-Error "Virtual environment not found. Run: .\setup.ps1"
    exit 1
}

# Forward all arguments directly to venv python
& $VenvPy @Args
