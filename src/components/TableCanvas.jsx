import { useState, useEffect, useRef } from 'react'
import { Stage, Layer, Image as KonvaImage, Circle, Rect, Text, Group } from 'react-konva'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

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

function TableEl({ el, isSelected, onSelect, onMove }) {
  const w = ft(el.feetW)
  const h = ft(el.feetH)
  const haloExtra = ft(CHAIR_CLEARANCE_FT)
  const isTable = el.type === 'round' || el.type === 'rect'
  const fontSize = Math.max(14, ft(0.7))
  const strokeColor = isSelected ? '#C9748A' : '#55555566'
  const strokeWidth = isSelected ? ft(0.12) : ft(0.06)

  return (
    <Group
      x={el.x}
      y={el.y}
      rotation={el.rotation || 0}
      draggable
      onClick={() => onSelect(el.id)}
      onTap={() => onSelect(el.id)}
      onDragEnd={e => {
        e.cancelBubble = true // prevent stage onDragEnd from firing
        onMove(el.id, e.target.x(), e.target.y())
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
        fill="#333"
        listening={false}
      />
      {el.capacity > 0 && (
        <Text
          text={`${el.capacity} seats`}
          x={-w / 2}
          y={fontSize * 0.35}
          width={w}
          align="center"
          fontSize={Math.max(11, ft(0.52))}
          fill="#888"
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

  const [floorImg, setFloorImg]   = useState(null)
  const [elements, setElements]   = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)

  // Toolbar UI state
  const [showRectPicker, setShowRectPicker] = useState(false)
  const [blockPrompt, setBlockPrompt]       = useState(null) // preset being configured

  // Load floor plan image
  useEffect(() => {
    const img = new window.Image()
    img.src = '/floorplan.png'
    img.onload = () => setFloorImg(img)
  }, [])

  // Size stage to container width (maintain image aspect ratio)
  useEffect(() => {
    const update = () => {
      if (!containerRef.current) return
      const w = containerRef.current.offsetWidth
      const h = Math.round(w * IMAGE_H / IMAGE_W)
      setStageW(w)
      setStageH(h)
      setZoom(prev => prev ?? w / IMAGE_W) // set fit-scale on first load only
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  // Load saved layout
  useEffect(() => {
    if (weddingId) loadLayout()
  }, [weddingId])

  const loadLayout = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/api/table-layout/${weddingId}`)
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
      await fetch(`${API_URL}/api/table-layout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weddingId, elements }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      console.error('Save failed:', err)
    }
    setSaving(false)
  }

  const fitScale = stageW / IMAGE_W
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

  const exportPng = () => {
    const uri = stageRef.current.toDataURL({ pixelRatio: 2 })
    const a = document.createElement('a')
    a.download = 'table-layout.png'
    a.href = uri
    a.click()
  }

  const selectedEl = elements.find(e => e.id === selectedId)

  return (
    <div>
      {/* ── Toolbar ── */}
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

        {/* Canvas controls */}
        <div className="flex items-center gap-2 pt-1 border-t border-cream-100">
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
            <button onClick={save} disabled={saving}
              className="text-xs px-4 py-1.5 rounded-lg bg-sage-600 text-white hover:bg-sage-700 disabled:opacity-50 transition">
              {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Layout'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Selected element properties ── */}
      {selectedEl && (
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
      <div ref={containerRef} className="border border-cream-200 rounded-xl overflow-hidden bg-[#f9f6f2] cursor-grab active:cursor-grabbing select-none">
        {loading ? (
          <div className="h-80 flex items-center justify-center">
            <p className="text-sage-400 text-sm">Loading floor plan…</p>
          </div>
        ) : (
          <Stage
            ref={stageRef}
            width={stageW}
            height={stageH}
            scaleX={currentZoom}
            scaleY={currentZoom}
            x={pos.x}
            y={pos.y}
            draggable
            onWheel={handleWheel}
            onDragEnd={e => {
              // Only update pos when the stage itself was dragged, not a child element
              if (e.target === stageRef.current) {
                setPos({ x: stageRef.current.x(), y: stageRef.current.y() })
              }
            }}
            onClick={e => { if (e.target === e.target.getStage()) setSelectedId(null) }}
          >
            <Layer>
              {floorImg && (
                <KonvaImage image={floorImg} x={0} y={0} width={IMAGE_W} height={IMAGE_H} />
              )}
            </Layer>
            <Layer>
              {elements.map(el => (
                <TableEl
                  key={el.id}
                  el={el}
                  isSelected={selectedId === el.id}
                  onSelect={setSelectedId}
                  onMove={moveElement}
                />
              ))}
            </Layer>
          </Stage>
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
