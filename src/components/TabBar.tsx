import { Sparkles, Images, Settings as SettingsIcon } from 'lucide-react'

export type TabKey = 'create' | 'library' | 'settings'

const ITEMS: Array<{ key: TabKey; label: string; Icon: typeof Sparkles }> = [
  { key: 'create', label: '生图', Icon: Sparkles },
  { key: 'library', label: '库', Icon: Images },
  { key: 'settings', label: '设置', Icon: SettingsIcon },
]

export default function TabBar({
  active,
  onChange,
}: {
  active: TabKey
  onChange: (k: TabKey) => void
}) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line/70 bg-ink/95 backdrop-blur"
      style={{ paddingBottom: 'var(--sab)' }}
    >
      <div className="mx-auto flex max-w-md items-stretch justify-around">
        {ITEMS.map(({ key, label, Icon }) => {
          const on = key === active
          return (
            <button
              key={key}
              type="button"
              onClick={() => onChange(key)}
              className={`flex flex-1 flex-col items-center gap-1 pb-2 pt-2.5 transition-colors ${
                on ? 'text-accru' : 'text-muted'
              }`}
            >
              <Icon size={21} strokeWidth={on ? 2.3 : 1.8} />
              <span className="text-[11px] leading-none">{label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
