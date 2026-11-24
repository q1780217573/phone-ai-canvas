export type ApiConfig = { baseUrl: string; apiKey: string }

export type ImageSize = '1024x1024' | '1024x1536' | '1536x1024'

export class ApiError extends Error {
  status: number
  constructor(message: string, status = 0) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

const DEFAULT_TIMEOUT = 180_000

function joinUrl(baseUrl: string, path: string) {
  return `${baseUrl.replace(/\/+$/, '')}${path}`
}

async function readError(res: Response): Promise<string> {
  const raw = await res.text().catch(() => '')
  try {
    const json = JSON.parse(raw)
    const msg =
      json?.error?.message ??
      json?.message ??
      json?.error ??
      (typeof json === 'string' ? json : '')
    if (typeof msg === 'string' && msg.trim()) return msg.trim()
  } catch {
    /* 非 JSON 响应 */
  }
  return raw.slice(0, 200).trim() || `HTTP ${res.status}`
}

/** 把原始错误翻译成能看懂的中文 */
export function explainError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401 || err.status === 403) return '密钥无效或没有该模型的权限，去设置里检查。'
    if (err.status === 429) return '请求太频繁或额度不足，稍等一下再试。'
    if (err.status === 404) return `模型不可用：${err.message}`
    if (err.status >= 502) return `中转站返回 ${err.status}：${err.message || '无详情'}，稍后重试一次。`
    if (err.status === 400) return `参数有问题：${err.message}`
    return err.message || '请求失败'
  }
  if (err instanceof DOMException && err.name === 'AbortError') return '已取消'
  if (err instanceof Error) {
    if (/Failed to fetch|NetworkError|Load failed/i.test(err.message))
      return '网络连接失败，检查手机网络后重试。'
    return err.message
  }
  return '未知错误'
}

async function post(
  cfg: ApiConfig,
  path: string,
  body: BodyInit,
  signal?: AbortSignal,
  timeout = DEFAULT_TIMEOUT,
): Promise<Response> {
  if (!cfg.apiKey.trim()) throw new ApiError('还没有填写 API Key', 401)
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeout)
  const onAbort = () => ctrl.abort()
  signal?.addEventListener('abort', onAbort)
  try {
    const res = await fetch(joinUrl(cfg.baseUrl, path), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.apiKey.trim()}`,
        'Content-Type': 'application/json',
      },
      body,
      signal: ctrl.signal,
    })
    if (!res.ok) throw new ApiError(await readError(res), res.status)
    return res
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}

function base64ToBlob(b64: string, type = 'image/png'): Blob {
  const bin = atob(b64)
  const len = bin.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type })
}

type ImageJson = { data?: Array<{ b64_json?: string; url?: string }> }

/** 用文件头判断真实格式，避免把错误内容当图片渲染 */
async function sniffType(blob: Blob): Promise<string | null> {
  const head = new Uint8Array(await blob.slice(0, 12).arrayBuffer())
  const at = (i: number) => head[i] ?? 0
  if (at(0) === 0x89 && at(1) === 0x50 && at(2) === 0x4e && at(3) === 0x47) return 'image/png'
  if (at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) return 'image/jpeg'
  if (at(0) === 0x52 && at(1) === 0x49 && at(2) === 0x46 && at(3) === 0x46 && at(8) === 0x57) return 'image/webp'
  if (at(0) === 0x47 && at(1) === 0x49 && at(2) === 0x46) return 'image/gif'
  return null
}

async function pickImage(json: ImageJson): Promise<Blob> {
  const item = json?.data?.[0]

  if (item?.b64_json) {
    const raw = base64ToBlob(item.b64_json)
    if (raw.size < 512) throw new ApiError(`返回的数据太小，不像图片（${raw.size} 字节）`)
    const type = await sniffType(raw)
    if (!type) throw new ApiError(`返回的内容不是有效图片（${raw.size} 字节）`)
    return new Blob([raw], { type })
  }

  // 少数情况下只给 url，兜底自己下回来
  if (item?.url) {
    const r = await fetch(item.url)
    if (!r.ok) throw new ApiError('图片地址下载失败', r.status)
    const b = await r.blob()
    const type = await sniffType(b)
    if (!b.size || !type) throw new ApiError(`下载到的图片无效（${b.size} 字节）`)
    return new Blob([b], { type })
  }

  throw new ApiError('接口没有返回图片数据')
}

/** 文生图 */
export async function generateImage(
  cfg: ApiConfig,
  opts: { model: string; prompt: string; size: ImageSize; signal?: AbortSignal },
): Promise<Blob> {
  const res = await post(
    cfg,
    '/images/generations',
    JSON.stringify({
      model: opts.model,
      prompt: opts.prompt,
      size: opts.size,
      n: 1,
    }),
    opts.signal,
  )
  return pickImage((await res.json()) as ImageJson)
}

/** 参考图改图（单张或多张） */
export async function editImage(
  cfg: ApiConfig,
  opts: {
    model: string
    prompt: string
    size: ImageSize
    refs: File[]
    signal?: AbortSignal
  },
): Promise<Blob> {
  const form = new FormData()
  form.append('model', opts.model)
  form.append('prompt', opts.prompt)
  form.append('size', opts.size)
  opts.refs.forEach((f) => form.append('image[]', f, f.name || 'ref.png'))

  if (!cfg.apiKey.trim()) throw new ApiError('还没有填写 API Key', 401)
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), DEFAULT_TIMEOUT)
  const onAbort = () => ctrl.abort()
  opts.signal?.addEventListener('abort', onAbort)
  try {
    const res = await fetch(joinUrl(cfg.baseUrl, '/images/edits'), {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfg.apiKey.trim()}` },
      body: form,
      signal: ctrl.signal,
    })
    if (!res.ok) throw new ApiError(await readError(res), res.status)
    return pickImage((await res.json()) as ImageJson)
  } finally {
    clearTimeout(timer)
    opts.signal?.removeEventListener('abort', onAbort)
  }
}

/** 连接自检：一次 1 token 的对话 */
export async function ping(cfg: ApiConfig, model: string): Promise<string> {
  const res = await post(
    cfg,
    '/chat/completions',
    JSON.stringify({
      model,
      messages: [{ role: 'user', content: '连接测试，只回复 OK' }],
      max_tokens: 8,
    }),
    undefined,
    30_000,
  )
  const json = await res.json()
  return json?.choices?.[0]?.message?.content ?? 'OK'
}
