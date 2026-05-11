param(
  [string]$RepoRoot,
  [string]$InstallRoot = "C:\voicy-worker",
  [string]$SecretDir = "C:\ProgramData\Voicy\worker",
  [string]$TaskName = "VoicyWorker4070Ti",
  [string]$YarnExe = "yarn",
  [int]$RestartDelaySeconds = 10,
  [int]$FailureWindowMinutes = 10,
  [int]$MaxFailuresInWindow = 10,
  [switch]$RunAsCurrentUser,
  [switch]$Start
)

$ErrorActionPreference = "Stop"

function Require-ProcessEnv {
  param([string]$Name)

  $value = [Environment]::GetEnvironmentVariable($Name, "Process")
  if ([string]::IsNullOrWhiteSpace($value)) {
    throw "$Name must be set in this PowerShell session before installing the worker task"
  }
  return $value
}

function Optional-ProcessEnv {
  param([string]$Name)

  return [Environment]::GetEnvironmentVariable($Name, "Process")
}

if (!$RepoRoot) {
  $RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
} else {
  $RepoRoot = Resolve-Path $RepoRoot
}

$runScriptSource = Join-Path $RepoRoot "scripts\run-windows-worker.ps1"
$runScriptTarget = Join-Path $InstallRoot "run-windows-worker.ps1"
$envPath = Join-Path $SecretDir "worker.env"
$logDir = Join-Path $InstallRoot "logs"

if (!(Test-Path -LiteralPath $runScriptSource)) {
  throw "run-windows-worker.ps1 not found: $runScriptSource"
}

New-Item -ItemType Directory -Force -Path $InstallRoot, $SecretDir, $logDir | Out-Null
Copy-Item -Force -LiteralPath $runScriptSource -Destination $runScriptTarget

$envNameSet = [ordered]@{}

function Add-EnvName {
  param([string]$Name)

  if (!$envNameSet.Contains($Name)) {
    $envNameSet[$Name] = $true
  }
}

$requiredEnvNames = @(
  "VOICY_WORKER_API_URL",
  "VOICY_WORKER_TOKEN",
  "VOICY_WORKER_TRANSCRIBE_EXECUTABLE",
  "VOICY_WORKER_TRANSCRIBE_ARGS_JSON"
)

foreach ($name in $requiredEnvNames) {
  Add-EnvName -Name $name
}

foreach ($envVar in Get-ChildItem Env:) {
  $name = $envVar.Name
  if (
    $name -eq "PATH" -or
    $name -eq "NODE_ENV" -or
    $name -eq "PYTHONPATH" -or
    $name -eq "PYTHONUTF8" -or
    $name -eq "HF_HOME" -or
    $name -eq "HUGGINGFACE_HUB_CACHE" -or
    $name -eq "TRANSFORMERS_CACHE" -or
    $name.StartsWith("VOICY_") -or
    $name.StartsWith("CUDA") -or
    $name.StartsWith("CUBLAS") -or
    $name.StartsWith("CUDNN") -or
    $name.StartsWith("CT2_") -or
    $name.StartsWith("OMP_") -or
    $name.StartsWith("KMP_")
  ) {
    Add-EnvName -Name $name
  }
}

$envContent = New-Object System.Collections.Generic.List[string]
foreach ($name in $envNameSet.Keys) {
  $value = if ($name -in $requiredEnvNames) {
    Require-ProcessEnv -Name $name
  } else {
    Optional-ProcessEnv -Name $name
  }

  if (![string]::IsNullOrWhiteSpace($value)) {
    $envContent.Add("$name=$value")
  }
}

Set-Content -LiteralPath $envPath -Value $envContent -Encoding ASCII

$currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
& icacls $SecretDir /inheritance:r /grant:r "SYSTEM:(OI)(CI)F" "Administrators:(OI)(CI)F" "${currentUser}:(OI)(CI)F" | Out-Null
& icacls $envPath /inheritance:r /grant:r "SYSTEM:F" "Administrators:F" "${currentUser}:F" | Out-Null

$actionArgs = @(
  "-NoProfile",
  "-ExecutionPolicy Bypass",
  "-File `"$runScriptTarget`"",
  "-EnvPath `"$envPath`"",
  "-RepoRoot `"$RepoRoot`"",
  "-YarnExe `"$YarnExe`"",
  "-LogDir `"$logDir`"",
  "-RestartDelaySeconds $RestartDelaySeconds",
  "-FailureWindowMinutes $FailureWindowMinutes",
  "-MaxFailuresInWindow $MaxFailuresInWindow"
) -join " "

$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $actionArgs
$trigger = New-ScheduledTaskTrigger -AtStartup
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -ExecutionTimeLimit (New-TimeSpan -Days 365) `
  -RestartCount 999 `
  -RestartInterval (New-TimeSpan -Minutes 1)
$principal = if ($RunAsCurrentUser) {
  New-ScheduledTaskPrincipal -UserId $currentUser -LogonType Interactive -RunLevel Highest
} else {
  New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
}

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
Write-Host "Worker supervisor script: $runScriptTarget"
Write-Host "Worker logs: $logDir"
