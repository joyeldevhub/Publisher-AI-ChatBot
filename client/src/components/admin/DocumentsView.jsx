import { useEffect, useState } from 'react';
import { FileText, Trash2, Loader2, FolderOpen, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { listDocuments, deleteDocument } from '../../services/api';

function formatDate(dt) {
  if (!dt) return '';
  try {
    return new Date(dt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '';
  }
}

export default function DocumentsView({ onChanged }) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState('');

  async function load() {
    setLoading(true);
    try { setDocs(await listDocuments()); } catch { /* ignore */ } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(d) {
    if (!confirm(`Delete "${d.source}"${d.customer ? ` (${d.customer})` : ''} and all its passages? The bot will no longer answer from it.`)) return;
    const key = `${d.customer}|${d.source}`;
    setDeleting(key);
    try {
      const { removed } = await deleteDocument(d.source, d.customer);
      toast.success(`Removed ${removed} passage${removed === 1 ? '' : 's'} from "${d.source}"`);
      await load();
      onChanged?.();
    } catch {
      toast.error('Failed to delete document');
    } finally {
      setDeleting('');
    }
  }

  if (loading) {
    return (
      <div className="text-center py-12 text-slate-400 text-sm">
        <Loader2 className="animate-spin mx-auto mb-2" size={20} />
        Loading documents…
      </div>
    );
  }

  if (docs.length === 0) {
    return (
      <div className="text-center py-16 text-slate-400">
        <FolderOpen size={40} className="mx-auto mb-3 opacity-40" />
        <p className="font-medium">No documents imported yet</p>
        <p className="text-sm mt-1">Use the “Import Document” tab to add PDFs, DOCX, or text files.</p>
      </div>
    );
  }

  // Group documents by customer.
  const byCustomer = {};
  for (const d of docs) {
    const c = d.customer || 'Unassigned';
    (byCustomer[c] = byCustomer[c] || []).push(d);
  }
  const customers = Object.keys(byCustomer).sort();

  return (
    <div className="space-y-6">
      {customers.map((cust) => (
        <div key={cust}>
          <div className="flex items-center gap-2 mb-2">
            <Users size={15} className="text-violet-500" />
            <h3 className="text-sm font-bold text-slate-700">{cust}</h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-violet-50 text-violet-600 font-medium">
              {byCustomer[cust].length} doc{byCustomer[cust].length === 1 ? '' : 's'}
            </span>
          </div>
          <div className="space-y-2">
            {byCustomer[cust].map((d) => {
              const key = `${d.customer}|${d.source}`;
              return (
                <div key={key}
                  className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3 hover:shadow-sm transition">
                  <FileText size={20} className="text-brand-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{d.source}</p>
                    <p className="text-xs text-slate-400">
                      {d.passages} passage{d.passages === 1 ? '' : 's'}
                      {d.createdAt ? ` · ${formatDate(d.createdAt)}` : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(d)}
                    disabled={deleting === key}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition disabled:opacity-50"
                    title="Delete document"
                  >
                    {deleting === key ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
