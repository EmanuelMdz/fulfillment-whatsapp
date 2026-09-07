import clsx from 'clsx'

/** Un círculo con las iniciales. Del nombre si hay, del email si no. */
export default function Avatar({ name, email, size = 36, className }) {
  const base = (name?.trim() || email?.split('@')[0] || '?').replace(/[._-]+/g, ' ')
  const iniciales = base
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('')
  return (
    <span
      className={clsx('grid shrink-0 place-items-center rounded-full bg-brand-soft font-bold text-brand-2', className)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
    >
      {iniciales}
    </span>
  )
}
