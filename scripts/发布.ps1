# 一键发布：构建 → 把 dist 推到 main（GitHub Pages）
# 源码在 source 分支；main 分支只放构建产物
# 用法：pnpm 发布    或    powershell -ExecutionPolicy Bypass -File scripts\发布.ps1

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$repo = 'https://github.com/q1780217573/phone-ai-canvas.git'
$tmp = Join-Path $env:TEMP 'ai-canvas-deploy'

Write-Host '1/4 构建…'
Push-Location $root
pnpm build
Pop-Location

Write-Host '2/4 准备部署目录…'
if (-not (Test-Path (Join-Path $tmp '.git'))) {
  if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
  git -c http.sslBackend=schannel clone --branch main --depth 1 $repo $tmp
}
Get-ChildItem $tmp -Exclude '.git' | Remove-Item -Recurse -Force
Copy-Item (Join-Path $root 'dist\*') -Destination $tmp -Recurse
Set-Content -Path (Join-Path $tmp '.nojekyll') -Value '' -Encoding ascii

Write-Host '3/4 提交…'
Push-Location $tmp
$stamp = Get-Date -Format 'yyyy-MM-dd HH:mm'
git add -A
git -c user.name='q1780217573' -c user.email='101926615+q1780217573@users.noreply.github.com' commit -m "deploy: $stamp"

Write-Host '4/4 推送 main…'
git -c http.sslBackend=schannel push origin main
Pop-Location

Write-Host '完成。Pages 约 1 分钟后生效：https://q1780217573.github.io/phone-ai-canvas/'
Write-Host '提示：源码改动记得单独提交到 source 分支：git add -A; git commit; git push origin source'