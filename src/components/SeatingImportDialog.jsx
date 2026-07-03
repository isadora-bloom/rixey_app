import { useState, useRef } from 'react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function SeatingImportDialog({ weddingId, onComplete }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState('idle'); // idle | parsing | preview | committing | done | error
  const [chart, setChart] = useState(null);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef();

  function reset() {
    setStep('idle');
    setChart(null);
    setResult(null);
    setErrorMsg('');
    setReplaceExisting(false);
  }

  function handleClose() {
    setOpen(false);
    setTimeout(reset, 300);
  }

  async function parseFile(file) {
    setStep('parsing');
    setErrorMsg('');
    const form = new FormData();
    form.append('file', file);
    form.append('weddingId', weddingId);
    form.append('action', 'parse');
    try {
      const r = await fetch(`${API}/api/seating/import`, { method: 'POST', body: form });
      const data = await r.json();
      if (!r.ok || !data.ok) throw new Error(data.error || 'Parse failed');
      setChart(data.chart);
      setStep('preview');
    } catch (err) {
      setErrorMsg(err.message);
      setStep('error');
    }
  }

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) parseFile(file);
  }

  function onFileChange(e) {
    const file = e.target.files[0];
    if (file) parseFile(file);
    e.target.value = '';
  }

  async function commit() {
    setStep('committing');
    const form = new FormData();
    form.append('weddingId', weddingId);
    form.append('action', 'commit');
    form.append('chart', JSON.stringify(chart));
    form.append('replaceExisting', replaceExisting ? 'true' : 'false');
    try {
      const r = await fetch(`${API}/api/seating/import`, { method: 'POST', body: form });
      const data = await r.json();
      if (!r.ok || !data.ok) throw new Error(data.error || 'Commit failed');
      setResult(data);
      setStep('done');
      if (onComplete) onComplete();
    } catch (err) {
      setErrorMsg(err.message);
      setStep('error');
    }
  }

  const totalTables = chart?.tables?.length ?? 0;
  const totalGuests = chart?.totalGuests ?? 0;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-sage-300 text-sage-700 hover:bg-sage-50 transition-colors"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <path d="M3 9h18M9 21V9"/>
        </svg>
        Import seating chart
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={e => { if (e.target === e.currentTarget) handleClose(); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
              <h2 className="font-semibold text-stone-800">Import Seating Chart</h2>
              <button onClick={handleClose} className="text-stone-400 hover:text-stone-600 transition-colors">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>

            <div className="p-6">
              {/* IDLE — file drop zone */}
              {step === 'idle' && (
                <div>
                  <p className="text-sm text-stone-500 mb-4">
                    Upload a spreadsheet with columns for table name, guest name, dietary restrictions, and any notes.
                    Excel (.xlsx) and CSV formats are supported.
                  </p>
                  <div
                    className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${dragging ? 'border-sage-400 bg-sage-50' : 'border-stone-200 hover:border-sage-300 hover:bg-stone-50'}`}
                    onClick={() => inputRef.current?.click()}
                    onDragOver={e => { e.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={onDrop}
                  >
                    <svg className="mx-auto mb-3 text-stone-300" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="3" y="3" width="18" height="18" rx="2"/>
                      <path d="M3 9h18M9 21V9"/>
                    </svg>
                    <p className="text-sm font-medium text-stone-600">Drop your spreadsheet here</p>
                    <p className="text-xs text-stone-400 mt-1">or click to browse · .xlsx .xls .csv</p>
                    <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onFileChange} />
                  </div>
                </div>
              )}

              {/* PARSING */}
              {step === 'parsing' && (
                <div className="py-10 flex flex-col items-center gap-3 text-stone-500">
                  <svg className="animate-spin" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </svg>
                  <p className="text-sm">Reading spreadsheet and detecting columns…</p>
                </div>
              )}

              {/* PREVIEW */}
              {step === 'preview' && chart && (
                <div>
                  {/* Summary pills */}
                  <div className="flex gap-3 mb-4">
                    <span className="px-3 py-1 rounded-full bg-sage-50 text-sage-700 text-sm font-medium">{totalTables} tables</span>
                    <span className="px-3 py-1 rounded-full bg-sage-50 text-sage-700 text-sm font-medium">{totalGuests} guests</span>
                  </div>

                  {/* Table list */}
                  <div className="max-h-60 overflow-y-auto border border-stone-100 rounded-xl divide-y divide-stone-50">
                    {chart.tables.map((table, i) => (
                      <div key={i} className="px-4 py-2.5 hover:bg-stone-50">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-stone-700">{table.table_name}</span>
                          <span className="text-xs text-stone-400">{table.guests.length} guests</span>
                        </div>
                        <p className="text-xs text-stone-400 mt-0.5 truncate">
                          {table.guests.slice(0, 4).map(g => g.first_name).join(', ')}
                          {table.guests.length > 4 ? ` +${table.guests.length - 4} more` : ''}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Replace toggle */}
                  <label className="flex items-start gap-2.5 mt-4 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={replaceExisting}
                      onChange={e => setReplaceExisting(e.target.checked)}
                      className="mt-0.5 rounded accent-sage-600"
                    />
                    <div>
                      <span className="text-sm text-stone-700 font-medium">Clear existing table assignments first</span>
                      <p className="text-xs text-stone-400 mt-0.5">Removes current seating before applying the import. Guests not in this file keep their profiles.</p>
                    </div>
                  </label>

                  <div className="flex gap-3 mt-5">
                    <button
                      onClick={() => { setChart(null); setStep('idle'); }}
                      className="flex-1 px-4 py-2 text-sm rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50 transition-colors"
                    >
                      Back
                    </button>
                    <button
                      onClick={commit}
                      className="flex-1 px-4 py-2 text-sm rounded-lg bg-sage-600 text-white hover:bg-sage-700 transition-colors font-medium"
                    >
                      Import {totalGuests} guests
                    </button>
                  </div>
                </div>
              )}

              {/* COMMITTING */}
              {step === 'committing' && (
                <div className="py-10 flex flex-col items-center gap-3 text-stone-500">
                  <svg className="animate-spin" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </svg>
                  <p className="text-sm">Saving guests…</p>
                </div>
              )}

              {/* DONE */}
              {step === 'done' && result && (
                <div className="py-6 flex flex-col items-center gap-4 text-center">
                  <div className="w-12 h-12 rounded-full bg-sage-50 flex items-center justify-center">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#7D8471" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m20 6-11 11-5-5"/>
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-stone-800">Seating chart imported</p>
                    <p className="text-sm text-stone-400 mt-1">
                      {result.created > 0 && `${result.created} guests added`}
                      {result.created > 0 && result.updated > 0 && ' · '}
                      {result.updated > 0 && `${result.updated} guests updated`}
                    </p>
                  </div>
                  <button
                    onClick={handleClose}
                    className="px-5 py-2 text-sm rounded-lg bg-sage-600 text-white hover:bg-sage-700 transition-colors font-medium"
                  >
                    Done
                  </button>
                </div>
              )}

              {/* ERROR */}
              {step === 'error' && (
                <div className="py-6 flex flex-col items-center gap-4 text-center">
                  <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/>
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-stone-800">Something went wrong</p>
                    <p className="text-sm text-stone-400 mt-1 max-w-xs">{errorMsg}</p>
                  </div>
                  <button
                    onClick={() => setStep('idle')}
                    className="px-5 py-2 text-sm rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50 transition-colors"
                  >
                    Try again
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
