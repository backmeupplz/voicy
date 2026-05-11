param(
  [string]$EnvPath = "C:\ProgramData\Voicy\worker\worker.env"
)

$ErrorActionPreference = "Stop"

function Write-VoicyWorkerLog {
  param(
    [string]$LogPath,
    [string]$Message
  )

  $timestamp = Get-Date -Format "yyyy-MM-ddTHH:mm:ss.fffK"
  "$timestamp $Message" | Out-File -LiteralPath $LogPath -Append -Encoding utf8
}

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

$envValues = Read-VoicyEnvFile -Path $EnvPath
$appRoot = Require-VoicyValue -Values $envValues -Name "VOICY_WORKER_APP_ROOT"
$yarnCommand = if ($envValues["VOICY_WORKER_YARN_COMMAND"]) { $envValues["VOICY_WORKER_YARN_COMMAND"] } else { "yarn.cmd" }
$logDir = if ($envValues["VOICY_WORKER_LOG_DIR"]) { $envValues["VOICY_WORKER_LOG_DIR"] } else { "C:\voicy-worker\logs" }
$logPath = Join-Path $logDir ("worker-{0}.log" -f (Get-Date -Format yyyyMMdd))

if (!(Test-Path -LiteralPath $appRoot)) {
  throw "Worker app root not found: $appRoot"
}

New-Item -ItemType Directory -Force -Path $logDir | Out-Null

foreach ($entry in $envValues.GetEnumerator()) {
  if ($entry.Key.StartsWith("VOICY_") -or $entry.Key -eq "TOKEN") {
    [Environment]::SetEnvironmentVariable($entry.Key, $entry.Value, "Process")
  }
}

try {
  Set-Location -LiteralPath $appRoot
  Write-VoicyWorkerLog -LogPath $logPath -Message "Voicy worker wrapper starting appRoot=`"$appRoot`""
  & $yarnCommand worker:run *>> $logPath
  $exitCode = if ($LASTEXITCODE -ne $null) { $LASTEXITCODE } else { 0 }
  Write-VoicyWorkerLog -LogPath $logPath -Message "Voicy worker wrapper exited exitCode=$exitCode"
  exit $exitCode
} catch {
  Write-VoicyWorkerLog -LogPath $logPath -Message ("Voicy worker wrapper crashed error=" + $_.Exception.Message)
  exit 1
}
