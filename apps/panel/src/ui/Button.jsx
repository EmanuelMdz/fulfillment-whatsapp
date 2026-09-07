import clsx from 'clsx'
import { Link } from 'react-router-dom'

/**
 * El botón. Cinco variantes, tres tamaños, un ícono opcional de lucide.
 * Con `to` se vuelve un link del router que se ve igual.
 *
 *   primary  la acción principal de la pantalla (verde). Una por tarjeta.
 *   default  el resto: borde y fondo blanco.
 *   ghost    sin borde, para acciones secundarias en cabeceras.
 *   danger   borrar, cerrar: texto rojo.
 *   dark     el botón de la barra oscura.
 */
const BASE =
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-ctl font-semibold transition-colors duration-150 disabled:cursor-default disabled:opacity-50'

const VARIANTS = {
  primary: 'bg-brand text-white hover:bg-brand-2',
  default: 'border border-line bg-surface text-ink hover:bg-surface-2',
  ghost: 'text-ink-2 hover:bg-surface-2 hover:text-ink',
  danger: 'border border-line bg-surface text-danger hover:bg-danger-soft',
  dark: 'bg-side text-white hover:bg-side-2',
}

const SIZES = {
  md: 'h-10 px-4 text-[14px]',
  sm: 'h-8 px-3 text-[13px]',
  icon: 'h-9 w-9',
}

export default function Button({ variant = 'default', size = 'md', icon: Icon, to, className, children, ...props }) {
  const cls = clsx(BASE, VARIANTS[variant] ?? VARIANTS.default, SIZES[size] ?? SIZES.md, className)
  const inner = (
    <>
      {Icon && <Icon size={size === 'sm' ? 14 : 16} />}
      {children}
    </>
  )
  if (to) {
    return (
      <Link to={to} className={cls} {...props}>
        {inner}
      </Link>
    )
  }
  return (
    <button type="button" className={cls} {...props}>
      {inner}
    </button>
  )
}
