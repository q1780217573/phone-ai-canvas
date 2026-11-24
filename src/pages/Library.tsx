import { useEffect, useState } from 'react'
import { Plus, Trash2, X, Download, ImagePlus, FolderOpen, Upload } from 'lucide-react'
import { useBlobUrl } from '../lib/useBlobUrl'
import { db, storageStats, uid, type ImageRec, type PromptRec, type RefRec } from '../lib/db'
import { CATEGORIES, parsePlaceholders } from '../lib/prompts'
import { fmtBytes } from '../lib/image'
import ResultViewer from '../components/ResultViewer'
import { useToast } from '../lib/store'

type Sub = 'works' | 'prompts' | 'refs'

export default function Library({ onGoCreate }: { onGoCreate: (blob: Blob) => void }) {
  const [sub, setSub] = useState<Sub>('works')

  return (
    <div className="mx-auto w-full max-w-md px-4" style={{ paddingTop: 'calc(var(--sat) + 18px)' }}>
      <h1 className="text-[22px] font-semibold tracking-tight">我的库</h1>

      <div className="mt-3 flex gap-1 rounded-xl bg-surface p-1">
        {(
          [
            ['works', '作品'],
            ['prompts', '提示词'],
            ['refs', '参考图'],
          ] as Array<[Sub, string]>
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setSub(k)}
            className={`flex-1 rounded-lg py-2 text-[13px] ${
              sub === k ? 'bg-raised text-fg' : 'text-muted'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-3 pb-4">
        {sub === 'works' && <Works />}
        {sub === 'prompts' && <Prompts />}
        {sub === 'refs' && <Refs onGoCreate={onGoCreate} />}
      </div>
    </div>
  )
}

/* ---------------- 作品 ---------------- */

function Works() {
  const [items, setItems] = useState<ImageRec[]>([])
  const [open, setOpen] = useState<ImageRec | null>(null)
  const [stats, setStats] = useState({ count: 0, bytes: 0 })
  const push = useToast((s) => s.push)

  const reload = async () => {
    setItems(await db.images.orderBy('createdAt').reverse().toArray())
    setStats(await storageStats())
  }
  useEffect(() => {
    void reload()
  }, [])

  const remove = async (id: string) => {
    await db.images.delete(id)
    setOpen(null)
    await reload()
    push('已删除')
  }

  return (
    <>
      <div className="mb-2 flex items-center justify-between text-[11px] text-muted">
        <span>
          {stats.count} 张 · 占用 {fmtBytes(stats.bytes)}
        </span>
        <span>原图保留最近 100 张</span>
      </div>

      {items.length === 0 ? (
        <Empty text="还没有作品，去「生图」画一张" />
      ) : (
        <div className="grid grid-cols-3 gap-1.5">
          {items.map((it) => (
            <Thumb key={it.id} rec={it} onClick={() => setOpen(it)} />
          ))}
        </div>
      )}

      {open && (
        <ResultViewer
          rec={open}
          mode="library"
          onClose={() => setOpen(null)}
          onEditPrompt={() => setOpen(null)}
          onUseAsRef={() => undefined}
          onDelete={() => void remove(open.id)}
        />
      )}
    </>
  )
}

function Thumb({ rec, onClick }: { rec: ImageRec; onClick: () => void }) {
  const url = useBlobUrl(rec.thumb)
  return (
    <button type="button" onClick={onClick} className="relative aspect-square overflow-hidden rounded-lg bg-surface">
      <img src={url} alt="" className="h-full w-full object-cover" draggable={false} />
      {rec.fav === 1 && <span className="absolute right-1 top-1 text-[11px] text-accru">★</span>}
      {!rec.full && <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1 text-[9px] text-white/70">缩略图</span>}
    </button>
  )
}

/* ---------------- 提示词 ---------------- */

function Prompts() {
  const [items, setItems] = useState<PromptRec[]>([])
  const [editing, setEditing] = useState<Partial<PromptRec> | null>(null)
  const push = useToast((s) => s.push)

  const reload = async () => setItems(await db.prompts.orderBy('updatedAt').reverse().toArray())

  useEffect(() => {
    void reload()
  }, [])

  const save = async () => {
    if (!editing?.title?.trim() || !editing?.body?.trim()) return push('标题和内容都要填')
    const now = Date.now()
    const body = editing.body.trim()
    if (editing.id) {
      await db.prompts.update(editing.id, {
        title: editing.title.trim(),
        category: editing.category ?? '其它',
        body,
        placeholders: parsePlaceholders(body),
        updatedAt: now,
      })
    } else {
      await db.prompts.add({
        id: uid(),
        title: editing.title.trim(),
        category: editing.category ?? '其它',
        body,
        placeholders: parsePlaceholders(body),
        tags: [],
        useCount: 0,
        fav: 0,
        createdAt: now,
        updatedAt: now,
      })
    }
    setEditing(null)
    await reload()
    push('已保存')
  }

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `提示词库_${Date.now()}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 20000)
    push('已导出 JSON')
  }

  const importJson = (files: FileList | null) => {
    const f = files?.[0]
    if (!f) return
    const reader = new FileReader()
    reader.onload = async () => {
      try {
        const arr = JSON.parse(String(reader.result))
        if (!Array.isArray(arr)) throw new Error('bad')
        const now = Date.now()
        const rows = arr
          .map((x: Record<string, unknown>, i: number) => {
            const body = String(x.body ?? '').trim()
            return {
              id: uid(),
              title: String(x.title ?? '未命名').slice(0, 30),
              category: String(x.category ?? '其它'),
              body,
              placeholders: parsePlaceholders(body),
              tags: Array.isArray(x.tags) ? (x.tags as string[]) : [],
              useCount: 0,
              fav: 0 as const,
              createdAt: now + i,
              updatedAt: now + i,
            }
          })
          .filter((r) => r.body)
        if (!rows.length) throw new Error('empty')
        await db.prompts.bulkAdd(rows)
        await reload()
        push(`已导入 ${rows.length} 条`)
      } catch {
        push('导入失败：需要词库导出的 JSON 格式')
      }
    }
    reader.readAsText(f)
  }

  return (
    <>
      <div className="mb-2 flex gap-2">
        <button
          type="button"
          onClick={() => setEditing({ category: '人像' })}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-line bg-raised py-2.5 text-[13px] active:opacity-80"
        >
          <Plus size={15} /> 新建
        </button>
        <label className="flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-line px-3 py-2.5 text-[13px] text-fg/70">
          <Upload size={15} /> 导入
          <input type="file" accept="application/json,.json" hidden onChange={(e) => importJson(e.target.files)} />
        </label>
        <button
          type="button"
          onClick={exportJson}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-line px-3 py-2.5 text-[13px] text-fg/70"
        >
          <Download size={15} /> 导出
        </button>
      </div>

      <div className="space-y-2">
        {items.map((p) => (
          <div key={p.id} className="rounded-xl border border-line/80 bg-surface/70 p-3">
            <div className="flex items-center gap-2">
              <span className="text-[13.5px] font-medium">{p.title}</span>
              <span className="rounded bg-fg/10 px-1.5 py-0.5 text-[10.5px] text-fg2">{p.category}</span>
              <span className="ml-auto text-[10.5px] text-fg3">用过 {p.useCount} 次</span>
            </div>
            <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-muted">{p.body}</p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => setEditing(p)}
                className="rounded-lg border border-line px-2.5 py-1 text-[11.5px] text-fg/70"
              >
                编辑
              </button>
              <button
                type="button"
                onClick={async () => {
                  await db.prompts.delete(p.id)
                  await reload()
                }}
                className="rounded-lg border border-line px-2.5 py-1 text-[11.5px] text-fg/70"
              >
                删除
              </button>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/55" onClick={() => setEditing(null)}>
          <div
            className="fade-up w-full rounded-t-2xl border-t border-line bg-surface p-4"
            style={{ paddingBottom: 'calc(var(--sab) + 14px)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center">
              <span className="text-[15px] font-semibold">{editing.id ? '编辑提示词' : '新建提示词'}</span>
              <button type="button" onClick={() => setEditing(null)} className="ml-auto p-1 text-muted">
                <X size={18} />
              </button>
            </div>

            <input
              value={editing.title ?? ''}
              onChange={(e) => setEditing({ ...editing, title: e.target.value })}
              placeholder="标题，如「清透人像」"
              className="w-full rounded-lg border border-line bg-raised px-3 py-2.5 text-[14px] outline-none"
            />

            <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setEditing({ ...editing, category: c })}
                  className={`shrink-0 rounded-full px-3 py-1 text-[12px] ${
                    (editing.category ?? '其它') === c ? 'bg-accru text-white' : 'bg-raised text-muted'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>

            <textarea
              value={editing.body ?? ''}
              onChange={(e) => setEditing({ ...editing, body: e.target.value })}
              rows={5}
              placeholder="内容，用方括号标出可替换部分，如 [年龄]、[服装]"
              className="mt-2 w-full resize-none rounded-lg border border-line bg-raised px-3 py-2.5 text-[13.5px] leading-relaxed outline-none"
            />
            <div className="mt-1 text-[11px] text-fg3">
              方括号会被识别为填空项，生成前让你逐项填写
            </div>

            <button
              type="button"
              onClick={() => void save()}
              className="mt-3 w-full rounded-xl bg-gradient-to-r from-accru to-accru2 py-3 text-[14px] font-semibold text-white"
            >
              保存
            </button>
          </div>
        </div>
      )}
    </>
  )
}

/* ---------------- 参考图 ---------------- */

function Refs({ onGoCreate }: { onGoCreate: (blob: Blob) => void }) {
  const [items, setItems] = useState<RefRec[]>([])
  const push = useToast((s) => s.push)

  const reload = async () => setItems(await db.refs.orderBy('createdAt').reverse().toArray())
  useEffect(() => {
    void reload()
  }, [])

  const add = async (files: FileList | null) => {
    if (!files?.length) return
    for (const f of Array.from(files)) {
      // 参考图存原图：改图接口吃的是原图细节，缩略图会掉画质
      await db.refs.add({ id: uid(), blob: f, note: f.name.slice(0, 20), createdAt: Date.now() })
    }
    await reload()
    push('已收藏参考图')
  }

  return (
    <>
      <label className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-line py-3 text-[13px] text-muted active:opacity-80">
        <ImagePlus size={16} /> 添加参考图
        <input type="file" accept="image/*" multiple hidden onChange={(e) => void add(e.target.files)} />
      </label>

      {items.length === 0 ? (
        <Empty text="把常用的人物或风格图存这里，下次一点就用" />
      ) : (
        <div className="mt-3 grid grid-cols-3 gap-1.5">
          {items.map((r) => (
            <RefCell key={r.id} rec={r} onUse={() => onGoCreate(r.blob)} onDelete={async () => {
              await db.refs.delete(r.id)
              await reload()
            }} />
          ))}
        </div>
      )}
    </>
  )
}

function RefCell({ rec, onUse, onDelete }: { rec: RefRec; onUse: () => void; onDelete: () => void }) {
  const url = useBlobUrl(rec.blob)
  return (
    <div className="relative aspect-square overflow-hidden rounded-lg bg-surface">
      <img src={url} alt="" className="h-full w-full object-cover" draggable={false} />
      <div className="absolute inset-x-0 bottom-0 flex bg-black/55 backdrop-blur-sm">
        <button type="button" onClick={onUse} className="flex flex-1 items-center justify-center gap-1 py-1.5 text-[10.5px] text-fg/90">
          <FolderOpen size={11} /> 使用
        </button>
        <button type="button" onClick={onDelete} className="px-2 py-1.5 text-fg/60">
          <Trash2 size={11} />
        </button>
      </div>
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <div className="py-14 text-center text-[12.5px] text-muted">{text}</div>
}
