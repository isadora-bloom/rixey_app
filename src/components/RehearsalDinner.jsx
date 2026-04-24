import { useState, useEffect, useCallback } from 'react';
import { API_URL } from '../config/api'
import { authHeaders } from '../utils/api'
import { Button, Input } from './ui'


function ToggleGroup({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
            value === opt
              ? 'bg-sage-600 text-white border-sage-600'
              : 'bg-white text-sage-600 border-cream-300 hover:border-sage-400'
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

function YesNoToggle({ value, onChange }) {
  return (
    <div className="flex gap-2">
      {['Yes', 'No'].map(opt => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
            value === opt
              ? 'bg-sage-600 text-white border-sage-600'
              : 'bg-white text-sage-600 border-cream-300 hover:border-sage-400'
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

function SectionHeading({ children }) {
  return (
    <h3 className="text-xs font-bold text-sage-500 uppercase tracking-widest pt-2 pb-1 border-b border-cream-200">
      {children}
    </h3>
  );
}

function Field({ label, children }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-sage-700">{label}</label>
      {children}
    </div>
  );
}

const EMPTY_FORM = {
  bar_type: '',
  food_type: '',
  food_notes: '',
  location: '',
  location_notes: '',
  seating_type: '',
  table_layout: '',
  high_chairs_needed: '',
  high_chairs_count: '',
  guest_count: '',
  using_disposables: '',
  renting_china: '',
  renting_flatware: '',
  linens_source: '',
  decor_source: '',
  notes: '',
};

export default function RehearsalDinner({ weddingId, userId }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`${API_URL}/api/rehearsal-dinner/${weddingId}`, { headers: await authHeaders() });
        if (res.ok) {
          const data = await res.json();
          if (data) {
            setForm(prev => ({ ...prev, ...data }));
          }
        }
      } catch (err) {
        console.error('Failed to load rehearsal dinner details:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [weddingId]);

  const set = useCallback((field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await fetch(`${API_URL}/api/rehearsal-dinner`, {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ weddingId, userId, ...form }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      console.error('Failed to save rehearsal dinner:', err);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-sage-500 text-sm">Loading rehearsal dinner details...</div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-sage-700">Rehearsal Dinner</h2>
        <p className="mt-1 text-sm text-sage-500">
          Tell us about your rehearsal dinner plans so we can help coordinate the space and setup.
        </p>
      </div>

      {/* ── BAR ── */}
      <div className="space-y-4">
        <SectionHeading>Bar</SectionHeading>

        <Field label="Bar type">
          <ToggleGroup
            options={['Dry', 'Beer & Wine', 'Full Bar']}
            value={form.bar_type}
            onChange={v => set('bar_type', v)}
          />
        </Field>
      </div>

      {/* ── FOOD ── */}
      <div className="space-y-4">
        <SectionHeading>Food</SectionHeading>

        <Field label="Food type">
          <ToggleGroup
            options={['Full Catering Company', 'Restaurant Delivery', 'DIY / Potluck']}
            value={form.food_type}
            onChange={v => set('food_type', v)}
          />
        </Field>

        <Field label="Food notes">
          <Input
            type="text"
            value={form.food_notes}
            onChange={e => set('food_notes', e.target.value)}
            placeholder="Who's catering? Any details?"
          />
        </Field>
      </div>

      {/* ── LOCATION ── */}
      <div className="space-y-4">
        <SectionHeading>Location</SectionHeading>

        <Field label="Where will the rehearsal dinner be held?">
          <ToggleGroup
            options={['Patio', 'Ballroom', 'Casual in the Manor', 'Kitchen', 'Other']}
            value={form.location}
            onChange={v => set('location', v)}
          />
        </Field>

        {form.location === 'Other' && (
          <Field label="Location details">
            <Input
              type="text"
              value={form.location_notes}
              onChange={e => set('location_notes', e.target.value)}
              placeholder="Where exactly?"
            />
          </Field>
        )}
      </div>

      {/* ── SEATING & SETUP ── */}
      <div className="space-y-4">
        <SectionHeading>Seating &amp; Setup</SectionHeading>

        <Field label="Seating type">
          <ToggleGroup
            options={['Open Seating', 'Assigned Seating']}
            value={form.seating_type}
            onChange={v => set('seating_type', v)}
          />
        </Field>

        <Field label="Table layout">
          <ToggleGroup
            options={['Round Tables', 'Rectangular Tables', 'Mix', 'Leave to venue']}
            value={form.table_layout}
            onChange={v => set('table_layout', v)}
          />
        </Field>

        <Field label="High chairs needed?">
          <YesNoToggle
            value={form.high_chairs_needed}
            onChange={v => set('high_chairs_needed', v)}
          />
        </Field>

        {form.high_chairs_needed === 'Yes' && (
          <Field label="How many high chairs?">
            <Input
              type="number"
              min="1"
              value={form.high_chairs_count}
              onChange={e => set('high_chairs_count', e.target.value)}
              placeholder="e.g. 2"
              className="w-28"
            />
          </Field>
        )}

        <Field label="Approximate guest count">
          <Input
            type="number"
            min="1"
            value={form.guest_count}
            onChange={e => set('guest_count', e.target.value)}
            placeholder="e.g. 40"
            className="w-28"
          />
        </Field>
      </div>

      {/* ── ITEMS & RENTALS ── */}
      <div className="space-y-4">
        <SectionHeading>Items &amp; Rentals</SectionHeading>

        {/* Small yes/no rows */}
        {[
          { field: 'using_disposables', label: 'Using disposables' },
          { field: 'renting_china', label: 'Renting china' },
          { field: 'renting_flatware', label: 'Renting flatware' },
        ].map(({ field, label }) => (
          <div key={field} className="flex items-center justify-between gap-4">
            <span className="text-sm font-medium text-sage-700">{label}</span>
            <YesNoToggle
              value={form[field]}
              onChange={v => set(field, v)}
            />
          </div>
        ))}

        <Field label="Linens provided by">
          <ToggleGroup
            options={['Venue', 'Couple brings', 'Rental company']}
            value={form.linens_source}
            onChange={v => set('linens_source', v)}
          />
          {form.linens_source === 'Venue' && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-2">
              Rixey can provide basic black linens for rehearsal dinners up to ~25 guests. For larger groups, you'll need to rent or bring your own.
            </p>
          )}
        </Field>

        <Field label="Decor provided by">
          <ToggleGroup
            options={['Couple brings', 'Venue', 'Florist']}
            value={form.decor_source}
            onChange={v => set('decor_source', v)}
          />
        </Field>
      </div>

      {/* ── NOTES ── */}
      <div className="space-y-4">
        <SectionHeading>Notes</SectionHeading>

        <textarea
          value={form.notes}
          onChange={e => set('notes', e.target.value)}
          rows={4}
          placeholder="Anything else we should know about the rehearsal dinner..."
          className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300 resize-none"
        />
      </div>

      {/* Save button */}
      <div className="sticky bottom-0 bg-white/90 backdrop-blur-sm border-t border-cream-200 -mx-1 px-1 py-3 flex items-center justify-between gap-4">
        {saved ? (
          <span className="text-sm text-sage-600 font-medium">Saved</span>
        ) : (
          <span />
        )}
        <Button
          type="submit"
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </form>
  );
}
