param(
    [Parameter(Mandatory)]
    [ValidateSet('start','stop','restart')]
    [string]$Action
)

$BackendPort  = 3001
$FrontendPort = 5173
$Root         = $PSScriptRoot

function Stop-DocFlow {
    Write-Host ""
    Write-Host "  Stopping DocFlow..." -ForegroundColor Yellow
    foreach ($port in @($BackendPort, $FrontendPort)) {
        $conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
        if ($conn) {
            Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
            Write-Host "  Stopped port $port" -ForegroundColor Red
        } else {
            Write-Host "  Port $port was not running" -ForegroundColor DarkGray
        }
    }
    Write-Host ""
}

function Start-DocFlow {
    Write-Host ""
    Write-Host "  Starting DocFlow..." -ForegroundColor Green
    Start-Process cmd -ArgumentList "/k title DocFlow Backend && cd /d `"$Root\server`" && node src/index.js" -WindowStyle Normal
    Start-Process cmd -ArgumentList "/k title DocFlow Frontend && cd /d `"$Root\client`" && npm run dev"  -WindowStyle Normal
    Start-Sleep -Seconds 3
    Write-Host "  Backend  -> http://localhost:$BackendPort" -ForegroundColor Cyan
    Write-Host "  Frontend -> http://localhost:$FrontendPort" -ForegroundColor Cyan
    Write-Host ""
}

Write-Host ""
Write-Host "  DocFlow Dev Manager" -ForegroundColor Magenta

switch ($Action) {
    'start'   { Start-DocFlow }
    'stop'    { Stop-DocFlow  }
    'restart' { Stop-DocFlow; Start-Sleep -Seconds 2; Start-DocFlow }
}
