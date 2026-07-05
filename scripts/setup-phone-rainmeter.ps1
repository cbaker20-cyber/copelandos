param(
  [string]$CopelandUrl = "https://copelandos.copelandbaker20.workers.dev/console"
)

# CopelandOS phone + Rainmeter bridge.
# Low CPU: static Rainmeter controls only. No animated wallpaper, no polling loop faster than 60s.

$ErrorActionPreference = "Continue"
$Root = "C:\AI\Ops\rainmeter"
$SkinName = "CopelandOSPhone"
$Docs = [Environment]::GetFolderPath("MyDocuments")
$SkinRoot = Join-Path $Docs "Rainmeter\Skins\$SkinName"

New-Item -ItemType Directory -Force -Path $Root, $SkinRoot | Out-Null

$CaptureUrl = $CopelandUrl.Replace('/console','') + "/api/capture/idea?text=SHORTCUT_TEXT&source=ios-shortcuts&urgency=medium&tags=ios,shortcut"
$HealthUrl = $CopelandUrl.Replace('/console','') + "/api/health"

$ini = @"
[Rainmeter]
Update=60000
AccurateText=1
DynamicWindowSize=1
BackgroundMode=2
SolidColor=0,0,0,1
WindowX=98%
WindowY=6%
AnchorX=100%
AnchorY=0%
Draggable=1

[Variables]
PanelW=310
PanelH=226
Glass=245,247,238,32
Stroke=255,255,255,78
Text=242,244,236,236
Muted=190,199,188,220
Accent=220,232,167,235
URL=$CopelandUrl
Capture=$CaptureUrl
Health=$HealthUrl

[Panel]
Meter=Shape
Shape=Rectangle 0,0,#PanelW#,#PanelH#,28 | Fill Color #Glass# | StrokeWidth 1 | Stroke Color #Stroke#

[Title]
Meter=String
Text=CopelandOS
X=20
Y=17
FontFace=Segoe UI Variable Display
FontSize=20
FontWeight=600
FontColor=#Text#
AntiAlias=1

[Sub]
Meter=String
Text=phone bridge / light control
X=22
Y=48
FontFace=Segoe UI Variable
FontSize=10
FontColor=#Muted#
AntiAlias=1

[MeasureTime]
Measure=Time
Format=%I:%M %p

[Time]
Meter=String
MeasureName=MeasureTime
X=22
Y=76
FontFace=Segoe UI Variable Display
FontSize=30
FontWeight=500
FontColor=#Text#
AntiAlias=1

[OpenButton]
Meter=Shape
Shape=Rectangle 20,128,270,34,17 | Fill Color 220,232,167,42 | StrokeWidth 1 | Stroke Color 220,232,167,90
LeftMouseUpAction=["#URL#"]

[OpenLabel]
Meter=String
Text=Open CopelandOS
X=155
Y=136
FontFace=Segoe UI Variable
FontSize=11
FontWeight=600
FontColor=#Text#
StringAlign=Center
AntiAlias=1
LeftMouseUpAction=["#URL#"]

[HealthButton]
Meter=Shape
Shape=Rectangle 20,170,130,32,16 | Fill Color 255,255,255,28 | StrokeWidth 1 | Stroke Color #Stroke#
LeftMouseUpAction=["#Health#"]

[HealthLabel]
Meter=String
Text=Health
X=85
Y=178
FontFace=Segoe UI Variable
FontSize=10
FontColor=#Muted#
StringAlign=Center
AntiAlias=1
LeftMouseUpAction=["#Health#"]

[ShortcutButton]
Meter=Shape
Shape=Rectangle 160,170,130,32,16 | Fill Color 255,255,255,28 | StrokeWidth 1 | Stroke Color #Stroke#
LeftMouseUpAction=["#Capture#"]

[ShortcutLabel]
Meter=String
Text=Test Capture
X=225
Y=178
FontFace=Segoe UI Variable
FontSize=10
FontColor=#Muted#
StringAlign=Center
AntiAlias=1
LeftMouseUpAction=["#Capture#"]
"@

Set-Content -Path (Join-Path $SkinRoot "CopelandOSPhone.ini") -Value $ini -Encoding UTF8

$shortcutText = @"
CopelandOS iPhone Shortcut

1. Open Safari on iPhone:
   $CopelandUrl
2. Share -> Add to Home Screen.
3. For Siri capture:
   Ask for Input
   URL Encode Provided Input
   Text: $CaptureUrl
   Replace SHORTCUT_TEXT with Encoded Text
   Get Contents of URL
   Show Notification: Captured to CopelandOS
"@

Set-Content -Path (Join-Path $Root "iphone-shortcut.txt") -Value $shortcutText -Encoding UTF8

$rainmeter = @(
  "$env:PROGRAMFILES\Rainmeter\Rainmeter.exe",
  "${env:PROGRAMFILES(X86)}\Rainmeter\Rainmeter.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1

if ($rainmeter) {
  Start-Process $rainmeter
  Start-Sleep -Seconds 2
  & $rainmeter "!RefreshApp"
  & $rainmeter "!ActivateConfig" $SkinName "CopelandOSPhone.ini"
  Write-Host "Rainmeter skin loaded: $SkinName"
} else {
  Write-Host "Rainmeter not found. Install with: winget install --id Rainmeter.Rainmeter -e"
}

Write-Host "Created: $SkinRoot\CopelandOSPhone.ini"
Write-Host "Created: $Root\iphone-shortcut.txt"
Write-Host "URL: $CopelandUrl"
