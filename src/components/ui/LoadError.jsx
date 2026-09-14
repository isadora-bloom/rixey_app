import Button from './Button'

/**
 * Shown in place of an empty state when a load actually failed (401, 500,
 * network drop) rather than there being nothing to show. Before this,
 * every raw fetch swallowed its own failure and the couple saw "no guests
 * yet" when the truth was "your session lapsed" or "the server is down".
 */
export default function LoadError({ what, error, onRetry, className = '' }) {
  const message = error?.message || 'Something went wrong.'
  return (
    <div
      className={`
        rounded-2xl border border-red-200 bg-red-50 p-6 text-center
        ${className}
      `.trim().replace(/\s+/g, ' ')}
    >
      <p className="text-sm font-medium text-red-800">
        Could not load {what || 'this'}
      </p>
      <p className="mt-1 text-sm text-red-700">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-3" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  )
}
