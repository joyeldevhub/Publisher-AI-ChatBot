import { useEffect, useState } from 'react';
import { RefreshCw, Activity } from 'lucide-react';
import { fetchLogs } from '../../services/api';

const TYPE_META = {
  kb_hit:        { label: 'KB Hit',         bg: '#e8f5e9', text: '#2e7d32', dot: '#5BBF5B' },
  web_search:    { label: 'Web Search',     bg: '#fff8e1', text: '#e65100', dot: '#F9C22E' },
  no_results:    { label: 'No Results',     bg: '#fce4ec', text: '#c62828', dot: '#ef5350' },
  out_of_scope:  { label: 'Out of Scope',   bg: '#fbe9e7', text: '#bf360c', dot: '#ff7043' },
  conversational:{ label: 'Chat',           bg: '#e3f2fd', text: '#1565c0', dot: '#17C8CE' },
  escalation:    { label: 'Escalation',     bg: '#f3e5f5', text: '#6a1b9a', dot: '#8B3CF7' },
  repeat:        { label: 'Repeat',         bg: '#efebe9', text: '#4e342e', dot: '#a1887f' },
  unknown:       { label: 'Unknown',        bg: '#f5f5f5', text: '#616161', dot: '#bdbdbd' },
};

function TypeBadge({ type }) {
  const m = TYPE_META[type] || TYPE_META.unknown;
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ background: m.bg, color: m.text }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: m.dot }} />
      {m.label}
    </span>
  );
}

function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'medium' });
}

function msLabel(ms) {
  if (!ms) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export default function LogsView() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const data = await fetchLogs();
      setLogs(Array.isArray(data) ? data : []);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  // Quick stats
  const timedLogs = logs.filter((l) => l.responseMs > 0);
  const avgMs = timedLogs.length
    ? Math.round(timedLogs.reduce((s, l) => s + l.responseMs, 0) / timedLogs.length)
    : 0;
  const slowCount = timedLogs.filter((l) => l.responseMs > 5000).length;

  const stats = {
    total:    logs.length,
    kb:       logs.filter((l) => l.type === 'kb_hit').length,
    web:      logs.filter((l) => l.type === 'web_search').length,
    noResult: logs.filter((l) => l.type === 'no_results').length,
    outScope: logs.filter((l) => l.type === 'out_of_scope').length,
    chat:     logs.filter((l) => l.type === 'conversational').length,
    esc:      logs.filter((l) => l.type === 'escalation').length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-400 text-sm gap-2">
        <RefreshCw size={15} className="animate-spin" />
        Loading logs…
      </div>
    );
  }

  return (
    <div>
      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3 mb-3">
        {[
          { label: 'Total Requests', value: stats.total,    color: '#8B3CF7' },
          { label: 'KB Hits',        value: stats.kb,       color: '#5BBF5B' },
          { label: 'Web Search',     value: stats.web,      color: '#F9C22E' },
          { label: 'Chat',           value: stats.chat,     color: '#17C8CE' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-slate-50 border border-slate-200 rounded-xl p-3">
            <p className="text-xl font-bold" style={{ color }}>{value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-5 gap-3 mb-5">
        {[
          { label: 'No Results',    value: stats.noResult, color: '#c62828' },
          { label: 'Out of Scope',  value: stats.outScope, color: '#bf360c' },
          { label: 'Escalations',   value: stats.esc,      color: '#ef5350' },
          { label: 'Avg Response',  value: avgMs ? msLabel(avgMs) : '—', color: avgMs > 5000 ? '#c62828' : avgMs > 2000 ? '#e65100' : '#2e7d32' },
          { label: 'Slow (>5s)',    value: slowCount, color: slowCount > 0 ? '#c62828' : '#616161' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-slate-50 border border-slate-200 rounded-xl p-3">
            <p className="text-xl font-bold" style={{ color }}>{value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Refresh button */}
      <div className="flex justify-end mb-3">
        <button onClick={load}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition">
          <RefreshCw size={12} />
          Refresh
        </button>
      </div>

      {logs.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <Activity size={32} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">No requests logged yet.</p>
          <p className="text-xs mt-1">Logs appear after users send messages.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">Time</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">Query</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">Type</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">KB Hits</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">Time</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">Sources</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log, i) => (
                <tr key={log.id} className={`border-b border-slate-100 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} hover:bg-brand-50 transition`}>
                  <td className="px-4 py-2.5 text-xs text-slate-500 whitespace-nowrap">{formatTime(log.timestamp)}</td>
                  <td className="px-4 py-2.5 text-slate-700 max-w-[280px]">
                    <span className="block truncate text-xs" title={log.query}>{log.query || '—'}</span>
                  </td>
                  <td className="px-4 py-2.5"><TypeBadge type={log.type} /></td>
                  <td className="px-4 py-2.5 text-xs text-slate-500 text-center">{log.kbHits ?? 0}</td>
                  <td className="px-4 py-2.5 text-xs whitespace-nowrap font-medium"
                    style={{ color: !log.responseMs ? '#94a3b8' : log.responseMs > 5000 ? '#c62828' : log.responseMs > 2000 ? '#e65100' : '#2e7d32' }}>
                    {msLabel(log.responseMs)}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-500 max-w-[180px]">
                    {log.sources?.length > 0
                      ? <span className="truncate block text-brand-600" title={log.sources.join(', ')}>
                          {log.sources[0]}{log.sources.length > 1 ? ` +${log.sources.length - 1}` : ''}
                        </span>
                      : <span className="text-slate-300">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
