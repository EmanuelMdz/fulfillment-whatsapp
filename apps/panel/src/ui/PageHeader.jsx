/**
 * El título de cada pantalla, con su bajada y, a la derecha, las
 * acciones de la pantalla (filtros, el botón de alta).
 */
export default function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-[24px] font-bold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-[13.5px] text-ink-2">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
