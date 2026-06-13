import { Plus, MessageSquare, Trash2, PanelLeftClose, PanelLeft, Search, X } from 'lucide-react';
import { useState } from 'react';

// Group conversations into Today / Previous 7 days / Older buckets (like ChatGPT)
function bucketLabel(updatedAt) {
  const now = new Date();
  const d = new Date(updatedAt);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (d.getTime() >= startOfToday) return 'Today';
  if (d.getTime() >= startOfToday - 6 * 24 * 60 * 60 * 1000) return 'Previous 7 days';
  return 'Older';
}

export default function ConversationSidebar({
  open,
  onToggle,
  conversations,
  currentId,
  onSelect,
  onNew,
  onDelete,
  darkMode = true,
}) {
  const [search, setSearch] = useState('');
  if (!open) {
    return (
      <div className={`flex-shrink-0 w-12 flex flex-col items-center py-3 gap-2 ${darkMode ? 'bg-slate-900' : 'bg-slate-100 border-r border-slate-200'}`}>
        <button onClick={onToggle} title="Open sidebar"
          className={`transition p-2 rounded-lg ${darkMode ? 'text-slate-400 hover:text-white hover:bg-white/10' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'}`}>
          <PanelLeft size={18} />
        </button>
        <button onClick={onNew} title="New chat"
          className={`transition p-2 rounded-lg ${darkMode ? 'text-slate-400 hover:text-white hover:bg-white/10' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'}`}>
          <Plus size={18} />
        </button>
      </div>
    );
  }

  // Filter conversations based on search query
  const filtered = search
    ? conversations.filter(c => (c.title || 'New chat').toLowerCase().includes(search.toLowerCase()))
    : conversations;

  // Build ordered buckets (conversations already arrive newest-first)
  const groups = [];
  let lastLabel = null;
  for (const c of filtered) {
    const label = bucketLabel(c.updatedAt);
    if (label !== lastLabel) { groups.push({ label, items: [] }); lastLabel = label; }
    groups[groups.length - 1].items.push(c);
  }

  return (
    <div className={`flex-shrink-0 w-64 flex flex-col h-full ${darkMode ? 'bg-slate-900' : 'bg-white border-r border-slate-200'}`}>
      {/* Header */}
      <div className={`flex items-center justify-between px-3 py-3 ${darkMode ? '' : 'border-b border-slate-200'}`}>
        <span className={`font-semibold text-sm tracking-tight px-1 ${darkMode ? 'text-white' : 'text-slate-800'}`}>DocFlow</span>
        <button onClick={onToggle} title="Collapse sidebar"
          className={`transition p-1.5 rounded-lg ${darkMode ? 'text-slate-400 hover:text-white hover:bg-white/10' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}>
          <PanelLeftClose size={18} />
        </button>
      </div>

      {/* New chat */}
      <div className="px-3 pb-2">
        <button onClick={onNew}
          className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition ${darkMode ? 'text-white bg-white/10 hover:bg-white/15' : 'text-slate-700 bg-slate-100 hover:bg-slate-200'}`}>
          <Plus size={16} />
          New chat
        </button>
      </div>

      {/* Search bar */}
      <div className="px-3 pb-3">
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${darkMode ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
          <Search size={14} className={darkMode ? 'text-slate-500' : 'text-slate-400'} />
          <input
            type="text"
            placeholder="Search conversations…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`flex-1 text-sm bg-transparent outline-none ${darkMode ? 'text-white placeholder-slate-500' : 'text-slate-900 placeholder-slate-400'}`}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className={`transition ${darkMode ? 'text-slate-500 hover:text-white' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Recents */}
      <div className="flex-1 overflow-y-auto px-2 pb-3">
        {conversations.length === 0 ? (
          <p className={`text-xs px-3 py-4 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>No conversations yet.</p>
        ) : (
          groups.map((group) => (
            <div key={group.label} className="mb-1">
              <p className={`text-[11px] uppercase tracking-wide px-3 pt-3 pb-1 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{group.label}</p>
              {group.items.map((c) => {
                const active = c.id === currentId;
                return (
                  <div key={c.id}
                    className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition ${
                      darkMode
                        ? active ? 'bg-white/15 text-white' : 'text-slate-300 hover:bg-white/10'
                        : active ? 'bg-slate-100 text-slate-900' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                    onClick={() => onSelect(c.id)}
                  >
                    <MessageSquare size={14} className="flex-shrink-0 opacity-70" />
                    <span className="flex-1 truncate text-sm">{c.title || 'New chat'}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); onDelete(c.id); }}
                      title="Delete conversation"
                      className={`opacity-0 group-hover:opacity-100 transition flex-shrink-0 ${darkMode ? 'text-slate-400 hover:text-red-400' : 'text-slate-500 hover:text-red-500'}`}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>

      <p className={`text-[10px] px-4 py-2 border-t ${darkMode ? 'text-slate-600 border-white/5' : 'text-slate-500 border-slate-200'}`}>
        Conversations are kept for 24 hours
      </p>
    </div>
  );
}
