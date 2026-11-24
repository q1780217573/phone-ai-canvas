import { useEffect, useState } from 'react'
import { Search, X, Sparkles } from 'lucide-react'
import { db, type PromptRec } from '../lib/db'
import { CATEGORIES, fillTemplate, parsePlaceholders } from '../lib/prompts'

/** 提示词库选择器：选中后有占位符的先填空，再回填输入框 */
export default function PromptPicker({
  onPick,
  onClose,
}: {
  onPick: (text: string, title: string) => void
  onClose: () => void
}) {
  const [items, setItems] = useState<PromptRec[]>([])
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<string>('全部')
  const [filling, setFilling] = useState<PromptRec | null>(null)

  useEffect(() => {
    db.prompts.orderBy('updatedAt').reverse().toArray().then(setItems)
  }, [])

  const list = items.filter((p) => {
    if (cat !== '全部' && p.category !== cat) return false
    if (!q.trim()) return true
    const t = `${p.title} ${p.body} ${p.tags.join(' ')}`.toLowerCase()
    return t.includes(q.trim().toLowerCase())
  })

  const choose = (p: PromptRec) => {
    const ph = parsePlaceholders(p.body)
    if (ph.length) setFilling({ ...p, placeholders: ph })
    else {
      db.prompts.update(p.id, { useCount: p.useCount + 1 })
      onPick(p.body, p.title)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/55" onClick={onClose}>
      <div
        className="fade-up flex max-h-[82vh] flex-col rounded-t-2xl border-t border-line bg-surface"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 pb-2 pt-3">
          <div className="mr-auto text-[15px] font-semibold">提示词库</div>
          <button type="button" onClick={onClose} className="p-1.5 text-muted">
            <X size={19} />
          </button>
        </div>

        <div className="px-4">
          <div className="flex items-center gap-2 rounded-xl border border-line bg-raised px-3 py-2">
            <Search size={15} className="text-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="搜索标题或内容"
              className="w-full bg-transparent text-[14px] outline-none placeholder:text-fg3"
            />
          </div>
        </div>

        <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 py-2.5">
          {['全部', ...CATEGORIES].map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCat(c)}
              className={`shrink-0 rounded-full px-3 py-1 text-[12.5px] ${
                cat === c ? 'bg-accru text-white' : 'bg-raised text-muted'
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="scroll-y min-h-0 flex-1 px-4 pb-6" style={{ paddingBottom: 'calc(var(--sab) + 16px)' }}>
          {list.length === 0 && (
            <div className="py-12 text-center text-[13px] text-muted">
              还没有提示词。去「库 → 提示词」新建，或先直接写描述。
            </div>
          )}
          <div className="space-y-2">
            {list.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => choose(p)}
                className="w-full rounded-xl border border-line/80 bg-raised/60 p-3 text-left active:bg-raised"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[13.5px] font-medium">{p.title}</span>
                  <span className="rounded bg-fg/10 px-1.5 py-0.5 text-[10.5px] text-fg2">
                    {p.category}
                  </span>
                  {p.placeholders?.length > 0 && (
                    <span className="flex items-center gap-1 text-[10.5px] text-accru">
                      <Sparkles size={11} /> 可填空
                    </span>
                  )}
                </div>
                <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-muted">{p.body}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {filling && (
        <FillSheet
          rec={filling}
          onCancel={() => setFilling(null)}
          onDone={(values) => {
            const text = fillTemplate(filling.body, values)
            db.prompts.update(filling.id, { useCount: filling.useCount + 1 })
            onPick(text, filling.title)
            setFilling(null)
          }}
        />
      )}
    </div>
  )
}

function FillSheet({
  rec,
  onCancel,
  onDone,
}: {
  rec: PromptRec
  onCancel: () => void
  onDone: (v: Record<string, string>) => void
}) {
  const [vals, setVals] = useState<Record<string, string>>({})
  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/60 px-5" onClick={onCancel}>
      <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-4" onClick={(e) => e.stopPropagation()}>
        <div className="text-[15px] font-semibold">{rec.title}</div>
        <div className="mt-0.5 text-[12px] text-muted">填一下方括号里的内容</div>
        <div className="scroll-y mt-3 max-h-[50vh] space-y-2.5">
          {rec.placeholders.map((label) => (
            <label key={label} className="block">
              <span className="text-[12px] text-muted">{label}</span>
              <input
                value={vals[label] ?? ''}
                onChange={(e) => setVals((v) => ({ ...v, [label]: e.target.value }))}
                placeholder={`输入${label}`}
                className="mt-1 w-full rounded-lg border border-line bg-raised px-3 py-2 text-[14px] outline-none focus:border-accru/60"
              />
            </label>
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={onCancel} className="flex-1 rounded-lg border border-line py-2.5 text-[13.5px] text-fg/70">
            取消
          </button>
          <button
            type="button"
            onClick={() => onDone(vals)}
            className="flex-1 rounded-lg bg-gradient-to-r from-accru to-accru2 py-2.5 text-[13.5px] font-semibold text-white"
          >
            生成描述
          </button>
        </div>
      </div>
    </div>
  )
}
