import { useState, useEffect, useRef } from 'react'
import { Stage, Layer, Image as KonvaImage, Circle, Rect, Text, Group } from 'react-konva'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

// Floor plan image is 4320×2430px. Barn measured at 687px = 40ft → 17.175 px/ft
const IMAGE_W = 4320
const IMAGE_H = 2430
const PX_PER_FT = 17.175

function ft(feet) { return feet * PX_PER_FT }

function genId() { return Math.random().toString(36).substr(2, 9) }

const PRESETS = [
  { type: 'round', label: '60" Round',   feetW: 5,  feetH: 5,  capacity: 8,  color: '#F5EDE0' },
  { type: 'round', label: '72" Round',   feetW: 6,  feetH: 6,  capacity: 10, color: '#F5EDE0' },
  { type: 'rect',  label: '6ft Table',   feetW: 6,  feetH: 2.5,capacity: 6,  color: '#F5EDE0' },
  { type: 'rect',  label: '8ft Table',   feetW: 8,  feetH: 2.5,capacity: 8,  color: '#F5EDE0' },
  { type: 'rect',  label: 'Sweetheart',  feetW: 5,  feetH: 2.5,capacity: 2,  color: '#FADADD' },
  { type: 'block', label: 'Dance Floor', feetW: 20, feetH: 20, capacity: 0,  color: '#DBEAFE' },
  { type: 'block', label: 'Bar',         feetW: 8,  feetH: 4,  capacity: 0,  color: '#FEF3C7' },
  { type: 'block', label: 'Band/Stage',  feetW: 16, feetH: 8,  capacity: 0,  color: '#F3E8FF' },
  { type: 'block', label: 'Gift Table',  feetW: 6,  feetH: 2.5,capacity: 0,  color: '#FCE7F3' },
  { type: 'block', label: 'Photo Booth', feetW: 8,  feetH: 8,  capacity: 0,  color: '#ECFDF5' },
]

// ─── Single draggable element ──────────────────────────────────────────────────

function TableEl({ el, isSelected, onSelect, onMove }) {
  const w = ft(el.feetW)
  const h = ft(el.feetH)
  const fontSize = Math.max(12, ft(0.65))
  const strokeColor = isSelected ? '#C9748A' : '#00000033'
  const strokeWidth = isSelected ? ft(0.15) : ft(0.08)

  return (
    <Group
      x={el.x}
      y={el.y}
      rotation={el.rotation || 0}
      draggable
      onClick={() => onSelect(el.id)}
      onTap={() => onSelect(el.id)}
      onDragEnd={e => onMove(el.id, e.target.x(), e.target.y())}
    >
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
          cornerRadius={el.type === 'block' ? ft(0.3) : ft(0.1)}
        />
      )}
      <Text
        text={el.label}
        x={-w / 2}
        y={el.type === 'round' ? -fontSize * 0.7 : -fontSize * 0.7}
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
          y={el.type === 'round' ? fontSize * 0.3 : fontSize * 0.3}
          width={w}
          align="center"
          fontSize={Math.max(10, ft(0.5))}
          fill="#777"
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
  const [stageH, setStageH] = useState(506)
  const [zoom, setZoom] = useState(null)   // null = not yet calculated
  const [pos, setPos] = useState({ x: 0, y: 0 })

  const [floorImg, setFloorImg] = useState(null)
  const [elements, setElements] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [layoutId, setLayoutId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Load floor plan image
  useEffect(() => {
    const img = new window.Image()
    img.src = '/floorplan.png'
    img.onload = () => setFloorImg(img)
  }, [])

  // Size stage to container and set initial zoom to fit
  useEffect(() => {
    const update = () => {
      if (!containerRef.current) return
      const w = containerRef.current.offsetWidth
      const h = Math.round(w * (IMAGE_H / IMAGE_W))
      setStageW(w)
      setStageH(h)
      if (zoom === null) setZoom(w / IMAGE_W)
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [zoom])

  // Load layout from DB
  useEffect(() => {
    if (weddingId) loadLayout()
  }, [weddingId])

  const loadLayout = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/api/table-layout/${weddingId}`)
      const data = await res.json()
      if (data.layout) {
        setLayoutId(data.layout.id)
        setElements(data.layout.elements || [])
      }
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weddingId, elements }),
      })
      const data = await res.json()
      if (data.layout?.id) setLayoutId(data.layout.id)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      console.error('Save failed:', err)
    }
    setSaving(false)
  }

  const addElement = (preset) => {
    // Place in centre of current viewport
    const cx = (stageW / 2 - pos.x) / zoom
    const cy = (stageH / 2 - pos.y) / zoom
    setElements(prev => [...prev, {
      id: genId(),
      type: preset.type,
      x: cx,
      y: cy,
      feetW: preset.feetW,
      feetH: preset.feetH,
      rotation: 0,
      label: preset.label,
      capacity: preset.capacity,
      color: preset.color,
    }])
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

  // Wheel zoom
  const handleWheel = (e) => {
    e.evt.preventDefault()
    const stage = stageRef.current
    const pointer = stage.getPointerPosition()
    const minZoom = stageW / IMAGE_W
    const maxZoom = minZoom * 8
    const factor = e.evt.deltaY < 0 ? 1.1 : 0.9
    const newZoom = Math.min(maxZoom, Math.max(minZoom, zoom * factor))
    const mousePointTo = {
      x: (pointer.x - pos.x) / zoom,
      y: (pointer.y - pos.y) / zoom,
    }
    setZoom(newZoom)
    setPos({
      x: pointer.x - mousePointTo.x * newZoom,
      y: pointer.y - mousePointTo.y * newZoom,
    })
  }

  const fitToScreen = () => {
    setZoom(stageW / IMAGE_W)
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
  const currentZoom = zoom ?? (stageW / IMAGE_W)

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-3 space-y-3">
        <div>
          <p className="text-xs font-semibold text-sage-500 uppercase tracking-wide mb-2">Add to Layout</p>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map(p => (
              <button
                key={p.label}
                onClick={() => addElement(p)}
                className="text-xs px-3 py-1.5 rounded-lg border border-cream-200 text-sage-600 hover:bg-cream-50 hover:border-sage-300 transition"
              >
                {p.type === 'round' ? '◯' : '▭'} {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={fitToScreen} className="text-xs px-3 py-1.5 rounded-lg border border-cream-200 text-sage-500 hover:bg-cream-50 transition">
            Fit to Screen
          </button>
          <button onClick={() => setZoom(z => Math.min((stageW / IMAGE_W) * 8, z * 1.25))} className="text-xs px-3 py-1.5 rounded-lg border border-cream-200 text-sage-500 hover:bg-cream-50 transition">
            + Zoom In
          </button>
          <button onClick={() => setZoom(z => Math.max(stageW / IMAGE_W, z * 0.8))} className="text-xs px-3 py-1.5 rounded-lg border border-cream-200 text-sage-500 hover:bg-cream-50 transition">
            − Zoom Out
          </button>
          <span className="text-xs text-sage-400">{Math.round(currentZoom / (stageW / IMAGE_W) * 100)}%</span>
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
              onClick={save}
              disabled={saving}
              className="text-xs px-4 py-1.5 rounded-lg bg-sage-600 text-white hover:bg-sage-700 disabled:opacity-50 transition"
            >
              {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save Layout'}
            </button>
          </div>
        </div>
      </div>

      {/* Selected element panel */}
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
              <input
                type="number" min="1" max="30"
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
                <input
                  type="number" min="1"
                  className="border border-cream-200 rounded-lg px-2 py-1 text-sm w-16 focus:outline-none focus:ring-1 focus:ring-sage-300"
                  value={selectedEl.feetW}
                  onChange={e => updateSelected({ feetW: parseFloat(e.target.value) || 1 })}
                />
              </div>
              <div>
                <label className="block text-xs text-sage-500 mb-0.5">Depth (ft)</label>
                <input
                  type="number" min="1"
                  className="border border-cream-200 rounded-lg px-2 py-1 text-sm w-16 focus:outline-none focus:ring-1 focus:ring-sage-300"
                  value={selectedEl.feetH}
                  onChange={e => updateSelected({ feetH: parseFloat(e.target.value) || 1 })}
                />
              </div>
            </>
          )}
          <div>
            <label className="block text-xs text-sage-500 mb-0.5">Rotation °</label>
            <input
              type="number"
              className="border border-cream-200 rounded-lg px-2 py-1 text-sm w-16 focus:outline-none focus:ring-1 focus:ring-sage-300"
              value={selectedEl.rotation || 0}
              onChange={e => updateSelected({ rotation: parseInt(e.target.value) || 0 })}
            />
          </div>
          <button onClick={() => setSelectedId(null)} className="text-xs text-sage-400 hover:text-sage-600 pb-1">
            Done
          </button>
        </div>
      )}

      {/* Canvas */}
      <div ref={containerRef} className="border border-cream-200 rounded-xl overflow-hidden bg-[#f8f5f0] cursor-grab active:cursor-grabbing">
        {loading ? (
          <div className="h-96 flex items-center justify-center">
            <p className="text-sage-400 text-sm">Loading floor plan...</p>
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
            onDragEnd={e => setPos({ x: e.target.x(), y: e.target.y() })}
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
        Scroll or pinch to zoom · Drag background to pan · Click element to select and edit
      </p>
    </div>
  )
}
