export function parsePlaceholders(body: string): string[] {
  const out: string[] = []
  const re = /\[([^[\]]{1,24})\]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(body))) {
    const label = m[1].trim()
    if (label && !out.includes(label)) out.push(label)
  }
  return out
}

export function fillTemplate(body: string, values: Record<string, string>): string {
  return body.replace(/\[([^[\]]{1,24})\]/g, (whole, label: string) => {
    const v = values[label.trim()]
    return v && v.trim() ? v.trim() : whole
  })
}

export const CATEGORIES = ['节气', '人像', '风景', '产品', '插画', '家居', '宠物', '风格', '文字', '其它'] as const

export const SEED_PROMPTS: Array<{
  title: string
  category: string
  body: string
}> = [
  {
    title: '清透人像',
    category: '人像',
    body: '一位[年龄]女性站在[地点]，[服装]被风轻轻带起，柔和自然光从正面偏左打来，浅景深，胶片颗粒细腻，画面干净通透不灰，皮肤质感自然',
  },
  {
    title: '国风山水',
    category: '风景',
    body: '中国水墨风格的[地点]山水，云雾在山腰缓缓流动，大面积留白，淡青与米色为主，宣纸纹理可见，远处只留几笔淡墨，气息安静，留白很多',
  },
  {
    title: '产品静物',
    category: '产品',
    body: '[产品]置于[台面材质]上，侧逆光勾出轮廓边缘，投影柔和向前延伸，背景极简只留一片浅灰，商业摄影质感，细节清晰，反光干净',
  },
  {
    title: '插画头像',
    category: '风格',
    body: '扁平插画风格头像，[性别]，[发色]短发，纯色背景，柔和渐变过渡，线条简洁，构图居中并留出呼吸空间，配色克制，像随手做了个表情包',
  },
]
