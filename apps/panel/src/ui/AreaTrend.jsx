import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

/**
 * El gráfico de área verde con degradé: una serie por día. `data` es
 * [{ dia: 'Lun', valor: 12 }, …]. El tooltip muestra el valor del día.
 */
export default function AreaTrend({ data, x = 'dia', y = 'valor', height = 220, nombre = 'Valor' }) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="areaBrand" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-brand)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--color-brand)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--color-line)" strokeDasharray="3 3" />
          <XAxis dataKey={x} axisLine={false} tickLine={false} dy={6} />
          <YAxis axisLine={false} tickLine={false} allowDecimals={false} width={36} />
          <Tooltip
            cursor={{ stroke: 'var(--color-brand)', strokeDasharray: '3 3' }}
            contentStyle={{
              borderRadius: 10,
              border: '1px solid var(--color-line)',
              boxShadow: 'var(--shadow-pop)',
              fontSize: 13,
            }}
            formatter={(v) => [v, nombre]}
          />
          <Area
            type="monotone"
            dataKey={y}
            name={nombre}
            stroke="var(--color-brand)"
            strokeWidth={2.5}
            fill="url(#areaBrand)"
            dot={false}
            activeDot={{ r: 5, fill: 'var(--color-brand)', stroke: '#fff', strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
