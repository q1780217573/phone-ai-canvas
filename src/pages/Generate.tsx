import { useEffect, useRef, useState } from 'react'
import { ImagePlus, Plus, Sparkles, X, BookOpen, Camera, Images, FolderOpen, AlertTriangle } from 'lucide-react'
import { useGen, useSettings, useToast, RATIO_SIZE, type Ratio } from '../lib/store'
import { db, type PromptRec, type RefRec } from '../lib/db'
import { useBlobUrl } from '../lib/useBlobUrl'
import GeneratingOverlay from '../components/GeneratingOverlay'
import ResultViewer from '../components/ResultViewer'
import PromptPicker from '../components/PromptPicker'

type RefSlot = { id: string; file: File; url: string }

export default function Generate({
  incoming,
  onConsume,
}: {
  incoming?: { id: string; blob: Blob } | null
  onConsume?: () => void
}) {
  const { imageModel, imageModels, ratio, apiKey, set } = useSettings()
  const { status, elapsed, error, result, run, cancel, clear } = useGen()
  const push = useToast((s) => s.push)

  const [prompt, setPrompt] = useState('')
  const [refs, setRefs] = useState<RefSlot[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [collectOpen, setCollectOpen] = useState(false)
  const [collect, setCollect] = useState<RefRec[]>([])
  const [viewerOpen, setViewerOpen] = useState(false)
  const [recent, setRecent] = useState<PromptRec[]>([])
  const galleryRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!collectOpen) return
    db.refs
      .orderBy('createdAt')
      .reverse()
      .toArray()
      .then(setCollect)
      .catch(() => setCollect([]))
  }, [collectOpen])

  useEffect(() => {
    // useCount 未建索引，取回后在前端排序
    db.prompts
      .toArray()
      .then((list) => setRecent(list.sort((a, b) => b.useCount - a.useCount).slice(0, 8)))
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    if (status === 'done' && result) setViewerOpen(true)
  }, [status, result])

  useEffect(() => {
    if (status === 'error' && error) push(error)
  }, [status, error, push])

  // 从「库 → 参考图」带过来的图片
  useEffect(() => {
    if (!incoming) return
    const blob = incoming.blob
    const file = new File([blob], `ref_${incoming.id}.png`, { type: blob.type || 'image/png' })
    setRefs((prev) =>
      prev.length >= 2 ? prev : [...prev, { id: incoming.id, file, url: URL.createObjectURL(blob) }],
    )
    onConsume?.()
  }, [incoming, onConsume])

  const canRun = prompt.trim().length > 0 && status !== 'running'

  const addFiles = (files: FileList | null) => {
    if (!files?.length) return
    const room = 2 - refs.length
    const arr = Array.from(files).slice(0, room)
    setRefs((prev) => [...prev, ...arr.map((f) => ({ id: `${Date.now()}${Math.random()}`, file: f, url: URL.createObjectURL(f) }))])
    setSheetOpen(false)
  }

  const removeRef = (id: string) =>
    setRefs((prev) => {
      const hit = prev.find((r) => r.id === id)
      if (hit) URL.revokeObjectURL(hit.url)
      return prev.filter((r) => r.id !== id)
    })

  const start = () => {
    if (!prompt.trim()) return push('先写一句描述')
    if (!apiKey.trim()) return push('先到「设置」填 API Key')
    run({ prompt: prompt.trim(), model: imageModel, ratio, refs: refs.map((r) => r.file) })
  }

  const pushBlob = (blob: Blob, name = 'ref.png') => {
    if (refs.length >= 2) {
      push('参考图最多 2 张')
      return false
    }
    const file = new File([blob], name, { type: blob.type || 'image/png' })
    setRefs((prev) =>
      prev.length >= 2
        ? prev
        : [...prev, { id: `${Date.now()}${Math.random()}`, file, url: URL.createObjectURL(blob) }],
    )
    return true
  }

  const useAsRef = (blob: Blob) => {
    if (!pushBlob(blob, `ref_${Date.now()}.png`)) return
    setViewerOpen(false)
    push('已放入参考图，可直接生成相似图')
  }

  return (
    <div className="mx-auto min-h-full w-full max-w-md px-4" style={{ paddingTop: 'calc(var(--sat) + 18px)' }}>
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight">画一张</h1>
          <p className="mt-0.5 text-[12.5px] text-muted">写清楚要什么，10 秒左右出图</p>
        </div>
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="flex items-center gap-1.5 rounded-full border border-line bg-raised px-3 py-1.5 text-[12.5px] text-fg/80 active:opacity-80"
        >
          <BookOpen size={14} /> 词库
        </button>
      </header>

      {/* 模型切换 */}
      <div className="no-scrollbar -mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-0.5">
        {imageModels.map((m) => {
          const on = m.id === imageModel
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => set({ imageModel: m.id })}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-[12px] transition-colors ${
                on
                  ? 'border-accru/70 bg-accru/12 text-accru'
                  : 'border-line bg-raised/60 text-fg2'
              }`}
            >
              {m.label}
            </button>
          )
        })}
      </div>

      {/* 参考图 */}
      <div className="mt-4 rounded-2xl border border-line/80 bg-surface p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[13px] font-medium text-fg/90">
            <ImagePlus size={15} className="text-accru" />
            参考图
            <span className="rounded bg-fg/10 px-1.5 py-0.5 text-[10.5px] text-fg2">{refs.length}/2</span>
          </div>
          <span className="text-[11px] text-muted">加了按图改，不加凭空画</span>
        </div>

        <div className="mt-2.5 flex items-center gap-2">
          {refs.map((r) => (
            <div
              key={r.id}
              className="relative h-[74px] w-[74px] shrink-0 overflow-hidden rounded-xl border border-line"
            >
              <img src={r.url} alt="参考图" className="h-full w-full object-cover" draggable={false} />
              <button
                type="button"
                onClick={() => removeRef(r.id)}
                className="absolute right-1 top-1 rounded-full bg-black/65 p-1 text-white"
              >
                <X size={12} />
              </button>
            </div>
          ))}

          {refs.length < 2 && (
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="flex h-[74px] w-[74px] shrink-0 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-line text-muted active:bg-raised"
            >
              <Plus size={18} />
              <span className="text-[10.5px]">添加</span>
            </button>
          )}

          {refs.length === 0 && (
            <div className="flex-1 text-[11.5px] leading-relaxed text-fg3">
              从相册选、拍照，或用「库 → 参考图」里收藏的图
            </div>
          )}
        </div>
      </div>

      {/* 提示词 */}
      <div className="mt-3 rounded-2xl border border-line/80 bg-surface px-3 py-2.5 focus-within:border-accru/50">
        <textarea
          ref={taRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          placeholder="例如：一位女生站在江南雨巷里，胶片质感，柔和光线"
          className="w-full resize-none bg-transparent text-[14.5px] leading-relaxed outline-none placeholder:text-fg3"
        />
        <div className="mt-1 flex items-center justify-between">
          <span className="text-[11px] text-fg3">{prompt.length} 字</span>
          <button
            type="button"
            onClick={() => {
              setPrompt('')
              taRef.current?.focus()
            }}
            className="text-[11.5px] text-muted"
          >
            清空
          </button>
        </div>
      </div>

      {/* 最近用过的词 */}
      {recent.length > 0 && (
        <div className="no-scrollbar mt-2.5 flex gap-2 overflow-x-auto pb-1">
          {recent.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPrompt(p.body)}
              className="shrink-0 rounded-full border border-line/70 bg-raised/70 px-3 py-1.5 text-[11.5px] text-fg/70 active:opacity-80"
            >
              {p.title}
            </button>
          ))}
        </div>
      )}

      {/* 失败提示：留在页面上，不随 toast 消失 */}
      {status === 'error' && error && (
        <div className="mt-3 rounded-xl border border-dangerline bg-danger p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle size={15} className="mt-0.5 shrink-0 text-dangericon" />
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] font-medium text-dangerfg">生成失败</div>
              <div className="mt-0.5 break-words text-[12px] leading-relaxed text-dangerfg2">{error}</div>
            </div>
            <button type="button" onClick={clear} className="shrink-0 p-1 text-[11px] text-dangerfg2">
              关闭
            </button>
          </div>
        </div>
      )}

      {/* 比例 + 模型 */}
      <div className="mt-3 flex items-center gap-2">
        {(['1:1', '3:4', '4:3'] as Ratio[]).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => set({ ratio: r })}
            className={`rounded-lg px-3 py-1.5 text-[12.5px] ${
              ratio === r ? 'bg-fg/10 text-fg' : 'text-muted'
            }`}
          >
            {r}
          </button>
        ))}
        <div className="ml-auto font-mono text-[10.5px] text-muted/70">{RATIO_SIZE[ratio]}</div>
      </div>

      <button
        type="button"
        disabled={!canRun}
        onClick={start}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-accru to-accru2 py-4 text-[15.5px] font-semibold text-white shadow-lg shadow-accru/15 active:opacity-90 disabled:from-fg/12 disabled:to-fg/12 disabled:text-fg2 disabled:opacity-100 disabled:shadow-none"
      >
        <Sparkles size={18} />
        {status === 'running' ? '生成中…' : refs.length > 0 ? '按参考图生成' : '生成图片'}
      </button>

      <p className="mb-2 mt-2 text-center text-[11px] text-fg3">
        {prompt.trim() ? '会消耗额度，单张约 10–15 秒' : '先写一句描述，再点生成'}
      </p>

      <input ref={galleryRef} type="file" accept="image/*" multiple hidden onChange={(e) => addFiles(e.target.files)} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => addFiles(e.target.files)} />

      {sheetOpen && (
        <div className="fixed inset-0 z-40 flex items-end bg-black/50" onClick={() => setSheetOpen(false)}>
          <div
            className="fade-up w-full rounded-t-2xl border-t border-line bg-surface p-3"
            style={{ paddingBottom: 'calc(var(--sab) + 12px)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-2 pb-2 text-[12px] text-muted">选择参考图（最多 2 张）</div>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => galleryRef.current?.click()}
                className="flex flex-col items-center gap-2 rounded-xl border border-line bg-raised py-5 text-[12.5px] active:opacity-80"
              >
                <Images size={21} className="text-accru" /> 相册
              </button>
              <button
                type="button"
                onClick={() => cameraRef.current?.click()}
                className="flex flex-col items-center gap-2 rounded-xl border border-line bg-raised py-5 text-[12.5px] active:opacity-80"
              >
                <Camera size={21} className="text-accru" /> 拍照
              </button>
              <button
                type="button"
                onClick={() => {
                  setSheetOpen(false)
                  setCollectOpen(true)
                }}
                className="flex flex-col items-center gap-2 rounded-xl border border-line bg-raised py-5 text-[12.5px] active:opacity-80"
              >
                <FolderOpen size={21} className="text-accru" /> 收藏
              </button>
            </div>
            <button
              type="button"
              onClick={() => setSheetOpen(false)}
              className="mt-2 w-full rounded-xl border border-line py-3 text-[13.5px] text-fg/70"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {collectOpen && (
        <div className="fixed inset-0 z-[45] flex items-end bg-black/55" onClick={() => setCollectOpen(false)}>
          <div
            className="fade-up flex max-h-[70vh] w-full flex-col rounded-t-2xl border-t border-line bg-surface p-3"
            style={{ paddingBottom: 'calc(var(--sab) + 12px)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center px-1 pb-2">
              <span className="text-[14px] font-medium">收藏的参考图</span>
              <button type="button" onClick={() => setCollectOpen(false)} className="ml-auto p-1.5 text-muted">
                <X size={17} />
              </button>
            </div>

            <div className="scroll-y min-h-0 flex-1">
              {collect.length === 0 ? (
                <div className="py-10 text-center text-[12.5px] leading-relaxed text-muted">
                  还没有收藏
                  <br />
                  去「库 → 参考图」上传几张常用的
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-1.5">
                  {collect.map((r) => (
                    <CollectCell
                      key={r.id}
                      rec={r}
                      onPick={() => {
                        if (pushBlob(r.blob, `collect_${r.id}.png`)) {
                          setCollectOpen(false)
                          push('已放入参考图')
                        }
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {status === 'running' && (
        <GeneratingOverlay
          elapsed={elapsed}
          ratio={ratio}
          onCancel={cancel}
          bgUrl={refs[0]?.url}
        />
      )}

      {viewerOpen && result && (
        <ResultViewer
          rec={result}
          onClose={() => {
            setViewerOpen(false)
            clear()
          }}
          onEditPrompt={() => {
            setViewerOpen(false)
            if (result) setPrompt(result.promptText)
            clear()
            setTimeout(() => taRef.current?.focus(), 60)
          }}
          onUseAsRef={useAsRef}
        />
      )}

      {pickerOpen && (
        <PromptPicker
          onClose={() => setPickerOpen(false)}
          onPick={(text) => {
            setPrompt(text)
            setPickerOpen(false)
          }}
        />
      )}
    </div>
  )
}

function CollectCell({ rec, onPick }: { rec: RefRec; onPick: () => void }) {
  const url = useBlobUrl(rec.blob)
  return (
    <button
      type="button"
      onClick={onPick}
      className="relative aspect-square overflow-hidden rounded-lg border border-line/70 bg-raised active:opacity-75"
    >
      <img src={url} alt="" className="h-full w-full object-cover" draggable={false} />
    </button>
  )
}
