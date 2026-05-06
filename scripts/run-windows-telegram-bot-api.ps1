param(
  [string]$EnvPath = "C:\ProgramData\Voicy\telegram-bot-api\telegram-bot-api.env"
)

$ErrorActionPreference = "Stop"

function Read-VoicyEnvFile {
  param([string]$Path)

  if (!(Test-Path -LiteralPath $Path)) {
    throw "Telegram Bot API env file not found: $Path"
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
$exePath = Require-VoicyValue -Values $envValues -Name "TELEGRAM_BOT_API_EXE"
$apiId = Require-VoicyValue -Values $envValues -Name "TELEGRAM_API_ID"
$apiHash = Require-VoicyValue -Values $envValues -Name "TELEGRAM_API_HASH"
$dataDir = $envValues["TELEGRAM_BOT_API_DIR"]
$tempDir = $envValues["TELEGRAM_BOT_API_TEMP_DIR"]
$httpIp = if ($envValues["TELEGRAM_BOT_API_HTTP_IP"]) { $envValues["TELEGRAM_BOT_API_HTTP_IP"] } else { "127.0.0.1" }
$httpPort = if ($envValues["TELEGRAM_BOT_API_HTTP_PORT"]) { $envValues["TELEGRAM_BOT_API_HTTP_PORT"] } else { "8081" }

if (!(Test-Path -LiteralPath $exePath)) {
  throw "telegram-bot-api executable not found: $exePath"
}

if ($dataDir) {
  New-Item -ItemType Directory -Force -Path $dataDir | Out-Null
}
if ($tempDir) {
  New-Item -ItemType Directory -Force -Path $tempDir | Out-Null
}

$arguments = @(
  "--api-id=$apiId",
  "--api-hash=$apiHash",
  "--local",
  "--http-ip-address=$httpIp",
  "--http-port=$httpPort"
)

if ($dataDir) {
  $arguments += "--dir=$dataDir"
}
if ($tempDir) {
  $arguments += "--temp-dir=$tempDir"
}

Write-Host "Starting local Telegram Bot API on http://$httpIp`:$httpPort"
& $exePath @arguments
exit $LASTEXITCODE
