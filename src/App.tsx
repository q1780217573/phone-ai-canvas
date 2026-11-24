import { useState } from 'react'
import TabBar, { type TabKey } from './components/TabBar'
import Toasts from './components/Toasts'
import Generate from './pages/Generate'
import Library from './pages/Library'
import Settings from './pages/Settings'
import { useThemeSync } from './lib/theme'

const BOTTOM_PAD = 'calc(var(--tab-h) + var(--sab) + 18px)'

export default function App() {
  useThemeSync()

  const [tab, setTab] = useState<TabKey>('create')
  const [incoming, setIncoming] = useState<{ id: string; blob: Blob } | null>(null)

  const goCreateWith = (blob: Blob) => {
    setIncoming({ id: `${Date.now()}`, blob })
    setTab('create')
  }

  return (
    <div className="h-[100dvh] overflow-hidden bg-ink">
      <div className={tab === 'create' ? 'h-full' : 'hidden'}>
        <div className="scroll-y h-full" style={{ paddingBottom: BOTTOM_PAD }}>
          <Generate incoming={incoming} onConsume={() => setIncoming(null)} />
        </div>
      </div>

      <div className={tab === 'library' ? 'h-full' : 'hidden'}>
        <div className="scroll-y h-full" style={{ paddingBottom: BOTTOM_PAD }}>
          <Library onGoCreate={goCreateWith} />
        </div>
      </div>

      <div className={tab === 'settings' ? 'h-full' : 'hidden'}>
        <div className="scroll-y h-full" style={{ paddingBottom: BOTTOM_PAD }}>
          <Settings />
        </div>
      </div>

      <Toasts />
      <TabBar active={tab} onChange={setTab} />
    </div>
  )
}
