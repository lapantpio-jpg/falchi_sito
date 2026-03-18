$ErrorActionPreference = "Stop"

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$prefix = "http://localhost:43123/"

$htmlPages = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
@(
  "index.html",
  "chi-siamo.html",
  "commenti.html",
  "nodi.html",
  "legature.html",
  "costruzioni.html"
) | ForEach-Object { [void]$htmlPages.Add($_) }

$mimeTypes = @{
  ".html" = "text/html; charset=utf-8"
  ".css" = "text/css; charset=utf-8"
  ".js" = "application/javascript; charset=utf-8"
  ".png" = "image/png"
  ".jpg" = "image/jpeg"
  ".jpeg" = "image/jpeg"
  ".gif" = "image/gif"
  ".webp" = "image/webp"
  ".svg" = "image/svg+xml"
  ".ico" = "image/x-icon"
}

$allowedHtmlTargets = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
@(
  "html/index.html",
  "html/chi-siamo.html",
  "html/commenti.html",
  "html/nodi.html",
  "html/legature.html",
  "html/costruzioni.html"
) | ForEach-Object { [void]$allowedHtmlTargets.Add($_) }

function Send-Json {
  param(
    [Parameter(Mandatory = $true)] $Response,
    [Parameter(Mandatory = $true)] [int] $StatusCode,
    [Parameter(Mandatory = $true)] $Payload
  )

  $json = $Payload | ConvertTo-Json -Depth 10 -Compress
  $buffer = [System.Text.Encoding]::UTF8.GetBytes($json)
  $Response.StatusCode = $StatusCode
  $Response.ContentType = "application/json; charset=utf-8"
  $Response.ContentEncoding = [System.Text.Encoding]::UTF8
  $Response.OutputStream.Write($buffer, 0, $buffer.Length)
  $Response.Close()
}

function Get-SafeFilePath {
  param(
    [Parameter(Mandatory = $true)] [string] $UrlPath
  )

  if ($UrlPath -eq "/") {
    $relativePath = "html/index.html"
  }
  else {
    $trimmedPath = $UrlPath.TrimStart("/")
    $pageName = [System.IO.Path]::GetFileName($trimmedPath)
    if ($htmlPages.Contains($pageName) -and -not $trimmedPath.StartsWith("html/", [System.StringComparison]::OrdinalIgnoreCase)) {
      $relativePath = "html/$pageName"
    }
    else {
      $relativePath = $trimmedPath
    }
  }

  $relativePath = $relativePath -replace "/", [System.IO.Path]::DirectorySeparatorChar
  $fullPath = [System.IO.Path]::GetFullPath((Join-Path $root $relativePath))
  $rootWithSlash = [System.IO.Path]::GetFullPath($root + [System.IO.Path]::DirectorySeparatorChar)

  if (-not $fullPath.StartsWith($rootWithSlash, [System.StringComparison]::OrdinalIgnoreCase)) {
    return $null
  }

  return $fullPath
}

function Invoke-SavePage {
  param(
    [Parameter(Mandatory = $true)] $Context
  )

  try {
    $reader = New-Object System.IO.StreamReader(
      $Context.Request.InputStream,
      [System.Text.UTF8Encoding]::new($false),
      $true
    )
    $rawBody = $reader.ReadToEnd()
    $reader.Close()

    if ([string]::IsNullOrWhiteSpace($rawBody)) {
      Send-Json -Response $Context.Response -StatusCode 400 -Payload @{ error = "Body richiesta vuoto." }
      return
    }

    $body = $rawBody | ConvertFrom-Json
    $pagePath = [string]$body.pagePath
    $html = [string]$body.html

    if (-not $allowedHtmlTargets.Contains($pagePath)) {
      Send-Json -Response $Context.Response -StatusCode 400 -Payload @{ error = "File non consentito per il salvataggio." }
      return
    }

    if (-not $html.Trim().ToLowerInvariant().StartsWith("<!doctype html>")) {
      Send-Json -Response $Context.Response -StatusCode 400 -Payload @{ error = "Contenuto HTML non valido." }
      return
    }

    $targetFile = [System.IO.Path]::GetFullPath((Join-Path $root $pagePath))
    [System.IO.File]::WriteAllText(
      $targetFile,
      $html.Trim() + [Environment]::NewLine,
      [System.Text.UTF8Encoding]::new($false)
    )

    Send-Json -Response $Context.Response -StatusCode 200 -Payload @{ ok = $true; savedPath = $pagePath }
  }
  catch {
    Send-Json -Response $Context.Response -StatusCode 500 -Payload @{ error = "Errore durante il salvataggio: $($_.Exception.Message)" }
  }
}

$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add($prefix)
$listener.Start()

Write-Host "Falchi sito attivo su $prefix"

try {
  while ($listener.IsListening) {
    $context = $listener.GetContext()
    $request = $context.Request
    $response = $context.Response

    if ($request.HttpMethod -eq "POST" -and $request.Url.AbsolutePath -eq "/api/save-page") {
      Invoke-SavePage -Context $context
      continue
    }

    if ($request.HttpMethod -ne "GET") {
      Send-Json -Response $response -StatusCode 405 -Payload @{ error = "Metodo non supportato." }
      continue
    }

    $filePath = Get-SafeFilePath -UrlPath $request.Url.AbsolutePath
    if (-not $filePath) {
      Send-Json -Response $response -StatusCode 400 -Payload @{ error = "Percorso non valido." }
      continue
    }

    if (-not (Test-Path -LiteralPath $filePath -PathType Leaf)) {
      Send-Json -Response $response -StatusCode 404 -Payload @{ error = "Risorsa non trovata." }
      continue
    }

    $extension = [System.IO.Path]::GetExtension($filePath).ToLowerInvariant()
    $contentType = if ($mimeTypes.ContainsKey($extension)) { $mimeTypes[$extension] } else { "application/octet-stream" }
    $bytes = [System.IO.File]::ReadAllBytes($filePath)

    $response.StatusCode = 200
    $response.ContentType = $contentType
    $response.ContentLength64 = $bytes.Length
    $response.OutputStream.Write($bytes, 0, $bytes.Length)
    $response.Close()
  }
}
finally {
  if ($listener.IsListening) {
    $listener.Stop()
  }
  $listener.Close()
}