import { useState, useEffect, useCallback } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const SECTIONS = [
  { key: 'processional', label: 'Processional', num: 1 },
  { key: 'family_escort', label: 'Family Escort', num: 2 },
  { key: 'recessional', label: 'Recessional', num: 3 },
];

const ROLE_CHIPS = [
  'Bridesmaid', 'Groomsman', 'Maid of Honor', 'Best Man',
  'Flower Girl', 'Ring Bearer', 'Usher',
  'Mother of Bride', 'Father of Bride',
  'Mother of Groom', 'Father of Groom',
  'Grandparent', 'Sibling', 'Officiant', 'Reader', 'Musician',
];

// Lower index = walks earlier in processional
const TRAD_ORDER = [
  'Officiant', 'Grandparent', 'Mother of Groom', 'Father of Groom',
  'Mother of Bride', 'Father of Bride', 'Usher', 'Groomsman',
  'Bridesmaid', 'Best Man', 'Maid of Honor', 'Ring Bearer', 'Flower Girl',
  'Reader', 'Musician', 'Sibling',
];
const roleRank = (role) => {
  const i = TRAD_ORDER.indexOf(role);
  return i === -1 ? 99 : i;
};

// Group a flat sorted array into steps: [[e1,e2], [e3], [e4,e5]]
function toSteps(entries) {
  const sorted = [...entries].sort((a, b) => a.sort_order - b.sort_order);
  const map = new Map();
  sorted.forEach(e => {
    if (!map.has(e.sort_order)) map.set(e.sort_order, []);
    map.get(e.sort_order).push(e);
  });
  return [...map.values()];
}

// Compute sort_order updates needed to persist a new steps arrangement
function buildUpdates(steps) {
  const updates = [];
  steps.forEach((step, i) => {
    step.forEach(e => updates.push({ id: e.id, sort_order: i + 1 }));
  });
  return updates;
}

async function persistUpdates(updates) {
  await Promise.all(updates.map(({ id, sort_order }) =>
    fetch(`${API_URL}/api/ceremony-order/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sort_order }),
    })
  ));
}

// ── Person Card ──────────────────────────────────────────────────────────────

function PersonCard({ entry, isDragging, onDragStart, onDragEnd, onDelete }) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`relative group bg-white border-2 rounded-xl px-3 py-2.5 cursor-grab active:cursor-grabbing select-none transition-all ${
        isDragging
          ? 'opacity-30 border-sage-200 shadow-none'
          : 'border-cream-200 hover:border-sage-300 shadow-sm hover:shadow'
      }`}
      style={{ minWidth: 130 }}
    >
      <p className="font-medium text-sm text-gray-900 leading-snug pr-3">
        {entry.participant_name || '—'}
      </p>
      {entry.role && (
        <p className="text-xs text-sage-500 mt-0.5">{entry.role}</p>
      )}
      <button
        onMouseDown={e => e.stopPropagation()}
        onClick={e => { e.stopPropagation(); onDelete(entry.id); }}
        className="absolute top-1 right-1 w-4 h-4 text-cream-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity text-sm leading-none flex items-center justify-center"
        title="Remove"
      >×</button>
    </div>
  );
}

// ── Gap Zone (insert between steps) ──────────────────────────────────────────

function GapZone({ active, onDrop }) {
  const [over, setOver] = useState(false);
  return (
    <div
      style={{ height: active ? 36 : 4 }}
      className="mx-3 transition-all duration-100"
      onDragOver={active ? e => { e.preventDefault(); setOver(true); } : undefined}
      onDragLeave={active ? () => setOver(false) : undefined}
      onDrop={active ? e => { e.preventDefault(); setOver(false); onDrop(); } : undefined}
    >
      {active && (
        <div
          className={`w-full h-full rounded-lg pointer-events-none border-2 border-dashed transition-colors ${
            over ? 'border-sage-400 bg-sage-50' : 'border-cream-200'
          }`}
        />
      )}
    </div>
  );
}

// ── Step Row ──────────────────────────────────────────────────────────────────

function StepRow({ step, stepNum, draggingId, onDragStart, onDragEnd, onDelete, onDropOnStep, isDragging }) {
  const [over, setOver] = useState(false);
  const draggingIsHere = step.some(e => e.id === draggingId);
  const canReceive = isDragging && !draggingIsHere && step.length < 3;

  return (
    <div
      className={`flex items-center gap-2 px-2 py-1.5 rounded-xl transition-colors ${
        over && canReceive ? 'bg-sage-50 ring-2 ring-sage-200' : ''
      }`}
      onDragOver={canReceive ? e => { e.preventDefault(); setOver(true); } : undefined}
      onDragLeave={canReceive ? e => {
        if (!e.relatedTarget || !e.currentTarget.contains(e.relatedTarget)) setOver(false);
      } : undefined}
      onDrop={canReceive ? e => { e.preventDefault(); setOver(false); onDropOnStep(); } : undefined}
    >
      <span className="text-xs text-cream-400 font-mono w-5 text-right shrink-0 select-none">
        {stepNum}
      </span>
      <div className="flex flex-wrap gap-2 flex-1">
        {step.map(entry => (
          <PersonCard
            key={entry.id}
            entry={entry}
            isDragging={entry.id === draggingId}
            onDragStart={() => onDragStart(entry.id)}
            onDragEnd={onDragEnd}
            onDelete={onDelete}
          />
        ))}
        {over && canReceive && (
          <div className="border-2 border-dashed border-sage-300 rounded-xl px-3 py-2.5 text-xs text-sage-400 flex items-center pointer-events-none" style={{ minWidth: 130 }}>
            walk together
          </div>
        )}
      </div>
      {step.length >= 3 && isDragging && !draggingIsHere && (
        <span className="text-xs text-cream-300 shrink-0">max 3</span>
      )}
    </div>
  );
}

// ── Add Person Form ───────────────────────────────────────────────────────────

function AddPersonForm({ onAdd, onCancel }) {
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [custom, setCustom] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    await onAdd({ participant_name: name.trim(), role: custom.trim() || role });
    setSaving(false);
    setName(''); setRole(''); setCustom('');
  };

  return (
    <div className="bg-cream-50 border-t border-cream-200 px-4 py-4 space-y-3">
      <input
        autoFocus
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => e.key === 'Escape' && onCancel()}
        placeholder="Full name *"
        className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sage-300"
      />
      <div>
        <p className="text-xs text-sage-500 font-medium mb-2">Role</p>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {ROLE_CHIPS.map(r => (
            <button
              key={r}
              type="button"
              onClick={() => { setRole(r === role ? '' : r); setCustom(''); }}
              className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                role === r && !custom
                  ? 'bg-sage-600 text-white border-sage-600'
                  : 'bg-white text-sage-600 border-cream-300 hover:border-sage-400'
              }`}
            >{r}</button>
          ))}
        </div>
        <input
          value={custom}
          onChange={e => { setCustom(e.target.value); if (e.target.value) setRole(''); }}
          placeholder="Or type a custom role…"
          className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sage-300"
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={saving || !name.trim()}
          className="px-4 py-2 bg-sage-600 text-white rounded-lg text-sm hover:bg-sage-700 disabled:opacity-50"
        >
          {saving ? 'Adding…' : 'Add to end'}
        </button>
        <button onClick={onCancel} className="px-4 py-2 bg-cream-200 text-gray-700 rounded-lg text-sm hover:bg-cream-300">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Section Builder ───────────────────────────────────────────────────────────

function SectionBuilder({ section, sectionEntries, onAdd, onDelete, onReorder }) {
  const [draggingId, setDraggingId] = useState(null);
  const [showAdd, setShowAdd] = useState(false);

  const steps = toSteps(sectionEntries);
  const isDragging = draggingId !== null;

  const applyNewSteps = async (newSteps) => {
    const updates = buildUpdates(newSteps);
    onReorder(updates);
    setDraggingId(null);
    await persistUpdates(updates);
  };

  const handleDropOnStep = async (targetStepIdx) => {
    if (!draggingId) return;
    const dragged = sectionEntries.find(e => e.id === draggingId);

    // Remove dragged from current steps, drop empty steps
    const without = steps
      .map(step => step.filter(e => e.id !== draggingId))
      .filter(s => s.length > 0);

    // Find target step by a stable entry id (since indices may have shifted)
    const anchorId = steps[targetStepIdx]?.find(e => e.id !== draggingId)?.id;
    if (!anchorId) return;
    const newTargetIdx = without.findIndex(s => s.some(e => e.id === anchorId));
    if (newTargetIdx === -1) return;

    without[newTargetIdx] = [...without[newTargetIdx], dragged];
    await applyNewSteps(without);
  };

  const handleDropOnGap = async (gapIdx) => {
    if (!draggingId) return;
    const dragged = sectionEntries.find(e => e.id === draggingId);

    const origStepIdx = steps.findIndex(s => s.some(e => e.id === draggingId));
    const willRemoveStep = origStepIdx !== -1 && steps[origStepIdx].length === 1;

    const without = steps
      .map(step => step.filter(e => e.id !== draggingId))
      .filter(s => s.length > 0);

    let adj = gapIdx;
    if (willRemoveStep && origStepIdx < gapIdx) adj--;
    adj = Math.max(0, Math.min(adj, without.length));

    without.splice(adj, 0, [dragged]);
    await applyNewSteps(without);
  };

  const handleTraditionalSort = async () => {
    const sorted = [...sectionEntries].sort((a, b) => {
      const diff = roleRank(a.role) - roleRank(b.role);
      if (section === 'recessional') return -diff;
      return diff;
    });
    await applyNewSteps(sorted.map(e => [e]));
  };

  const handleAdd = async (form) => {
    await onAdd(section, form);
    setShowAdd(false);
  };

  return (
    <div className="bg-white rounded-xl border border-cream-200 overflow-hidden">
      {/* Hint bar */}
      {sectionEntries.length > 0 && (
        <div className="px-4 py-2 bg-cream-50 border-b border-cream-100 flex items-center justify-between">
          <p className="text-xs text-cream-400">
            Drag to reorder · drop onto a card to walk together (max 3)
          </p>
          <button
            onClick={handleTraditionalSort}
            className="text-xs text-sage-600 hover:text-sage-700 font-medium"
          >
            Sort traditionally
          </button>
        </div>
      )}

      {/* Steps */}
      <div className="py-2">
        {steps.length === 0 ? (
          <p className="text-sm text-cream-400 italic text-center py-8">
            Add people below to build this section.
          </p>
        ) : (
          <>
            <GapZone active={isDragging} onDrop={() => handleDropOnGap(0)} />
            {steps.map((step, i) => (
              <div key={i}>
                <StepRow
                  step={step}
                  stepNum={i + 1}
                  draggingId={draggingId}
                  onDragStart={setDraggingId}
                  onDragEnd={() => setDraggingId(null)}
                  onDelete={onDelete}
                  onDropOnStep={() => handleDropOnStep(i)}
                  isDragging={isDragging}
                />
                <GapZone active={isDragging} onDrop={() => handleDropOnGap(i + 1)} />
              </div>
            ))}
          </>
        )}
      </div>

      {/* Add / button */}
      {showAdd ? (
        <AddPersonForm onAdd={handleAdd} onCancel={() => setShowAdd(false)} />
      ) : (
        <div className="px-4 py-3 border-t border-cream-100">
          <button
            onClick={() => setShowAdd(true)}
            className="text-sm text-sage-600 hover:text-sage-700 font-medium flex items-center gap-1"
          >
            <span className="text-lg leading-none">+</span> Add person
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function CeremonyOrder({ weddingId }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/ceremony-order/${weddingId}`);
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setEntries(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [weddingId]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async (section, form) => {
    const inSection = entries.filter(e => e.section === section);
    const maxOrder = inSection.length > 0
      ? Math.max(...inSection.map(e => e.sort_order))
      : 0;
    const payload = {
      wedding_id: weddingId,
      section,
      participant_name: form.participant_name,
      role: form.role || '',
      sort_order: maxOrder + 1,
      side: 'center',
    };
    try {
      const res = await fetch(`${API_URL}/api/ceremony-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to add');
      const newEntry = await res.json();
      setEntries(prev => [...prev, newEntry]);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id) => {
    try {
      await fetch(`${API_URL}/api/ceremony-order/${id}`, { method: 'DELETE' });
      setEntries(prev => prev.filter(e => e.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const handleReorder = (updates) => {
    setEntries(prev => prev.map(e => {
      const u = updates.find(up => up.id === e.id);
      return u ? { ...e, sort_order: u.sort_order } : e;
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-sage-500 text-sm">
        Loading ceremony order…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
        Error: {error}{' '}
        <button onClick={load} className="underline hover:no-underline ml-1">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Ceremony Order</h2>
        <p className="text-sm text-sage-500 mt-0.5">
          Add people to each section, then drag to reorder. Drop a card onto another to walk together.
        </p>
      </div>

      {SECTIONS.map(({ key, label, num }) => (
        <section key={key}>
          <h3 className="text-base font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-sage-100 text-sage-700 text-xs flex items-center justify-center font-bold">
              {num}
            </span>
            {label}
          </h3>
          <SectionBuilder
            section={key}
            sectionEntries={entries.filter(e => e.section === key)}
            onAdd={handleAdd}
            onDelete={handleDelete}
            onReorder={handleReorder}
          />
        </section>
      ))}
    </div>
  );
}
