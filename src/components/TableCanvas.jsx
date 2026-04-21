import { useState, useEffect, useRef } from 'react'
import { Stage, Layer, Image as KonvaImage, Circle, Rect, Text, Group } from 'react-konva'
import { API_URL } from '../config/api'
import { authHeaders } from '../utils/api'


// Cropped image is 2893×1550. Barn measured: 718px = 40ft → 17.95 px/ft
const IMAGE_W = 2893
const IMAGE_H = 1550
const PX_PER_FT = 17.93

const CHAIR_CLEARANCE_FT = 1.5 // 18 inches

function ft(feet) { return feet * PX_PER_FT }
function genId() { return Math.random().toString(36).substr(2, 9) }

// Rect table sizes in 2ft increments 6–36ft
const RECT_SIZES = Array.from({ length: 16 }, (_, i) => 6 + i * 2) // [6,8,...,36]

const BLOCK_TYPES = [
  { label: 'Dance Floor', defaultW: 20, defaultH: 20, color: '#DBEAFE' },
  { label: 'Bar',         defaultW: 10, defaultH: 4,  color: '#FEF3C7' },
  { label: 'Band / Stage',defaultW: 20, defaultH: 10, color: '#F3E8FF' },
  { label: 'Gift Table',  defaultW: 6,  defaultH: 3,  color: '#FCE7F3' },
  { label: 'Photo Booth', defaultW: 8,  defaultH: 8,  color: '#ECFDF5' },
  { label: 'Custom',      defaultW: 10, defaultH: 10, color: '#E5E7EB' },
]

// ─── Block dimension prompt modal ─────────────────────────────────────────────

function BlockPrompt({ preset, onConfirm, onCancel }) {
  const [w, setW] = useState(preset.defaultW)
  const [h, setH] = useState(preset.defaultH)
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl p-6 max-w-xs w-full">
        <h3 className="font-semibold text-sage-800 mb-1">Add {preset.label}</h3>
        <p className="text-xs text-sage-400 mb-4">Enter dimensions in feet</p>
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div>
            <label className="block text-xs text-sage-500 mb-1">Width (ft)</label>
            <input
              type="number" min="1" max="200"
              className="w-full border border-cream-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300"
              value={w}
              onChange={e => setW(parseFloat(e.target.value) || 1)}
            />
          </div>
          <div>
            <label className="block text-xs text-sage-500 mb-1">Depth (ft)</label>
            <input
              type="number" min="1" max="200"
              className="w-full border border-cream-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300"
              value={h}
              onChange={e => setH(parseFloat(e.target.value) || 1)}
            />
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => onConfirm(w, h)}
            className="flex-1 bg-sage-600 text-white rounded-xl py-2 text-sm font-medium hover:bg-sage-700 transition"
          >
            Add to Layout
          </button>
          <button
            onClick={onCancel}
            className="px-4 border border-cream-300 rounded-xl text-sm text-sage-600 hover:bg-cream-50 transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Single canvas element ─────────────────────────────────────────────────────

function TableEl({ el, isSelected, isAdmin, onSelect, onMove }) {
  const w = ft(el.feetW)
  const h = ft(el.feetH)
  const haloExtra = ft(CHAIR_CLEARANCE_FT)
  const isTable = el.type === 'round' || el.type === 'rect'
  const fontSize = Math.max(16, ft(0.85))
  const seatsFontSize = Math.max(13, ft(0.65))
  const strokeColor = isSelected ? '#C9748A' : '#55555566'
  const strokeWidth = isSelected ? ft(0.12) : ft(0.06)

  return (
    <Group
      x={el.x}
      y={el.y}
      rotation={el.rotation || 0}
      draggable={isAdmin}
      onClick={() => isAdmin && onSelect(el.id)}
      onTap={() => isAdmin && onSelect(el.id)}
      onDragEnd={e => {
        e.cancelBubble = true // prevent stage onDragEnd from firing
        if (isAdmin) onMove(el.id, e.target.x(), e.target.y())
      }}
    >
      {/* Chair clearance halo — tables only */}
      {isTable && el.type === 'round' && (
        <Circle
          radius={w / 2 + haloExtra}
          fill="rgba(96,165,250,0.10)"
          stroke="#93C5FD"
          strokeWidth={ft(0.05)}
          listening={false}
        />
      )}
      {isTable && el.type === 'rect' && (
        <Rect
          x={-(w / 2 + haloExtra)}
          y={-(h / 2 + haloExtra)}
          width={w + haloExtra * 2}
          height={h + haloExtra * 2}
          fill="rgba(96,165,250,0.10)"
          stroke="#93C5FD"
          strokeWidth={ft(0.05)}
          cornerRadius={ft(0.4)}
          listening={false}
        />
      )}

      {/* Table / block shape */}
      {el.type === 'round' ? (
        <Circle
          radius={w / 2}
          fill={el.color}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
        />
      ) : (
        <Rect
          x={-w / 2}
          y={-h / 2}
          width={w}
          height={h}
          fill={el.color}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          cornerRadius={el.type === 'block' ? ft(0.25) : ft(0.08)}
        />
      )}

      {/* Label */}
      <Text
        text={el.label}
        x={-w / 2}
        y={-fontSize * 0.75}
        width={w}
        align="center"
        fontSize={fontSize}
        fontStyle="bold"
        fill="#000"
        listening={false}
      />
      {el.capacity > 0 && (
        <Text
          text={`${el.capacity} seats`}
          x={-w / 2}
          y={fontSize * 0.35}
          width={w}
          align="center"
          fontSize={seatsFontSize}
          fontStyle="bold"
          fill="#333"
          listening={false}
        />
      )}
    </Group>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function TableCanvas({ weddingId, isAdmin }) {
  const containerRef = useRef()
  const stageRef = useRef()

  const [stageW, setStageW] = useState(900)
  const [stageH, setStageH] = useState(480)
  const [zoom, setZoom]   = useState(null) // null = not yet calculated
  const [pos, setPos]     = useState({ x: 0, y: 0 })
  const [planRotation, setPlanRotation] = useState(0) // 0, 90, 180, 270

  const [floorImg, setFloorImg]   = useState(null)
  const [elements, setElements]   = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)

  // Toolbar UI state
  const [showRectPicker, setShowRectPicker] = useState(false)
  const [blockPrompt, setBlockPrompt]       = useState(null) // preset being configured

  // Crop-export state
  const [cropMode, setCropMode] = useState(false)
  const [cropStart, setCropStart] = useState(null)
  const [cropRect, setCropRect]   = useState(null)

  // Load floor plan image
  useEffect(() => {
    const img = new window.Image()
    img.src = '/floorplan.png'
    img.onload = () => setFloorImg(img)
  }, [])

  // Effective image dimensions based on rotation
  const isLandscape = planRotation % 180 === 0
  const effectiveW = isLandscape ? IMAGE_W : IMAGE_H
  const effectiveH = isLandscape ? IMAGE_H : IMAGE_W

  // Size stage to container width (maintain image aspect ratio)
  useEffect(() => {
    const update = () => {
      if (!containerRef.current) return
      const w = containerRef.current.offsetWidth
      const h = Math.round(w * effectiveH / effectiveW)
      setStageW(w)
      setStageH(h)
      setZoom(w / effectiveW)
      setPos({ x: 0, y: 0 })
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [planRotation]) // eslint-disable-line react-hooks/exhaustive-deps

  // Load saved layout
  useEffect(() => {
    if (weddingId) loadLayout()
  }, [weddingId])

  const loadLayout = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/api/table-layout/${weddingId}`, { headers: await authHeaders() })
      const data = await res.json()
      if (data.layout) setElements(data.layout.elements || [])
    } catch (err) {
      console.error('Failed to load layout:', err)
    }
    setLoading(false)
  }

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch(`${API_URL}/api/table-layout`, {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ weddingId, elements }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Server error ${res.status}`)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      console.error('Save failed:', err)
      alert(`Save failed: ${err.message}`)
    }
    setSaving(false)
  }

  const fitScale = stageW / effectiveW
  const currentZoom = zoom ?? fitScale

  // Place new element in centre of current viewport
  const viewCentre = () => ({
    x: (stageW / 2 - pos.x) / currentZoom,
    y: (stageH / 2 - pos.y) / currentZoom,
  })

  const addRound = (feetW, label, capacity) => {
    const c = viewCentre()
    setElements(prev => [...prev, {
      id: genId(), type: 'round',
      x: c.x, y: c.y,
      feetW, feetH: feetW,
      rotation: 0, label, capacity,
      color: '#F5EDE0',
    }])
  }

  const addRect = (size) => {
    const c = viewCentre()
    setElements(prev => [...prev, {
      id: genId(), type: 'rect',
      x: c.x, y: c.y,
      feetW: size, feetH: 2.5,
      rotation: 0,
      label: `${size}ft Table`,
      capacity: size, // ~1 seat per linear foot (both sides)
      color: '#F5EDE0',
    }])
    setShowRectPicker(false)
  }

  const addBlock = (preset, feetW, feetH) => {
    const c = viewCentre()
    setElements(prev => [...prev, {
      id: genId(), type: 'block',
      x: c.x, y: c.y,
      feetW, feetH,
      rotation: 0, label: preset.label,
      capacity: 0, color: preset.color,
    }])
    setBlockPrompt(null)
  }

  const updateSelected = (changes) => {
    setElements(prev => prev.map(el => el.id === selectedId ? { ...el, ...changes } : el))
  }

  const deleteSelected = () => {
    setElements(prev => prev.filter(el => el.id !== selectedId))
    setSelectedId(null)
  }

  const moveElement = (id, x, y) => {
    setElements(prev => prev.map(el => el.id === id ? { ...el, x, y } : el))
  }

  // Wheel: zoom around pointer
  const handleWheel = (e) => {
    e.evt.preventDefault()
    const stage = stageRef.current
    const pointer = stage.getPointerPosition()
    const factor = e.evt.deltaY < 0 ? 1.1 : 0.909
    const newZoom = Math.min(fitScale * 10, Math.max(fitScale * 0.5, currentZoom * factor))
    const mousePointTo = {
      x: (pointer.x - pos.x) / currentZoom,
      y: (pointer.y - pos.y) / currentZoom,
    }
    setZoom(newZoom)
    setPos({
      x: pointer.x - mousePointTo.x * newZoom,
      y: pointer.y - mousePointTo.y * newZoom,
    })
  }

  const fitToScreen = () => {
    setZoom(fitScale)
    setPos({ x: 0, y: 0 })
  }

  const rotatePlan = () => setPlanRotation(r => (r + 90) % 360)

  const exportPng = () => {
    const uri = stageRef.current.toDataURL({ pixelRatio: 4 })
    const a = document.createElement('a')
    a.download = 'table-layout.png'
    a.href = uri
    a.click()
  }

  // Crop-export: download just the selected region at high res
  const exportCrop = (rect) => {
    // rect is in stage (screen) coords. Convert to content coords for toDataURL.
    const uri = stageRef.current.toDataURL({
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      pixelRatio: 4,
    })
    const a = document.createElement('a')
    a.download = 'table-layout-crop.png'
    a.href = uri
    a.click()
    setCropMode(false)
    setCropRect(null)
    setCropStart(null)
  }

  const handleCropMouseDown = (e) => {
    if (!cropMode) return
    const stage = stageRef.current
    const pointer = stage.getPointerPosition()
    setCropStart(pointer)
    setCropRect(null)
  }

  const handleCropMouseMove = (e) => {
    if (!cropMode || !cropStart) return
    const stage = stageRef.current
    const pointer = stage.getPointerPosition()
    setCropRect({
      x: Math.min(cropStart.x, pointer.x),
      y: Math.min(cropStart.y, pointer.y),
      width: Math.abs(pointer.x - cropStart.x),
      height: Math.abs(pointer.y - cropStart.y),
    })
  }

  const handleCropMouseUp = () => {
    if (!cropMode || !cropRect) return
    if (cropRect.width > 10 && cropRect.height > 10) {
      exportCrop(cropRect)
    } else {
      // Too small, cancel
      setCropRect(null)
      setCropStart(null)
    }
  }

  const selectedEl = elements.find(e => e.id === selectedId)

  // Client view: if no layout saved yet, show placeholder
  if (!isAdmin && !loading && elements.length === 0) {
    return (
      <div className="bg-cream-50 rounded-2xl border border-cream-200 p-12 text-center">
        <p className="text-sage-500 text-sm">Your seating layout will appear here once your coordinator has set it up.</p>
      </div>
    )
  }

  return (
    <div>
      {/* ── Admin-only toolbar ── */}
      {isAdmin && (
        <div className="mb-3 space-y-2">

          {/* Round tables */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-sage-500 uppercase tracking-wide w-20">Round</span>
            <button onClick={() => addRound(5, '60" Round', 8)}
              className="text-xs px-3 py-1.5 rounded-lg border border-cream-200 text-sage-600 hover:bg-cream-50 hover:border-sage-300 transition">
              ◯ 60" (8 seats)
            </button>
            <button onClick={() => addRound(6, '72" Round', 10)}
              className="text-xs px-3 py-1.5 rounded-lg border border-cream-200 text-sage-600 hover:bg-cream-50 hover:border-sage-300 transition">
              ◯ 72" (10 seats)
            </button>
          </div>

          {/* Rect tables */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-sage-500 uppercase tracking-wide w-20">Rect</span>
            <button
              onClick={() => { setShowRectPicker(v => !v); setBlockPrompt(null) }}
              className={`text-xs px-3 py-1.5 rounded-lg border transition ${showRectPicker ? 'border-sage-400 bg-sage-50 text-sage-700' : 'border-cream-200 text-sage-600 hover:bg-cream-50 hover:border-sage-300'}`}
            >
              ▭ Choose size…
            </button>
            {showRectPicker && (
              <div className="flex flex-wrap gap-1">
                {RECT_SIZES.map(size => (
                  <button key={size} onClick={() => addRect(size)}
                    className="text-xs px-2 py-1 rounded border border-cream-300 bg-white text-sage-600 hover:bg-cream-50 hover:border-sage-400 transition">
                    {size}ft
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Blocks */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-sage-500 uppercase tracking-wide w-20">Blocks</span>
            {BLOCK_TYPES.map(b => (
              <button key={b.label}
                onClick={() => { setBlockPrompt(b); setShowRectPicker(false) }}
                className={`text-xs px-3 py-1.5 rounded-lg border transition ${blockPrompt?.label === b.label ? 'border-sage-400 bg-sage-50 text-sage-700' : 'border-cream-200 text-sage-600 hover:bg-cream-50 hover:border-sage-300'}`}
              >
                ▩ {b.label}
              </button>
            ))}
          </div>

          {/* Canvas controls (admin) */}
          <div className="flex items-center gap-2 pt-1 border-t border-cream-100">
            <button onClick={rotatePlan} className="text-xs px-3 py-1.5 rounded-lg border border-cream-200 text-sage-500 hover:bg-cream-50 transition">
              Rotate 90°
            </button>
            <button onClick={fitToScreen} className="text-xs px-3 py-1.5 rounded-lg border border-cream-200 text-sage-500 hover:bg-cream-50 transition">
              Fit Screen
            </button>
            <button onClick={() => setZoom(z => Math.min(fitScale * 10, (z ?? fitScale) * 1.25))} className="text-xs px-3 py-1.5 rounded-lg border border-cream-200 text-sage-500 hover:bg-cream-50 transition">
              + In
            </button>
            <button onClick={() => setZoom(z => Math.max(fitScale * 0.5, (z ?? fitScale) * 0.8))} className="text-xs px-3 py-1.5 rounded-lg border border-cream-200 text-sage-500 hover:bg-cream-50 transition">
              − Out
            </button>
            <span className="text-xs text-sage-400">{Math.round(currentZoom / fitScale * 100)}%</span>
            <div className="ml-auto flex gap-2">
              {selectedId && (
                <button onClick={deleteSelected} className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition">
                  Delete
                </button>
              )}
              <button onClick={exportPng} className="text-xs px-3 py-1.5 rounded-lg border border-cream-200 text-sage-600 hover:bg-cream-50 transition">
                Export PNG
              </button>
              <button
                onClick={() => { setCropMode(m => !m); setCropRect(null); setCropStart(null) }}
                className={`text-xs px-3 py-1.5 rounded-lg border transition ${cropMode ? 'border-sage-500 bg-sage-50 text-sage-700' : 'border-cream-200 text-sage-600 hover:bg-cream-50'}`}
              >
                {cropMode ? 'Cancel Crop' : 'Crop & Export'}
              </button>
              <button onClick={save} disabled={saving}
                className="text-xs px-4 py-1.5 rounded-lg bg-sage-600 text-white hover:bg-sage-700 disabled:opacity-50 transition">
                {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Layout'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Client canvas controls (view only) ── */}
      {!isAdmin && (
        <div className="flex items-center gap-2 mb-3">
          <button onClick={rotatePlan} className="text-xs px-3 py-1.5 rounded-lg border border-cream-200 text-sage-500 hover:bg-cream-50 transition">
            Rotate 90°
          </button>
          <button onClick={fitToScreen} className="text-xs px-3 py-1.5 rounded-lg border border-cream-200 text-sage-500 hover:bg-cream-50 transition">
            Fit Screen
          </button>
          <button onClick={() => setZoom(z => Math.min(fitScale * 10, (z ?? fitScale) * 1.25))} className="text-xs px-3 py-1.5 rounded-lg border border-cream-200 text-sage-500 hover:bg-cream-50 transition">
            + In
          </button>
          <button onClick={() => setZoom(z => Math.max(fitScale * 0.5, (z ?? fitScale) * 0.8))} className="text-xs px-3 py-1.5 rounded-lg border border-cream-200 text-sage-500 hover:bg-cream-50 transition">
            − Out
          </button>
          <span className="text-xs text-sage-400">{Math.round(currentZoom / fitScale * 100)}%</span>
          <button onClick={exportPng} className="ml-auto text-xs px-3 py-1.5 rounded-lg border border-cream-200 text-sage-600 hover:bg-cream-50 transition">
            Export PNG
          </button>
          <button
            onClick={() => { setCropMode(m => !m); setCropRect(null); setCropStart(null) }}
            className={`text-xs px-3 py-1.5 rounded-lg border transition ${cropMode ? 'border-sage-500 bg-sage-50 text-sage-700' : 'border-cream-200 text-sage-600 hover:bg-cream-50'}`}
          >
            {cropMode ? 'Cancel Crop' : 'Crop & Export'}
          </button>
        </div>
      )}

      {/* ── Selected element properties (admin only) ── */}
      {isAdmin && selectedEl && (
        <div className="flex flex-wrap items-end gap-3 mb-3 p-3 bg-cream-50 rounded-xl border border-cream-200">
          <div>
            <label className="block text-xs text-sage-500 mb-0.5">Label</label>
            <input
              className="border border-cream-200 rounded-lg px-2 py-1 text-sm w-36 focus:outline-none focus:ring-1 focus:ring-sage-300"
              value={selectedEl.label}
              onChange={e => updateSelected({ label: e.target.value })}
            />
          </div>
          {selectedEl.type !== 'block' && (
            <div>
              <label className="block text-xs text-sage-500 mb-0.5">Seats</label>
              <input type="number" min="1"
                className="border border-cream-200 rounded-lg px-2 py-1 text-sm w-16 focus:outline-none focus:ring-1 focus:ring-sage-300"
                value={selectedEl.capacity}
                onChange={e => updateSelected({ capacity: parseInt(e.target.value) || 0 })}
              />
            </div>
          )}
          {selectedEl.type === 'block' && (
            <>
              <div>
                <label className="block text-xs text-sage-500 mb-0.5">Width (ft)</label>
                <input type="number" min="1"
                  className="border border-cream-200 rounded-lg px-2 py-1 text-sm w-16 focus:outline-none focus:ring-1 focus:ring-sage-300"
                  value={selectedEl.feetW}
                  onChange={e => updateSelected({ feetW: parseFloat(e.target.value) || 1 })}
                />
              </div>
              <div>
                <label className="block text-xs text-sage-500 mb-0.5">Depth (ft)</label>
                <input type="number" min="1"
                  className="border border-cream-200 rounded-lg px-2 py-1 text-sm w-16 focus:outline-none focus:ring-1 focus:ring-sage-300"
                  value={selectedEl.feetH}
                  onChange={e => updateSelected({ feetH: parseFloat(e.target.value) || 1 })}
                />
              </div>
            </>
          )}
          <div>
            <label className="block text-xs text-sage-500 mb-0.5">Rotation °</label>
            <input type="number"
              className="border border-cream-200 rounded-lg px-2 py-1 text-sm w-16 focus:outline-none focus:ring-1 focus:ring-sage-300"
              value={selectedEl.rotation || 0}
              onChange={e => updateSelected({ rotation: parseInt(e.target.value) || 0 })}
            />
          </div>
          <button onClick={() => setSelectedId(null)} className="text-xs text-sage-400 hover:text-sage-600 pb-1">Done</button>
        </div>
      )}

      {/* ── Canvas ── */}
      <div ref={containerRef}
        className={`border border-cream-200 rounded-xl overflow-hidden bg-[#f9f6f2] select-none relative ${
          cropMode ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'
        }`}
      >
        {loading ? (
          <div className="h-80 flex items-center justify-center">
            <p className="text-sage-400 text-sm">Loading floor plan…</p>
          </div>
        ) : (
          <>
            <Stage
              ref={stageRef}
              width={stageW}
              height={stageH}
              scaleX={currentZoom}
              scaleY={currentZoom}
              x={pos.x}
              y={pos.y}
              draggable={!cropMode}
              onWheel={handleWheel}
              onMouseDown={handleCropMouseDown}
              onMouseMove={handleCropMouseMove}
              onMouseUp={handleCropMouseUp}
              onDragEnd={e => {
                if (e.target === stageRef.current) {
                  setPos({ x: stageRef.current.x(), y: stageRef.current.y() })
                }
              }}
              onClick={e => { if (!cropMode && e.target === e.target.getStage()) setSelectedId(null) }}
            >
              <Layer>
                <Group
                  rotation={planRotation}
                  offsetX={IMAGE_W / 2}
                  offsetY={IMAGE_H / 2}
                  x={effectiveW / 2}
                  y={effectiveH / 2}
                >
                  {floorImg && (
                    <KonvaImage image={floorImg} x={0} y={0} width={IMAGE_W} height={IMAGE_H} />
                  )}
                </Group>
              </Layer>
              <Layer>
                <Group
                  rotation={planRotation}
                  offsetX={IMAGE_W / 2}
                  offsetY={IMAGE_H / 2}
                  x={effectiveW / 2}
                  y={effectiveH / 2}
                >
                  {elements.map(el => (
                    <TableEl
                      key={el.id}
                      el={el}
                      isSelected={selectedId === el.id}
                      isAdmin={isAdmin}
                      onSelect={setSelectedId}
                      onMove={moveElement}
                    />
                  ))}
                </Group>
              </Layer>
              {/* Crop selection overlay rendered in Konva so it exports cleanly */}
              {cropMode && cropRect && (
                <Layer listening={false}>
                  {/* Dim everything outside the selection */}
                  <Rect x={0} y={0} width={stageW} height={cropRect.y}
                    fill="rgba(0,0,0,0.35)" scaleX={1/currentZoom} scaleY={1/currentZoom} />
                  <Rect x={0} y={(cropRect.y + cropRect.height) / currentZoom} width={stageW} height={stageH}
                    fill="rgba(0,0,0,0.35)" scaleX={1/currentZoom} scaleY={1/currentZoom} />
                  <Rect x={0} y={cropRect.y / currentZoom} width={cropRect.x / currentZoom} height={cropRect.height / currentZoom}
                    fill="rgba(0,0,0,0.35)" />
                  <Rect x={(cropRect.x + cropRect.width) / currentZoom} y={cropRect.y / currentZoom}
                    width={(stageW - cropRect.x - cropRect.width) / currentZoom} height={cropRect.height / currentZoom}
                    fill="rgba(0,0,0,0.35)" />
                </Layer>
              )}
            </Stage>
            {/* HTML overlay for crop rectangle border (not baked into export) */}
            {cropMode && cropRect && (
              <div
                className="absolute border-2 border-dashed border-white pointer-events-none"
                style={{
                  left: cropRect.x, top: cropRect.y,
                  width: cropRect.width, height: cropRect.height,
                }}
              />
            )}
            {cropMode && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-sage-800/80 text-white text-xs px-4 py-2 rounded-full pointer-events-none">
                Click and drag to select area, then it will download
              </div>
            )}
          </>
        )}
      </div>

      <p className="text-xs text-sage-400 mt-2 text-center">
        Scroll to zoom · Drag background to pan · Click to select · Blue ring = 18" chair clearance
      </p>

      {/* ── Block dimension prompt ── */}
      {blockPrompt && (
        <BlockPrompt
          preset={blockPrompt}
          onConfirm={(w, h) => addBlock(blockPrompt, w, h)}
          onCancel={() => setBlockPrompt(null)}
        />
      )}
    </div>
  )
}
