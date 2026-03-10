import { useState, useEffect, useCallback } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const ROLES = [
  'Bride',
  'Maid of Honor',
  'Bridesmaid',
  'Mother of Bride',
  'Mother of Groom',
  'Flower Girl',
  'Other',
];

const EMPTY_FORM = {
  participant_name: '',
  role: 'Bridesmaid',
  hair_start_time: '',
  makeup_start_time: '',
  notes: '',
};

function formatTime(t) {
  if (!t) return '—';
  // t might be "HH:MM:SS" from Postgres or "HH:MM"
  const parts = t.split(':');
  if (parts.length < 2) return t;
  const h = parseInt(parts[0], 10);
  const m = parts[1];
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m} ${ampm}`;
}

function sortByTime(entries) {
  return [...entries].sort((a, b) => {
    if (!a.hair_start_time && !b.hair_start_time) return 0;
    if (!a.hair_start_time) return 1;
    if (!b.hair_start_time) return -1;
    return a.hair_start_time.localeCompare(b.hair_start_time);
  });
}

export default function MakeupSchedule({ weddingId, userId }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [savedRows, setSavedRows] = useState({});
  const [editingCell, setEditingCell] = useState(null); // { id, field }
  const [editValue, setEditValue] = useState('');
  const [error, setError] = useState(null);
  const [hairMakeupDoneTime, setHairMakeupDoneTime] = useState(null);

  useEffect(() => {
    if (!weddingId) return;
    fetchEntries();
    fetchTimelineDeadline();
  }, [weddingId]);

  async function fetchTimelineDeadline() {
    try {
      const res = await fetch(`${API_URL}/api/timeline/${weddingId}`);
      if (!res.ok) return;
      const data = await res.json();
      const events = data.timeline?.timeline_data?.events;
      const t = events?.['hair-makeup-done']?.time;
      if (t) setHairMakeupDoneTime(t);
    } catch {
      // not critical
    }
  }

  async function fetchEntries() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/makeup/${weddingId}`);
      if (!res.ok) throw new Error('Failed to load makeup schedule');
      const data = await res.json();
      setEntries(sortByTime(data));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd() {
    if (!formData.participant_name.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/makeup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wedding_id: weddingId,
          participant_name: formData.participant_name.trim(),
          role: formData.role,
          hair_start_time: formData.hair_start_time || null,
          makeup_start_time: formData.makeup_start_time || null,
          notes: formData.notes.trim(),
          sort_order: entries.length,
          user_id: userId,
        }),
      });
      if (!res.ok) throw new Error('Failed to add entry');
      const newEntry = await res.json();
      setEntries(prev => sortByTime([...prev, newEntry]));
      setFormData(EMPTY_FORM);
      setShowForm(false);
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Remove this person from the schedule?')) return;
    try {
      const res = await fetch(`${API_URL}/api/makeup/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      setEntries(prev => prev.filter(e => e.id !== id));
    } catch (err) {
      alert(err.message);
    }
  }

  const startEdit = useCallback((id, field, currentValue) => {
    setEditingCell({ id, field });
    setEditValue(currentValue || '');
  }, []);

  const commitEdit = useCallback(async (entry) => {
    if (!editingCell) return;
    const { id, field } = editingCell;
    if (entry.id !== id) return;

    const updated = { ...entry, [field]: editValue };
    setEntries(prev =>
      sortByTime(prev.map(e => (e.id === id ? updated : e)))
    );
    setEditingCell(null);

    try {
      const res = await fetch(`${API_URL}/api/makeup/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participant_name: updated.participant_name,
          role: updated.role,
          hair_start_time: updated.hair_start_time || null,
          makeup_start_time: updated.makeup_start_time || null,
          notes: updated.notes,
          user_id: userId,
        }),
      });
      if (!res.ok) throw new Error('Save failed');
      setSavedRows(prev => ({ ...prev, [id]: true }));
      setTimeout(() => {
        setSavedRows(prev => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }, 2000);
    } catch {
      // silently fail
    }
  }, [editingCell, editValue, userId]);

  if (loading) {
    return (
      <div className="p-6 text-sage-500 text-sm">Loading makeup schedule…</div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-rose-400 text-sm">
        {error}{' '}
        <button
          onClick={fetchEntries}
          className="underline text-sage-600 hover:text-sage-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-sage-700 mb-1">Makeup & Hair Schedule</h2>
          <p className="text-sm text-sage-500">
            {entries.length > 0
              ? `${entries.length} ${entries.length === 1 ? 'person' : 'people'} scheduled`
              : 'No one scheduled yet'}
          </p>
        </div>
        <button
          onClick={() => { setShowForm(v => !v); setFormData(EMPTY_FORM); }}
          className="px-4 py-2 bg-sage-600 text-white rounded-lg text-sm hover:bg-sage-700 disabled:opacity-50 shrink-0"
        >
          {showForm ? 'Cancel' : '+ Add Person'}
        </button>
      </div>

      {/* Deadline + tip */}
      <div className="mb-5 bg-cream-50 border border-cream-200 rounded-lg px-4 py-3 space-y-1.5">
        {hairMakeupDoneTime && (
          <p className="text-sm text-sage-700">
            Everyone must be ready by{' '}
            <span className="font-bold">{formatTime(hairMakeupDoneTime)}</span>
            {' '}— this is your Hair &amp; Makeup Complete time from the timeline.
          </p>
        )}
        <p className="text-sm text-sage-500">
          Allow <strong>45 mins per service</strong> for the bride (hair + makeup = <strong>90 mins total</strong>). Schedule bridesmaids and family around her.
        </p>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="mb-6 bg-cream-50 border border-cream-200 rounded-xl p-4">
          <h3 className="text-sm font-medium text-sage-700 mb-3">Add to Schedule</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-sage-500 mb-1">Name *</label>
              <input
                type="text"
                value={formData.participant_name}
                onChange={e => setFormData(f => ({ ...f, participant_name: e.target.value }))}
                placeholder="Full name"
                className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300"
              />
            </div>
            <div>
              <label className="block text-xs text-sage-500 mb-1">Role</label>
              <select
                value={formData.role}
                onChange={e => setFormData(f => ({ ...f, role: e.target.value }))}
                className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300 bg-white"
              >
                {ROLES.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-sage-500 mb-1">Hair Starts</label>
              <input
                type="time"
                value={formData.hair_start_time}
                onChange={e => setFormData(f => ({ ...f, hair_start_time: e.target.value }))}
                className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300"
              />
            </div>
            <div>
              <label className="block text-xs text-sage-500 mb-1">Makeup Starts</label>
              <input
                type="time"
                value={formData.makeup_start_time}
                onChange={e => setFormData(f => ({ ...f, makeup_start_time: e.target.value }))}
                className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300"
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-1">
              <label className="block text-xs text-sage-500 mb-1">Notes</label>
              <input
                type="text"
                value={formData.notes}
                onChange={e => setFormData(f => ({ ...f, notes: e.target.value }))}
                placeholder="Any notes…"
                className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300"
              />
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <button
              onClick={handleAdd}
              disabled={submitting || !formData.participant_name.trim()}
              className="px-4 py-2 bg-sage-600 text-white rounded-lg text-sm hover:bg-sage-700 disabled:opacity-50"
            >
              {submitting ? 'Adding…' : 'Add to Schedule'}
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {entries.length === 0 && !showForm && (
        <div className="text-center py-12 text-sage-400 text-sm">
          No one on the schedule yet. Click "+ Add Person" to get started.
        </div>
      )}

      {/* Desktop table */}
      {entries.length > 0 && (
        <div className="hidden md:block overflow-hidden rounded-xl border border-cream-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-cream-50 border-b border-cream-200">
                <th className="text-left px-4 py-3 text-sage-600 font-medium">Person</th>
                <th className="text-left px-4 py-3 text-sage-600 font-medium">Role</th>
                <th className="text-left px-4 py-3 text-sage-600 font-medium">Hair Starts</th>
                <th className="text-left px-4 py-3 text-sage-600 font-medium">Makeup Starts</th>
                <th className="text-left px-4 py-3 text-sage-600 font-medium">Notes</th>
                <th className="w-16 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-100">
              {entries.map(entry => (
                <tr key={entry.id} className="hover:bg-cream-50 transition-colors group">
                  {/* Person name */}
                  <td className="px-4 py-3 font-medium text-sage-700">
                    {entry.participant_name}
                  </td>

                  {/* Role */}
                  <td className="px-4 py-3 text-sage-500">
                    {entry.role}
                  </td>

                  {/* Hair start — inline editable */}
                  <td
                    className="px-4 py-3 cursor-pointer"
                    onClick={() =>
                      editingCell?.id !== entry.id || editingCell?.field !== 'hair_start_time'
                        ? startEdit(entry.id, 'hair_start_time', entry.hair_start_time)
                        : null
                    }
                  >
                    {editingCell?.id === entry.id && editingCell?.field === 'hair_start_time' ? (
                      <input
                        type="time"
                        autoFocus
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onBlur={() => commitEdit(entry)}
                        className="border border-cream-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300"
                      />
                    ) : (
                      <span className="text-sage-600 hover:text-sage-700 underline decoration-dotted decoration-sage-300">
                        {formatTime(entry.hair_start_time)}
                      </span>
                    )}
                  </td>

                  {/* Makeup start — inline editable */}
                  <td
                    className="px-4 py-3 cursor-pointer"
                    onClick={() =>
                      editingCell?.id !== entry.id || editingCell?.field !== 'makeup_start_time'
                        ? startEdit(entry.id, 'makeup_start_time', entry.makeup_start_time)
                        : null
                    }
                  >
                    {editingCell?.id === entry.id && editingCell?.field === 'makeup_start_time' ? (
                      <input
                        type="time"
                        autoFocus
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onBlur={() => commitEdit(entry)}
                        className="border border-cream-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300"
                      />
                    ) : (
                      <span className="text-sage-600 hover:text-sage-700 underline decoration-dotted decoration-sage-300">
                        {formatTime(entry.makeup_start_time)}
                      </span>
                    )}
                  </td>

                  {/* Notes */}
                  <td className="px-4 py-3 text-sage-400 text-xs">
                    {entry.notes || ''}
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {savedRows[entry.id] && (
                        <span className="text-sage-500 text-base leading-none">✓</span>
                      )}
                      <button
                        onClick={() => handleDelete(entry.id)}
                        className="text-rose-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity text-xs px-2 py-1 rounded hover:bg-rose-50"
                        title="Remove"
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Mobile cards */}
      {entries.length > 0 && (
        <div className="md:hidden space-y-3">
          {entries.map(entry => (
            <div
              key={entry.id}
              className="bg-white border border-cream-200 rounded-xl p-4 space-y-3"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-medium text-sage-700">{entry.participant_name}</div>
                  <div className="text-xs text-sage-400 mt-0.5">{entry.role}</div>
                </div>
                <div className="flex items-center gap-2">
                  {savedRows[entry.id] && (
                    <span className="text-sage-500 text-base">✓</span>
                  )}
                  <button
                    onClick={() => handleDelete(entry.id)}
                    className="text-rose-400 hover:text-rose-500 text-xs px-2 py-1 rounded hover:bg-rose-50"
                  >
                    Remove
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-sage-500 mb-1">Hair Starts</label>
                  {editingCell?.id === entry.id && editingCell?.field === 'hair_start_time' ? (
                    <input
                      type="time"
                      autoFocus
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      onBlur={() => commitEdit(entry)}
                      className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300"
                    />
                  ) : (
                    <button
                      onClick={() => startEdit(entry.id, 'hair_start_time', entry.hair_start_time)}
                      className="text-sm text-sage-600 underline decoration-dotted"
                    >
                      {formatTime(entry.hair_start_time)}
                    </button>
                  )}
                </div>
                <div>
                  <label className="block text-xs text-sage-500 mb-1">Makeup Starts</label>
                  {editingCell?.id === entry.id && editingCell?.field === 'makeup_start_time' ? (
                    <input
                      type="time"
                      autoFocus
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      onBlur={() => commitEdit(entry)}
                      className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300"
                    />
                  ) : (
                    <button
                      onClick={() =>
                        startEdit(entry.id, 'makeup_start_time', entry.makeup_start_time)
                      }
                      className="text-sm text-sage-600 underline decoration-dotted"
                    >
                      {formatTime(entry.makeup_start_time)}
                    </button>
                  )}
                </div>
              </div>

              {entry.notes && (
                <div className="text-xs text-sage-400">{entry.notes}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
