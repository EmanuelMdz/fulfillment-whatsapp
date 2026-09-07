import clsx from 'clsx'

/**
 * La pastilla de estado. Color suave de fondo, texto del mismo tono.
 * Los tonos son semánticos, no decorativos: verde = bien / bot, azul =
 * informativo, amarillo = esperando, rojo = problema, violeta = humano.
 */
const TONES = {
  neutral: 'bg-surface-2 text-ink-2',
  green: 'bg-brand-soft text-brand-2',
  blue: 'bg-info-soft text-info',
  yellow: 'bg-warn-soft text-warn',
  red: 'bg-danger-soft text-danger',
  violet: 'bg-violet-soft text-violet',
  orange: 'bg-orange-soft text-orange',
  dark: 'bg-side text-white',
}

export default function Badge({ tone = 'neutral', icon: Icon, className, children }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-pill px-2.5 py-0.5 text-[12px] font-semibold whitespace-nowrap',
        TONES[tone] ?? TONES.neutral,
        className,
      )}
    >
      {Icon && <Icon size={12} />}
      {children}
    </span>
  )
}
