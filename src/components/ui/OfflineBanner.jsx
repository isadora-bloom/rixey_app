import { useEffect, useState } from 'react'

/**
 * A plain line at the top of the page while the browser has no connection.
 *
 * Without it a dropped connection showed up as a wall of red in the console
 * and a browser error page, and nothing on screen said why saves had
 * stopped. Recordings and autosaves keep their local copies and go through
 * once the connection is back.
 */
export default function OfflineBanner() {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))
  useEffect(() => {
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])
  if (online) return null
  return (
    <div role="status" className="fixed top-0 inset-x-0 z-[100] bg-amber-100 text-amber-900 text-sm text-center py-2 px-4 border-b border-amber-200">
      You are offline. Nothing will save until the connection is back; anything you have typed or recorded stays on this device.
    </div>
  )
}
