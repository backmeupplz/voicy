param(
  [Parameter(Mandatory = $true)]
  [string]$TelegramBotApiExe,

  [Parameter(Mandatory = $true)]
  [string]$ApiId,

  [Parameter(Mandatory = $true)]
  [string]$ApiHash,

  [string]$InstallRoot = "C:\voicy-worker\telegram-bot-api",
  [string]$SecretDir = "C:\ProgramData\Voicy\telegram-bot-api",
  [string]$TaskName = "VoicyLocalTelegramBotApi",
  [int]$Port = 8081,
  [string]$HttpIp = "127.0.0.1",
  [switch]$Start
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$runScriptSource = Join-Path $repoRoot "scripts\run-windows-telegram-bot-api.ps1"
$runScriptTarget = Join-Path $InstallRoot "run-windows-telegram-bot-api.ps1"
$envPath = Join-Path $SecretDir "telegram-bot-api.env"
$dataDir = Join-Path $InstallRoot "data"
$tempDir = Join-Path $InstallRoot "temp"

if (!(Test-Path -LiteralPath $TelegramBotApiExe)) {
  throw "telegram-bot-api executable not found: $TelegramBotApiExe"
}

New-Item -ItemType Directory -Force -Path $InstallRoot, $SecretDir, $dataDir, $tempDir | Out-Null
Copy-Item -Force -LiteralPath $runScriptSource -Destination $runScriptTarget

$envContent = @(
  "TELEGRAM_BOT_API_EXE=$TelegramBotApiExe",
  "TELEGRAM_API_ID=$ApiId",
  "TELEGRAM_API_HASH=$ApiHash",
  "TELEGRAM_BOT_API_DIR=$dataDir",
  "TELEGRAM_BOT_API_TEMP_DIR=$tempDir",
  "TELEGRAM_BOT_API_HTTP_IP=$HttpIp",
  "TELEGRAM_BOT_API_HTTP_PORT=$Port"
)

Set-Content -LiteralPath $envPath -Value $envContent -Encoding ASCII

$currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
& icacls $SecretDir /inheritance:r /grant:r "SYSTEM:(OI)(CI)F" "Administrators:(OI)(CI)F" "${currentUser}:(OI)(CI)F" | Out-Null
& icacls $envPath /inheritance:r /grant:r "SYSTEM:F" "Administrators:F" "${currentUser}:F" | Out-Null

$actionArgs = "-NoProfile -ExecutionPolicy Bypass -File `"$runScriptTarget`" -EnvPath `"$envPath`""
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $actionArgs
$trigger = New-ScheduledTaskTrigger -AtStartup
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -ExecutionTimeLimit (New-TimeSpan -Days 365) `
  -RestartCount 999 `
  -RestartInterval (New-TimeSpan -Minutes 1)
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Principal $principal `
  -Force | Out-Null

if ($Start) {
  Start-ScheduledTask -TaskName $TaskName
}

Write-Host "Installed scheduled task: $TaskName"
Write-Host "Secret env file: $envPath"
Write-Host "Local Bot API URL for the worker: http://$HttpIp`:$Port"
Write-Host "Set VOICY_WORKER_TELEGRAM_API_URL=http://$HttpIp`:$Port on the Windows worker."
