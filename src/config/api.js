// API configuration for different environments.
// In dev, API_URL is empty so fetches go to `/api/...` (relative) and are
// proxied by Vite to the backend — sidesteps CORS on the Railway deploy.
export const API_URL = import.meta.env.DEV
  ? ''
  : (import.meta.env.VITE_API_URL || 'http://localhost:3001')
