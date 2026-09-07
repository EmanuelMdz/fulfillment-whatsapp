/**
 * Lo que se ve cuando no hay nada: un ícono, una frase, y si corresponde
 * la acción que lo llena.
 */
export default function EmptyState({ icon: Icon, title, text, action }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
      {Icon && (
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-surface-2 text-ink-3">
          <Icon size={20} />
        </span>
      )}
      {title && <p className="text-[14px] font-semibold text-ink">{title}</p>}
      {text && <p className="max-w-sm text-[13px] text-ink-3">{text}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
