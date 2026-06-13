import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Database, Plus, List, Bot, FileUp, ScrollText, Lightbulb, Search, Files, BarChart3 } from 'lucide-react';
import FeedForm from '../components/admin/FeedForm';
import KnowledgeList from '../components/admin/KnowledgeList';
import DocImportForm from '../components/admin/DocImportForm';
import DocumentsView from '../components/admin/DocumentsView';
import LogsView from '../components/admin/LogsView';
import GapsView from '../components/admin/GapsView';
import AnalyticsView from '../components/admin/AnalyticsView';
import { fetchKnowledge, fetchServiceHealth, listDocuments } from '../services/api';

const CATEGORIES = [
  'All','LaTeX Setter','XML','HTML','EPUB','Crossref Validation','DTD Validation',
  'Probe Validation','Table Formats','Metadata','Upload','Rendering',
  'InDesign','PDF Publishing','General',
];

export default function AdminPage() {
  const [entries, setEntries] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('import');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCat, setFilterCat] = useState('All');
  const [health, setHealth] = useState(null);
  const navigate = useNavigate();

  async function checkHealth() {
    try { setHealth(await fetchServiceHealth()); } catch { setHealth({ groq: 'error', ollama: 'error' }); }
  }

  async function loadEntries() {
    try {
      setLoading(true);
      const data = await fetchKnowledge();
      setEntries(data);
    } catch {
      localStorage.removeItem('admin_token');
      navigate('/admin/login');
    } finally {
      setLoading(false);
    }
  }

  async function loadDocuments() {
    try { setDocuments(await listDocuments()); } catch { /* ignore */ }
  }

  useEffect(() => { loadEntries(); loadDocuments(); checkHealth(); }, []);

  function handleLogout() {
    localStorage.removeItem('admin_token');
    navigate('/admin/login');
  }

  const tabs = [
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'import', label: 'Import Document', icon: FileUp },
    { id: 'add',    label: 'Add Entry',        icon: Plus  },
    { id: 'list',   label: 'All Entries',      icon: List, count: entries.length },
    { id: 'documents', label: 'Documents',     icon: Files, count: documents.length },
    { id: 'gaps',   label: 'KB Gaps',          icon: Lightbulb },
    { id: 'logs',   label: 'Logs',             icon: ScrollText },
  ];

  const filteredEntries = entries.filter((e) => {
    const catOk = filterCat === 'All' || e.category === filterCat;
    const term = searchTerm.toLowerCase();
    const textOk = !term ||
      e.title?.toLowerCase().includes(term) ||
      e.error_description?.toLowerCase().includes(term);
    return catOk && textOk;
  });

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Header ─────────────────────────────────────── */}
      <header className="px-6 py-4 flex items-center justify-between shadow-lg" style={{ background: 'linear-gradient(160deg, #3B5BDB 0%, #4C6EF5 100%)' }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center shadow-sm p-1.5">
            <img src="/logo.png" alt="DocFlow" className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="font-bold text-white text-lg leading-tight tracking-tight">DocFlow</h1>
            <p className="text-xs text-white/70">Publishing Support · Admin</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <a href="/"
            className="text-white/80 hover:text-white text-sm font-medium flex items-center gap-1.5 px-3 py-1.5 hover:bg-white/15 rounded-xl transition"
          >
            <Bot size={15} />
            View Chat
          </a>
          {health && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-xl text-xs text-white/80">
              {[{ label: 'Groq', status: health.groq, hint: 'chat + analysis' }, { label: 'Ollama', status: health.ollama, hint: 'embeddings + fallback' }].map(({ label, status, hint }) => (
                <span key={label} className="flex items-center gap-1" title={`${label} (${hint}): ${status}`}>
                  <span className={`w-2 h-2 rounded-full ${status === 'ok' ? 'bg-green-400' : status === 'timeout' ? 'bg-yellow-400' : 'bg-red-400'}`} />
                  {label}
                </span>
              ))}
              <button onClick={checkHealth} className="ml-1 text-white/60 hover:text-white">↻</button>
            </div>
          )}
          <button onClick={handleLogout}
            className="text-white/80 hover:text-white text-sm flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-white/15 transition"
          >
            <LogOut size={15} />
            Logout
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* ── Stats bar ──────────────────────────────────── */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-6 flex items-center gap-6 shadow-sm">
          {/* Coloured stat dots */}
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full" style={{ background: '#93C5FD' }} />
            <span className="w-3 h-3 rounded-full" style={{ background: '#6EE7B7' }} />
            <span className="w-3 h-3 rounded-full" style={{ background: '#A5B4FC' }} />
            <span className="w-3 h-3 rounded-full" style={{ background: '#86EFAC' }} />
          </div>
          <div className="h-8 w-px bg-slate-200" />
          <div>
            <p className="text-2xl font-bold text-slate-800">{entries.length}</p>
            <p className="text-xs text-slate-500 mt-0.5">Knowledge entries</p>
          </div>
          <div className="h-8 w-px bg-slate-200" />
          <div>
            <p className="text-2xl font-bold text-slate-800">{documents.length}</p>
            <p className="text-xs text-slate-500 mt-0.5">Documents</p>
          </div>
          <div className="h-8 w-px bg-slate-200" />
          <p className="text-sm text-slate-500 flex-1">
            Import documents (saved as-is and used to answer questions) or add curated entries manually. Imported documents are stored separately — they don't appear in "All Entries". DocFlow answers from both.
          </p>
        </div>

        {/* ── Tabs ──────────────────────────────────────── */}
        <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1 mb-6 w-fit shadow-sm">
          {tabs.map(({ id, label, icon: Icon, count }) => (
            <button key={id}
              onClick={() => { setTab(id); if (id === 'list') loadEntries(); /* logs load themselves */ }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                tab === id
                  ? 'text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-800 hover:bg-slate-50'
              }`}
              style={tab === id ? { background: 'linear-gradient(160deg, #3B5BDB 0%, #4C6EF5 100%)' } : undefined}
            >
              <Icon size={15} />
              {label}
              {count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                  tab === id ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-600'
                }`}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Content ───────────────────────────────────── */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          {/* Coloured top accent stripe */}
          <div className="h-1 rounded-full mb-6 -mt-1 mx-0" style={{ background: 'linear-gradient(to right, #F9C22E, #17C8CE, #8B3CF7, #5BBF5B)' }} />

          {tab === 'analytics' && (
            <>
              <h2 className="font-semibold text-slate-800 mb-5">Analytics & Insights</h2>
              <AnalyticsView />
            </>
          )}
          {tab === 'import' && (
            <>
              <h2 className="font-semibold text-slate-800 mb-1">Import from Document</h2>
              <DocImportForm onAdded={() => { loadDocuments(); /* documents stay on this tab — they aren't entries */ }} />
            </>
          )}
          {tab === 'add' && (
            <>
              <h2 className="font-semibold text-slate-800 mb-5">Add New Knowledge Entry</h2>
              <FeedForm onAdded={() => { loadEntries(); setTab('list'); }} />
            </>
          )}
          {tab === 'list' && (
            <>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-slate-800">All Knowledge Entries</h2>
                <span className="text-xs text-slate-400">{filteredEntries.length} of {entries.length}</span>
              </div>
              {/* Search + Filter */}
              <div className="flex gap-2 mb-4">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                    placeholder="Search title or description…"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <select
                  className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-400"
                  value={filterCat}
                  onChange={(e) => setFilterCat(e.target.value)}
                >
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <KnowledgeList
                entries={filteredEntries}
                onDelete={(id) => setEntries((p) => p.filter((e) => e.id !== id))}
                onUpdate={(id, fields) => setEntries((p) => p.map((e) => e.id === id ? { ...e, ...fields } : e))}
                loading={loading}
              />
            </>
          )}
          {tab === 'documents' && (
            <>
              <h2 className="font-semibold text-slate-800 mb-1">Imported Documents</h2>
              <p className="text-xs text-slate-400 mb-5">Documents the bot answers from (NotebookLM-style). Stored separately from entries.</p>
              <DocumentsView onChanged={loadDocuments} />
            </>
          )}
          {tab === 'gaps' && (
            <>
              <h2 className="font-semibold text-slate-800 mb-1">KB Gap Analyzer</h2>
              <p className="text-xs text-slate-400 mb-5">AI-generated suggestions based on questions users asked that weren't in the knowledge base.</p>
              <GapsView />
            </>
          )}
          {tab === 'logs' && (
            <>
              <h2 className="font-semibold text-slate-800 mb-5">Request Logs</h2>
              <LogsView />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
