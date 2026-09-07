import clsx from 'clsx'

/**
 * La tabla. En escritorio es una tabla; en el teléfono, una tarjeta por
 * fila con la etiqueta de cada columna al lado del valor — el panel
 * nunca scrollea de costado (regla 6 del repo).
 *
 *   columns: [{ key, label, render?(row), align?: 'right', className? }]
 *   rows:    las filas, tal cual vienen de la base
 */
export default function Table({ columns, rows, rowKey = (r) => r.id, empty = 'Nada por acá todavía.' }) {
  if (!rows.length) return <p className="py-6 text-center text-[13.5px] text-ink-3">{empty}</p>

  const celda = (c, r) => (c.render ? c.render(r) : r[c.key])

  return (
    <>
      <div className="hidden md:block">
        <table className="w-full border-collapse text-[13.5px]">
          <thead>
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={clsx(
                    'border-b border-line pt-1 pb-2.5 pr-3 text-left text-[12px] font-medium text-ink-3 last:pr-0',
                    c.align === 'right' && 'text-right',
                    c.className,
                  )}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={rowKey(r)} className="border-b border-line last:border-0">
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={clsx('py-3 pr-3 align-top last:pr-0', c.align === 'right' && 'text-right', c.className)}
                  >
                    {celda(c, r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="divide-y divide-line md:hidden">
        {rows.map((r) => (
          <li key={rowKey(r)} className="grid gap-1.5 py-3">
            {columns.map((c) => (
              <div key={c.key} className="flex items-start justify-between gap-3 text-[13.5px]">
                <span className="shrink-0 text-[12px] text-ink-3">{c.label}</span>
                <span className="min-w-0 text-right">{celda(c, r)}</span>
              </div>
            ))}
          </li>
        ))}
      </ul>
    </>
  )
}
