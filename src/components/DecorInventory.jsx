import { useState, useEffect, useCallback, useRef } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const DEFAULT_SPACES = [
  'Ceremony Space',
  'Guest Tables',
  'Head Table / Sweetheart Table',
  'Cocktail Hour Tables',
  'Card Table & Guest Book',
  'Drinks Station',
  'Favor Table',
  'Memorial Table',
  'Dessert Table',
  'Cake Table',
  'Photo Booth',
];

const EMPTY_ITEM_FORM = {
  item_name: '',
  source: '',
  goes_home_with: '',
  leaving_it: false,
  notes: '',
};

function ItemRow({ item, onDelete, onUpdate }) {
  const [values, setValues] = useState({
    item_name: item.item_name || '',
    source: item.source || '',
    goes_home_with: item.goes_home_with || '',
    leaving_it: !!item.leaving_it,
    notes: item.notes || '',
  });
  const saveTimeout = useRef(null);

  const persist = useCallback(
    async (updated) => {
      clearTimeout(saveTimeout.current);
      saveTimeout.current = setTimeout(async () => {
        try {
          const res = await fetch(`${API_URL}/api/decor/${item.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updated),
          });
          if (!res.ok) throw new Error('Failed to update item');
          const saved = await res.json();
          onUpdate(saved);
        } catch (err) {
          console.error(err);
        }
      }, 400);
    },
    [item.id, onUpdate]
  );

  const handleChange = (field, val) => {
    const updated = { ...values, [field]: val };
    setValues(updated);
    persist(updated);
  };

  const handleBlur = () => {
    clearTimeout(saveTimeout.current);
    persist(values);
  };

  const inputClass = (disabled = false) =>
    `border border-cream-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300 w-full ${
      disabled ? 'bg-cream-100 text-cream-400 cursor-not-allowed' : 'bg-white'
    }`;

  return (
    <tr className="border-b border-cream-100 hover:bg-cream-50 group">
      <td className="py-2 px-3 min-w-[180px]">
        <input
          className={inputClass()}
          value={values.item_name}
          placeholder="Item description"
          onChange={(e) => handleChange('item_name', e.target.value)}
          onBlur={handleBlur}
        />
      </td>
      <td className="py-2 px-3 min-w-[140px]">
        <input
          className={inputClass()}
          value={values.source}
          placeholder="e.g. Bride's car"
          onChange={(e) => handleChange('source', e.target.value)}
          onBlur={handleBlur}
        />
      </td>
      <td className="py-2 px-3 min-w-[140px]">
        <input
          className={inputClass(values.leaving_it)}
          value={values.goes_home_with}
          placeholder={values.leaving_it ? '—' : 'e.g. Take home'}
          disabled={values.leaving_it}
          onChange={(e) => handleChange('goes_home_with', e.target.value)}
          onBlur={handleBlur}
        />
      </td>
      <td className="py-2 px-3 text-center w-20">
        <input
          type="checkbox"
          checked={values.leaving_it}
          onChange={(e) => handleChange('leaving_it', e.target.checked)}
          className="w-4 h-4 rounded border-cream-300 text-sage-600 focus:ring-sage-300 cursor-pointer"
        />
      </td>
      <td className="py-2 px-3 min-w-[140px]">
        <input
          className={inputClass()}
          value={values.notes}
          placeholder="Notes"
          onChange={(e) => handleChange('notes', e.target.value)}
          onBlur={handleBlur}
        />
      </td>
      <td className="py-2 px-2 w-10 text-right">
        <button
          onClick={() => onDelete(item.id)}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-rose-50 text-rose-400 hover:text-rose-600 text-base leading-none"
          title="Remove item"
        >
          ×
        </button>
      </td>
    </tr>
  );
}

function AddItemRow({ spaceName, onAdd, onCancel }) {
  const [form, setForm] = useState({ ...EMPTY_ITEM_FORM });
  const [saving, setSaving] = useState(false);

  const set = (field, val) => setForm((f) => ({ ...f, [field]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.item_name.trim()) return;
    setSaving(true);
    await onAdd(spaceName, form);
    setSaving(false);
    setForm({ ...EMPTY_ITEM_FORM });
  };

  const inputClass = (disabled = false) =>
    `border border-cream-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300 w-full ${
      disabled ? 'bg-cream-100 text-cream-400 cursor-not-allowed' : 'bg-white'
    }`;

  return (
    <tr className="bg-cream-50 border-b border-cream-200">
      <td className="py-2 px-3">
        <input
          autoFocus
          className={inputClass()}
          placeholder="Item description *"
          value={form.item_name}
          onChange={(e) => set('item_name', e.target.value)}
        />
      </td>
      <td className="py-2 px-3">
        <input
          className={inputClass()}
          placeholder="e.g. Bride's car"
          value={form.source}
          onChange={(e) => set('source', e.target.value)}
        />
      </td>
      <td className="py-2 px-3">
        <input
          className={inputClass(form.leaving_it)}
          placeholder={form.leaving_it ? '—' : 'e.g. Take home'}
          disabled={form.leaving_it}
          value={form.goes_home_with}
          onChange={(e) => set('goes_home_with', e.target.value)}
        />
      </td>
      <td className="py-2 px-3 text-center">
        <input
          type="checkbox"
          checked={form.leaving_it}
          onChange={(e) => set('leaving_it', e.target.checked)}
          className="w-4 h-4 rounded border-cream-300 text-sage-600 focus:ring-sage-300 cursor-pointer"
        />
      </td>
      <td className="py-2 px-3">
        <input
          className={inputClass()}
          placeholder="Notes"
          value={form.notes}
          onChange={(e) => set('notes', e.target.value)}
        />
      </td>
      <td className="py-2 px-2 w-10">
        <div className="flex gap-1">
          <button
            onClick={handleSubmit}
            disabled={saving || !form.item_name.trim()}
            className="px-3 py-1.5 bg-sage-600 text-white rounded-lg text-xs hover:bg-sage-700 disabled:opacity-50 whitespace-nowrap"
          >
            {saving ? '…' : 'Add'}
          </button>
          <button
            onClick={onCancel}
            className="px-2 py-1.5 bg-cream-200 text-gray-700 rounded-lg text-xs hover:bg-cream-300"
          >
            ✕
          </button>
        </div>
      </td>
    </tr>
  );
}

function SpaceSection({ spaceName, items, onAddItem, onDeleteItem, onUpdateItem }) {
  const [showForm, setShowForm] = useState(false);

  const handleAdd = async (space, form) => {
    await onAddItem(space, form);
    setShowForm(false);
  };

  return (
    <div className="bg-white rounded-xl border border-cream-200 overflow-hidden">
      {/* Space header */}
      <div className="px-4 py-3 bg-cream-50 border-b border-cream-200 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-sage-700">{spaceName}</h3>
        <span className="text-xs text-cream-500">
          {items.length} {items.length === 1 ? 'item' : 'items'}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px]">
          <thead>
            <tr className="text-xs text-cream-500 bg-cream-50 border-b border-cream-100">
              <th className="py-1.5 px-3 text-left">Item</th>
              <th className="py-1.5 px-3 text-left">Coming From</th>
              <th className="py-1.5 px-3 text-left">Going Home With</th>
              <th className="py-1.5 px-3 text-center w-20">Leaving It</th>
              <th className="py-1.5 px-3 text-left">Notes</th>
              <th className="py-1.5 px-2 w-10" />
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && !showForm ? (
              <tr>
                <td colSpan={6} className="py-4 px-3 text-sm text-cream-400 italic text-center">
                  No items yet — add one below.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  onDelete={onDeleteItem}
                  onUpdate={onUpdateItem}
                />
              ))
            )}
            {showForm && (
              <AddItemRow
                spaceName={spaceName}
                onAdd={handleAdd}
                onCancel={() => setShowForm(false)}
              />
            )}
          </tbody>
        </table>
      </div>

      {!showForm && (
        <div className="px-4 py-2.5 border-t border-cream-100">
          <button
            onClick={() => setShowForm(true)}
            className="text-sm text-sage-600 hover:text-sage-700 font-medium flex items-center gap-1"
          >
            <span className="text-lg leading-none">+</span> Add item
          </button>
        </div>
      )}
    </div>
  );
}

export default function DecorInventory({ weddingId, userId }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [customSpaces, setCustomSpaces] = useState([]);
  const [newSpaceInput, setNewSpaceInput] = useState('');
  const [addingSpace, setAddingSpace] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/decor/${weddingId}`);
      if (!res.ok) throw new Error('Failed to load decor inventory');
      const data = await res.json();
      setItems(data);

      // Discover any custom spaces already in the data that aren't in defaults
      const existingSpaces = [...new Set(data.map((i) => i.space_name))];
      const custom = existingSpaces.filter((s) => !DEFAULT_SPACES.includes(s));
      setCustomSpaces(custom);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [weddingId]);

  useEffect(() => { load(); }, [load]);

  // All spaces to display: defaults + any custom ones (from DB or newly added)
  const allSpaces = [
    ...DEFAULT_SPACES,
    ...customSpaces.filter((s) => !DEFAULT_SPACES.includes(s)),
  ];

  const itemsForSpace = (spaceName) =>
    items
      .filter((i) => i.space_name === spaceName)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  const getNextSortOrder = (spaceName) => {
    const spaceItems = items.filter((i) => i.space_name === spaceName);
    return spaceItems.length > 0
      ? Math.max(...spaceItems.map((i) => i.sort_order ?? 0)) + 1
      : 1;
  };

  const handleAddItem = async (spaceName, form) => {
    try {
      const payload = {
        wedding_id: weddingId,
        space_name: spaceName,
        item_name: form.item_name,
        source: form.source,
        goes_home_with: form.goes_home_with,
        leaving_it: form.leaving_it,
        notes: form.notes,
        sort_order: getNextSortOrder(spaceName),
      };
      const res = await fetch(`${API_URL}/api/decor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to add item');
      const newItem = await res.json();
      setItems((prev) => [...prev, newItem]);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteItem = async (id) => {
    try {
      const res = await fetch(`${API_URL}/api/decor/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete item');
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateItem = (updated) => {
    setItems((prev) => prev.map((i) => (i.id === updated.id ? { ...i, ...updated } : i)));
  };

  const handleAddSpace = (e) => {
    e.preventDefault();
    const trimmed = newSpaceInput.trim();
    if (!trimmed) return;
    if (allSpaces.includes(trimmed)) {
      setNewSpaceInput('');
      setAddingSpace(false);
      return;
    }
    setCustomSpaces((prev) => [...prev, trimmed]);
    setNewSpaceInput('');
    setAddingSpace(false);
  };

  const totalItems = items.length;
  const populatedSpaces = allSpaces.filter((s) => itemsForSpace(s).length > 0).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-sage-500 text-sm">
        Loading decor inventory…
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Decor Inventory</h2>
          <p className="text-sm text-sage-500 mt-0.5">
            {totalItems === 0
              ? 'Track all your decor items — where they come from and where they go.'
              : `${totalItems} ${totalItems === 1 ? 'item' : 'items'} across ${populatedSpaces} ${populatedSpaces === 1 ? 'space' : 'spaces'}`}
          </p>
        </div>
      </div>

      {/* Space sections */}
      {allSpaces.map((spaceName) => (
        <SpaceSection
          key={spaceName}
          spaceName={spaceName}
          items={itemsForSpace(spaceName)}
          onAddItem={handleAddItem}
          onDeleteItem={handleDeleteItem}
          onUpdateItem={handleUpdateItem}
        />
      ))}

      {/* Add custom space */}
      <div className="pt-2">
        {addingSpace ? (
          <form
            onSubmit={handleAddSpace}
            className="flex items-center gap-3 bg-white border border-cream-200 rounded-xl px-4 py-3"
          >
            <input
              autoFocus
              className="border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300 flex-1"
              placeholder="New space name (e.g. Bar Cart)"
              value={newSpaceInput}
              onChange={(e) => setNewSpaceInput(e.target.value)}
            />
            <button
              type="submit"
              disabled={!newSpaceInput.trim()}
              className="px-4 py-2 bg-sage-600 text-white rounded-lg text-sm hover:bg-sage-700 disabled:opacity-50"
            >
              Add Space
            </button>
            <button
              type="button"
              onClick={() => { setAddingSpace(false); setNewSpaceInput(''); }}
              className="px-4 py-2 bg-cream-200 text-gray-700 rounded-lg text-sm hover:bg-cream-300"
            >
              Cancel
            </button>
          </form>
        ) : (
          <button
            onClick={() => setAddingSpace(true)}
            className="w-full text-sm text-sage-600 hover:text-sage-700 font-medium border border-dashed border-sage-300 rounded-xl py-3 hover:bg-sage-50 transition-colors flex items-center justify-center gap-2"
          >
            <span className="text-lg leading-none">+</span> Add custom space
          </button>
        )}
      </div>
    </div>
  );
}
