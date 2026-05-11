param(
  [string]$EnvPath = "C:\ProgramData\Voicy\worker\worker.env",
  [string]$RepoRoot = "C:\voicy-worker\voicy",
  [string]$YarnExe = "yarn",
  [string]$LogDir = "C:\voicy-worker\logs",
  [int]$RestartDelaySeconds = 10,
  [int]$FailureWindowMinutes = 10,
  [int]$MaxFailuresInWindow = 10
)

$ErrorActionPreference = "Stop"

function Read-VoicyEnvFile {
  param([string]$Path)

  if (!(Test-Path -LiteralPath $Path)) {
    throw "Worker env file not found: $Path"
  }

  $values = @{}
  foreach ($line in Get-Content -LiteralPath $Path) {
    $trimmed = $line.Trim()
    if (!$trimmed -or $trimmed.StartsWith("#")) {
      continue
    }

    $separator = $trimmed.IndexOf("=")
    if ($separator -lt 1) {
      continue
    }

    $key = $trimmed.Substring(0, $separator).Trim()
    $value = $trimmed.Substring($separator + 1).Trim()
    $values[$key] = $value
  }

  return $values
}

function Require-VoicyValue {
  param(
    [hashtable]$Values,
    [string]$Name
  )

  if (!$Values.ContainsKey($Name) -or [string]::IsNullOrWhiteSpace($Values[$Name])) {
    throw "$Name is required in $EnvPath"
  }

  return $Values[$Name]
}

function Write-WorkerLog {
  param([string]$Message)

  $timestamp = Get-Date -Format "yyyy-MM-ddTHH:mm:ss.fffK"
  "$timestamp $Message" | Tee-Object -FilePath $script:LogPath -Append
}

if (!(Test-Path -LiteralPath $RepoRoot)) {
  throw "Worker repo root not found: $RepoRoot"
}

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$script:LogPath = Join-Path $LogDir "worker-supervisor-$(Get-Date -Format yyyyMMdd).log"
$envValues = Read-VoicyEnvFile -Path $EnvPath

Require-VoicyValue -Values $envValues -Name "VOICY_WORKER_API_URL" | Out-Null
Require-VoicyValue -Values $envValues -Name "VOICY_WORKER_TOKEN" | Out-Null
Require-VoicyValue -Values $envValues -Name "VOICY_WORKER_TRANSCRIBE_EXECUTABLE" | Out-Null
Require-VoicyValue -Values $envValues -Name "VOICY_WORKER_TRANSCRIBE_ARGS_JSON" | Out-Null

foreach ($key in $envValues.Keys) {
  [Environment]::SetEnvironmentVariable($key, $envValues[$key], "Process")
}

Set-Location -LiteralPath $RepoRoot

$failureWindowStartedAt = Get-Date
$failuresInWindow = 0
Write-WorkerLog "Supervisor starting worker task repoRoot=$RepoRoot envPath=$EnvPath yarn=$YarnExe"

while ($true) {
  $startedAt = Get-Date
  Write-WorkerLog "Starting yarn worker:run"
  & $YarnExe worker:run *>> $script:LogPath
  $exitCode = $LASTEXITCODE
  $elapsedSeconds = [int]((Get-Date) - $startedAt).TotalSeconds

  if ($exitCode -eq 0) {
    Write-WorkerLog "Worker exited cleanly exitCode=0 elapsedSeconds=$elapsedSeconds"
    exit 0
  }

  $now = Get-Date
  if ((New-TimeSpan -Start $failureWindowStartedAt -End $now).TotalMinutes -gt $FailureWindowMinutes) {
    $failureWindowStartedAt = $now
    $failuresInWindow = 0
  }
  $failuresInWindow += 1

  Write-WorkerLog "Worker crashed exitCode=$exitCode elapsedSeconds=$elapsedSeconds failuresInWindow=$failuresInWindow maxFailuresInWindow=$MaxFailuresInWindow restartDelaySeconds=$RestartDelaySeconds"

  if ($failuresInWindow -ge $MaxFailuresInWindow) {
    Write-WorkerLog "Repeated worker failures reached threshold; continuing with restart backoff so transcription does not stop silently"
  }

  Start-Sleep -Seconds $RestartDelaySeconds
}
