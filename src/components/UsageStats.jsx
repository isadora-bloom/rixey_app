import { useState, useEffect } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export default function UsageStats({ weddingId, weddings = [] }) {
  const [stats, setStats] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedWedding, setSelectedWedding] = useState(null)
  const [weddingDetails, setWeddingDetails] = useState(null)

  useEffect(() => {
    if (weddingId) {
      loadWeddingUsage(weddingId)
    } else {
      loadAllStats()
    }
  }, [weddingId])

  const loadAllStats = async () => {
    try {
      const response = await fetch(`${API_URL}/api/usage/stats`)
      const data = await response.json()
      setStats(data.stats || [])
    } catch (err) {
      console.error('Failed to load usage stats:', err)
    }
    setLoading(false)
  }

  const loadWeddingUsage = async (id) => {
    setLoading(true)
    try {
      const response = await fetch(`${API_URL}/api/usage/${id}`)
      const data = await response.json()
      setWeddingDetails(data)
    } catch (err) {
      console.error('Failed to load wedding usage:', err)
    }
    setLoading(false)
  }

  const formatCost = (cost) => {
    return `$${cost.toFixed(4)}`
  }

  const formatTokens = (tokens) => {
    if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`
    if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`
    return tokens.toString()
  }

  // Get wedding name by ID
  const getWeddingName = (id) => {
    const wedding = weddings.find(w => w.id === id)
    return wedding?.couple_names || 'Unknown'
  }

  if (loading) {
    return <p className="text-sage-400 text-center py-4">Loading usage data...</p>
  }

  // Single wedding view
  if (weddingId && weddingDetails) {
    return (
      <div className="bg-white rounded-xl border border-cream-200 p-4">
        <h3 className="font-medium text-sage-700 mb-3">API Usage</h3>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-sage-50 rounded-lg p-3 text-center">
            <p className="text-xl font-semibold text-sage-700">
              {formatTokens(weddingDetails.totals.input_tokens)}
            </p>
            <p className="text-sage-500 text-xs">Input Tokens</p>
          </div>
          <div className="bg-sage-50 rounded-lg p-3 text-center">
            <p className="text-xl font-semibold text-sage-700">
              {formatTokens(weddingDetails.totals.output_tokens)}
            </p>
            <p className="text-sage-500 text-xs">Output Tokens</p>
          </div>
          <div className="bg-cream-100 rounded-lg p-3 text-center">
            <p className="text-xl font-semibold text-sage-700">
              {weddingDetails.totals.total_requests}
            </p>
            <p className="text-sage-500 text-xs">API Calls</p>
          </div>
          <div className="bg-amber-50 rounded-lg p-3 text-center">
            <p className="text-xl font-semibold text-amber-700">
              {formatCost(weddingDetails.totals.estimated_cost)}
            </p>
            <p className="text-sage-500 text-xs">Est. Cost</p>
          </div>
        </div>

        {weddingDetails.logs.length > 0 && (
          <div>
            <p className="text-sage-600 text-sm font-medium mb-2">Recent Activity</p>
            <div className="max-h-40 overflow-y-auto space-y-1">
              {weddingDetails.logs.slice(0, 10).map(log => (
                <div key={log.id} className="flex items-center justify-between text-xs py-1 border-b border-cream-100">
                  <span className="text-sage-600">{log.endpoint}</span>
                  <span className="text-sage-400">
                    {log.input_tokens + log.output_tokens} tokens
                  </span>
                  <span className="text-sage-400">
                    {new Date(log.created_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  // All weddings overview
  const totalCost = stats.reduce((sum, s) => sum + (s.estimated_cost || 0), 0)
  const totalTokens = stats.reduce((sum, s) => sum + s.total_input_tokens + s.total_output_tokens, 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-serif text-xl text-sage-700">API Usage & Costs</h2>
          <p className="text-sage-500 text-sm">Token usage and estimated costs by wedding</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold text-amber-700">{formatCost(totalCost)}</p>
          <p className="text-sage-500 text-xs">Total Est. Cost</p>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-sage-50 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-sage-700">{stats.length}</p>
          <p className="text-sage-500 text-sm">Active Weddings</p>
        </div>
        <div className="bg-cream-100 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-sage-700">{formatTokens(totalTokens)}</p>
          <p className="text-sage-500 text-sm">Total Tokens</p>
        </div>
        <div className="bg-amber-50 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-amber-700">{formatCost(totalCost)}</p>
          <p className="text-sage-500 text-sm">Total Cost</p>
        </div>
      </div>

      {/* Per-wedding breakdown */}
      {stats.length === 0 ? (
        <p className="text-sage-400 text-center py-8">No usage data yet</p>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-5 gap-2 text-xs font-medium text-sage-500 px-3 py-2 bg-cream-100 rounded-lg">
            <span>Wedding</span>
            <span className="text-right">Requests</span>
            <span className="text-right">Input</span>
            <span className="text-right">Output</span>
            <span className="text-right">Est. Cost</span>
          </div>
          {stats
            .sort((a, b) => (b.estimated_cost || 0) - (a.estimated_cost || 0))
            .map(stat => (
              <div
                key={stat.wedding_id}
                className="grid grid-cols-5 gap-2 text-sm px-3 py-3 bg-white rounded-lg border border-cream-200 hover:border-sage-300 cursor-pointer"
                onClick={() => {
                  setSelectedWedding(stat.wedding_id)
                  loadWeddingUsage(stat.wedding_id)
                }}
              >
                <span className="font-medium text-sage-800 truncate">
                  {getWeddingName(stat.wedding_id)}
                </span>
                <span className="text-right text-sage-600">{stat.total_requests}</span>
                <span className="text-right text-sage-600">{formatTokens(stat.total_input_tokens)}</span>
                <span className="text-right text-sage-600">{formatTokens(stat.total_output_tokens)}</span>
                <span className="text-right font-medium text-amber-700">
                  {formatCost(stat.estimated_cost || 0)}
                </span>
              </div>
            ))}
        </div>
      )}

      {/* Selected wedding detail modal */}
      {selectedWedding && weddingDetails && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-serif text-lg text-sage-700">
                {getWeddingName(selectedWedding)}
              </h3>
              <button
                onClick={() => {
                  setSelectedWedding(null)
                  setWeddingDetails(null)
                }}
                className="text-sage-400 hover:text-sage-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-sage-50 rounded-lg p-3 text-center">
                <p className="text-xl font-semibold text-sage-700">
                  {formatTokens(weddingDetails.totals.input_tokens)}
                </p>
                <p className="text-sage-500 text-xs">Input Tokens</p>
              </div>
              <div className="bg-sage-50 rounded-lg p-3 text-center">
                <p className="text-xl font-semibold text-sage-700">
                  {formatTokens(weddingDetails.totals.output_tokens)}
                </p>
                <p className="text-sage-500 text-xs">Output Tokens</p>
              </div>
            </div>

            <div className="bg-amber-50 rounded-lg p-4 text-center mb-4">
              <p className="text-2xl font-semibold text-amber-700">
                {formatCost(weddingDetails.totals.estimated_cost)}
              </p>
              <p className="text-sage-500 text-sm">Estimated Cost</p>
            </div>

            <p className="text-sage-600 text-sm font-medium mb-2">
              Usage by Endpoint
            </p>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {Object.entries(
                weddingDetails.logs.reduce((acc, log) => {
                  acc[log.endpoint] = (acc[log.endpoint] || 0) + 1
                  return acc
                }, {})
              ).map(([endpoint, count]) => (
                <div key={endpoint} className="flex justify-between text-sm py-1">
                  <span className="text-sage-600">{endpoint}</span>
                  <span className="text-sage-500">{count} calls</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
