import clsx from 'clsx'
import { Bar, BarChart, Cell, ResponsiveContainer } from 'recharts'
import Badge from './Badge.jsx'
import Card from './Card.jsx'

/**
 * La tarjeta de un número: ícono en un cuadrado de color suave, el
 * nombre, el valor grande, una pastilla con la variación, una nota, y a
 * la derecha las barritas de los últimos días (la última en verde).
 *
 *   delta: { text: '+5.4%', tone: 'green' | 'red' | 'neutral' }
 *   spark: [3, 5, 2, 8, 6, 9, 12]  — un número por día
 */
const TONES = {
  green: 'bg-brand-soft text-brand-2',
  violet: 'bg-violet-soft text-violet',
  orange: 'bg-orange-soft text-orange',
  blue: 'bg-info-soft text-info',
  red: 'bg-danger-soft text-danger',
}

export default function Kpi({ icon: Icon, tone = 'green', label, value, delta, note, spark, alert = false }) {
  const datos = (spark ?? []).map((v, i) => ({ i, v }))
  return (
    <Card className={clsx(alert && 'ring-1 ring-danger/40')}>
      <div className="flex items-center gap-2.5">
        <span className={clsx('grid h-9 w-9 shrink-0 place-items-center rounded-xl', TONES[tone] ?? TONES.green)}>
          {Icon && <Icon size={17} />}
        </span>
        <span className="text-[14px] font-semibold text-ink">{label}</span>
      </div>
      <div className="mt-4 flex items-end justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span
            className={clsx(
              'text-[26px] leading-none font-bold tracking-tight tabular-nums',
              alert ? 'text-danger' : 'text-ink',
            )}
          >
            {value}
          </span>
          {delta && <Badge tone={delta.tone ?? 'neutral'}>{delta.text}</Badge>}
        </div>
        {datos.length > 1 && (
          <div className="h-10 w-16 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={datos} barCategoryGap={3} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <Bar dataKey="v" radius={[3, 3, 3, 3]} isAnimationActive={false} minPointSize={2}>
                  {datos.map((d, i) => (
                    <Cell key={i} fill={i === datos.length - 1 ? 'var(--color-brand)' : 'var(--color-line)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
      {note && <p className="mt-3 text-[12px] text-ink-3">{note}</p>}
    </Card>
  )
}
