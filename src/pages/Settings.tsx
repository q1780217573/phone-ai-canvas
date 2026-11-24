import { useEffect, useState } from 'react'
import { Check, Eye, EyeOff, Loader2, PlugZap, Trash2 } from 'lucide-react'
import { useSettings, useToast } from '../lib/store'
import ModelManager from '../components/ModelManager'
import { db, enforceRetention, storageStats } from '../lib/db'
import { explainError, ping } from '../lib/api'
import { fmtBytes } from '../lib/image'

export default function Settings() {
  const s = useSettings()
  const push = useToast((t) => t.push)
  const [showKey, setShowKey] = useState(false)
  const [testing, setTesting] = useState(false)
  const [stats, setStats] = useState({ count: 0, bytes: 0 })

  const refreshStats = async () => setStats(await storageStats())
  useEffect(() => {
    void refreshStats()
  }, [])

  const test = async () => {
    if (!s.apiKey.trim()) return push('先填 API Key')
    setTesting(true)
    try {
      const reply = await ping({ baseUrl: s.baseUrl, apiKey: s.apiKey }, s.chatModel)
      push(`连接正常：${reply.slice(0, 20)}`)
    } catch (e) {
      push(explainError(e))
    } finally {
      setTesting(false)
    }
  }

  const clearOriginals = async () => {
    const all = await db.images.filter((r) => !!r.full).toArray()
    await db.images.bulkUpdate(all.map((r) => ({ key: r.id, changes: { full: undefined } })))
    await refreshStats()
    push('已清理原图，缩略图仍在')
  }

  const clearAll = async () => {
    await db.images.clear()
    await refreshStats()
    push('作品已全部清空')
  }

  return (
    <div className="mx-auto w-full max-w-md px-4" style={{ paddingTop: 'calc(var(--sat) + 18px)' }}>
      <h1 className="text-[22px] font-semibold tracking-tight">设置</h1>
      <p className="mt-0.5 text-[12.5px] text-muted">连接信息只存在这台手机上</p>

      <Section title="外观">
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              ['auto', '跟随系统'],
              ['light', '亮色'],
              ['dark', '暗色'],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => s.set({ theme: k })}
              className={`rounded-xl border py-2.5 text-[12.5px] ${
                s.theme === k
                  ? 'border-accru/70 bg-accru/10 text-accru'
                  : 'border-line bg-raised/60 text-fg2'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <Hint>亮色用暖白底，不刺眼；结果页看图固定深底，避免颜色判断失真。</Hint>
      </Section>

      <Section title="接口">
        <Field label="API 地址">
          <input
            value={s.baseUrl}
            onChange={(e) => s.set({ baseUrl: e.target.value })}
            placeholder="https://api.apikey.fan/v1"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            className="w-full rounded-lg border border-line bg-raised px-3 py-2.5 font-mono text-[13px] outline-none focus:border-accru/50"
          />
          <Hint>末尾一般带 /v1，换中转站只改这里</Hint>
        </Field>

        <Field label="API Key">
          <div className="flex items-center gap-2">
            <input
              value={s.apiKey}
              onChange={(e) => s.set({ apiKey: e.target.value })}
              type={showKey ? 'text' : 'password'}
              placeholder="sk-..."
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              className="w-full rounded-lg border border-line bg-raised px-3 py-2.5 font-mono text-[13px] outline-none focus:border-accru/50"
            />
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              className="rounded-lg border border-line p-2.5 text-muted"
            >
              {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <Hint>生图和连接自检共用一个 Key，在 apikey.fan 后台生成</Hint>
        </Field>

        <button
          type="button"
          onClick={() => void test()}
          disabled={testing}
          className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-raised py-3 text-[13.5px] active:opacity-80 disabled:opacity-60"
        >
          {testing ? <Loader2 size={16} className="animate-spin" /> : <PlugZap size={16} className="text-accru" />}
          测试连接
        </button>
      </Section>

      <Section title="生图模型">
        <ModelManager />
        <Hint>生图页顶部的模型切换就是这份列表，点左侧圆圈设为默认。</Hint>
      </Section>

      <Section title="存储">
        <div className="flex items-center justify-between rounded-lg border border-line/70 bg-surface px-3 py-2.5 text-[12.5px]">
          <span className="text-muted">
            {stats.count} 张作品 · {fmtBytes(stats.bytes)}
          </span>
          <button type="button" onClick={() => void refreshStats()} className="text-[11.5px] text-muted underline">
            刷新
          </button>
        </div>

        <Field label="原图保留张数">
          <Chips
            options={['50', '100', '200']}
            value={String(s.keepOriginals)}
            onChange={(v) => {
              s.set({ keepOriginals: Number(v) })
              void enforceRetention(Number(v))
            }}
            format={(v) => `${v} 张`}
          />
          <Hint>超出后旧图只留缩略图与提示词，可在作品里翻看当时的文案</Hint>
        </Field>

        <div className="mt-1 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => void clearOriginals()}
            className="rounded-xl border border-line py-2.5 text-[12.5px] text-fg/70"
          >
            清理原图
          </button>
          <button
            type="button"
            onClick={() => void clearAll()}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-line py-2.5 text-[12.5px] text-fg/70"
          >
            <Trash2 size={13} /> 清空作品
          </button>
        </div>
      </Section>

      <Section title="关于">
        <div className="space-y-1.5 text-[12px] leading-relaxed text-muted">
          <p>
            版本 0.5.0 · 构建 <span className="font-mono text-fg/70">r8-20261118</span>
          </p>
          <p>纯手机端 PWA，不依赖电脑。</p>
          <p>余额与用量请到 apikey.fan 网页查看，接口没有开放查询。</p>
          <p>图片保存在本机浏览器存储里；换手机或清缓存前，先把要留的图存到相册。</p>
        </div>
      </Section>

      <div className="h-2" />
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5">
      <h2 className="mb-2 text-[12px] font-medium tracking-wide text-muted">{title}</h2>
      <div className="space-y-3 rounded-2xl border border-line/70 bg-surface/60 p-3">{children}</div>
    </section>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[12.5px] text-fg/80">{label}</div>
      {children}
    </div>
  )
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="mt-1.5 text-[11px] leading-relaxed text-fg3">{children}</p>
}

function Chips({
  options,
  value,
  onChange,
  format,
}: {
  options: string[]
  value: string
  onChange: (v: string) => void
  format?: (v: string) => string
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = o === value
        return (
          <button
            key={o}
            type="button"
            onClick={() => onChange(o)}
            className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[12px] ${
              on ? 'bg-fg/10 text-fg' : 'bg-raised text-muted'
            }`}
          >
            {on && <Check size={12} className="text-accru" />}
            <span className="font-mono">{format ? format(o) : o}</span>
          </button>
        )
      })}
    </div>
  )
}
