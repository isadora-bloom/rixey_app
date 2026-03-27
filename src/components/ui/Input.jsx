export default function Input({
  label,
  error,
  className = '',
  id,
  ...props
}) {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined)

  return (
    <div className={label || error ? 'space-y-1' : ''}>
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-sage-700">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`
          w-full border border-cream-200 rounded-lg px-3 py-2 text-sm
          focus:outline-none focus:ring-2 focus:ring-sage-300 focus:border-sage-300
          placeholder:text-sage-300 disabled:bg-cream-50 disabled:text-sage-400
          ${error ? 'border-red-300 focus:ring-red-300' : ''}
          ${className}
        `.trim().replace(/\s+/g, ' ')}
        {...props}
      />
      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}
    </div>
  )
}
