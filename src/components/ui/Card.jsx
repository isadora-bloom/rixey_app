export default function Card({
  title,
  compact = false,
  className = '',
  children,
  ...props
}) {
  return (
    <div
      className={`
        bg-white rounded-2xl shadow-sm border border-cream-200
        ${compact ? 'p-4' : 'p-6'}
        ${className}
      `.trim().replace(/\s+/g, ' ')}
      {...props}
    >
      {title && (
        <h3 className="text-lg font-serif text-sage-800 mb-4">{title}</h3>
      )}
      {children}
    </div>
  )
}
