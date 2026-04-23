import { useState, useEffect, useCallback } from 'react';
import { API_URL } from '../config/api'
import { authHeaders } from '../utils/api'
import { Input } from './ui'
import SaveIndicator from './ui/SaveIndicator'


export default function BedroomAssignments({ weddingId }) {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savedRows, setSavedRows] = useState({});
  const [fetchError, setFetchError] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [saveState, setSaveState] = useState('idle');

  useEffect(() => {
    if (!weddingId) return;
    fetchRooms();
  }, [weddingId]);

  async function fetchRooms() {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch(`${API_URL}/api/bedrooms/${weddingId}`, { headers: await authHeaders() });
      if (!res.ok) throw new Error('Failed to load bedroom assignments');
      const data = await res.json();
      setRooms(data);
    } catch (err) {
      setFetchError(err.message);
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
    setSaveError(null);
    try {
      const res = await fetch(`${API_URL}/api/bedrooms/${room.id}`, {
        method: 'PUT',
        headers: await authHeaders(),
        body: JSON.stringify({
          guest_friday: room.guest_friday || '',
          guest_saturday: room.guest_saturday || '',
          notes: room.notes || '',
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Save failed (${res.status})`);
      }
      setSaveState('saved');
      setSavedRows(prev => ({ ...prev, [room.id]: true }));
      setTimeout(() => {
        setSavedRows(prev => {
          const next = { ...prev };
          delete next[room.id];
          return next;
        });
      }, 2000);
    } catch (err) {
      setSaveState('idle');
      setSaveError(`Couldn't save ${room.room_name}: ${err.message}. Your changes aren't saved, please try again.`);
    }
  }, []);

  if (loading) {
    return (
      <div className="p-6 text-sage-500 text-sm">Loading bedroom assignments…</div>
    );
  }

  if (fetchError) {
    return (
      <div className="p-6 text-rose-400 text-sm">
        {fetchError}{' '}
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

      {/* Save error banner */}
      {saveError && (
        <div className="mb-6 flex items-start gap-2 bg-rose-50 border border-rose-200 rounded-lg px-4 py-3">
          <span className="text-rose-500 mt-0.5">&#9888;</span>
          <p className="text-sm text-rose-700 flex-1">{saveError}</p>
          <button
            onClick={() => setSaveError(null)}
            className="text-rose-500 hover:text-rose-700 text-sm"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}

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
                    value={room.guest_friday || ''}
                    placeholder="Guest name(s)"
                    onChange={e => handleChange(room.id, 'guest_friday', e.target.value)}
                    onBlur={() => handleBlur(room)}
                  />
                </td>
                <td className="px-4 py-3 align-middle">
                  <Input
                    type="text"
                    value={room.guest_saturday || ''}
                    placeholder="Guest name(s)"
                    onChange={e => handleChange(room.id, 'guest_saturday', e.target.value)}
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
                value={room.guest_friday || ''}
                placeholder="Guest name(s)"
                onChange={e => handleChange(room.id, 'guest_friday', e.target.value)}
                onBlur={() => handleBlur(room)}
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs text-sage-500 font-medium">Saturday Night</label>
              <Input
                type="text"
                value={room.guest_saturday || ''}
                placeholder="Guest name(s)"
                onChange={e => handleChange(room.id, 'guest_saturday', e.target.value)}
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
