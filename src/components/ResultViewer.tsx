import { useState } from 'react'
import { useBlobUrl } from '../lib/useBlobUrl'
import {
  Download,
  Share2,
  Pencil,
  Star,
  X,
  ImagePlus,
  Trash2,
  Check,
} from 'lucide-react'
import type { ImageRec } from '../lib/db'
import { fileNameFor, saveToPhone } from '../lib/image'
import { useToast } from '../lib/store'
import { db } from '../lib/db'

export default function ResultViewer({
  rec,
  mode = 'generate',
  onClose,
  onEditPrompt,
  onUseAsRef,
  onDelete,
}: {
  rec: ImageRec
  mode?: 'generate' | 'library'
  onClose: () => void
  onEditPrompt: () => void
  onUseAsRef: (blob: Blob) => void
  onDelete?: () => void
}) {
  const push = useToast((s) => s.push)
  const [fav, setFav] = useState(rec.fav === 1)
  const [busy, setBusy] = useState(false)
  const [broken, setBroken] = useState(false)

  const url = useBlobUrl(rec.full ?? rec.thumb)

  const blob = rec.full ?? rec.thumb

  const handleSave = async () => {
    setBusy(true)
    try {
      const r = await saveToPhone(blob, fileNameFor())
      if (r === 'downloaded') push('已保存到手机「下载」目录')
      if (r === 'shared') push('已打开分享面板，可存进相册')
    } catch {
      push('保存失败，试试长按图片另存')
    } finally {
      setBusy(false)
    }
  }

  const handleShare = async () => {
    const file = new File([blob], fileNameFor(), { type: blob.type || 'image/png' })
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean; share?: (d: ShareData) => Promise<void> }
    if (nav.share && nav.canShare?.({ files: [file] })) {
      try {
        await nav.share({ files: [file] })
      } catch {
        /* 用户取消 */
      }
    } else {
      push('当前浏览器不支持分享，请用「保存到手机」')
    }
  }

  const toggleFav = async () => {
    const next = fav ? 0 : 1
    setFav(!fav)
    await db.images.update(rec.id, { fav: next as 0 | 1 })
    push(next === 1 ? '已收藏' : '已取消收藏')
  }

  return (
    <div data-theme="dark" className="fixed inset-0 z-50 flex flex-col bg-ink">
      <div
        className="flex items-center justify-between px-4 pb-2"
        style={{ paddingTop: 'calc(var(--sat) + 12px)' }}
      >
        <button type="button" onClick={onClose} className="rounded-full p-2 text-fg/70 active:bg-raised">
          <X size={20} />
        </button>
        <div className="font-mono text-[11px] text-muted">
          {rec.ratio} · {rec.model.replace('gpt-image-', '')}
        </div>
        <div className="flex items-center">
          {onDelete && (
            <button type="button" onClick={onDelete} className="rounded-full p-2 text-fg/60 active:bg-raised">
              <Trash2 size={19} />
            </button>
          )}
          <button
            type="button"
            onClick={toggleFav}
            className={`rounded-full p-2 active:bg-raised ${fav ? 'text-accru' : 'text-fg/70'}`}
          >
            <Star size={20} fill={fav ? 'currentColor' : 'none'} />
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center px-3">
        {broken ? (
          <div className="rounded-xl border border-line bg-surface px-5 py-6 text-center text-[13px] leading-relaxed text-muted">
            这张图没能显示出来
            <br />
            <span className="text-[11.5px]">可能是图片数据异常，关掉回生图页重试</span>
          </div>
        ) : !url ? (
          <div className="skeleton h-[60%] w-[70%] rounded-xl" />
        ) : (
          <img
            src={url}
            alt="生成结果"
            draggable={false}
            onError={() => setBroken(true)}
            className="max-h-full max-w-full rounded-xl object-contain fade-up"
          />
        )}
      </div>

      <div
        className="border-t border-line/70 bg-surface/60 px-4 pt-3"
        style={{ paddingBottom: 'calc(var(--sab) + 12px)' }}
      >
        <p className="line-clamp-2 text-[12.5px] leading-relaxed text-muted">{rec.promptText}</p>

        {mode === 'library' ? (
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={handleSave}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-accru to-accru2 py-3 text-[14px] font-semibold text-white active:opacity-85 disabled:from-fg/12 disabled:to-fg/12 disabled:text-fg2 disabled:opacity-100"
            >
              <Download size={17} /> 保存到手机
            </button>
            <button
              type="button"
              onClick={handleShare}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-line bg-raised px-4 py-3 text-[14px] text-fg/85 active:opacity-80"
            >
              <Share2 size={17} />
            </button>
          </div>
        ) : (
          <div className="mt-2.5 flex items-center gap-1.5 text-[11.5px] text-fg3">
            <Check size={13} className="text-accru" />
            已存入「库」，要存到相册可在库里操作
          </div>
        )}

        <div className="mt-2 grid grid-cols-2 gap-2">
          <ActionBtn icon={<Pencil size={15} />} label="改描述" onClick={onEditPrompt} />
          <ActionBtn icon={<ImagePlus size={15} />} label="作参考图" onClick={() => onUseAsRef(blob)} />
        </div>

        {mode === 'generate' && (
          <button
            type="button"
            onClick={onClose}
            className="mt-2 w-full rounded-xl border border-line py-3 text-[14px] font-medium text-fg/85 active:bg-raised"
          >
            完成
          </button>
        )}
      </div>
    </div>
  )
}

function ActionBtn({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-center gap-1.5 rounded-lg border border-line/80 py-2.5 text-[12.5px] text-fg/75 active:bg-raised"
    >
      {icon}
      {label}
    </button>
  )
}
