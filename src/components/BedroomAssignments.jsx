import { useState, useEffect, useCallback } from 'react';
import { API_URL } from '../config/api'
import { authHeaders } from '../utils/api'
import { Input } from './ui'
import SaveIndicator from './ui/SaveIndicator'


export default function BedroomAssignments({ weddingId, userId }) {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savedRows, setSavedRows] = useState({});
  const [error, setError] = useState(null);
  const [saveState, setSaveState] = useState('idle');

  useEffect(() => {
    if (!weddingId) return;
    fetchRooms();
  }, [weddingId]);

  async function fetchRooms() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/bedrooms/${weddingId}`, { headers: await authHeaders() });
      if (!res.ok) throw new Error('Failed to load bedroom assignments');
      const data = await res.json();
      setRooms(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const handleChange = useCallback((id, field, value) => {
    setRooms(prev =>
      prev.map(room => (room.id === id ? { ...room, [field]: value } : room))
    );
  }, []);

  const handleBlur = useCallback(async (room) => {
    setSaveState('saving');
    try {
      const res = await fetch(`${API_URL}/api/bedrooms/${room.id}`, {
        method: 'PUT',
        headers: await authHeaders(),
        body: JSON.stringify({
          friday_night: room.friday_night || '',
          saturday_night: room.saturday_night || '',
          notes: room.notes || '',
          user_id: userId,
        }),
      });
      if (!res.ok) throw new Error('Save failed');
      setSaveState('saved');
      setSavedRows(prev => ({ ...prev, [room.id]: true }));
      setTimeout(() => {
        setSavedRows(prev => {
          const next = { ...prev };
          delete next[room.id];
          return next;
        });
      }, 2000);
    } catch {
      setSaveState('idle');
      // silently fail — user can retry on next blur
    }
  }, [userId]);

  if (loading) {
    return (
      <div className="p-6 text-sage-500 text-sm">Loading bedroom assignments…</div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-rose-400 text-sm">
        {error}{' '}
        <button
          onClick={fetchRooms}
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
      <div className="mb-5">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold text-sage-700 mb-1">Bedroom Assignments</h2>
          <SaveIndicator state={saveState} />
        </div>
        <p className="text-sm text-sage-500">
          Assign guests to rooms for Friday and Saturday nights.
        </p>
      </div>

      {/* Tip */}
      <div className="mb-6 flex items-start gap-2 bg-cream-50 border border-cream-200 rounded-lg px-4 py-3">
        <span className="text-sage-500 mt-0.5">&#9432;</span>
        <p className="text-sm text-sage-600">
          Pets are most comfortable in the Cottage, away from the festivities.
        </p>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-hidden rounded-xl border border-cream-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-cream-50 border-b border-cream-200">
              <th className="text-left px-4 py-3 text-sage-600 font-medium w-48">Room</th>
              <th className="text-left px-4 py-3 text-sage-600 font-medium">Friday Night</th>
              <th className="text-left px-4 py-3 text-sage-600 font-medium">Saturday Night</th>
              <th className="text-left px-4 py-3 text-sage-600 font-medium">Notes</th>
              <th className="w-8 px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-cream-100">
            {rooms.map(room => (
              <tr key={room.id} className="hover:bg-cream-50 transition-colors">
                <td className="px-4 py-3 align-top">
                  <div className="font-medium text-sage-700">{room.room_name}</div>
                  {room.room_description && (
                    <div className="text-xs text-sage-400 mt-0.5 leading-snug">
                      {room.room_description}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 align-middle">
                  <Input
                    type="text"
                    value={room.friday_night || ''}
                    placeholder="Guest name(s)"
                    onChange={e => handleChange(room.id, 'friday_night', e.target.value)}
                    onBlur={() => handleBlur(room)}
                  />
                </td>
                <td className="px-4 py-3 align-middle">
                  <Input
                    type="text"
                    value={room.saturday_night || ''}
                    placeholder="Guest name(s)"
                    onChange={e => handleChange(room.id, 'saturday_night', e.target.value)}
                    onBlur={() => handleBlur(room)}
                  />
                </td>
                <td className="px-4 py-3 align-middle">
                  <Input
                    type="text"
                    value={room.notes || ''}
                    placeholder="Any notes..."
                    onChange={e => handleChange(room.id, 'notes', e.target.value)}
                    onBlur={() => handleBlur(room)}
                  />
                </td>
                <td className="px-4 py-3 align-middle text-center">
                  {savedRows[room.id] && (
                    <span className="text-sage-500 text-base leading-none" title="Saved">
                      ✓
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-4">
        {rooms.map(room => (
          <div
            key={room.id}
            className="bg-white border border-cream-200 rounded-xl p-4 space-y-3"
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="font-medium text-sage-700">{room.room_name}</div>
                {room.room_description && (
                  <div className="text-xs text-sage-400 mt-0.5">{room.room_description}</div>
                )}
              </div>
              {savedRows[room.id] && (
                <span className="text-sage-500 text-base mt-0.5">✓</span>
              )}
            </div>

            <div className="space-y-2">
              <label className="block text-xs text-sage-500 font-medium">Friday Night</label>
              <Input
                type="text"
                value={room.friday_night || ''}
                placeholder="Guest name(s)"
                onChange={e => handleChange(room.id, 'friday_night', e.target.value)}
                onBlur={() => handleBlur(room)}
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs text-sage-500 font-medium">Saturday Night</label>
              <Input
                type="text"
                value={room.saturday_night || ''}
                placeholder="Guest name(s)"
                onChange={e => handleChange(room.id, 'saturday_night', e.target.value)}
                onBlur={() => handleBlur(room)}
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs text-sage-500 font-medium">Notes</label>
              <Input
                type="text"
                value={room.notes || ''}
                placeholder="Any notes..."
                onChange={e => handleChange(room.id, 'notes', e.target.value)}
                onBlur={() => handleBlur(room)}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
