param(
  [int]$Port = 8001,
  [string]$Root = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = 'Stop'
$rootPath = (Resolve-Path -LiteralPath $Root).Path.TrimEnd('\', '/')
$rootPrefix = $rootPath + [IO.Path]::DirectorySeparatorChar
$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Output "Serving $rootPath at http://localhost:$Port/ (no-cache development mode)."

$contentTypes = @{
  '.html' = 'text/html; charset=utf-8'
  '.js' = 'text/javascript; charset=utf-8'
  '.mjs' = 'text/javascript; charset=utf-8'
  '.css' = 'text/css; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.webmanifest' = 'application/manifest+json'
  '.svg' = 'image/svg+xml'
  '.png' = 'image/png'
  '.jpg' = 'image/jpeg'
  '.jpeg' = 'image/jpeg'
  '.webp' = 'image/webp'
  '.woff' = 'font/woff'
  '.woff2' = 'font/woff2'
  '.wasm' = 'application/wasm'
  '.bcmap' = 'application/octet-stream'
}

try {
  while ($listener.IsListening) {
    $context = $listener.GetContext()
    $response = $context.Response
    try {
      $response.Headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
      $response.Headers['Pragma'] = 'no-cache'
      $response.Headers['Expires'] = '0'
      if ($context.Request.HttpMethod -notin @('GET', 'HEAD')) {
        $response.StatusCode = 405
        continue
      }

      $relativePath = [Uri]::UnescapeDataString($context.Request.Url.AbsolutePath.TrimStart('/'))
      if (-not $relativePath) { $relativePath = 'index.html' }
      $filePath = [IO.Path]::GetFullPath((Join-Path $rootPath $relativePath))
      if (-not $filePath.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path -LiteralPath $filePath -PathType Leaf)) {
        $response.StatusCode = 404
        continue
      }

      $extension = [IO.Path]::GetExtension($filePath).ToLowerInvariant()
      if ($contentTypes.ContainsKey($extension)) { $response.ContentType = $contentTypes[$extension] }
      else { $response.ContentType = 'application/octet-stream' }
      $bytes = [IO.File]::ReadAllBytes($filePath)
      $response.ContentLength64 = $bytes.Length
      if ($context.Request.HttpMethod -ne 'HEAD') { $response.OutputStream.Write($bytes, 0, $bytes.Length) }
    }
    finally {
      $response.Close()
    }
  }
}
finally {
  $listener.Stop()
  $listener.Close()
}
