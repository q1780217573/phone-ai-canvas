import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

const STAGES = [
  '正在理解描述…',
  '正在构图…',
  '正在铺色…',
  '正在细化细节…',
  '正在收尾…',
]

/**
 * 生成态：实测单张 10–12 秒，上游不返回中间帧，
 * 所以给的是计时 + 阶段文案，不做假进度条。
 * 底层把当前页面与参考图虚化，避免整块死黑。
 */
export default function GeneratingOverlay({
  elapsed,
  ratio,
  onCancel,
  bgUrl,
}: {
  elapsed: number
  ratio: '1:1' | '3:4' | '4:3'
  onCancel: () => void
  bgUrl?: string
}) {
  const [stage, setStage] = useState(0)

  useEffect(() => {
    const t = window.setInterval(() => {
      setStage((s) => (s + 1 < STAGES.length ? s + 1 : s))
    }, 2600)
    return () => window.clearInterval(t)
  }, [])

  const aspect = ratio === '1:1' ? '1 / 1' : ratio === '3:4' ? '3 / 4' : '4 / 3'

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* 1. 参考图作为底色，重度虚化 */}
      {bgUrl && (
        <img
          src={bgUrl}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full scale-125 object-cover opacity-50 blur-3xl"
        />
      )}

      {/* 2. 页面本身的虚化遮罩 */}
      <div className="absolute inset-0 bg-ink/70 backdrop-blur-2xl" />

      {/* 3. 顶部/底部渐隐，压住边缘 */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-ink/60 via-transparent to-ink/80" />

      {/* 内容 */}
      <div className="relative flex h-full flex-col items-center justify-center px-8">
        <div
          className="relative w-full max-w-[248px] overflow-hidden rounded-3xl border border-white/10 shadow-2xl shadow-black/40"
          style={{ aspectRatio: aspect }}
        >
          <div className="skeleton absolute inset-0" />
          {/* 扫光 */}
          <div className="absolute inset-0 animate-pulse bg-gradient-to-tr from-transparent via-white/10 to-transparent" />
          {/* 中央光点 */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="h-10 w-10 animate-ping rounded-full bg-accru/40" />
            <span className="absolute h-2.5 w-2.5 rounded-full bg-accru" />
          </div>
        </div>

        {/* 不确定进度条：只表示在跑，不假装百分比 */}
        <div className="mt-7 h-[3px] w-40 overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-1/3 animate-[slide_1.6s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-accru to-accru2" />
        </div>

        <div className="mt-4 text-center">
          <div className="text-[15px] font-medium text-fg/90">{STAGES[stage]}</div>
          <div className="mt-1.5 font-mono text-[13px] tabular-nums text-fg3">
            已用时 {elapsed} 秒 · 通常 10–15 秒
          </div>
        </div>

        <button
          type="button"
          onClick={onCancel}
          className="mt-8 flex items-center gap-1.5 rounded-full border border-white/15 bg-black/20 px-4 py-2 text-[13px] text-fg/70 backdrop-blur active:bg-white/10"
        >
          <X size={15} /> 取消
        </button>
      </div>
    </div>
  )
}
