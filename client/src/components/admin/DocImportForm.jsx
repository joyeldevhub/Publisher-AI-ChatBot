import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  FileText, Upload, Loader2, Trash2, CheckCircle,
  X, Save, ChevronDown, ChevronUp, Pencil,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { analyzeDoc, bulkAddKnowledge } from '../../services/api';

const CATEGORIES = [
  'LaTeX Setter', 'XML', 'HTML', 'EPUB', 'Crossref Validation', 'DTD Validation',
  'Probe Validation', 'Table Formats', 'Metadata', 'Upload', 'Rendering',
  'InDesign', 'PDF Publishing', 'General',
];

// Customers — documents are saved under the selected customer, and chat answers
// can be scoped to a customer when the user names it.
const CUSTOMERS = [
  'American Society for Microbiology',
  'British Medical Journal',
  'Society of Economic Geologists',
  'Royal Society',
  'Professional Publishing League',
  'eLife',
  'Journal of Medical Internet Research',
  'Society of Petroleum Engineers',
];

const CATEGORY_COLORS = {
  'LaTeX Setter':        'bg-indigo-50 text-indigo-600',
  'XML':                 'bg-sky-50 text-sky-600',
  'HTML':                'bg-orange-50 text-orange-500',
  'EPUB':                'bg-emerald-50 text-emerald-600',
  'Crossref Validation': 'bg-rose-50 text-rose-500',
  'DTD Validation':      'bg-amber-50 text-amber-600',
  'Probe Validation':    'bg-purple-50 text-purple-500',
  'Table Formats':       'bg-cyan-50 text-cyan-600',
  'Metadata':            'bg-blue-50 text-blue-600',
  'Upload':              'bg-teal-50 text-teal-600',
  'Rendering':           'bg-violet-50 text-violet-500',
  'InDesign':            'bg-pink-50 text-pink-500',
  'PDF Publishing':      'bg-yellow-50 text-yellow-600',
  'General':             'bg-slate-50 text-slate-500',
};

function EntryPreviewCard({ entry, index, isRemoved, onToggleRemove, onUpdate }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(entry);

  function startEdit(e) {
    e.stopPropagation();
    setDraft({ ...entry });
    setEditing(true);
    setExpanded(true);
  }

  function saveEdit(e) {
    e.stopPropagation();
    onUpdate(index, draft);
    setEditing(false);
  }

  function cancelEdit(e) {
    e.stopPropagation();
    setEditing(false);
    setDraft(entry);
  }

  const catColor = CATEGORY_COLORS[entry.category] || CATEGORY_COLORS.General;

  return (
    <div className={`border rounded-xl transition ${
      isRemoved ? 'border-slate-100 bg-slate-50 opacity-40' : 'border-slate-200 bg-white'
    }`}>
      {/* ── Header row ── */}
      <div
        className="flex items-start gap-3 p-4 cursor-pointer select-none"
        onClick={() => !editing && setExpanded(v => !v)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${catColor}`}>
              {entry.source_type === 'document' ? 'Document' : entry.category}
            </span>
          </div>
          <p className="text-sm font-semibold text-slate-800 leading-snug">{entry.title}</p>
          {!expanded && (
            <p className="text-xs text-slate-400 mt-1 line-clamp-1">
              {entry.source_type === 'document' ? entry.solution : entry.error_description}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {!isRemoved && !editing && (
            <button
              type="button"
              onClick={startEdit}
              className="p-1.5 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition"
              title="Edit"
            >
              <Pencil size={13} />
            </button>
          )}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggleRemove(index); }}
            className={`p-1.5 rounded-lg transition ${
              isRemoved
                ? 'text-violet-500 hover:text-violet-700 bg-violet-50'
                : 'text-slate-400 hover:text-red-500 hover:bg-red-50'
            }`}
            title={isRemoved ? 'Restore' : 'Remove'}
          >
            {isRemoved ? <CheckCircle size={14} /> : <Trash2 size={14} />}
          </button>
          {!editing && (
            expanded
              ? <ChevronUp size={15} className="text-slate-400" />
              : <ChevronDown size={15} className="text-slate-400" />
          )}
        </div>
      </div>

      {/* ── Expanded: view mode ── */}
      {expanded && !editing && (
        <div className="border-t border-slate-100 px-4 pb-4 pt-3 space-y-3">
          {entry.source_type === 'document' ? (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Passage</p>
              <p className="text-xs text-slate-700 whitespace-pre-wrap bg-slate-50 rounded-lg p-3 leading-relaxed">
                {entry.solution}
              </p>
            </div>
          ) : (
            <>
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Problem</p>
                <p className="text-xs text-slate-700 whitespace-pre-wrap bg-slate-50 rounded-lg p-3 leading-relaxed font-mono">
                  {entry.error_description}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Solution</p>
                <p className="text-xs text-slate-700 whitespace-pre-wrap bg-green-50 rounded-lg p-3 leading-relaxed">
                  {entry.solution}
                </p>
              </div>
              {entry.aliases && (
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Aliases / Keywords</p>
                  <p className="text-xs text-slate-600 whitespace-pre-wrap bg-slate-50 rounded-lg p-3 leading-relaxed">{entry.aliases}</p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Expanded: edit mode ── */}
      {editing && (
        <div
          className="border-t border-slate-100 px-4 pb-4 pt-3 space-y-3"
          onClick={e => e.stopPropagation()}
        >
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1 block">Title</label>
            <input
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
              value={draft.title}
              onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1 block">Category</label>
            <select
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-400"
              value={draft.category}
              onChange={e => setDraft(d => ({ ...d, category: e.target.value }))}
            >
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1 block">Problem</label>
            <textarea
              rows={3}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-violet-400 resize-y"
              value={draft.error_description}
              onChange={e => setDraft(d => ({ ...d, error_description: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1 block">Solution</label>
            <textarea
              rows={5}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-violet-400 resize-y"
              value={draft.solution}
              onChange={e => setDraft(d => ({ ...d, solution: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1 block">Aliases / Keywords <span className="normal-case font-normal text-slate-400">(comma-separated)</span></label>
            <input
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-violet-400"
              value={draft.aliases || ''}
              onChange={e => setDraft(d => ({ ...d, aliases: e.target.value }))}
              placeholder="alternate phrasings users might type"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={saveEdit}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white transition"
              style={{ background: 'linear-gradient(160deg, #3B5BDB 0%, #4C6EF5 100%)' }}
            >
              <CheckCircle size={13} /> Done
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition"
            >
              <X size={13} /> Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DocImportForm({ onAdded }) {
  const [files, setFiles] = useState([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState({ cur: 0, total: 0 });
  const [entries, setEntries] = useState([]);
  const [removed, setRemoved] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [sourceName, setSourceName] = useState('');
  const [customer, setCustomer] = useState('');
  const [customCustomer, setCustomCustomer] = useState('');
  const [addedCustomers, setAddedCustomers] = useState([]);

  const onDrop = useCallback((accepted) => {
    setFiles((prev) => [...prev, ...accepted].slice(0, 20));
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/*': ['.txt', '.md'],
    },
    maxFiles: 20,
    maxSize: 20 * 1024 * 1024,
  });

  function removeFile(i) {
    setFiles((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleAnalyze() {
    if (files.length === 0) return;
    const selectedCustomer = customCustomer.trim() || customer;
    if (!selectedCustomer) { toast.error('Please choose or enter a customer first'); return; }

    // Add custom customer to dropdown for next time (if it's not already there)
    if (customCustomer.trim()) {
      const existingNames = [...CUSTOMERS, ...addedCustomers].map(c => c.toLowerCase());
      if (!existingNames.includes(customCustomer.trim().toLowerCase())) {
        setAddedCustomers(prev => [...prev, customCustomer.trim()]);
      }
    }

    setAnalyzing(true);
    setEntries([]);
    setRemoved(new Set());
    setSavedCount(0);
    setProgress({ cur: 0, total: files.length });

    const all = [];
    let failed = 0;
    for (let i = 0; i < files.length; i++) {
      setProgress({ cur: i + 1, total: files.length });
      try {
        const result = await analyzeDoc(files[i]);
        // Tag every passage from this batch with the selected customer.
        const selectedCustomer = customCustomer.trim() || customer;
        all.push(...(result.entries || []).map((e) => ({ ...e, customer: selectedCustomer })));
      } catch {
        failed++;
      }
    }
    setEntries(all);
    setSourceName(files.length === 1 ? files[0].name : `${files.length} documents`);
    setAnalyzing(false);

    if (all.length > 0) {
      const ok = files.length - failed;
      toast.success(`${all.length} entries extracted from ${ok} document${ok === 1 ? '' : 's'} — review and save`);
    } else {
      toast.error('No entries could be extracted');
    }
  }

  function toggleRemove(i) {
    setRemoved(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  function updateEntry(i, fields) {
    setEntries(prev => prev.map((e, idx) => idx === i ? { ...e, ...fields } : e));
  }

  const activeEntries = entries.filter((_, i) => !removed.has(i));

  async function handleSaveAll() {
    if (activeEntries.length === 0) return;
    setSaving(true);
    try {
      const { saved } = await bulkAddKnowledge(activeEntries);
      setSavedCount(saved);
      toast.success(`${saved} of ${activeEntries.length} passages saved to the knowledge base`);
      if (saved > 0) onAdded?.();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setFiles([]);
    setEntries([]);
    setRemoved(new Set());
    setSavedCount(0);
    setSourceName('');
    setProgress({ cur: 0, total: 0 });
    setCustomer('');
    setCustomCustomer('');
  }

  return (
    <div className="space-y-6">
      {/* Step 1 — Upload */}
      <div>
        <p className="text-sm text-slate-500 mb-4">
          Upload publishing guides, style sheets, and documentation (PDF, DOCX, TXT, or MD). DocFlow splits them into passages and saves them as <strong>documents</strong> under the chosen publisher — kept separate from entries. The bot answers questions from these passages; they won't appear in "All Entries".
        </p>

        {/* Customer selector — all files in this import are saved under this customer */}
        {entries.length === 0 && (
          <div className="mb-4">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">
              Customer <span className="text-red-400">*</span>
            </label>
            <div className="space-y-2.5">
              <select
                value={customer}
                onChange={(e) => { setCustomer(e.target.value); setCustomCustomer(''); }}
                disabled={!!customCustomer.trim()}
                className={`w-full px-3 py-2.5 border rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-400 transition ${
                  customCustomer.trim()
                    ? 'border-slate-200 text-slate-400 opacity-50'
                    : customer
                    ? 'border-slate-200 text-slate-800'
                    : 'border-amber-300 text-slate-400'
                }`}
              >
                <option value="">Select a customer…</option>
                {CUSTOMERS.map((c) => <option key={c} value={c}>{c}</option>)}
                {addedCustomers.length > 0 && (
                  <optgroup label="Recently Added">
                    {addedCustomers.map((c) => <option key={c} value={c}>{c}</option>)}
                  </optgroup>
                )}
              </select>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-slate-200" />
                <span className="text-xs text-slate-400 px-1">or</span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>
              <input
                type="text"
                placeholder="Enter a new customer name…"
                value={customCustomer}
                onChange={(e) => {
                  setCustomCustomer(e.target.value);
                  if (e.target.value.trim()) setCustomer('');
                }}
                onBlur={(e) => {
                  const val = e.target.value.trim();
                  // Only when they finish typing (blur), add it to the dropdown if it's new
                  if (val) {
                    const existingNames = [...CUSTOMERS, ...addedCustomers].map(c => c.toLowerCase());
                    if (!existingNames.includes(val.toLowerCase())) {
                      setAddedCustomers(prev => [...prev, val]);
                    }
                  }
                }}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 placeholder:text-slate-400"
              />
            </div>
            <p className="text-xs text-slate-400 mt-1.5">
              All files you upload here will be saved under <strong>{customCustomer || customer || 'the selected customer'}</strong>. In chat, naming the customer scopes answers to their documents.
            </p>
          </div>
        )}

        {entries.length === 0 && (
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition ${
              isDragActive ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:border-brand-400 hover:bg-slate-50'
            }`}
          >
            <input {...getInputProps()} />
            <Upload size={28} className="mx-auto mb-3 text-slate-400" />
            <p className="text-sm font-medium text-slate-600">
              {isDragActive ? 'Drop your documents here…' : 'Drag & drop your KT documents'}
            </p>
            <p className="text-xs text-slate-400 mt-1">PDF, DOCX, TXT, MD — up to 20 files, max 20 MB each</p>
          </div>
        )}

        {/* Selected files */}
        {files.length > 0 && entries.length === 0 && (
          <ul className="mt-3 space-y-1.5">
            {files.map((f, i) => (
              <li key={i} className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5">
                <FileText size={18} className="text-brand-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">{f.name}</p>
                  <p className="text-xs text-slate-400">{(f.size / 1024).toFixed(0)} KB</p>
                </div>
                {!analyzing && (
                  <button type="button" onClick={() => removeFile(i)} className="text-slate-400 hover:text-red-500">
                    <X size={16} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Analyze button */}
      {files.length > 0 && entries.length === 0 && (
        <button
          type="button"
          onClick={handleAnalyze}
          disabled={analyzing || !(customCustomer.trim() || customer)}
          title={!(customCustomer.trim() || customer) ? 'Choose or enter a customer first' : undefined}
          className="w-full py-3 text-white font-semibold rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          style={{ background: 'linear-gradient(160deg, #3B5BDB 0%, #4C6EF5 100%)' }}
        >
          {analyzing ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Analyzing {progress.cur} of {progress.total}…
            </>
          ) : !(customCustomer.trim() || customer) ? (
            'Choose or enter a customer to continue'
          ) : (
            `Analyze ${files.length} document${files.length === 1 ? '' : 's'} for ${customCustomer || customer}`
          )}
        </button>
      )}

      {/* Step 2 — Preview + Edit */}
      {entries.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-semibold text-slate-800">
                {activeEntries.length} passages to save
                {removed.size > 0 && (
                  <span className="text-slate-400 font-normal text-sm ml-2">({removed.size} removed)</span>
                )}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                From: {sourceName}
                {(customCustomer || customer) && <> · Customer: <span className="font-semibold text-violet-600">{customCustomer || customer}</span></>}
                {' '}· Click a passage to expand · <span className="text-violet-500">✎ to edit</span>
              </p>
            </div>
            <button
              type="button"
              onClick={reset}
              className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1"
            >
              <X size={12} /> Start over
            </button>
          </div>

          <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
            {entries.map((entry, i) => (
              <EntryPreviewCard
                key={i}
                entry={entry}
                index={i}
                isRemoved={removed.has(i)}
                onToggleRemove={toggleRemove}
                onUpdate={updateEntry}
              />
            ))}
          </div>

          {/* Save / Cancel buttons */}
          {savedCount === 0 ? (
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={handleSaveAll}
                disabled={saving || activeEntries.length === 0}
                className="flex-1 py-3 text-white font-semibold rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-60"
                style={{ background: 'linear-gradient(160deg, #3B5BDB 0%, #4C6EF5 100%)' }}
              >
                {saving ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Saving to knowledge base…
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    Save {activeEntries.length} {activeEntries.length === 1 ? 'passage' : 'passages'} to KB
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={reset}
                disabled={saving}
                className="px-5 py-3 rounded-xl text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition disabled:opacity-50 flex items-center gap-1.5"
              >
                <X size={14} /> Cancel
              </button>
            </div>
          ) : (
            <div className="mt-4 flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
              <CheckCircle size={18} className="text-green-500 flex-shrink-0" />
              <p className="text-sm text-green-700 font-medium">{savedCount} entries saved successfully!</p>
              <button type="button" onClick={reset} className="ml-auto text-xs text-green-600 hover:underline">
                Import another
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
