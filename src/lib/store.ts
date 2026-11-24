import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { db, enforceRetention, uid, type ImageRec } from './db'
import { editImage, generateImage, explainError, type ImageSize } from './api'
import { makeThumb } from './image'

export type Ratio = '1:1' | '3:4' | '4:3'

export const RATIO_SIZE: Record<Ratio, ImageSize> = {
  '1:1': '1024x1024',
  '3:4': '1024x1536',
  '4:3': '1536x1024',
}

export type ModelItem = { id: string; label: string }

export const DEFAULT_CHAT_MODELS: ModelItem[] = [
  { id: 'gpt-6.1-sol', label: 'GPT-6.1 Sol' },
  { id: 'gpt-6-luna', label: 'GPT-6 Luna' },
  { id: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro' },
]

export const DEFAULT_IMAGE_MODELS: ModelItem[] = [
  { id: 'gpt-image-2.6-sunburst', label: 'Image 2.6 精细' },
  { id: 'gpt-image-2.6-flare', label: 'Image 2.6 创意' },
]

type SettingsState = {
  baseUrl: string
  apiKey: string
  chatModel: string
  imageModel: string
  chatModels: ModelItem[]
  imageModels: ModelItem[]
  ratio: Ratio
  keepOriginals: number
  theme: 'auto' | 'light' | 'dark'
  set: (patch: Partial<Omit<SettingsState, 'set'>>) => void
  addModel: (kind: 'chat' | 'image', item: ModelItem) => void
  removeModel: (kind: 'chat' | 'image', id: string) => void
  updateModel: (kind: 'chat' | 'image', id: string, patch: Partial<ModelItem>) => void
}

export const useSettings = create<SettingsState>()(
  persist(
    (set, get) => ({
      baseUrl: 'https://api.apikey.fan/v1',
      apiKey: '',
      chatModel: DEFAULT_CHAT_MODELS[0].id,
      imageModel: DEFAULT_IMAGE_MODELS[0].id,
      chatModels: DEFAULT_CHAT_MODELS,
      imageModels: DEFAULT_IMAGE_MODELS,
      ratio: '3:4',
      keepOriginals: 100,
      theme: 'auto',
      set: (patch) => set(patch),

      addModel: (kind, item) => {
        const key = kind === 'chat' ? 'chatModels' : 'imageModels'
        const list = get()[key]
        if (list.some((m) => m.id === item.id)) return
        set({ [key]: [...list, item] } as Partial<SettingsState>)
      },

      removeModel: (kind, id) => {
        const key = kind === 'chat' ? 'chatModels' : 'imageModels'
        const list = get()[key].filter((m) => m.id !== id)
        if (!list.length) return
        const patch: Partial<SettingsState> = { [key]: list } as Partial<SettingsState>
        // 删掉的正好是当前选中项，就回退到第一个
        if (kind === 'chat' && get().chatModel === id) patch.chatModel = list[0].id
        if (kind === 'image' && get().imageModel === id) patch.imageModel = list[0].id
        set(patch)
      },

      updateModel: (kind, id, patchItem) => {
        const key = kind === 'chat' ? 'chatModels' : 'imageModels'
        const list = get()[key].map((m) => (m.id === id ? { ...m, ...patchItem } : m))
        set({ [key]: list } as Partial<SettingsState>)
        if (patchItem.id && patchItem.id !== id) {
          if (kind === 'chat' && get().chatModel === id) set({ chatModel: patchItem.id })
          if (kind === 'image' && get().imageModel === id) set({ imageModel: patchItem.id })
        }
      },
    }),
    {
      name: 'ai-canvas-settings',
      version: 2,
      migrate: (persisted: any) => {
        const s = persisted ?? {}
        if (!Array.isArray(s.chatModels) || s.chatModels.length === 0) s.chatModels = DEFAULT_CHAT_MODELS
        if (!Array.isArray(s.imageModels) || s.imageModels.length === 0) s.imageModels = DEFAULT_IMAGE_MODELS
        // 旧版本只存过单个模型 ID，若不在列表里就补进去
        if (s.chatModel && !s.chatModels.some((m: ModelItem) => m.id === s.chatModel)) {
          s.chatModels = [{ id: s.chatModel, label: s.chatModel }, ...s.chatModels]
        }
        if (s.imageModel && !s.imageModels.some((m: ModelItem) => m.id === s.imageModel)) {
          s.imageModels = [{ id: s.imageModel, label: s.imageModel }, ...s.imageModels]
        }
        if (!s.theme) s.theme = 'auto'
        return s
      },
    },
  ),
)

type Toast = { id: number; text: string }
type ToastState = {
  toasts: Toast[]
  push: (text: string) => void
}
export const useToast = create<ToastState>((set) => ({
  toasts: [],
  push: (text) => {
    const id = Date.now() + Math.random()
    set((s) => ({ toasts: [...s.toasts, { id, text }] }))
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
    }, 2600)
  },
}))

type GenArgs = {
  prompt: string
  model: string
  ratio: Ratio
  refs: File[]
}

type GenState = {
  status: 'idle' | 'running' | 'done' | 'error'
  elapsed: number
  error: string
  result: ImageRec | null
  controller: AbortController | null
  run: (args: GenArgs) => Promise<void>
  cancel: () => void
  clear: () => void
}

let timer: number | undefined

export const useGen = create<GenState>((set, get) => ({
  status: 'idle',
  elapsed: 0,
  error: '',
  result: null,
  controller: null,

  clear: () => set({ status: 'idle', result: null, error: '', elapsed: 0 }),

  cancel: () => {
    get().controller?.abort()
    if (timer) window.clearInterval(timer)
    set({ status: 'idle', controller: null })
  },

  run: async ({ prompt, model, ratio, refs }) => {
    const cfg = useSettings.getState()
    const controller = new AbortController()
    const startedAt = Date.now()
    set({ status: 'running', elapsed: 0, error: '', result: null, controller })

    if (timer) window.clearInterval(timer)
    timer = window.setInterval(() => {
      set({ elapsed: Math.floor((Date.now() - startedAt) / 1000) })
    }, 250)

    try {
      const size = RATIO_SIZE[ratio]
      const blob =
        refs.length > 0
          ? await editImage({ baseUrl: cfg.baseUrl, apiKey: cfg.apiKey }, {
              model,
              prompt,
              size,
              refs,
              signal: controller.signal,
            })
          : await generateImage({ baseUrl: cfg.baseUrl, apiKey: cfg.apiKey }, {
              model,
              prompt,
              size,
              signal: controller.signal,
            })

      const thumb = await makeThumb(blob)
      const rec: ImageRec = {
        id: uid(),
        promptText: prompt,
        model,
        size,
        ratio,
        thumb,
        full: blob,
        fav: 0,
        createdAt: Date.now(),
      }
      await db.images.add(rec)
      await enforceRetention(cfg.keepOriginals)

      if (timer) window.clearInterval(timer)
      set({ status: 'done', result: rec, controller: null })
    } catch (e) {
      if (timer) window.clearInterval(timer)
      const aborted = e instanceof DOMException && e.name === 'AbortError'
      set({
        status: aborted ? 'idle' : 'error',
        error: aborted ? '' : explainError(e),
        controller: null,
      })
    }
  },
}))
