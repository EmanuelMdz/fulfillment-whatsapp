import clsx from 'clsx'
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react'

/**
 * Un aviso en línea: "guardado", "no se pudo", "falta configurar tal
 * cosa". Con `action` (un botón o link) a la derecha.
 */
const TONES = {
  ok: { cls: 'bg-brand-soft text-brand-2', Icon: CheckCircle2 },
  error: { cls: 'bg-danger-soft text-danger', Icon: XCircle },
  warn: { cls: 'bg-warn-soft text-warn', Icon: AlertTriangle },
  info: { cls: 'bg-info-soft text-info', Icon: Info },
}

export default function Notice({ tone = 'info', action, className, children }) {
  const { cls, Icon } = TONES[tone] ?? TONES.info
  return (
    <div className={clsx('flex items-center gap-2.5 rounded-ctl px-3.5 py-2.5 text-[13.5px]', cls, className)}>
      <Icon size={16} className="shrink-0" />
      <span className="min-w-0 flex-1">{children}</span>
      {action}
    </div>
  )
}
