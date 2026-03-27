import { useState, useEffect } from 'react';
import { API_URL } from '../config/api'


// ── time helpers ──────────────────────────────────────────────────
function parseTime(str) {
  if (!str) return null;
  const m = str.trim().match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
  if (!m) return null;
  let h = parseInt(m[1]);
  const min = parseInt(m[2]);
  const period = m[3].toLowerCase();
  if (period === 'pm' && h !== 12) h += 12;
  if (period === 'am' && h === 12) h = 0;
  return h * 60 + min;
}

function formatTime(totalMinutes) {
  if (totalMinutes < 0) totalMinutes += 1440;
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

// ── Suggested Schedule panel ──────────────────────────────────────
function SuggestedSchedule({ onGenerateRuns }) {
  const [open, setOpen] = useState(false);
  const [pre, setPre] = useState({ ceremonyTime: '', numRuns: '2', pickupLocation: '' });
  const [post, setPost] = useState({ eventEndTime: '', numRuns: '2', dropoffLocation: '' });
  const [generating, setGenerating] = useState('');

  const setPreField = (f, v) => setPre((p) => ({ ...p, [f]: v }));
  const setPostField = (f, v) => setPost((p) => ({ ...p, [f]: v }));

  const generatePreRuns = async () => {
    const base = parseTime(pre.ceremonyTime);
    if (!base) return;
    const n = parseInt(pre.numRuns) || 1;
    const TRANSIT = 25; // minutes hotel → venue
    const ARRIVE_BEFORE = 5; // arrive this many minutes before ceremony
    // last pickup departs hotel so guests arrive ~5 min before ceremony
    const lastPickup = base - TRANSIT - ARRIVE_BEFORE;
    const runs = [];
    for (let i = n - 1; i >= 0; i--) {
      const pickupTime = lastPickup - i * 30;
      const dropoffTime = pickupTime + TRANSIT;
      runs.push({
        run_label: n > 1 ? `Pre-Ceremony — Run ${n - i} of ${n}` : 'Pre-Ceremony Run',
        pickup_location: pre.pickupLocation || 'Hotel',
        pickup_time: formatTime(pickupTime),
        dropoff_location: 'Rixey Manor',
        dropoff_time: formatTime(dropoffTime),
        seat_count: '',
        notes: '',
      });
    }
    setGenerating('pre');
    await onGenerateRuns(runs);
    setGenerating('');
  };

  const generatePostRuns = async () => {
    const base = parseTime(post.eventEndTime);
    if (!base) return;
    const n = parseInt(post.numRuns) || 1;
    const TRANSIT = 25;
    const runs = [];
    for (let i = 0; i < n; i++) {
      const pickupTime = base + i * 30;
      const dropoffTime = pickupTime + TRANSIT;
      runs.push({
        run_label: n > 1 ? `End of Night — Run ${i + 1} of ${n}` : 'End of Night Run',
        pickup_location: 'Rixey Manor',
        pickup_time: formatTime(pickupTime),
        dropoff_location: post.dropoffLocation || 'Hotel',
        dropoff_time: formatTime(dropoffTime),
        seat_count: '',
        notes: '',
      });
    }
    setGenerating('post');
    await onGenerateRuns(runs);
    setGenerating('');
  };

  const numOptions = ['1', '2', '3', '4'];

  return (
    <div className="bg-cream-50 border border-cream-200 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-sage-700 hover:bg-cream-100 transition-colors"
      >
        <span>Generate Suggested Runs</span>
        <svg
          className={`w-4 h-4 text-sage-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-cream-200 p-5 grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Pre-ceremony */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-sage-500 uppercase tracking-wider">Pre-Ceremony</h4>
            <div>
              <label className="block text-xs font-medium text-sage-600 mb-1">Ceremony time</label>
              <input
                value={pre.ceremonyTime}
                onChange={(e) => setPreField('ceremonyTime', e.target.value)}
                placeholder="e.g. 4:00 PM"
                className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-sage-600 mb-1">Number of runs</label>
              <div className="flex gap-2">
                {numOptions.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setPreField('numRuns', n)}
                    className={`w-10 py-1.5 rounded-lg text-sm border transition-colors ${
                      pre.numRuns === n
                        ? 'bg-sage-600 text-white border-sage-600'
                        : 'bg-white text-sage-600 border-cream-300 hover:border-sage-400'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-sage-600 mb-1">Pickup location</label>
              <input
                value={pre.pickupLocation}
                onChange={(e) => setPreField('pickupLocation', e.target.value)}
                placeholder="e.g. Hampton Inn, Culpeper"
                className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300"
              />
            </div>
            <button
              type="button"
              disabled={!pre.ceremonyTime || generating === 'pre'}
              onClick={generatePreRuns}
              className="w-full px-4 py-2 bg-sage-600 text-white rounded-lg text-sm hover:bg-sage-700 disabled:opacity-50"
            >
              {generating === 'pre' ? 'Generating…' : 'Generate Pre-Ceremony Runs'}
            </button>
          </div>

          {/* End of night */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-sage-500 uppercase tracking-wider">End of Night</h4>
            <div>
              <label className="block text-xs font-medium text-sage-600 mb-1">Event ends at</label>
              <input
                value={post.eventEndTime}
                onChange={(e) => setPostField('eventEndTime', e.target.value)}
                placeholder="e.g. 11:00 PM"
                className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-sage-600 mb-1">Number of runs</label>
              <div className="flex gap-2">
                {numOptions.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setPostField('numRuns', n)}
                    className={`w-10 py-1.5 rounded-lg text-sm border transition-colors ${
                      post.numRuns === n
                        ? 'bg-sage-600 text-white border-sage-600'
                        : 'bg-white text-sage-600 border-cream-300 hover:border-sage-400'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-sage-600 mb-1">Dropoff location</label>
              <input
                value={post.dropoffLocation}
                onChange={(e) => setPostField('dropoffLocation', e.target.value)}
                placeholder="e.g. Hampton Inn, Culpeper"
                className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300"
              />
            </div>
            <button
              type="button"
              disabled={!post.eventEndTime || generating === 'post'}
              onClick={generatePostRuns}
              className="w-full px-4 py-2 bg-sage-600 text-white rounded-lg text-sm hover:bg-sage-700 disabled:opacity-50"
            >
              {generating === 'post' ? 'Generating…' : 'Generate End-of-Night Runs'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ShuttleSchedule({ weddingId, userId }) {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingFields, setEditingFields] = useState({});
  const [formData, setFormData] = useState({
    run_label: '',
    pickup_location: '',
    pickup_time: '',
    dropoff_location: '',
    dropoff_time: '',
    seat_count: '',
    notes: '',
  });

  useEffect(() => {
    fetchRuns();
  }, [weddingId]);

  async function fetchRuns() {
    try {
      const res = await fetch(`${API_URL}/api/shuttle/${weddingId}`);
      const data = await res.json();
      setRuns(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load shuttle runs:', err);
      setRuns([]);
    } finally {
      setLoading(false);
    }
  }

  function handleFormChange(e) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  async function addRun(data) {
    const res = await fetch(`${API_URL}/api/shuttle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wedding_id: weddingId, ...data }),
    });
    return await res.json();
  }

  async function handleAddRun(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const newRun = await addRun(formData);
      setRuns((prev) => [...prev, newRun]);
      setFormData({
        run_label: '',
        pickup_location: '',
        pickup_time: '',
        dropoff_location: '',
        dropoff_time: '',
        seat_count: '',
        notes: '',
      });
      setShowForm(false);
    } catch (err) {
      console.error('Failed to add shuttle run:', err);
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerateRuns(runDataArray) {
    const newRuns = [];
    for (const data of runDataArray) {
      try {
        const run = await addRun(data);
        newRuns.push(run);
      } catch (err) {
        console.error('Failed to add run:', err);
      }
    }
    setRuns((prev) => [...prev, ...newRuns]);
  }

  function handleEditField(runId, field, value) {
    setEditingFields((prev) => ({
      ...prev,
      [`${runId}_${field}`]: value,
    }));
  }

  function getEditValue(runId, field, fallback) {
    const key = `${runId}_${field}`;
    return key in editingFields ? editingFields[key] : fallback;
  }

  async function handleBlur(run, field) {
    const key = `${run.id}_${field}`;
    if (!(key in editingFields)) return;
    const newValue = editingFields[key];
    if (newValue === run[field]) {
      setEditingFields((prev) => {
        const copy = { ...prev };
        delete copy[key];
        return copy;
      });
      return;
    }
    try {
      const updated = { ...run, [field]: newValue };
      const res = await fetch(`${API_URL}/api/shuttle/${run.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...updated, userId }),
      });
      const saved = await res.json();
      setRuns((prev) => prev.map((r) => (r.id === run.id ? saved : r)));
    } catch (err) {
      console.error('Failed to update shuttle run:', err);
    } finally {
      setEditingFields((prev) => {
        const copy = { ...prev };
        delete copy[key];
        return copy;
      });
    }
  }

  async function handleDelete(runId) {
    if (!window.confirm('Delete this shuttle run?')) return;
    try {
      await fetch(`${API_URL}/api/shuttle/${runId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      setRuns((prev) => prev.filter((r) => r.id !== runId));
    } catch (err) {
      console.error('Failed to delete shuttle run:', err);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-sage-500 text-sm">Loading shuttle schedule...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-sage-700">Shuttle Schedule</h2>
          <p className="mt-1 text-sm text-sage-500">
            Coordinate guest transportation runs for your wedding day.
          </p>
        </div>
        <button
          onClick={() => setShowForm((prev) => !prev)}
          className="px-4 py-2 bg-sage-600 text-white rounded-lg text-sm hover:bg-sage-700 disabled:opacity-50 shrink-0"
        >
          {showForm ? 'Cancel' : '+ Add Run'}
        </button>
      </div>

      {/* Advisory note */}
      <div className="bg-cream-100 border border-cream-300 rounded-lg px-4 py-3 text-sm text-sage-600">
        Please avoid having guests arrive too early — aim for pickup 5 mins before they're needed.
      </div>

      {/* Suggested schedule generator */}
      <SuggestedSchedule onGenerateRuns={handleGenerateRuns} />

      {/* Add Run Form */}
      {showForm && (
        <form
          onSubmit={handleAddRun}
          className="bg-cream-50 border border-cream-200 rounded-xl p-5 space-y-4"
        >
          <h3 className="text-sm font-semibold text-sage-700 uppercase tracking-wide">
            New Shuttle Run
          </h3>

          <div>
            <label className="block text-xs font-medium text-sage-600 mb-1">Run Label</label>
            <input
              name="run_label"
              value={formData.run_label}
              onChange={handleFormChange}
              placeholder='e.g. "Run 1 — Pre-ceremony pickup"'
              className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-sage-600 mb-1">
                Pickup Location
              </label>
              <input
                name="pickup_location"
                value={formData.pickup_location}
                onChange={handleFormChange}
                placeholder="e.g. Hampton Inn, Culpeper"
                required
                className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-sage-600 mb-1">Pickup Time</label>
              <input
                name="pickup_time"
                value={formData.pickup_time}
                onChange={handleFormChange}
                placeholder="e.g. 3:45 PM"
                required
                className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-sage-600 mb-1">
                Dropoff Location
              </label>
              <input
                name="dropoff_location"
                value={formData.dropoff_location}
                onChange={handleFormChange}
                placeholder="e.g. Rixey Manor"
                required
                className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-sage-600 mb-1">Dropoff Time</label>
              <input
                name="dropoff_time"
                value={formData.dropoff_time}
                onChange={handleFormChange}
                placeholder="e.g. 4:10 PM"
                required
                className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-sage-600 mb-1">
                Seat Count
              </label>
              <input
                name="seat_count"
                type="number"
                min="1"
                value={formData.seat_count}
                onChange={handleFormChange}
                placeholder="e.g. 14"
                className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-sage-600 mb-1">Notes</label>
            <input
              name="notes"
              value={formData.notes}
              onChange={handleFormChange}
              placeholder="Any special instructions..."
              className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300"
            />
          </div>

          <div className="flex gap-2 justify-end pt-1">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 border border-cream-300 text-sage-600 rounded-lg text-sm hover:bg-cream-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-sage-600 text-white rounded-lg text-sm hover:bg-sage-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Add Run'}
            </button>
          </div>
        </form>
      )}

      {/* Run Cards */}
      {runs.length === 0 ? (
        <div className="text-center py-12 text-sage-400 text-sm">
          No shuttle runs yet. Generate suggested runs above or add one manually.
        </div>
      ) : (
        <div className="space-y-4">
          {runs.map((run, index) => (
            <div
              key={run.id}
              className="bg-white border border-cream-200 rounded-xl overflow-hidden shadow-sm"
            >
              {/* Run label bar */}
              <div className="flex items-center justify-between gap-3 bg-cream-50 border-b border-cream-200 px-4 py-3">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-xs font-bold text-sage-400 uppercase tracking-wider shrink-0">
                    Run {index + 1}
                  </span>
                  <span className="text-sage-300 shrink-0">—</span>
                  <input
                    value={getEditValue(run.id, 'run_label', run.run_label || '')}
                    onChange={(e) => handleEditField(run.id, 'run_label', e.target.value)}
                    onBlur={() => handleBlur(run, 'run_label')}
                    placeholder="Label this run..."
                    className="flex-1 min-w-0 bg-transparent text-sm font-medium text-sage-700 placeholder-sage-300 focus:outline-none border-b border-transparent focus:border-sage-300"
                  />
                </div>
                <button
                  onClick={() => handleDelete(run.id)}
                  className="text-xs text-rose-400 hover:text-rose-500 shrink-0"
                >
                  Delete
                </button>
              </div>

              {/* Timeline row */}
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] items-center gap-0 px-4 py-4">
                {/* Pickup side */}
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-sage-400 uppercase tracking-wide">
                    Pickup
                  </div>
                  <input
                    value={getEditValue(run.id, 'pickup_location', run.pickup_location || '')}
                    onChange={(e) => handleEditField(run.id, 'pickup_location', e.target.value)}
                    onBlur={() => handleBlur(run, 'pickup_location')}
                    placeholder="Location"
                    className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300"
                  />
                  <input
                    value={getEditValue(run.id, 'pickup_time', run.pickup_time || '')}
                    onChange={(e) => handleEditField(run.id, 'pickup_time', e.target.value)}
                    onBlur={() => handleBlur(run, 'pickup_time')}
                    placeholder="Time (e.g. 3:45 PM)"
                    className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300"
                  />
                </div>

                {/* Arrow connector */}
                <div className="hidden sm:flex flex-col items-center px-4 text-sage-300">
                  <svg
                    className="w-8 h-8"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M13 7l5 5m0 0l-5 5m5-5H6"
                    />
                  </svg>
                </div>

                {/* Dropoff side */}
                <div className="space-y-2 mt-4 sm:mt-0">
                  <div className="text-xs font-semibold text-sage-400 uppercase tracking-wide">
                    Dropoff
                  </div>
                  <input
                    value={getEditValue(run.id, 'dropoff_location', run.dropoff_location || '')}
                    onChange={(e) => handleEditField(run.id, 'dropoff_location', e.target.value)}
                    onBlur={() => handleBlur(run, 'dropoff_location')}
                    placeholder="Location"
                    className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300"
                  />
                  <input
                    value={getEditValue(run.id, 'dropoff_time', run.dropoff_time || '')}
                    onChange={(e) => handleEditField(run.id, 'dropoff_time', e.target.value)}
                    onBlur={() => handleBlur(run, 'dropoff_time')}
                    placeholder="Time (e.g. 4:10 PM)"
                    className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300"
                  />
                </div>
              </div>

              {/* Bottom row: seat count + notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 px-4 pb-4">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-sage-500 shrink-0">Seats:</label>
                  <input
                    type="number"
                    min="1"
                    value={getEditValue(run.id, 'seat_count', run.seat_count ?? '')}
                    onChange={(e) => handleEditField(run.id, 'seat_count', e.target.value)}
                    onBlur={() => handleBlur(run, 'seat_count')}
                    placeholder="—"
                    className="w-20 border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-sage-500 shrink-0">Notes:</label>
                  <input
                    value={getEditValue(run.id, 'notes', run.notes || '')}
                    onChange={(e) => handleEditField(run.id, 'notes', e.target.value)}
                    onBlur={() => handleBlur(run, 'notes')}
                    placeholder="Any special instructions..."
                    className="flex-1 border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
