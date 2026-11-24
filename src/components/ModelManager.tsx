import { useState } from 'react'
import { Plus, Trash2, Check, X } from 'lucide-react'
import { useSettings, useToast } from '../lib/store'

const PRESET_IMAGE = [
  'gpt-image-2.6-sunburst',
  'gpt-image-2.6-flare',
  'gpt-image-2.5-sunburst',
  'gpt-image-2.5-flare',
  'gpt-image-2',
]

const autoLabel = (id: string) => id.replace(/^gpt-image-/, 'Image ').replace(/^gpt-/, 'GPT-')

export default function ModelManager() {
  const s = useSettings()
  const push = useToast((t) => t.push)
  const list = s.imageModels
  const current = s.imageModel
  const presets = PRESET_IMAGE

  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [id, setId] = useState('')

  const submit = () => {
    const modelId = id.trim()
    if (!modelId) return push('模型 ID 不能为空')
    if (list.some((m) => m.id === modelId)) return push('这个模型已经在列表里了')
    s.addModel('image', { id: modelId, label: label.trim() || autoLabel(modelId) })
    setOpen(false)
    setLabel('')
    setId('')
    push('已添加')
  }

  return (
    <>
      <div className="space-y-1.5">
        {list.map((m) => {
          const on = m.id === current
          return (
            <div
              key={m.id}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 ${
                on ? 'border-accru/60 bg-accru/10' : 'border-line bg-raised/50'
              }`}
            >
              <button
                type="button"
                onClick={() => s.set({ imageModel: m.id })}
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                  on ? 'border-accru bg-accru text-white' : 'border-line text-transparent'
                }`}
                aria-label="设为默认"
              >
                <Check size={13} strokeWidth={3} />
              </button>

              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] text-fg/90">{m.label}</div>
                <div className="truncate font-mono text-[10.5px] text-fg3">{m.id}</div>
              </div>

              {on && <span className="shrink-0 rounded bg-accru/15 px-1.5 py-0.5 text-[10px] text-accru">默认</span>}

              {list.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    s.removeModel('image', m.id)
                    push('已移除')
                  }}
                  className="shrink-0 rounded-lg p-1.5 text-fg/55 active:bg-white/10"
                  aria-label="删除模型"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          )
        })}
      </div>

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-line py-2.5 text-[12.5px] text-fg/70 active:bg-raised"
      >
        <Plus size={15} /> 添加模型
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={() => setOpen(false)}>
          <div
            className="fade-up w-full rounded-t-2xl border-t border-line bg-surface p-4"
            style={{ paddingBottom: 'calc(var(--sab) + 14px)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center">
              <span className="text-[15px] font-semibold">添加生图模型</span>
              <button type="button" onClick={() => setOpen(false)} className="ml-auto p-1 text-muted">
                <X size={18} />
              </button>
            </div>

            <div className="no-scrollbar -mx-1 mb-3 flex gap-2 overflow-x-auto px-1">
              {presets.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    setId(p)
                    setLabel(autoLabel(p))
                  }}
                  className={`shrink-0 rounded-full border px-2.5 py-1 font-mono text-[11px] ${
                    id === p ? 'border-accru text-accru' : 'border-line text-fg3'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>

            <label className="block text-[12px] text-fg2">
              模型 ID
              <input
                value={id}
                onChange={(e) => setId(e.target.value)}
                placeholder="例如 gpt-image-2.6-flare"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                className="mt-1 w-full rounded-lg border border-line bg-raised px-3 py-2.5 font-mono text-[13px] outline-none focus:border-accru/60"
              />
            </label>

            <label className="mt-2.5 block text-[12px] text-fg2">
              显示名（可留空）
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="给这个模型起个好认的名字"
                className="mt-1 w-full rounded-lg border border-line bg-raised px-3 py-2.5 text-[13px] outline-none focus:border-accru/60"
              />
            </label>

            <button
              type="button"
              onClick={submit}
              className="mt-3.5 w-full rounded-xl bg-gradient-to-r from-accru to-accru2 py-3 text-[14px] font-semibold text-white"
            >
              添加
            </button>
          </div>
        </div>
      )}
    </>
  )
}
