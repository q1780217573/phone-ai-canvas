// 一键发布：构建 → 把 dist 推到 main（GitHub Pages）
// 源码在 source 分支，main 只放构建产物
// 用法：pnpm 发布

import { execSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repo = 'https://github.com/q1780217573/phone-ai-canvas.git'
const tmp = path.join(os.tmpdir(), 'ai-canvas-deploy')
const GIT = 'git -c http.sslBackend=schannel'
const who = `-c user.name=q1780217573 -c user.email=101926615+q1780217573@users.noreply.github.com`

const run = (cmd, cwd = root) => execSync(cmd, { cwd, stdio: 'pipe', encoding: 'utf8' }).trim()

// Node 22 的 fs.cpSync 在本机（非 ASCII 路径）会直接崩溃，这里自己递归拷
function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true })
  for (const name of fs.readdirSync(src)) {
    const s = path.join(src, name)
    const d = path.join(dst, name)
    if (fs.statSync(s).isDirectory()) copyDir(s, d)
    else fs.copyFileSync(s, d)
  }
}

console.log('1/4 构建…')
console.log(run('pnpm build').split('\n').slice(-3).join('\n'))

console.log('2/4 准备部署目录…')
if (!fs.existsSync(path.join(tmp, '.git'))) {
  if (fs.existsSync(tmp)) fs.rmSync(tmp, { recursive: true, force: true })
  run(`${GIT} clone --branch main --depth 1 ${repo} "${tmp}"`, os.tmpdir())
} else {
  try {
    run(`${GIT} pull --ff-only`, tmp)
  } catch {
    console.log('    拉取远端失败，继续用本地副本')
  }
}

for (const name of fs.readdirSync(tmp)) {
  if (name === '.git') continue
  fs.rmSync(path.join(tmp, name), { recursive: true, force: true })
}
copyDir(path.join(root, 'dist'), tmp)
fs.writeFileSync(path.join(tmp, '.nojekyll'), '', 'ascii')

console.log('3/4 提交…')
run('git add -A', tmp)
if (run('git status --porcelain', tmp)) {
  const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ')
  run(`${GIT} ${who} commit -m "deploy: ${stamp}"`, tmp)
  console.log('4/4 推送 main…')
  console.log(run(`${GIT} push origin main`, tmp).split('\n').slice(-2).join('\n'))
} else {
  console.log('4/4 产物无变化，跳过推送')
}

console.log('\n完成。Pages 约 1 分钟后生效：https://q1780217573.github.io/phone-ai-canvas/')
console.log('提醒：源码改动记得单独提交 —— git add -A && git commit && git push origin source')