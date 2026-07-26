param(
  [string]$SamplePath = "scripts/fixtures/realtime-catch-up-english.json",
  [string]$OutputPath = "docs/verification/fixtures/realtime-catch-up-english.wav"
)

$ErrorActionPreference = "Stop"
$workspace = Split-Path -Parent $PSScriptRoot
$resolvedSample = Join-Path $workspace $SamplePath
$resolvedOutput = Join-Path $workspace $OutputPath
$outputDirectory = Split-Path -Parent $resolvedOutput

New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
$sample = Get-Content -Raw -Encoding UTF8 -LiteralPath $resolvedSample | ConvertFrom-Json
$transcript = ($sample.utterances | ForEach-Object { $_.text }) -join " "

Add-Type -AssemblyName System.Speech
$synthesizer = New-Object System.Speech.Synthesis.SpeechSynthesizer
$format = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(
  16000,
  [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen,
  [System.Speech.AudioFormat.AudioChannel]::Mono
)

try {
  $voice = $synthesizer.GetInstalledVoices() |
    Where-Object { $_.VoiceInfo.Culture.Name -eq "en-US" } |
    Select-Object -First 1
  if (-not $voice) {
    throw "No en-US SAPI voice is installed."
  }
  $synthesizer.SelectVoice($voice.VoiceInfo.Name)
  $synthesizer.Rate = 1
  $synthesizer.SetOutputToWaveFile($resolvedOutput, $format)
  $synthesizer.Speak($transcript)
  $synthesizer.SetOutputToNull()
  $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $resolvedOutput).Hash.ToLowerInvariant()
  Write-Output "Generated $OutputPath"
  Write-Output "Voice=$($voice.VoiceInfo.Name)"
  Write-Output "SHA256=$hash"
} finally {
  $synthesizer.Dispose()
}
