import Dexie, { type Table } from 'dexie'
import { SEED_PROMPTS, parsePlaceholders } from './prompts'
import { JIEQI_PROMPTS } from '../data/jieqi'
import { PROMPT_PACK } from '../data/prompt-pack'
import { PROMPT_PACK_2 } from '../data/prompt-pack2'

export type ImageRec = {
  id: string
  promptText: string
  model: string
  size: string
  ratio: string
  thumb: Blob
  /** 原图；超出保留策略时会被清空，仅留缩略图 */
  full?: Blob
  fav: 0 | 1
  parentId?: string
  createdAt: number
}

export type PromptRec = {
  id: string
  title: string
  category: string
  body: string
  placeholders: string[]
  tags: string[]
  useCount: number
  fav: 0 | 1
  createdAt: number
  updatedAt: number
}

export type ChatRec = {
  id: string
  title: string
  model: string
  createdAt: number
  updatedAt: number
}

export type MsgRec = {
  id: string
  chatId: string
  role: 'user' | 'assistant'
  content: string
  createdAt: number
}

export type RefRec = {
  id: string
  blob: Blob
  note: string
  createdAt: number
}

class AppDB extends Dexie {
  images!: Table<ImageRec, string>
  prompts!: Table<PromptRec, string>
  chats!: Table<ChatRec, string>
  messages!: Table<MsgRec, string>
  refs!: Table<RefRec, string>
  meta!: Table<{ key: string; value: string }, string>

  constructor() {
    super('ai-canvas')
    // chats / messages 是早期对话功能留下的表，界面已移除。
    // 保留在 schema 里不删，避免 Dexie 升级时连表把老数据一起清掉。
    this.version(1).stores({
      images: 'id, createdAt, fav',
      prompts: 'id, category, updatedAt, fav',
      chats: 'id, updatedAt',
      messages: 'id, chatId, createdAt',
      refs: 'id, createdAt',
    })
    // v2：新增 meta，用于内置词库的版本升级
    this.version(2).stores({
      meta: 'key',
    })
  }
}

export const db = new AppDB()

export const uid = () =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`

/**
 * 原图保留策略：只留最近 `keep` 张的原始 PNG，
 * 更早的只保留缩略图与提示词（作品页仍能看到当时的文案）。
 */
export async function enforceRetention(keep = 100) {
  const withFull = await db.images.filter((r) => !!r.full).toArray()
  if (withFull.length <= keep) return 0
  const overflow = withFull
    .sort((a, b) => a.createdAt - b.createdAt)
    .slice(0, withFull.length - keep)
  await db.images.bulkUpdate(
    overflow.map((r) => ({ key: r.id, changes: { full: undefined } })),
  )
  return overflow.length
}

export async function storageStats() {
  const all = await db.images.toArray()
  const bytes = all.reduce((n, r) => n + (r.thumb?.size ?? 0) + (r.full?.size ?? 0), 0)
  return { count: all.length, bytes }
}

/** 首次启动灌入几条示例提示词，避免词库空白（幂等，可重复调用） */
let seeding: Promise<void> | null = null
export function ensureSeed(): Promise<void> {
  if (!seeding) seeding = doSeed()
  return seeding
}

/** 内置词库版本：改了 jieqi / pack 的正文就 +1，老设备下次启动会自动覆盖正文 */
const SEED_VERSION = 3

async function doSeed() {
  const now = Date.now()

  const base = SEED_PROMPTS.map((p, i) => ({
    id: `seed-${i}`,
    title: p.title,
    category: p.category,
    body: p.body,
    placeholders: parsePlaceholders(p.body),
    tags: [] as string[],
    useCount: 0,
    fav: 0 as const,
    createdAt: now + i,
    updatedAt: now + i,
  }))

  // 二十四节气 · 高定礼服（来自本机提示词总结文件）
  const jieqi = JIEQI_PROMPTS.map((j, i) => ({
    id: `jieqi-${i}`,
    title: `${j.name} · ${j.sub}`,
    category: '节气',
    body: j.body,
    placeholders: parsePlaceholders(j.body),
    tags: ['节气', '高定礼服'] as string[],
    useCount: 0,
    fav: 0 as const,
    createdAt: now + 100 + i,
    updatedAt: now + 100 + i,
  }))

  // 通用生图提示词包（人像/风景/产品/插画/家居/宠物，各 5 条）
  const pack = PROMPT_PACK.map((p, i) => ({
    id: `pack-${i}`,
    title: p.title,
    category: p.category,
    body: p.body,
    placeholders: parsePlaceholders(p.body),
    tags: ['通用', p.category] as string[],
    useCount: 0,
    fav: (i < 3 ? 1 : 0) as 0 | 1,
    createdAt: now + 200 + i,
    updatedAt: now + 200 + i,
  }))

  // 第二批：从 awesome-gpt-image-2 案例提炼写法后重写
  const pack2 = PROMPT_PACK_2.map((p, i) => ({
    id: `pack2-${i}`,
    title: p.title,
    category: p.category,
    body: p.body,
    placeholders: parsePlaceholders(p.body),
    tags: ['案例改写', p.category] as string[],
    useCount: 0,
    fav: 0 as const,
    createdAt: now + 300 + i,
    updatedAt: now + 300 + i,
  }))

  const rows = [...jieqi, ...pack, ...pack2, ...base]
  const exist = new Set((await db.prompts.toCollection().primaryKeys()).map(String))
  const missing = rows.filter((r) => !exist.has(r.id))
  if (missing.length) {
    try {
      await db.prompts.bulkAdd(missing)
    } catch {
      /* 并发重复写入时忽略约束错误 */
    }
  }

  // 词库改过正文时，覆盖老设备上的内置条目（保留使用次数与收藏状态）
  const ver = Number((await db.meta.get('seedVersion'))?.value ?? 1)
  if (ver < SEED_VERSION) {
    for (const j of [...jieqi, ...pack, ...pack2, ...base]) {
      await db.prompts.update(j.id, { body: j.body, placeholders: j.placeholders })
    }
    await db.meta.put({ key: 'seedVersion', value: String(SEED_VERSION) })
  }
}
