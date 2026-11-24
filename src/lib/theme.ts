import { useEffect } from 'react'
import { useSettings } from './store'

export type ThemeMode = 'auto' | 'light' | 'dark'

const META_DARK = '#0B0B0F'
const META_LIGHT = '#F7F6F3'

const media = () => window.matchMedia('(prefers-color-scheme: dark)')

function resolve(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'auto') return media().matches ? 'dark' : 'light'
  return mode
}

/** 把主题写到 <html data-theme>，同时同步状态栏颜色 */
export function applyTheme(mode: ThemeMode) {
  const resolved = resolve(mode)
  document.documentElement.dataset.theme = resolved
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', resolved === 'dark' ? META_DARK : META_LIGHT)
}

/** 挂在 App 顶层：跟随设置，并在 auto 模式下监听系统切换 */
export function useThemeSync() {
  const mode = useSettings((s) => s.theme)

  useEffect(() => {
    applyTheme(mode)
    if (mode !== 'auto') return
    const mq = media()
    const onChange = () => applyTheme('auto')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [mode])
}
