import clsx from 'clsx'

/**
 * La tarjeta: la unidad de todo el panel. Fondo blanco, esquinas
 * redondeadas, sombra suave. Con `title` trae cabecera; `actions` va a
 * la derecha de la cabecera (botones, filtros).
 *
 * `padded={false}` saca el relleno del cuerpo: para listas y chats que
 * manejan su propio espacio hasta el borde.
 */
export default function Card({ title, subtitle, actions, padded = true, className, bodyClassName, children }) {
  const conCabecera = Boolean(title || actions)
  return (
    <section className={clsx('rounded-card bg-surface shadow-card', className)}>
      {conCabecera && (
        <header className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
          <div className="min-w-0">
            {title && <h2 className="text-[16px] font-bold text-ink">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-[12.5px] text-ink-3">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={clsx(padded && 'px-5 pb-5', padded && (conCabecera ? 'pt-4' : 'pt-5'), bodyClassName)}>
        {children}
      </div>
    </section>
  )
}
