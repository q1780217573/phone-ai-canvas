import { useEffect, useState } from 'react'

const cache = new WeakMap<Blob, string>()

/**
 * 稳定的 objectURL：
 * 同一个 Blob 只创建一次，会话内不主动回收。
 * 早期实现用 useEffect 清理时 revoke，在 StrictMode 双执行下会把
 * 正在使用的 URL 提前吊销，图片就变成"损坏的图标"。
 */
export function useBlobUrl(blob?: Blob | null): string {
  const [url, setUrl] = useState('')

  useEffect(() => {
    if (!blob) {
      setUrl('')
      return
    }
    let u = cache.get(blob)
    if (!u) {
      u = URL.createObjectURL(blob)
      cache.set(blob, u)
    }
    setUrl(u)
  }, [blob])

  return url
}
