import { useState } from 'react';
import { Lightbulb, Plus, X, ChevronDown, ChevronUp, Sparkles, RefreshCw } from 'lucide-react';
import { fetchGaps, addKnowledge } from '../../services/api';

const CATEGORY_COLORS = {
  'LaTeX Setter': '#8B3CF7', 'XML': '#3b82f6', 'HTML': '#f97316',
  'EPUB': '#22c55e', 'Table Formats': '#06b6d4', 'Metadata': '#6366f1',
  'Upload': '#17C8CE', 'General': '#64748b',
};

function SuggestionCard({ suggestion, onAdd, onDismiss, isAdding, isAdded }) {
  const [expanded, setExpanded] = useState(false);
  const dot = CATEGORY_COLORS[suggestion.category] || '#64748b';

  return (
    <div className={`border rounded-xl p-4 mb-3 transition ${isAdded ? 'border-green-200 bg-green-50/50' : 'border-slate-200 bg-white'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium text-white"
              style={{ background: dot }}>
              {suggestion.category}
            </span>
          </div>
          <p className="font-semibold text-slate-800 text-sm leading-snug">{suggestion.title}</p>
          <p className="text-xs text-slate-500 mt-1 line-clamp-2">{suggestion.error_description}</p>
        </div>
        <div className="flex gap-1.5 flex-shrink-0">
          {!isAdded ? (
            <button
              onClick={onAdd}
              disabled={isAdding}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white transition disabled:opacity-60"
              style={{ background: 'linear-gradient(160deg, #3B5BDB 0%, #4C6EF5 100%)' }}
            >
              {isAdding ? <RefreshCw size={11} className="animate-spin" /> : <Plus size={11} />}
              {isAdding ? 'Adding…' : 'Add to KB'}
            </button>
          ) : (
            <span className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-green-700 bg-green-100">
              ✓ Added
            </span>
          )}
          {!isAdded && (
            <button onClick={onDismiss}
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition">
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1 mt-2 text-xs text-slate-400 hover:text-slate-600 transition"
      >
        {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        {expanded ? 'Hide solution' : 'Preview solution'}
      </button>

      {expanded && (
        <div className="mt-2 p-3 bg-slate-50 rounded-lg text-xs text-slate-600 leading-relaxed whitespace-pre-wrap border border-slate-100">
          {suggestion.solution}
        </div>
      )}
    </div>
  );
}

export default function GapsView() {
  const [phase, setPhase] = useState('idle'); // idle | loading | done | error
  const [data, setData] = useState(null);
  const [dismissed, setDismissed] = useState(new Set());
  const [adding, setAdding] = useState(new Set());
  const [added, setAdded] = useState(new Set());
  const [errorMsg, setErrorMsg] = useState('');

  async function generate() {
    setPhase('loading');
    setDismissed(new Set());
    setAdding(new Set());
    setAdded(new Set());
    try {
      const result = await fetchGaps();
      setData(result);
      setPhase('done');
    } catch (err) {
      setErrorMsg(err.message || 'Failed to generate suggestions');
      setPhase('error');
    }
  }

  async function handleAdd(idx, suggestion) {
    setAdding((prev) => new Set([...prev, idx]));
    try {
      const form = new FormData();
      form.append('title', suggestion.title);
      form.append('error_description', suggestion.error_description);
      form.append('solution', suggestion.solution);
      form.append('category', suggestion.category || 'General');
      await addKnowledge(form);
      setAdded((prev) => new Set([...prev, idx]));
    } catch {
      // silently ignore — button resets
    } finally {
      setAdding((prev) => { const s = new Set(prev); s.delete(idx); return s; });
    }
  }

  const visible = data?.suggestions?.filter((_, i) => !dismissed.has(i)) || [];
  const addedCount = added.size;

  return (
    <div>
      {phase === 'idle' && (
        <div className="text-center py-16">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'linear-gradient(160deg, #3B5BDB 0%, #4C6EF5 100%)' }}>
            <Lightbulb size={26} className="text-white" />
          </div>
          <h3 className="font-semibold text-slate-800 mb-1">KB Gap Analyzer</h3>
          <p className="text-sm text-slate-500 mb-6 max-w-sm mx-auto">
            Analyzes all unanswered user questions and generates AI-suggested KB entries for you to review and add.
          </p>
          <button onClick={generate}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white mx-auto transition hover:opacity-90"
            style={{ background: 'linear-gradient(160deg, #3B5BDB 0%, #4C6EF5 100%)' }}>
            <Sparkles size={15} />
            Generate Suggestions
          </button>
        </div>
      )}

      {phase === 'loading' && (
        <div className="text-center py-16">
          <div className="flex items-end gap-[3px] h-8 justify-center mb-4">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className="kd-wave-bar" />
            ))}
          </div>
          <p className="text-sm text-slate-500">Analyzing unanswered questions…</p>
          <p className="text-xs text-slate-400 mt-1">This may take 15–30 seconds</p>
        </div>
      )}

      {phase === 'error' && (
        <div className="text-center py-12">
          <p className="text-sm text-red-500 mb-4">{errorMsg}</p>
          <button onClick={generate}
            className="text-xs text-brand-500 hover:underline">Try again</button>
        </div>
      )}

      {phase === 'done' && (
        <>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-semibold text-slate-700">
                {data.suggestions.length} suggestion{data.suggestions.length !== 1 ? 's' : ''} generated
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                From {data.analyzed} unanswered question{data.analyzed !== 1 ? 's' : ''}
                {addedCount > 0 && ` · ${addedCount} added to KB`}
              </p>
            </div>
            <button onClick={generate}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition">
              <RefreshCw size={11} />
              Regenerate
            </button>
          </div>

          {data.analyzed === 0 ? (
            <div className="text-center py-10 text-slate-400 text-sm">
              No unanswered questions in logs yet. Once users ask things not in the KB, gaps will appear here.
            </div>
          ) : visible.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-sm">
              All suggestions have been added or dismissed.
            </div>
          ) : (
            visible.map((s, i) => (
              <SuggestionCard
                key={i}
                suggestion={s}
                onAdd={() => handleAdd(i, s)}
                onDismiss={() => setDismissed((prev) => new Set([...prev, i]))}
                isAdding={adding.has(i)}
                isAdded={added.has(i)}
              />
            ))
          )}
        </>
      )}
    </div>
  );
}
