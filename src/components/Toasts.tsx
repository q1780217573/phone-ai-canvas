import { useToast } from '../lib/store'

export default function Toasts() {
  const toasts = useToast((s) => s.toasts)
  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-[60] flex flex-col items-center gap-2 px-6"
      style={{ bottom: 'calc(var(--sab) + 84px)' }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className="fade-up max-w-full rounded-full bg-fg px-4 py-2 text-[13px] font-medium text-ink shadow-lg"
        >
          {t.text}
        </div>
      ))}
    </div>
  )
}
