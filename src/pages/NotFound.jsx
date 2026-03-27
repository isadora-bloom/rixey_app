import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-cream-50 flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <h1 className="text-6xl font-serif text-sage-300 mb-4">404</h1>
        <h2 className="text-xl font-serif text-sage-800 mb-2">Page not found</h2>
        <p className="text-sage-600 text-sm mb-8">
          The page you're looking for doesn't exist or may have been moved.
        </p>
        <Link
          to="/dashboard"
          className="inline-block px-6 py-2.5 bg-sage-600 text-white rounded-lg text-sm font-medium hover:bg-sage-700 transition-colors"
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  )
}
