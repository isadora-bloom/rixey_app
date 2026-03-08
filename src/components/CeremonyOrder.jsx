import { useState, useEffect, useCallback } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const SECTIONS = [
  { key: 'processional', label: 'Processional' },
  { key: 'family_escort', label: 'Family Escort' },
  { key: 'recessional', label: 'Recessional' },
];

const SIDE_OPTIONS = {
  processional: [
    { value: 'center', label: 'Center' },
    { value: 'brides_side', label: "Bride's Side" },
    { value: 'grooms_side', label: "Groom's Side" },
  ],
  family_escort: [
    { value: 'family', label: 'Family' },
  ],
  recessional: [
    { value: 'center', label: 'Center' },
    { value: 'brides_side', label: "Bride's Side" },
    { value: 'grooms_side', label: "Groom's Side" },
  ],
};

const SIDE_LABEL = {
  brides_side: "Bride's Side",
  grooms_side: "Groom's Side",
  center: 'Center',
  family: 'Family',
};

const EMPTY_FORM = {
  participant_name: '',
  role: '',
  side: '',
  walk_with: '',
  notes: '',
};

function EntryRow({ entry, onDelete, onMoveUp, onMoveDown, isFirst, isLast }) {
  const [editing, setEditing] = useState({});
  const [values, setValues] = useState({
    participant_name: entry.participant_name || '',
    role: entry.role || '',
    walk_with: entry.walk_with || '',
    notes: entry.notes || '',
  });

  const handleBlur = async (field) => {
    if (values[field] === (entry[field] || '')) return;
    try {
      await fetch(`${API_URL}/api/ceremony-order/${entry.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: values[field] }),
      });
    } catch (err) {
      console.error('Failed to save field', field, err);
    }
    setEditing((e) => ({ ...e, [field]: false }));
  };

  const handleChange = (field, val) => setValues((v) => ({ ...v, [field]: val }));

  const handleDelete = () => {
    if (window.confirm(`Remove "${entry.participant_name || 'this entry'}" from the order?`)) {
      onDelete(entry.id);
    }
  };

  const cell = (field, placeholder = '') => (
    editing[field] ? (
      <input
        autoFocus
        className="border border-cream-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300 w-full"
        value={values[field]}
        placeholder={placeholder}
        onChange={(e) => handleChange(field, e.target.value)}
        onBlur={() => handleBlur(field)}
      />
    ) : (
      <span
        className="cursor-text hover:bg-cream-100 rounded px-1 py-0.5 text-sm text-gray-800 min-w-[60px] inline-block"
        onClick={() => setEditing((e) => ({ ...e, [field]: true }))}
        title="Click to edit"
      >
        {values[field] || <span className="text-cream-400 italic">{placeholder || 'Edit…'}</span>}
      </span>
    )
  );

  return (
    <tr className="border-b border-cream-100 hover:bg-cream-50 group">
      <td className="py-2 px-3 w-8 text-xs text-cream-400 font-mono">{entry.sort_order}</td>
      <td className="py-2 px-3">{cell('participant_name', 'Name')}</td>
      <td className="py-2 px-3">{cell('role', 'Role')}</td>
      <td className="py-2 px-3">{cell('walk_with', 'Walks with…')}</td>
      <td className="py-2 px-3">{cell('notes', 'Notes')}</td>
      <td className="py-2 px-2 w-16">
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onMoveUp(entry.id)}
            disabled={isFirst}
            className="p-1 rounded hover:bg-cream-200 disabled:opacity-30 disabled:cursor-not-allowed text-cream-500"
            title="Move up"
          >
            ▲
          </button>
          <button
            onClick={() => onMoveDown(entry.id)}
            disabled={isLast}
            className="p-1 rounded hover:bg-cream-200 disabled:opacity-30 disabled:cursor-not-allowed text-cream-500"
            title="Move down"
          >
            ▼
          </button>
          <button
            onClick={handleDelete}
            className="p-1 rounded hover:bg-rose-50 text-rose-400 hover:text-rose-600"
            title="Remove"
          >
            ×
          </button>
        </div>
      </td>
    </tr>
  );
}

function AddForm({ section, onAdd, onCancel }) {
  const [form, setForm] = useState({ ...EMPTY_FORM, side: SIDE_OPTIONS[section][0]?.value || 'center' });
  const [saving, setSaving] = useState(false);

  const set = (field, val) => setForm((f) => ({ ...f, [field]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.participant_name.trim()) return;
    setSaving(true);
    await onAdd(form);
    setSaving(false);
    setForm({ ...EMPTY_FORM, side: SIDE_OPTIONS[section][0]?.value || 'center' });
  };

  return (
    <tr className="bg-cream-50 border-b border-cream-200">
      <td colSpan={6} className="px-3 py-3">
        <form onSubmit={handleSubmit} className="flex flex-wrap gap-2 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-sage-500 font-medium">Name *</label>
            <input
              autoFocus
              className="border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300"
              placeholder="Full name"
              value={form.participant_name}
              onChange={(e) => set('participant_name', e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-sage-500 font-medium">Role</label>
            <input
              className="border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300"
              placeholder="e.g. Bridesmaid"
              value={form.role}
              onChange={(e) => set('role', e.target.value)}
            />
          </div>
          {SIDE_OPTIONS[section].length > 1 && (
            <div className="flex flex-col gap-1">
              <label className="text-xs text-sage-500 font-medium">Side</label>
              <select
                className="border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300"
                value={form.side}
                onChange={(e) => set('side', e.target.value)}
              >
                {SIDE_OPTIONS[section].map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-sage-500 font-medium">Walks with</label>
            <input
              className="border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300"
              placeholder="Name of partner"
              value={form.walk_with}
              onChange={(e) => set('walk_with', e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1 flex-1 min-w-[120px]">
            <label className="text-xs text-sage-500 font-medium">Notes</label>
            <input
              className="border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300 w-full"
              placeholder="Any notes"
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving || !form.participant_name.trim()}
              className="px-4 py-2 bg-sage-600 text-white rounded-lg text-sm hover:bg-sage-700 disabled:opacity-50"
            >
              {saving ? 'Adding…' : 'Add'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 bg-cream-200 text-gray-700 rounded-lg text-sm hover:bg-cream-300"
            >
              Cancel
            </button>
          </div>
        </form>
      </td>
    </tr>
  );
}

function ProcessionalSection({ entries, onAdd, onDelete, onMoveUp, onMoveDown, section }) {
  const [showForm, setShowForm] = useState(false);

  const centerRows = entries.filter((e) => e.side === 'center');
  const brideRows = entries.filter((e) => e.side === 'brides_side');
  const groomRows = entries.filter((e) => e.side === 'grooms_side');

  const handleAdd = async (form) => {
    await onAdd(form);
    setShowForm(false);
  };

  const makeRows = (rows) =>
    rows.map((entry, idx) => (
      <EntryRow
        key={entry.id}
        entry={entry}
        onDelete={onDelete}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        isFirst={idx === 0}
        isLast={idx === rows.length - 1}
      />
    ));

  return (
    <div className="bg-white rounded-xl border border-cream-200 overflow-hidden">
      {/* Center rows */}
      {centerRows.length > 0 && (
        <div className="border-b border-cream-200">
          <div className="px-4 py-2 bg-cream-50">
            <span className="text-xs font-semibold text-sage-600 uppercase tracking-wide">Center</span>
          </div>
          <table className="w-full">
            <thead>
              <tr className="text-xs text-cream-500 bg-cream-50 border-b border-cream-100">
                <th className="py-1.5 px-3 w-8 text-left">#</th>
                <th className="py-1.5 px-3 text-left">Name</th>
                <th className="py-1.5 px-3 text-left">Role</th>
                <th className="py-1.5 px-3 text-left">Walks With</th>
                <th className="py-1.5 px-3 text-left">Notes</th>
                <th className="py-1.5 px-2 w-16" />
              </tr>
            </thead>
            <tbody>{makeRows(centerRows)}</tbody>
          </table>
        </div>
      )}

      {/* Two-column: bride's side + groom's side */}
      <div className="grid grid-cols-2 divide-x divide-cream-200">
        <div>
          <div className="px-4 py-2 bg-cream-50 border-b border-cream-100">
            <span className="text-xs font-semibold text-rose-400 uppercase tracking-wide">Bride's Side</span>
          </div>
          <table className="w-full">
            <thead>
              <tr className="text-xs text-cream-500 bg-cream-50 border-b border-cream-100">
                <th className="py-1.5 px-3 w-8 text-left">#</th>
                <th className="py-1.5 px-3 text-left">Name</th>
                <th className="py-1.5 px-3 text-left">Role</th>
                <th className="py-1.5 px-3 text-left">Walks With</th>
                <th className="py-1.5 px-2 w-8" />
              </tr>
            </thead>
            <tbody>
              {brideRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-4 px-3 text-sm text-cream-400 italic text-center">No entries</td>
                </tr>
              ) : (
                brideRows.map((entry, idx) => (
                  <EntryRow
                    key={entry.id}
                    entry={entry}
                    onDelete={onDelete}
                    onMoveUp={onMoveUp}
                    onMoveDown={onMoveDown}
                    isFirst={idx === 0}
                    isLast={idx === brideRows.length - 1}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
        <div>
          <div className="px-4 py-2 bg-cream-50 border-b border-cream-100">
            <span className="text-xs font-semibold text-sage-600 uppercase tracking-wide">Groom's Side</span>
          </div>
          <table className="w-full">
            <thead>
              <tr className="text-xs text-cream-500 bg-cream-50 border-b border-cream-100">
                <th className="py-1.5 px-3 w-8 text-left">#</th>
                <th className="py-1.5 px-3 text-left">Name</th>
                <th className="py-1.5 px-3 text-left">Role</th>
                <th className="py-1.5 px-3 text-left">Walks With</th>
                <th className="py-1.5 px-2 w-8" />
              </tr>
            </thead>
            <tbody>
              {groomRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-4 px-3 text-sm text-cream-400 italic text-center">No entries</td>
                </tr>
              ) : (
                groomRows.map((entry, idx) => (
                  <EntryRow
                    key={entry.id}
                    entry={entry}
                    onDelete={onDelete}
                    onMoveUp={onMoveUp}
                    onMoveDown={onMoveDown}
                    isFirst={idx === 0}
                    isLast={idx === groomRows.length - 1}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add form + button */}
      {showForm ? (
        <table className="w-full">
          <tbody>
            <AddForm section={section} onAdd={handleAdd} onCancel={() => setShowForm(false)} />
          </tbody>
        </table>
      ) : (
        <div className="px-4 py-3 border-t border-cream-100">
          <button
            onClick={() => setShowForm(true)}
            className="text-sm text-sage-600 hover:text-sage-700 font-medium flex items-center gap-1"
          >
            <span className="text-lg leading-none">+</span> Add entry
          </button>
        </div>
      )}
    </div>
  );
}

function FamilyEscortSection({ entries, onAdd, onDelete, onMoveUp, onMoveDown, section }) {
  const [showForm, setShowForm] = useState(false);

  const handleAdd = async (form) => {
    await onAdd({ ...form, side: 'family' });
    setShowForm(false);
  };

  return (
    <div className="bg-white rounded-xl border border-cream-200 overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="text-xs text-cream-500 bg-cream-50 border-b border-cream-100">
            <th className="py-1.5 px-3 w-8 text-left">#</th>
            <th className="py-1.5 px-3 text-left">Name</th>
            <th className="py-1.5 px-3 text-left">Role / Relation</th>
            <th className="py-1.5 px-3 text-left">Escorted By</th>
            <th className="py-1.5 px-3 text-left">Notes</th>
            <th className="py-1.5 px-2 w-16" />
          </tr>
        </thead>
        <tbody>
          {entries.length === 0 && !showForm ? (
            <tr>
              <td colSpan={6} className="py-8 text-center text-sm text-cream-400 italic">
                No family escort entries yet.
              </td>
            </tr>
          ) : (
            entries.map((entry, idx) => (
              <EntryRow
                key={entry.id}
                entry={entry}
                onDelete={onDelete}
                onMoveUp={onMoveUp}
                onMoveDown={onMoveDown}
                isFirst={idx === 0}
                isLast={idx === entries.length - 1}
              />
            ))
          )}
          {showForm && (
            <AddForm section={section} onAdd={handleAdd} onCancel={() => setShowForm(false)} />
          )}
        </tbody>
      </table>
      {!showForm && (
        <div className="px-4 py-3 border-t border-cream-100">
          <button
            onClick={() => setShowForm(true)}
            className="text-sm text-sage-600 hover:text-sage-700 font-medium flex items-center gap-1"
          >
            <span className="text-lg leading-none">+</span> Add family member
          </button>
        </div>
      )}
    </div>
  );
}

export default function CeremonyOrder({ weddingId, userId }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/ceremony-order/${weddingId}`);
      if (!res.ok) throw new Error('Failed to load ceremony order');
      const data = await res.json();
      setEntries(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [weddingId]);

  useEffect(() => { load(); }, [load]);

  const getNextSortOrder = (section) => {
    const sectionEntries = entries.filter((e) => e.section === section);
    return sectionEntries.length > 0
      ? Math.max(...sectionEntries.map((e) => e.sort_order)) + 1
      : 1;
  };

  const handleAdd = async (section, form) => {
    try {
      const payload = {
        wedding_id: weddingId,
        section,
        side: form.side,
        participant_name: form.participant_name,
        role: form.role,
        walk_with: form.walk_with,
        notes: form.notes,
        sort_order: getNextSortOrder(section),
      };
      const res = await fetch(`${API_URL}/api/ceremony-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to add entry');
      await load();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id) => {
    try {
      const res = await fetch(`${API_URL}/api/ceremony-order/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete entry');
      setEntries((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const handleMove = async (id, direction) => {
    const entry = entries.find((e) => e.id === id);
    if (!entry) return;

    const sectionEntries = entries
      .filter((e) => e.section === entry.section && e.side === entry.side)
      .sort((a, b) => a.sort_order - b.sort_order);

    const idx = sectionEntries.findIndex((e) => e.id === id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sectionEntries.length) return;

    const swapEntry = sectionEntries[swapIdx];
    const newOrderA = swapEntry.sort_order;
    const newOrderB = entry.sort_order;

    try {
      await Promise.all([
        fetch(`${API_URL}/api/ceremony-order/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sort_order: newOrderA }),
        }),
        fetch(`${API_URL}/api/ceremony-order/${swapEntry.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sort_order: newOrderB }),
        }),
      ]);
      setEntries((prev) =>
        prev.map((e) => {
          if (e.id === id) return { ...e, sort_order: newOrderA };
          if (e.id === swapEntry.id) return { ...e, sort_order: newOrderB };
          return e;
        })
      );
    } catch (err) {
      console.error('Failed to reorder', err);
    }
  };

  const forSection = (section) =>
    entries
      .filter((e) => e.section === section)
      .sort((a, b) => a.sort_order - b.sort_order);

  const totalEntries = entries.length;

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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Ceremony Order</h2>
          <p className="text-sm text-sage-500 mt-0.5">
            {totalEntries === 0
              ? 'Add your wedding party, family, and officiant to build your processional order.'
              : `${totalEntries} ${totalEntries === 1 ? 'entry' : 'entries'} across all sections`}
          </p>
        </div>
      </div>

      {/* Processional */}
      <section>
        <h3 className="text-base font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-sage-100 text-sage-700 text-xs flex items-center justify-center font-bold">1</span>
          Processional
        </h3>
        <ProcessionalSection
          entries={forSection('processional')}
          onAdd={(form) => handleAdd('processional', form)}
          onDelete={handleDelete}
          onMoveUp={(id) => handleMove(id, 'up')}
          onMoveDown={(id) => handleMove(id, 'down')}
          section="processional"
        />
      </section>

      {/* Family Escort */}
      <section>
        <h3 className="text-base font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-sage-100 text-sage-700 text-xs flex items-center justify-center font-bold">2</span>
          Family Escort
        </h3>
        <FamilyEscortSection
          entries={forSection('family_escort')}
          onAdd={(form) => handleAdd('family_escort', form)}
          onDelete={handleDelete}
          onMoveUp={(id) => handleMove(id, 'up')}
          onMoveDown={(id) => handleMove(id, 'down')}
          section="family_escort"
        />
      </section>

      {/* Recessional */}
      <section>
        <h3 className="text-base font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-sage-100 text-sage-700 text-xs flex items-center justify-center font-bold">3</span>
          Recessional
        </h3>
        <ProcessionalSection
          entries={forSection('recessional')}
          onAdd={(form) => handleAdd('recessional', form)}
          onDelete={handleDelete}
          onMoveUp={(id) => handleMove(id, 'up')}
          onMoveDown={(id) => handleMove(id, 'down')}
          section="recessional"
        />
      </section>
    </div>
  );
}
