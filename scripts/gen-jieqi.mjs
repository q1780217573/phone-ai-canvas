// 从「二十四节气高定礼服.html」里抽出 24 条提示词，生成 src/data/jieqi.ts
import fs from 'node:fs'
import path from 'node:path'

const SRC = 'C:\\Users\\17802\\Pictures\\提示词总结\\二十四节气高定礼服.html'
const OUT = path.resolve('src/data/jieqi.ts')

const html = fs.readFileSync(SRC, 'utf8')
const m = html.match(/const jieqiData\s*=\s*\[([\s\S]*?)\n\];/)
if (!m) {
  console.error('没找到 jieqiData 数组')
  process.exit(1)
}

// 数组字面量里的键没有引号，用 Function 求值最省事（本地文件，可信）
const data = new Function(`return [${m[1]}]`)()

const clean = (s = '') =>
  s
    .split('|')
    .map((x) => x.trim())
    .filter(Boolean)
    .join('；')

const buildBody = (d) => {
  const parts = [
    `正面全身站姿时装设计稿，3:4 竖版画册构图，二十四节气「${d.name}」高定礼服，${d.sub}`,
    `灵感：${d.inspiration}`,
    `廓形：${d.silhouette}`,
    `元素：${clean(d.elements)}`,
    `关键词：${(d.notes || '').split('|').map((x) => x.trim()).filter(Boolean).join('；')}`,
    '水彩与数字插画结合，干净留白背景，面料质感清晰，人物正对镜头，避免侧身与背影',
  ]
  return parts.join('\n')
}

const items = data.map((d) => ({
  name: d.name,
  sub: d.sub,
  body: buildBody(d),
}))

const header = `// 由 scripts/gen-jieqi.mjs 从「二十四节气高定礼服.html」生成，勿手改
export type JieqiPrompt = { name: string; sub: string; body: string }

export const JIEQI_PROMPTS: JieqiPrompt[] = `

fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, header + JSON.stringify(items, null, 2) + '\n', 'utf8')
console.log(`已生成 ${items.length} 条 -> ${OUT}`)
