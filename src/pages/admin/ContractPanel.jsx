import { useState, useEffect } from 'react'
import { API_URL } from '../../config/api'
import { authHeaders } from '../../utils/api'

export default function ContractPanel({ weddingId, uploadingContract, handleContractUpload, uploadResult }) {
  const [contracts, setContracts] = useState([])
  const [vendorContracts, setVendorContracts] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState(null)

  useEffect(() => {
    loadContracts()
  }, [weddingId])

  const loadContracts = async () => {
    try {
      const res = await fetch(`${API_URL}/api/contracts/${weddingId}`, {
        headers: await authHeaders(),
      })
      if (res.ok) {
        const data = await res.json()
        setContracts(data.contracts || [])
        setVendorContracts(data.vendorContracts || [])
      }
    } catch (err) {
      console.error('Failed to load contracts:', err)
    }
    setLoading(false)
  }

  // Reload after a new upload completes
  useEffect(() => {
    if (uploadResult?.success) loadContracts()
  }, [uploadResult])

  const total = contracts.length + vendorContracts.length

  return (
    <div className="space-y-6">
      {/* Upload area */}
      <div>
        <h3 className="font-medium text-sage-700 mb-3">Upload Contract</h3>
        <p className="text-sage-500 text-sm mb-4">
          Upload vendor contracts (PDF or image) and Claude will extract key details as planning notes.
        </p>
        <label className={`block w-full p-4 border-2 border-dashed rounded-lg text-center cursor-pointer transition ${
          uploadingContract
            ? 'border-sage-300 bg-sage-50'
            : 'border-cream-300 hover:border-sage-400 hover:bg-cream-50'
        }`}>
          <input
            type="file"
            accept=".pdf,image/*"
            onChange={handleContractUpload}
            disabled={uploadingContract}
            className="hidden"
          />
          {uploadingContract ? (
            <span className="text-sage-600">
              <svg className="w-5 h-5 animate-spin inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Extracting details...
            </span>
          ) : (
            <span className="text-sage-500">
              <svg className="w-6 h-6 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              Click to upload PDF or image
            </span>
          )}
        </label>
        {uploadResult && (
          <div className={`mt-3 p-3 rounded-lg text-sm ${
            uploadResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}>
            {uploadResult.message}
          </div>
        )}
      </div>

      {/* Contracts on file */}
      <div>
        <h3 className="font-medium text-sage-700 mb-3">
          Contracts on File {!loading && <span className="text-sage-400 font-normal">({total})</span>}
        </h3>

        {loading ? (
          <p className="text-sage-400 text-sm">Loading...</p>
        ) : total === 0 ? (
          <p className="text-sage-400 text-sm py-4 text-center bg-cream-50 rounded-lg">
            No contracts uploaded yet
          </p>
        ) : (
          <div className="space-y-2">
            {/* Extracted docs from contracts table */}
            {contracts.map((c) => (
              <div key={c.id} className="border border-cream-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-cream-50 transition"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-lg flex-shrink-0">
                      {c.file_type?.includes('pdf') ? '📄' : '🖼️'}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-sage-800 truncate">{c.filename}</p>
                      <p className="text-xs text-sage-500">
                        {new Date(c.created_at).toLocaleDateString()} · {c.extracted_text?.length || 0} chars extracted
                      </p>
                    </div>
                  </div>
                  <svg className={`w-4 h-4 text-sage-400 flex-shrink-0 transition ${expandedId === c.id ? 'rotate-180' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {expandedId === c.id && (
                  <div className="px-4 pb-4 border-t border-cream-100">
                    <pre className="whitespace-pre-wrap text-xs text-sage-700 bg-cream-50 rounded p-3 mt-3 max-h-80 overflow-y-auto font-sans leading-relaxed">
                      {c.extracted_text || 'No text extracted'}
                    </pre>
                  </div>
                )}
              </div>
            ))}

            {/* Per-vendor contracts with file links */}
            {vendorContracts.map((v) => (
              <div key={v.id} className="flex items-center justify-between px-4 py-3 border border-cream-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-lg">📎</span>
                  <div>
                    <p className="text-sm font-medium text-sage-800 capitalize">
                      {v.vendor_name || v.vendor_type}
                    </p>
                    <p className="text-xs text-sage-500">
                      {v.contract_date ? new Date(v.contract_date).toLocaleDateString() : 'Date unknown'} · vendor contract
                    </p>
                  </div>
                </div>
                {v.contract_url && (
                  <a
                    href={v.contract_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 text-xs font-medium bg-sage-50 text-sage-700 rounded-lg hover:bg-sage-100 transition"
                  >
                    View file
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
