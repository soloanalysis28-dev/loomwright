param(
  [int]$Port = 8001,
  [string]$Root = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = 'Stop'
$python = Get-Command python -ErrorAction SilentlyContinue
if (-not $python) { $python = Get-Command python3 -ErrorAction SilentlyContinue }
if (-not $python) { throw 'Python 3 is required to start Loomwright.' }

$rootPath = (Resolve-Path -LiteralPath $Root).Path
$sharedPort = if ($Port -eq 8000) { 8001 } else { 8000 }
& $python.Source (Join-Path $PSScriptRoot 'serve-local.py') --port $Port --also-port $sharedPort --root $rootPath
if ($LASTEXITCODE -ne 0) { throw 'The Loomwright server stopped with an error.' }
