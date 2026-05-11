param(
  [Parameter(Mandatory = $true)]
  [string]$WorkerApiUrl,

  [Parameter(Mandatory = $true)]
  [string]$WorkerToken,

  [Parameter(Mandatory = $true)]
  [string]$TranscribeExecutable,

  [Parameter(Mandatory = $true)]
  [string]$TranscribeArgsJson,

  [string]$AppRoot = "C:\voicy-worker\app",
  [string]$InstallRoot = "C:\voicy-worker\worker",
  [string]$SecretDir = "C:\ProgramData\Voicy\worker",
  [string]$TaskName = "VoicyWorker4070Ti",
  [string]$YarnCommand = "yarn.cmd",
  [string]$WorkDir = "C:\voicy-worker\jobs",
  [string]$LogDir = "C:\voicy-worker\logs",
  [string]$Engine = "faster-whisper",
  [string]$Model = "large-v3",
  [string]$TelegramBotApiUrl = "http://127.0.0.1:8081",
  [string]$TelegramBotToken,
  [int]$PollIntervalMs = 5000,
  [int]$HeartbeatIntervalMs = 30000,
  [int]$DownloadConcurrency = 2,
  [int]$TranscriptionConcurrency = 1,
  [switch]$Start
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$runScriptSource = Join-Path $repoRoot "scripts\run-windows-worker.ps1"
$runScriptTarget = Join-Path $InstallRoot "run-windows-worker.ps1"
$envPath = Join-Path $SecretDir "worker.env"

if (!(Test-Path -LiteralPath $AppRoot)) {
  throw "Worker app root not found: $AppRoot"
}

if (!(Test-Path -LiteralPath $TranscribeExecutable)) {
  throw "Transcription executable not found: $TranscribeExecutable"
}

$parsedArgs = $TranscribeArgsJson | ConvertFrom-Json
if (!($parsedArgs -is [array]) -or ($parsedArgs | Where-Object { $_ -isnot [string] })) {
  throw "TranscribeArgsJson must be a JSON array of strings"
}

New-Item -ItemType Directory -Force -Path $InstallRoot, $SecretDir, $WorkDir, $LogDir | Out-Null
Copy-Item -Force -LiteralPath $runScriptSource -Destination $runScriptTarget

$envContent = @(
  "VOICY_WORKER_APP_ROOT=$AppRoot",
  "VOICY_WORKER_YARN_COMMAND=$YarnCommand",
  "VOICY_WORKER_API_URL=$WorkerApiUrl",
  "VOICY_WORKER_TOKEN=$WorkerToken",
  "VOICY_WORKER_WORK_DIR=$WorkDir",
  "VOICY_WORKER_LOG_DIR=$LogDir",
  "VOICY_WORKER_ENGINE=$Engine",
  "VOICY_WORKER_MODEL=$Model",
  "VOICY_WORKER_HEARTBEAT_INTERVAL_MS=$HeartbeatIntervalMs",
  "VOICY_WORKER_POLL_INTERVAL_MS=$PollIntervalMs",
  "VOICY_WORKER_TELEGRAM_API_URL=$TelegramBotApiUrl",
  "VOICY_WORKER_DOWNLOAD_CONCURRENCY=$DownloadConcurrency",
  "VOICY_WORKER_TRANSCRIPTION_CONCURRENCY=$TranscriptionConcurrency",
  "VOICY_WORKER_TRANSCRIBE_EXECUTABLE=$TranscribeExecutable",
  "VOICY_WORKER_TRANSCRIBE_ARGS_JSON=$TranscribeArgsJson"
)

if ($TelegramBotToken) {
  $envContent += "VOICY_WORKER_TELEGRAM_BOT_TOKEN=$TelegramBotToken"
}

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
  -MultipleInstances IgnoreNew `
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
Write-Host "Worker env file: $envPath"
Write-Host "Worker logs: $LogDir"
Write-Host "The task restarts the worker after crashes and records wrapper start/exit lines in the daily worker log."
