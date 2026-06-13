import { useState } from 'react';
import { Trash2, ChevronDown, ChevronUp, Tag, Calendar, Paperclip, Pencil, Check, X, FileText, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { deleteKnowledge, updateKnowledge } from '../../services/api';

const CATEGORIES = [
  'LaTeX Setter', 'XML', 'HTML', 'EPUB', 'Crossref Validation', 'DTD Validation',
  'Probe Validation', 'Table Formats', 'Metadata', 'Upload', 'Rendering',
  'InDesign', 'PDF Publishing', 'Calibre', 'General',
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
  'Calibre':             'bg-lime-50 text-lime-600',
  'General':             'bg-slate-50 text-slate-500',
};

function formatDate(dt) {
  return new Date(dt).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function EntryCard({ entry, onDelete, onUpdate }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: entry.title,
    error_description: entry.error_description,
    solution: entry.solution,
    category: entry.category,
    aliases: entry.aliases || '',
  });

  async function handleDelete() {
    if (!confirm(`Delete "${entry.title}"?`)) return;
    try {
      await deleteKnowledge(entry.id);
      toast.success('Entry deleted');
      onDelete(entry.id);
    } catch {
      toast.error('Failed to delete');
    }
  }

  function handleEditClick(e) {
    e.stopPropagation();
    setForm({
      title: entry.title,
      error_description: entry.error_description,
      solution: entry.solution,
      category: entry.category,
      aliases: entry.aliases || '',
    });
    setEditing(true);
    setExpanded(true);
  }

  function handleCancel(e) {
    e.stopPropagation();
    setEditing(false);
  }

  async function handleSave(e) {
    e.stopPropagation();
    if (!form.title.trim() || !form.error_description.trim() || !form.solution.trim()) {
      toast.error('All fields are required');
      return;
    }
    setSaving(true);
    try {
      await updateKnowledge(entry.id, form);
      onUpdate(entry.id, form);
      toast.success('Entry updated');
      setEditing(false);
    } catch {
      toast.error('Failed to update');
    } finally {
      setSaving(false);
    }
  }

  const colorClass = CATEGORY_COLORS[form.category] || CATEGORY_COLORS.General;

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden hover:shadow-sm transition">
      <div
        className="flex items-start gap-3 p-4 cursor-pointer"
        onClick={() => !editing && setExpanded((v) => !v)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="text-sm font-semibold text-slate-800 truncate">{entry.title}</h3>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colorClass}`}>
              {form.category}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <Calendar size={11} />
              {formatDate(entry.created_at)}
            </span>
            {entry.source_files?.length > 0 && (
              <span className="flex items-center gap-1">
                <Paperclip size={11} />
                {entry.source_files.length} file{entry.source_files.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleEditClick}
            className="p-1.5 text-slate-400 hover:text-brand-500 hover:bg-violet-50 rounded-lg transition"
            title="Edit"
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleDelete(); }}
            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
            title="Delete"
          >
            <Trash2 size={14} />
          </button>
          {!editing && (
            expanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />
          )}
        </div>
      </div>

      {expanded && !editing && (
        <div className="border-t border-slate-100 px-4 pb-4 pt-3 space-y-3">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Error</p>
            <p className="text-sm text-slate-700 whitespace-pre-wrap font-mono bg-slate-50 rounded-lg p-3 text-xs leading-relaxed">
              {entry.error_description}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Solution</p>
            <p className="text-sm text-slate-700 whitespace-pre-wrap bg-green-50 rounded-lg p-3 text-xs leading-relaxed">
              {entry.solution}
            </p>
          </div>
          {entry.aliases && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Aliases / Keywords</p>
              <p className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3 text-xs leading-relaxed">{entry.aliases}</p>
            </div>
          )}
          {entry.images?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Attachments</p>
              <div className="flex flex-wrap gap-2">
                {entry.images.map((att, i) => {
                  const type = att.fileType || 'image';
                  const href = `http://localhost:3001${att.url}`;
                  if (type === 'image') return (
                    <a key={i} href={href} target="_blank" rel="noopener noreferrer">
                      <img
                        src={href}
                        alt={att.name}
                        className="h-36 max-w-xs object-cover rounded-lg border border-slate-200 hover:opacity-80 transition cursor-zoom-in shadow-sm"
                      />
                    </a>
                  );
                  if (type === 'video') return (
                    <div key={i} className="rounded-lg border border-slate-200 overflow-hidden bg-black shadow-sm">
                      <video
                        src={href}
                        controls
                        className="h-36 max-w-xs"
                        title={att.name}
                      />
                      <p className="text-xs text-slate-400 px-2 py-1 bg-slate-50 truncate">{att.name}</p>
                    </div>
                  );
                  return (
                    <a key={i} href={href} target="_blank" rel="noopener noreferrer" download={att.name}
                      className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition">
                      <FileText size={14} className="text-blue-500 flex-shrink-0" />
                      <span className="text-xs text-slate-700 truncate max-w-[160px]">{att.name}</span>
                      <Download size={12} className="text-slate-400 flex-shrink-0" />
                    </a>
                  );
                })}
              </div>
            </div>
          )}
          {entry.source_files?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Source Files</p>
              <div className="flex flex-wrap gap-1.5">
                {entry.source_files.map((f, i) => (
                  <span key={i} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{f}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {editing && (
        <div className="border-t border-slate-100 px-4 pb-4 pt-3 space-y-3" onClick={(e) => e.stopPropagation()}>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Title</label>
            <input
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Category</label>
            <select
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            >
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Aliases / Keywords <span className="normal-case font-normal text-slate-400">(optional, comma-separated)</span></label>
            <input
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              value={form.aliases}
              onChange={(e) => setForm((f) => ({ ...f, aliases: e.target.value }))}
              placeholder="e.g. table too big, table overflow, won't fit"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Error / Problem</label>
            <textarea
              rows={3}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500 resize-y"
              value={form.error_description}
              onChange={(e) => setForm((f) => ({ ...f, error_description: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Solution</label>
            <textarea
              rows={5}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-y"
              value={form.solution}
              onChange={(e) => setForm((f) => ({ ...f, solution: e.target.value }))}
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60 transition"
              style={{ background: 'linear-gradient(160deg, #3B5BDB 0%, #4C6EF5 100%)' }}
            >
              <Check size={13} />
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={handleCancel}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition"
            >
              <X size={13} />
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function KnowledgeList({ entries, onDelete, onUpdate, loading }) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-xl p-4 animate-pulse">
            <div className="h-4 bg-slate-200 rounded w-3/4 mb-2" />
            <div className="h-3 bg-slate-100 rounded w-1/4" />
          </div>
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-16 text-slate-400">
        <Tag size={40} className="mx-auto mb-3 opacity-40" />
        <p className="font-medium">No knowledge entries yet</p>
        <p className="text-sm mt-1">Add your first error & solution using the form</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {entries.map((entry) => (
        <EntryCard key={entry.id} entry={entry} onDelete={onDelete} onUpdate={onUpdate} />
      ))}
    </div>
  );
}
