$ErrorActionPreference = "Stop"

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$serverScript = Join-Path $scriptRoot "server.ps1"
$url = "http://localhost:43123/"
$port = 43123
$hostName = "localhost"

function Test-ServerReady {
  param(
    [Parameter(Mandatory = $true)] [string] $TargetHost,
    [Parameter(Mandatory = $true)] [int] $TargetPort
  )

  try {
    $client = [System.Net.Sockets.TcpClient]::new()
    $asyncResult = $client.BeginConnect($TargetHost, $TargetPort, $null, $null)
    $connected = $asyncResult.AsyncWaitHandle.WaitOne(250)

    if (-not $connected) {
      $client.Close()
      return $false
    }

    $client.EndConnect($asyncResult)
    $client.Close()
    return $true
  }
  catch {
    return $false
  }
}

if (-not (Test-ServerReady -TargetHost $hostName -TargetPort $port)) {
  Start-Process -FilePath "powershell.exe" -WindowStyle Hidden -ArgumentList @(
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-File", ('"{0}"' -f $serverScript)
  )

  for ($i = 0; $i -lt 40; $i++) {
    if (Test-ServerReady -TargetHost $hostName -TargetPort $port) {
      break
    }
    Start-Sleep -Milliseconds 250
  }
}

Start-Process $url
