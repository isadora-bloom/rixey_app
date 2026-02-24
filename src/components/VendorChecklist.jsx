import { useState, useEffect, useRef } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export default function VendorChecklist({ weddingId, isAdmin = false }) {
  const [vendors, setVendors] = useState([])
  const [vendorTypes, setVendorTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [formData, setFormData] = useState({
    vendorType: '',
    vendorName: '',
    vendorContact: '',
    notes: '',
    isBooked: false
  })
  const [saving, setSaving] = useState(false)
  const [uploadingContract, setUploadingContract] = useState(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (weddingId) {
      loadVendors()
    }
  }, [weddingId])

  const loadVendors = async () => {
    try {
      const response = await fetch(`${API_URL}/api/vendors/${weddingId}`)
      const data = await response.json()
      setVendors(data.vendors || [])
      setVendorTypes(data.vendorTypes || [])
    } catch (error) {
      console.error('Error loading vendors:', error)
    }
    setLoading(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.vendorType) return

    setSaving(true)
    try {
      const response = await fetch(`${API_URL}/api/vendors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingId,
          weddingId,
          ...formData
        })
      })
      const data = await response.json()

      if (data.vendor) {
        if (editingId) {
          setVendors(vendors.map(v => v.id === editingId ? data.vendor : v))
        } else {
          setVendors([...vendors, data.vendor])
        }
        resetForm()
      }
    } catch (error) {
      console.error('Error saving vendor:', error)
    }
    setSaving(false)
  }

  const handleEdit = (vendor) => {
    setFormData({
      vendorType: vendor.vendor_type,
      vendorName: vendor.vendor_name || '',
      vendorContact: vendor.vendor_contact || '',
      notes: vendor.notes || '',
      isBooked: vendor.is_booked
    })
    setEditingId(vendor.id)
    setShowAddForm(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this vendor?')) return

    try {
      await fetch(`${API_URL}/api/vendors/${id}`, { method: 'DELETE' })
      setVendors(vendors.filter(v => v.id !== id))
    } catch (error) {
      console.error('Error deleting vendor:', error)
    }
  }

  const handleContractUpload = async (vendorId, file) => {
    setUploadingContract(vendorId)
    const formData = new FormData()
    formData.append('contract', file)

    try {
      const response = await fetch(`${API_URL}/api/vendors/${vendorId}/contract`, {
        method: 'POST',
        body: formData
      })
      const data = await response.json()
      if (data.vendor) {
        setVendors(vendors.map(v => v.id === vendorId ? data.vendor : v))
      }
    } catch (error) {
      console.error('Error uploading contract:', error)
    }
    setUploadingContract(null)
  }

  const handleRemoveContract = async (vendorId) => {
    if (!confirm('Remove this contract?')) return

    try {
      const response = await fetch(`${API_URL}/api/vendors/${vendorId}/contract`, {
        method: 'DELETE'
      })
      const data = await response.json()
      if (data.vendor) {
        setVendors(vendors.map(v => v.id === vendorId ? data.vendor : v))
      }
    } catch (error) {
      console.error('Error removing contract:', error)
    }
  }

  const resetForm = () => {
    setFormData({
      vendorType: '',
      vendorName: '',
      vendorContact: '',
      notes: '',
      isBooked: false
    })
    setEditingId(null)
    setShowAddForm(false)
  }

  const bookedCount = vendors.filter(v => v.is_booked).length
  const contractCount = vendors.filter(v => v.contract_uploaded).length

  if (loading) {
    return <div className="text-sage-400 text-center py-4">Loading vendors...</div>
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-sage-600">
          <span className="font-medium">{bookedCount}</span> booked, <span className="font-medium">{contractCount}</span> contracts
        </div>
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="text-sm px-3 py-1 bg-sage-100 text-sage-700 rounded-lg hover:bg-sage-200"
          >
            + Add Vendor
          </button>
        )}
      </div>

      {/* Add/Edit Form */}
      {showAddForm && (
        <form onSubmit={handleSubmit} className="bg-cream-50 rounded-lg p-4 space-y-3 border border-cream-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-sage-600 mb-1">Vendor Type</label>
              <select
                value={formData.vendorType}
                onChange={(e) => setFormData({ ...formData, vendorType: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-cream-300 text-sm"
                required
              >
                <option value="">Select type...</option>
                {vendorTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-sage-600 mb-1">Vendor Name</label>
              <input
                type="text"
                value={formData.vendorName}
                onChange={(e) => setFormData({ ...formData, vendorName: e.target.value })}
                placeholder="Company or person name"
                className="w-full px-3 py-2 rounded-lg border border-cream-300 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-sage-600 mb-1">Contact Info</label>
            <input
              type="text"
              value={formData.vendorContact}
              onChange={(e) => setFormData({ ...formData, vendorContact: e.target.value })}
              placeholder="Email or phone"
              className="w-full px-3 py-2 rounded-lg border border-cream-300 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-sage-600 mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Package details, pricing, etc."
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-cream-300 text-sm"
            />
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-sage-700">
              <input
                type="checkbox"
                checked={formData.isBooked}
                onChange={(e) => setFormData({ ...formData, isBooked: e.target.checked })}
                className="rounded border-cream-300"
              />
              Booked/Confirmed
            </label>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-sage-600 text-white rounded-lg text-sm hover:bg-sage-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : editingId ? 'Update' : 'Add Vendor'}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 text-sage-600 text-sm hover:text-sage-800"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Vendor List */}
      <div className="space-y-2">
        {vendors.length === 0 ? (
          <p className="text-sage-400 text-sm text-center py-4">No vendors added yet</p>
        ) : (
          vendors.map(vendor => (
            <div
              key={vendor.id}
              className={`border rounded-lg p-3 ${
                vendor.is_booked ? 'border-green-200 bg-green-50/50' : 'border-cream-200'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      vendor.is_booked ? 'bg-green-100 text-green-700' : 'bg-cream-100 text-sage-600'
                    }`}>
                      {vendor.vendor_type}
                    </span>
                    {vendor.is_booked && (
                      <span className="text-green-600 text-xs">Booked</span>
                    )}
                    {vendor.contract_uploaded && (
                      <span className="text-blue-600 text-xs flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Contract
                      </span>
                    )}
                  </div>
                  {vendor.vendor_name && (
                    <p className="font-medium text-sage-800 mt-1">{vendor.vendor_name}</p>
                  )}
                  {vendor.vendor_contact && (
                    <p className="text-sage-500 text-sm">{vendor.vendor_contact}</p>
                  )}
                  {vendor.notes && (
                    <p className="text-sage-500 text-xs mt-1">{vendor.notes}</p>
                  )}
                  {vendor.contract_date && (
                    <p className="text-sage-400 text-xs mt-1">
                      Contract uploaded: {new Date(vendor.contract_date).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => handleEdit(vendor)}
                    className="text-sage-500 hover:text-sage-700 text-xs"
                  >
                    Edit
                  </button>
                  {!vendor.contract_uploaded ? (
                    <label className="text-blue-500 hover:text-blue-700 text-xs cursor-pointer">
                      <input
                        type="file"
                        accept=".pdf,image/*"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files?.[0]) {
                            handleContractUpload(vendor.id, e.target.files[0])
                          }
                        }}
                        disabled={uploadingContract === vendor.id}
                      />
                      {uploadingContract === vendor.id ? 'Uploading...' : '+ Contract'}
                    </label>
                  ) : (
                    <>
                      <a
                        href={vendor.contract_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:text-blue-700 text-xs"
                      >
                        View
                      </a>
                      <button
                        onClick={() => handleRemoveContract(vendor.id)}
                        className="text-red-500 hover:text-red-700 text-xs"
                      >
                        Remove
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => handleDelete(vendor.id)}
                    className="text-red-400 hover:text-red-600 text-xs"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
