import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, Square, Settings, Paperclip, X, FileText, Trash2, Zap, Edit3, Globe, Moon, Sun, Mic, Plus, Download, Sparkles, LogOut } from 'lucide-react';
import ChatMessage from '../components/chat/ChatMessage';
import ConversationSidebar from '../components/chat/ConversationSidebar';
import { authService } from '../services/authService';
import {
  streamChat,
  listConversations,
  getConversation,
  createConversation,
  saveConversation,
  deleteConversation,
} from '../services/api';

// Context sent to the model is the full conversation for now — restrict before production if needed.

// Strip non-serializable bits before saving: blob previews and File objects
// can't survive a reload, and `streaming` is a transient UI flag.
function serializeMessages(messages) {
  return messages.map((msg) => {
    const m = { ...msg };
    delete m.streaming;
    if (m.attachments?.length) {
      m.attachments = m.attachments.map((a) => ({ name: a.name, isImage: false }));
    }
    return m;
  });
}

// Patterns that are clearly conversational — skip KB lookup for these
const CONV_RE = [
  /^(hi|hello|hey|howdy|hiya)\b/i,
  /^(thanks?|thank you|thx|ty)\b/i,
  /^(ok|okay|got it|yes|no|yeah|nope|sure|alright)\b/i,
  /^(bye|goodbye|see you)\b/i,
  /^(good (morning|afternoon|evening|night))\b/i,
  /^(how are you|what.?s up)\b/i,
  /^(who are you|what are you)\b/i,
];
const isConversational = (t) => CONV_RE.some((r) => r.test(t?.trim() ?? ''));

function WaveLoader() {
  return (
    <div className="flex gap-3 flex-row">
      <div className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center mt-0.5 bg-white border border-slate-200 shadow-sm p-1">
        <img src="/logo.png" alt="DocFlow" className="w-full h-full object-contain" />
      </div>
      <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-white border border-slate-200 text-slate-800 shadow-sm flex items-center gap-1.5 min-w-fit">
        <span className="docflow-typing-dot docflow-typing-dot-1" />
        <span className="docflow-typing-dot docflow-typing-dot-2" />
        <span className="docflow-typing-dot docflow-typing-dot-3" />
      </div>
    </div>
  );
}

export default function ChatPage() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [currentId, setCurrentId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [darkMode, setDarkMode] = useState(false);
  const [listening, setListening] = useState(false);
  const [totalTokens, setTotalTokens] = useState(0);
  const [variants, setVariants] = useState({});
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const abortRef = useRef(null);
  const messagesRef = useRef(messages);
  const currentIdRef = useRef(currentId);
  const recognitionRef = useRef(null);

  const handleLogout = () => {
    authService.logout();
    navigate('/login');
  };

  // Keep refs in sync (read latest values inside async callbacks without stale closures)
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { currentIdRef.current = currentId; }, [currentId]);

  // Initialize speech recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);

    recognition.onresult = (event) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      if (transcript) setInput((prev) => prev + transcript);
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  const refreshList = useCallback(async () => {
    try { setConversations(await listConversations()); } catch { /* server down */ }
  }, []);

  // Load the Recents list on mount
  useEffect(() => { refreshList(); }, [refreshList]);

  // Save whenever messages or conversation ID changes (and not loading)
  useEffect(() => {
    if (loading || !currentIdRef.current || messages.length === 0) return;

    const timer = setTimeout(() => {
      saveConversation(currentIdRef.current, serializeMessages(messages))
        .then(() => refreshList())
        .catch(() => { /* offline — keep working in-memory */ });
    }, 500); // debounce rapid saves

    return () => clearTimeout(timer);
  }, [messages, loading, refreshList]);

  // Auto-scroll to newest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Conversation controls ───────────────────────────────────────────────────
  const newChat = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setCurrentId(null);
    currentIdRef.current = null;
    setInput('');
    setAttachments([]);
    inputRef.current?.focus();
  }, []);

  const openConversation = useCallback(async (id) => {
    if (id === currentIdRef.current || loading) return;
    try {
      const convo = await getConversation(id);
      setMessages(convo.messages?.length ? convo.messages : []);
      setCurrentId(id);
      currentIdRef.current = id;
    } catch { /* not found / server down */ }
  }, [loading]);

  const removeConversation = useCallback(async (id) => {
    try { await deleteConversation(id); } catch { /* ignore */ }
    if (id === currentIdRef.current) newChat();
    refreshList();
  }, [newChat, refreshList]);

  function deleteCurrent() {
    if (currentIdRef.current) removeConversation(currentIdRef.current);
    else newChat();
  }

  function handleFileSelect(e) {
    const selected = Array.from(e.target.files || []);
    const mapped = selected.map((f) => ({
      file: f, name: f.name,
      isImage: f.type.startsWith('image/'),
      preview: f.type.startsWith('image/') ? URL.createObjectURL(f) : null,
    }));
    setAttachments((prev) => [...prev, ...mapped].slice(0, 5));
    e.target.value = '';
  }

  function removeAttachment(index) {
    setAttachments((prev) => {
      const next = [...prev];
      if (next[index].preview) URL.revokeObjectURL(next[index].preview);
      next.splice(index, 1);
      return next;
    });
  }

  function handleStop() { abortRef.current?.abort(); }

  // ── Core: stream an answer from the server ─────────────────────────────────
  const doStream = useCallback(async (text, files, mode = 'full') => {
    // Read latest messages via ref — avoids stale closure when called after state updates
    const history = messagesRef.current
      .filter((m) => m.content)
      .map((m) => ({ role: m.role, content: m.content }));

    setLoading(true);
    const controller = new AbortController();
    abortRef.current = controller;

    const assistantId = `${Date.now()}-a`;
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: 'assistant', content: '', sources: [], streaming: true },
    ]);

    try {
      for await (const chunk of streamChat(text, files, history, controller.signal, mode)) {
        if (chunk.type === 'sources') {
          setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, sources: chunk.sources } : m));
        } else if (chunk.type === 'token') {
          setMessages((prev) => prev.map((m) =>
            m.id === assistantId ? { ...m, content: m.content + chunk.token } : m
          ));
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setMessages((prev) => prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: 'Something went wrong. Please try again.', streaming: false }
            : m
        ));
      }
    } finally {
      setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, streaming: false } : m));
      setLoading(false);
      inputRef.current?.focus();
    }
  }, []);

  // ── Try again ──────────────────────────────────────────────────────────────
  async function handleResend(text) {
    if (!text || loading) return;
    await doStream(text, []);
  }

  // ── Full flow: direct stream — KB match or not, ragPipeline decides ────────
  async function runFlow(text, files) {
    await doStream(text, files);
  }

  // ── Main send handler ──────────────────────────────────────────────────────
  async function handleSend(e) {
    e?.preventDefault();
    const text = input.trim();
    const currentFiles = [...attachments];
    if ((!text && currentFiles.length === 0) || loading) return;

    setInput('');
    setAttachments([]);

    // Add user message to chat
    setMessages((prev) => [...prev, {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      attachments: currentFiles.map((a) => ({ name: a.name, preview: a.preview, isImage: a.isImage })),
    }]);

    // Ensure a server-side conversation exists so this chat is saved + listed in Recents
    if (!currentIdRef.current) {
      try {
        const convo = await createConversation();
        currentIdRef.current = convo.id;
        setCurrentId(convo.id);
        refreshList();
      } catch { /* server down — continue in-memory */ }
    }

    await runFlow(text, currentFiles.map((a) => a.file));
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  function handleInputPaste(e) {
    const imageItem = Array.from(e.clipboardData?.items || []).find((i) => i.type.startsWith('image/'));
    if (!imageItem) return; // text paste — let browser handle normally
    e.preventDefault();
    const file = imageItem.getAsFile();
    if (!file) return;
    const ext = imageItem.type.split('/')[1] || 'png';
    const named = new File([file], `screenshot-${Date.now()}.${ext}`, { type: imageItem.type });
    const preview = URL.createObjectURL(named);
    setAttachments((prev) => [...prev, { file: named, name: named.name, isImage: true, preview }].slice(0, 5));
  }

  function handleMicrophone() {
    if (!recognitionRef.current) return;
    if (listening) {
      recognitionRef.current.stop();
      setListening(false);
    } else {
      recognitionRef.current.start();
    }
  }

  function handleEditMessage(messageId, newContent) {
    setMessages((prev) => prev.map((m) => m.id === messageId ? { ...m, content: newContent } : m));
    // Re-stream the next assistant message if this is a user message
    const msgIndex = messages.findIndex((m) => m.id === messageId);
    const nextMsg = messages[msgIndex + 1];
    if (msgIndex >= 0 && nextMsg?.role === 'assistant') {
      setMessages((prev) => prev.filter((m, i) => i <= msgIndex));
      handleResend(newContent);
    }
  }

  function exportAsMarkdown() {
    let markdown = '# DocFlow Conversation\n\n';
    markdown += `*Exported on ${new Date().toLocaleString()}*\n\n---\n\n`;

    messages.forEach((msg) => {
      if (msg.role === 'user') {
        markdown += `**You:** ${msg.content}\n\n`;
      } else {
        markdown += `**DocFlow:** ${msg.content}\n\n`;
      }
      if (msg.sources?.length) {
        markdown += `*Sources: ${msg.sources.map((s) => s.title).join(', ')}*\n\n`;
      }
      markdown += '---\n\n';
    });

    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `docflow-chat-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportAsPDF() {
    let text = 'DocFlow Conversation\n';
    text += `Exported on ${new Date().toLocaleString()}\n`;
    text += '='.repeat(50) + '\n\n';

    messages.forEach((msg) => {
      if (msg.role === 'user') {
        text += `YOU:\n${msg.content}\n\n`;
      } else {
        text += `DOCFLOW:\n${msg.content}\n\n`;
      }
      if (msg.sources?.length) {
        text += `Sources: ${msg.sources.map((s) => s.title).join(', ')}\n\n`;
      }
      text += '-'.repeat(50) + '\n\n';
    });

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `docflow-chat-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function generateVariants(messageId) {
    const msg = messages.find((m) => m.id === messageId);
    if (!msg || msg.role !== 'assistant') return;
    // Store variant state
    const variantId = `variant-${messageId}-${Date.now()}`;
    setVariants((prev) => ({ ...prev, [messageId]: { ...prev[messageId], loading: true } }));
    // Simulate variant generation by getting similar response
    setTimeout(() => {
      setVariants((prev) => ({
        ...prev,
        [messageId]: {
          ...prev[messageId],
          variants: [
            msg.content,
            msg.content + '\n\n*Alternative perspective: Consider reviewing related standards.*',
          ],
          loading: false,
        },
      }));
    }, 1500);
  }

  const isStreaming = loading && messages[messages.length - 1]?.streaming;
  const isSearching = loading && !isStreaming;

  return (
    <div className={`flex h-screen ${darkMode ? 'bg-slate-900' : 'bg-slate-50'}`}>

      {/* Mobile Overlay Sidebar */}
      {sidebarOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 sm:hidden z-40"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="fixed left-0 top-0 h-full w-64 z-50 sm:relative sm:w-auto sm:bg-transparent">
            <ConversationSidebar
              open={true}
              onToggle={() => setSidebarOpen(false)}
              conversations={conversations}
              currentId={currentId}
              onSelect={(id) => { openConversation(id); setSidebarOpen(false); }}
              onNew={() => { newChat(); setSidebarOpen(false); }}
              onDelete={removeConversation}
              darkMode={darkMode}
            />
          </div>
        </>
      )}

      {/* Desktop Sidebar */}
      {!sidebarOpen && (
        <ConversationSidebar
          open={false}
          onToggle={() => setSidebarOpen(true)}
          conversations={conversations}
          currentId={currentId}
          onSelect={openConversation}
          onNew={newChat}
          onDelete={removeConversation}
          darkMode={darkMode}
        />
      )}

      <div className="flex flex-col flex-1 min-w-0">

        {/* ── Header ─────────────────────────────────────────────── */}
        <header className={`px-3 sm:px-6 py-2 sm:py-4 flex items-center justify-between flex-shrink-0 border-b ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
          {/* Mobile Header - Minimal */}
          <div className="flex items-center gap-2 sm:hidden flex-1">
            <button onClick={() => setSidebarOpen(true)} className={`p-1 rounded transition ${darkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-700'}`} title="Menu">
              <Plus size={18} />
            </button>
            <h1 className={`font-semibold text-base flex-1 ${darkMode ? 'text-white' : 'text-slate-800'}`}>DocFlow</h1>
            <button onClick={() => setDarkMode(!darkMode)} className={`p-1 rounded transition ${darkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-700'}`}>
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>

          {/* Desktop Header - Full */}
          <div className="hidden sm:flex items-center gap-3 flex-1">
            <h1 className={`font-semibold ${darkMode ? 'text-white' : 'text-slate-800'}`}>DocFlow</h1>
            {totalTokens > 0 && (
              <span className={`text-xs px-2 py-1 rounded-lg ${darkMode ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-600'}`}>
                {totalTokens} tokens
              </span>
            )}
          </div>

          {/* Desktop Actions */}
          <div className="hidden sm:flex items-center gap-2">
            {messages.length > 0 && (
              <>
                <button
                  onClick={exportAsMarkdown}
                  className={`transition p-2 rounded-lg ${darkMode ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-700' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}
                  title="Export as Markdown"
                >
                  <Download size={18} />
                </button>
                <button
                  onClick={exportAsPDF}
                  className={`transition p-2 rounded-lg ${darkMode ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-700' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}
                  title="Export as Text"
                >
                  <FileText size={18} />
                </button>
              </>
            )}
            <button
              onClick={deleteCurrent}
              className={`transition p-2 rounded-lg ${darkMode ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-700' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}
              title="Delete this chat"
            >
              <Trash2 size={18} />
            </button>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`transition p-2 rounded-lg ${darkMode ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-700' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}
              title={darkMode ? 'Light mode' : 'Dark mode'}
            >
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <a href="/admin/login"
              className={`transition p-2 rounded-lg ${darkMode ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-700' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}
              title="Admin">
              <Settings size={18} />
            </a>
            <button
              onClick={handleLogout}
              className={`transition p-2 rounded-lg ${darkMode ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-700' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}
              title="Logout">
              <LogOut size={18} />
            </button>
          </div>
        </header>

        {/* ── Messages ────────────────────────────────────────────── */}
        <div className={`flex-1 overflow-y-auto px-2 sm:px-4 py-4 sm:py-6 pb-2 sm:pb-4 ${darkMode ? 'bg-slate-900' : ''}`}>
          <div className="w-full sm:max-w-3xl sm:mx-auto space-y-4 sm:space-y-5">
            {/* Empty state with suggestions */}
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center min-h-full gap-8 sm:gap-6 py-12 sm:py-12 px-4 sm:px-0">
                <div className="text-center">
                  <h2 className={`text-3xl sm:text-3xl font-light mb-2 ${darkMode ? 'text-white' : 'text-slate-800'}`}>Ready when you are.</h2>
                </div>

                {/* Suggestion buttons - grid on mobile, horizontal on desktop */}
                <div className="w-full sm:max-w-2xl grid grid-cols-1 gap-3 sm:flex sm:flex-row sm:gap-3 sm:justify-center">
                  <button onClick={() => {
                    setInput('Help me understand XML & markup standards');
                    inputRef.current?.focus();
                  }}
                    className={`flex items-center gap-2 px-4 py-3 rounded-lg transition border text-sm sm:text-sm whitespace-nowrap ${darkMode ? 'border-slate-600 hover:bg-slate-800 text-slate-300' : 'border-slate-200 hover:bg-slate-50 text-slate-700'}`}>
                    <Zap size={16} className="text-brand-500 flex-shrink-0" />
                    <span>XML & Markup</span>
                  </button>

                  <button onClick={() => {
                    setInput('What are best practices for EPUB and PDF production?');
                    inputRef.current?.focus();
                  }}
                    className={`flex items-center gap-2 px-4 py-3 rounded-lg transition border text-sm sm:text-sm whitespace-nowrap ${darkMode ? 'border-slate-600 hover:bg-slate-800 text-slate-300' : 'border-slate-200 hover:bg-slate-50 text-slate-700'}`}>
                    <Edit3 size={16} className="text-brand-500 flex-shrink-0" />
                    <span>EPUB & PDF</span>
                  </button>

                  <button onClick={() => {
                    setInput('How do I handle citations and metadata?');
                    inputRef.current?.focus();
                  }}
                    className={`flex items-center gap-2 px-4 py-3 rounded-lg transition border text-sm sm:text-sm whitespace-nowrap ${darkMode ? 'border-slate-600 hover:bg-slate-800 text-slate-300' : 'border-slate-200 hover:bg-slate-50 text-slate-700'}`}>
                    <Globe size={16} className="text-brand-500 flex-shrink-0" />
                    <span>Citations & Metadata</span>
                  </button>
                </div>
              </div>
            )}

            {/* Render welcome message only if it has content to show */}
            {messages.map((msg, index) => {
              const prevMsg = messages[index - 1];
              const question = msg.role === 'assistant' && prevMsg?.role === 'user'
                ? prevMsg.content : undefined;
              // Skip rendering streaming messages with no content (WaveLoader will show instead)
              if (msg.streaming && !msg.content) return null;
              // Skip welcome message if it's the only message (already shown as empty state)
              if (messages.length === 1 && msg.id === 'welcome') return null;
              return (
                <div key={msg.id}>
                  <ChatMessage
                    message={msg}
                    question={question}
                    onTryAgain={question && !loading ? () => handleResend(question) : undefined}
                    onEdit={msg.role === 'user' ? handleEditMessage : undefined}
                    onGenerateVariants={msg.role === 'assistant' && !loading ? generateVariants : undefined}
                    darkMode={darkMode}
                  />
                  {msg.role === 'assistant' && variants[msg.id]?.variants && (
                    <div className={`mt-3 p-3 rounded-lg border ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                      <p className={`text-xs font-semibold mb-2 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>Response Variants</p>
                      <div className="space-y-2">
                        {variants[msg.id].variants.map((variant, i) => (
                          <button
                            key={i}
                            onClick={() => setMessages((prev) => prev.map((m) => m.id === msg.id ? { ...m, content: variant } : m))}
                            className={`w-full text-left p-2 rounded text-xs transition ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-white'}`}
                          >
                            <span className={`font-semibold ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>Variant {i + 1}:</span> {variant.substring(0, 80)}...
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Wave loader — shown during KB search or streaming with no content yet */}
            {(isSearching || (loading && messages[messages.length - 1]?.content === '')) && (
              <WaveLoader />
            )}

            <div ref={bottomRef} />
          </div>
        </div>

        {/* ── Input ───────────────────────────────────────────────── */}
        <div className={`border-t px-2 sm:px-4 py-2 sm:py-6 flex-shrink-0 sticky bottom-0 ${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50'}`}>
          <div className="w-full sm:max-w-3xl sm:mx-auto">

            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {attachments.map((a, i) => (
                  <div key={i} className={`relative flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] sm:text-xs ${darkMode ? 'bg-slate-700' : 'bg-slate-100'}`}>
                    {a.isImage
                      ? <img src={a.preview} alt={a.name} className="w-7 sm:w-8 h-7 sm:h-8 object-cover rounded" />
                      : <FileText size={12} className="text-brand-500 flex-shrink-0" />
                    }
                    <span className={`max-w-[70px] sm:max-w-[100px] truncate ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>{a.name}</span>
                    <button type="button" onClick={() => removeAttachment(i)}
                      className="ml-0.5 text-slate-400 hover:text-red-500 transition">
                      <X size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={handleSend} className={`flex items-end gap-2 px-3 py-2.5 sm:px-4 sm:py-3 border rounded-2xl sm:rounded-3xl transition ${darkMode ? 'bg-slate-800 border-slate-700 focus-within:border-slate-600' : 'bg-white border-slate-200 focus-within:border-brand-300 focus-within:ring-2 focus-within:ring-brand-100'}`}>
              <input ref={fileInputRef} type="file" multiple
                accept="image/*,.docx,.txt,.log,.csv,.md,.js,.ts,.py,.json,.xml,.html,.css,.sh,.bat"
                className="hidden" onChange={handleFileSelect}
              />

              <button type="button" onClick={() => fileInputRef.current?.click()}
                disabled={loading || attachments.length >= 5}
                title="Add files"
                className={`flex-shrink-0 transition disabled:opacity-40 p-1.5 sm:p-2 ${darkMode ? 'text-slate-500 hover:text-slate-400' : 'text-slate-500 hover:text-slate-700'}`}>
                <Plus size={16} className="sm:w-[18px]" />
              </button>

              <textarea ref={inputRef} value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onPaste={handleInputPaste}
                placeholder="Ask anything"
                rows={1} disabled={loading}
                className={`flex-1 resize-none border-0 text-sm focus:outline-none transition disabled:opacity-60 max-h-24 sm:max-h-36 leading-relaxed bg-transparent ${darkMode ? 'text-white placeholder-slate-500' : 'text-slate-900 placeholder-slate-500'}`}
                style={{ overflowY: input.split('\n').length > 3 ? 'auto' : 'hidden' }}
                onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = `${Math.min(e.target.scrollHeight, 96)}px`; }}
              />

              <button type="button" onClick={handleMicrophone}
                title={listening ? "Stop listening" : "Start voice input"}
                className={`flex-shrink-0 transition p-1.5 sm:p-2 ${listening ? 'text-red-500 animate-pulse' : darkMode ? 'text-slate-500 hover:text-slate-400' : 'text-slate-500 hover:text-slate-700'}`}>
                <Mic size={16} className="sm:w-[18px]" />
              </button>

              {loading ? (
                <button type="button" onClick={handleStop}
                  className="w-8 h-8 sm:w-9 sm:h-9 bg-blue-500 hover:bg-blue-600 text-white rounded-full flex items-center justify-center transition flex-shrink-0 shadow-md"
                  title="Stop">
                  <Square size={9} fill="currentColor" className="sm:w-2.5" />
                </button>
              ) : (
                <button type="submit" disabled={(!input.trim() && attachments.length === 0) || loading}
                  className="w-8 h-8 sm:w-9 sm:h-9 bg-blue-500 hover:bg-blue-600 text-white rounded-full flex items-center justify-center transition disabled:opacity-50 flex-shrink-0 shadow-md">
                  <Send size={11} className="sm:w-[13px]" />
                </button>
              )}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
