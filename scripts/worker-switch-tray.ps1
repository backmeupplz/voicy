# Tray switch for which Voicy worker takes new jobs. While a Steam game runs,
# new jobs go to another worker; when the game exits they come back here.
# Start at logon (HKCU Run):
#   powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File <this file>
param(
  [string]$EnvPath = "C:\voicy-worker\voicy-worker.env.ps1",
  [string]$LogPath = "C:\voicy-worker\logs\switch.log"
)

$mutex = New-Object System.Threading.Mutex($false, "Local\VoicyWorkerSwitch")
if (-not $mutex.WaitOne(0)) { exit }

Add-Type -AssemblyName System.Windows.Forms, System.Drawing
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
. $EnvPath
$headers = @{ Authorization = "Bearer $env:VOICY_WORKER_TOKEN" }
$script:list = $null
$script:gaming = $false

function Invoke-Workers([string]$Activate) {
  try {
    if ($Activate) {
      $script:list = Invoke-RestMethod -Method Post -Uri "$env:VOICY_WORKER_API_URL/workers/active" `
        -Headers $headers -ContentType "application/json" -Body (@{ name = $Activate } | ConvertTo-Json) -TimeoutSec 4
    } else {
      $script:list = Invoke-RestMethod -Uri "$env:VOICY_WORKER_API_URL/workers" -Headers $headers -TimeoutSec 4
    }
  } catch {
    $script:list = $null
  }
}

function New-DotIcon([System.Drawing.Color]$Color) {
  $bitmap = New-Object System.Drawing.Bitmap 16, 16
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = "AntiAlias"
  $graphics.FillEllipse((New-Object System.Drawing.SolidBrush $Color), 2, 2, 12, 12)
  $graphics.Dispose()
  [System.Drawing.Icon]::FromHandle($bitmap.GetHicon())
}
$icons = @{
  mine = New-DotIcon ([System.Drawing.Color]::LimeGreen)
  other = New-DotIcon ([System.Drawing.Color]::DodgerBlue)
  none = New-DotIcon ([System.Drawing.Color]::OrangeRed)
}

$tray = New-Object System.Windows.Forms.NotifyIcon
$tray.ContextMenuStrip = New-Object System.Windows.Forms.ContextMenuStrip
$tray.Icon = $icons.none
$tray.Visible = $true

function Update-Tray {
  $workers = @($script:list.workers)
  # Standby workers cover only while no active worker is online.
  $working = @($workers | Where-Object { $_.online -and $_.active })
  if (-not $working.Count) { $working = @($workers | Where-Object { $_.online }) }
  if (-not $script:list) {
    $tray.Icon = $icons.none
    $status = "Voicy: backend unreachable"
  } elseif (-not $working.Count) {
    $tray.Icon = $icons.none
    $status = "Voicy: no worker online"
  } else {
    $tray.Icon = $(if (@($working.name) -contains $script:list.self) { $icons.mine } else { $icons.other })
    $status = "Voicy: " + (@($working.name) -join ", ") + " transcribing"
  }
  $tray.Text = $status.Substring(0, [Math]::Min(63, $status.Length))
}

# Built on open so the 5 s refresh never rebuilds a menu under the cursor.
$tray.ContextMenuStrip.add_Opening({
  param($sender, $e)
  $e.Cancel = $false
  $menu = $tray.ContextMenuStrip
  $menu.Items.Clear()
  $header = $menu.Items.Add($tray.Text)
  $header.Enabled = $false
  [void]$menu.Items.Add("-")
  foreach ($worker in @($script:list.workers)) {
    $label = $worker.name
    if ($worker.name -eq $script:list.self) { $label += " (this PC)" }
    if (-not $worker.online) { $label += " - offline" }
    $entry = $menu.Items.Add($label)
    $entry.Checked = [bool]$worker.active
    $entry.Tag = $worker.name
    $entry.add_Click({ param($sender) Invoke-Workers $sender.Tag; Update-Tray })
  }
  [void]$menu.Items.Add("-")
  $menu.Items.Add("Quit").add_Click({ $tray.Visible = $false; [System.Windows.Forms.Application]::Exit() })
})

$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 5000
$timer.add_Tick({
  # Steam keeps the running game's app id here (0 when none).
  $game = [int](Get-ItemProperty "HKCU:\Software\Valve\Steam" -ErrorAction SilentlyContinue).RunningAppID
  $target = $null
  if ($script:list -and [bool]$game -ne $script:gaming) {
    $self = $script:list.self
    $target = $(if ($game) {
      ($script:list.workers | Where-Object { $_.name -ne $self } | Sort-Object { -not $_.online } | Select-Object -First 1).name
    } else { $self })
  }
  Invoke-Workers $target
  if ($target -and $script:list) {
    $script:gaming = [bool]$game
    Add-Content -Path $LogPath -ErrorAction SilentlyContinue -Value "$(Get-Date -Format o) steam app $game -> $target active"
  }
  Update-Tray
})

Invoke-Workers
Update-Tray
$timer.Start()
[System.Windows.Forms.Application]::Run()
