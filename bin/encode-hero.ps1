# Requires ffmpeg on PATH with libx264, libvpx-vp9, and libwebp.
# Encodes an optimized hero stack under public/: hero.mp4, hero.webm, hero-sm.mp4, hero-sm.webm,
# plus public/gallery/hero-poster.webp for fast first paint.
#
# Usage (from repo root):
#   powershell -ExecutionPolicy Bypass -File ./bin/encode-hero.ps1
#   powershell -ExecutionPolicy Bypass -File ./bin/encode-hero.ps1 -Source "Main Website vdo.mp4"
#
# Same duration as source; 60 fps sources are normalized to 30 fps for smaller files on the web.

param(
  [string]$Source = "Main Website vdo.mp4"
)

$ErrorActionPreference = "Stop"
$public = Join-Path (Join-Path $PSScriptRoot "..") "public"
$srcPath = Join-Path $public $Source
$heroOut = Join-Path $public "hero.mp4"
$heroTmp = Join-Path $public "hero.encode-temp.mp4"

if (-not (Test-Path $srcPath)) {
  Write-Host "Missing source: $srcPath"
  Write-Host "Place the file under public/ or pass -Source relative to public/."
  exit 1
}

Write-Host "Encoding hero.mp4 (H.264, 30fps, faststart, no audio)..."
& ffmpeg -y -hide_banner -loglevel error -i $srcPath -an `
  -vf "fps=30" `
  -c:v libx264 -crf 23 -preset slow -profile:v high `
  -pix_fmt yuv420p -movflags +faststart `
  $heroTmp
if (-not (Test-Path $heroTmp)) { throw "ffmpeg missing output: $heroTmp" }
Move-Item -LiteralPath $heroTmp -Destination $heroOut -Force

Write-Host "Extracting poster (WebP)..."
$posterDir = Join-Path $public "gallery"
if (-not (Test-Path $posterDir)) { New-Item -ItemType Directory -Path $posterDir | Out-Null }
$posterPath = Join-Path $posterDir "hero-poster.webp"
& ffmpeg -y -hide_banner -loglevel error -ss 1 -i $heroOut -frames:v 1 `
  -c:v libwebp -quality 85 `
  $posterPath

Write-Host "Encoding hero.webm (VP9, full width)..."
& ffmpeg -y -hide_banner -loglevel error -i $heroOut `
  -c:v libvpx-vp9 -crf 35 -b:v 0 -row-mt 1 -cpu-used 1 -an -pix_fmt yuv420p `
  (Join-Path $public "hero.webm")

Write-Host "Encoding hero-sm.* (max 1280px wide)..."
$vfSm = "scale='min(1280,iw)':-2"
& ffmpeg -y -hide_banner -loglevel error -i $heroOut -vf $vfSm `
  -c:v libx264 -crf 26 -preset slow -movflags +faststart -an `
  (Join-Path $public "hero-sm.mp4")
& ffmpeg -y -hide_banner -loglevel error -i $heroOut -vf $vfSm `
  -c:v libvpx-vp9 -crf 36 -b:v 0 -row-mt 1 -cpu-used 1 -an -pix_fmt yuv420p `
  (Join-Path $public "hero-sm.webm")

Write-Host "Done. Sizes:"
Get-Item $heroOut, (Join-Path $public "hero.webm"), (Join-Path $public "hero-sm.mp4"), (Join-Path $public "hero-sm.webm"), $posterPath |
  ForEach-Object { "{0,-22} {1,12:N0} bytes" -f $_.Name, $_.Length }
