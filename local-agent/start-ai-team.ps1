param(
  [switch]$SkipModelPull
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$compose = Join-Path $PSScriptRoot 'docker-compose.ai-stack.yml'

Write-Host 'Starting CopelandOS local AI stack...' -ForegroundColor Cyan
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw 'Docker Desktop is required. Install Docker Desktop, start it, then rerun this script.'
}

docker compose -f $compose up -d

if (-not $SkipModelPull) {
  $models = @(
    'qwen2.5-coder:14b',
    'qwen3:8b',
    'llama3.2:3b',
    'nomic-embed-text'
  )
  foreach ($model in $models) {
    Write-Host "Pulling $model..." -ForegroundColor Cyan
    docker exec copelandos-ollama ollama pull $model
  }
}

Write-Host ''
Write-Host 'Local AI stack is starting.' -ForegroundColor Green
Write-Host 'Ollama:       http://127.0.0.1:11434'
Write-Host 'Open WebUI:   http://127.0.0.1:3000'
Write-Host 'LiteLLM:      http://127.0.0.1:4000'
Write-Host 'Qdrant:       http://127.0.0.1:6333'
Write-Host ''
Write-Host 'Cloudflare Worker secrets to add later:' -ForegroundColor Yellow
Write-Host 'OLLAMA_BASE_URL=http://YOUR_TAILSCALE_PC_IP:11434'
Write-Host 'OPEN_WEBUI_URL=http://YOUR_TAILSCALE_PC_IP:3000'
Write-Host 'LITELLM_BASE_URL=http://YOUR_TAILSCALE_PC_IP:4000'
Write-Host 'QDRANT_URL=http://YOUR_TAILSCALE_PC_IP:6333'
