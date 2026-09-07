import clsx from 'clsx'

/**
 * Los controles de formulario. `Field` es la etiqueta con su ayuda;
 * adentro va un `Input`, `Select` o `Textarea` (todos usan la clase
 * `.ctl` definida en styles.css). `Checkbox` y `Radio` traen su propio
 * texto al lado.
 */

export function Field({ label, hint, className, children }) {
  return (
    <label className={clsx('block', className)}>
      {label && <span className="mb-1.5 block text-[12.5px] font-medium text-ink-2">{label}</span>}
      {children}
      {hint && <span className="mt-1.5 block text-[12px] text-ink-3">{hint}</span>}
    </label>
  )
}

export function Input({ className, ...rest }) {
  return <input className={clsx('ctl', className)} {...rest} />
}

export function Select({ className, children, ...rest }) {
  return (
    <select className={clsx('ctl', className)} {...rest}>
      {children}
    </select>
  )
}

export function Textarea({ className, ...rest }) {
  return <textarea className={clsx('ctl', className)} {...rest} />
}

export function Checkbox({ label, className, ...rest }) {
  return (
    <label className={clsx('flex cursor-pointer items-start gap-2.5 text-[13.5px] text-ink-2', className)}>
      <input type="checkbox" className="mt-[3px] h-4 w-4 shrink-0 accent-brand" {...rest} />
      <span>{label}</span>
    </label>
  )
}

export function Radio({ label, className, ...rest }) {
  return (
    <label className={clsx('flex cursor-pointer items-start gap-2.5 text-[13.5px] text-ink-2', className)}>
      <input type="radio" className="mt-[3px] h-4 w-4 shrink-0 accent-brand" {...rest} />
      <span>{label}</span>
    </label>
  )
}
