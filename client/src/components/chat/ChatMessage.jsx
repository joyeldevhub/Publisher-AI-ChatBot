import ReactMarkdown from 'react-markdown';
import { User, ChevronDown, ChevronUp, FileText, ThumbsUp, ThumbsDown, Copy, RotateCcw, Check, CheckCircle2, XCircle, Edit2, Save, X, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { submitThumbsUp, submitThumbsDown } from '../../services/api';

function SourceBadge({ source }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs bg-brand-50 text-brand-700 border border-brand-100 px-2 py-0.5 rounded-full">
      {source.title}
      <span className="text-brand-400">{source.score}%</span>
    </span>
  );
}

// ── Clarification card — shows the KB entry found and asks user to confirm ───
function ClarificationCard({ message, onConfirm, onDecline, darkMode = false }) {
  const { match } = message;
  const score = Math.round((match?.score ?? 0) * 100);

  const CATEGORY_DOT = {
    'LaTeX Setter': '#6366F1', 'XML': '#0EA5E9', 'HTML': '#F97316', 'EPUB': '#10B981',
    'Table Formats': '#06B6D4', 'Metadata': '#4C6EF5', 'Upload': '#14B8A6',
    'General': '#94A3B8', 'Company Info': '#4C6EF5',
  };
  const dot = CATEGORY_DOT[match?.category] || '#64748b';

  return (
    <div className="flex gap-2 sm:gap-3 flex-row">
      <div className={`w-7 sm:w-8 h-7 sm:h-8 rounded-lg sm:rounded-xl flex-shrink-0 flex items-center justify-center mt-0.5 border shadow-sm p-0.5 sm:p-1 ${darkMode ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-200'}`}>
        <img src="/logo.png" alt="DocFlow" className="w-full h-full object-contain" />
      </div>
      <div className="flex flex-col gap-2 max-w-[85%] sm:max-w-[80%]">
        <div className={`px-3 sm:px-4 py-2.5 sm:py-3.5 rounded-xl sm:rounded-2xl rounded-tl-sm border shadow-sm text-xs sm:text-sm ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'}`}>
          <p className={`text-[10px] sm:text-xs mb-1 sm:mb-2 font-medium uppercase tracking-wide ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>Found in knowledge base</p>
          <p className={`font-semibold mb-1 sm:mb-2 leading-snug text-xs sm:text-sm ${darkMode ? 'text-white' : 'text-slate-800'}`}>{match?.title}</p>
          <div className="flex flex-wrap items-center gap-1 sm:gap-2 mb-2 sm:mb-3">
            <span className="flex items-center gap-0.5 text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full font-medium"
              style={{ background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0' }}>
              <span className="w-1 sm:w-1.5 h-1 sm:h-1.5 rounded-full inline-block" style={{ background: '#10B981' }} />
              {score}% match
            </span>
            <span className={`flex items-center gap-0.5 text-[10px] sm:text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              <span className="w-1 sm:w-1.5 h-1 sm:h-1.5 rounded-full inline-block" style={{ background: dot }} />
              {match?.category}
            </span>
          </div>
          <p className={`text-[10px] sm:text-xs ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>Is this the solution for your issue?</p>
        </div>
        <div className="flex gap-1 sm:gap-2 flex-wrap">
          <button onClick={onConfirm}
            className="flex items-center gap-0.5 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-semibold text-white shadow-sm transition hover:opacity-90"
            style={{ background: 'linear-gradient(160deg, #3B5BDB 0%, #4C6EF5 100%)' }}>
            <CheckCircle2 size={11} className="sm:w-[13px]" />
            <span>Yes, show</span>
          </button>
          <button onClick={onDecline}
            className={`flex items-center gap-0.5 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-medium transition ${darkMode ? 'text-slate-400 bg-slate-600 hover:bg-slate-500' : 'text-slate-500 bg-slate-100 hover:bg-slate-200'}`}>
            <XCircle size={11} className="sm:w-[13px]" />
            <span>No, search</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ChatMessage({ message, question, onTryAgain, onConfirm, onDecline, onEdit, onGenerateVariants, darkMode = false }) {
  // Render clarification card separately
  if (message.type === 'clarification') {
    return <ClarificationCard message={message} onConfirm={onConfirm} onDecline={onDecline} darkMode={darkMode} />;
  }

  const isUser = message.role === 'user';
  const [showSources, setShowSources] = useState(false);
  const [copied, setCopied] = useState(false);
  const [upState, setUpState] = useState('idle');   // idle | loading | done
  const [downState, setDownState] = useState('idle'); // idle | loading | done | sent
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(message.content || '');

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(message.content || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard may be denied */ }
  }

  async function handleThumbsUp() {
    if (upState !== 'idle' || !question) return;
    setUpState('loading');
    try {
      const sourceIds = (message.sources || []).map((s) => s.id).filter(Boolean);
      await submitThumbsUp(question, sourceIds);
      setUpState('done');
    } catch {
      setUpState('idle');
    }
  }

  async function handleThumbsDown() {
    if (downState !== 'idle' || !question) return;
    setDownState('loading');
    try {
      await submitThumbsDown(question, message.content);
      setDownState('sent');
    } catch {
      setDownState('idle');
    }
  }

  function handleSaveEdit() {
    if (onEdit) onEdit(message.id, editText);
    setIsEditing(false);
  }

  const showFeedback = !isUser && !message.streaming && message.content;

  return (
    <div className={`flex gap-2 sm:gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div
        className={`w-7 sm:w-8 h-7 sm:h-8 rounded-lg sm:rounded-xl flex-shrink-0 flex items-center justify-center mt-0.5 ${
          isUser ? '' : darkMode ? 'bg-slate-700 border border-slate-600 shadow-sm p-0.5 sm:p-1' : 'bg-white border border-slate-200 shadow-sm p-0.5 sm:p-1'
        }`}
        style={isUser ? { background: 'linear-gradient(160deg, #3B5BDB 0%, #4C6EF5 100%)' } : undefined}
      >
        {isUser
          ? <User size={13} className="text-white sm:w-[15px]" />
          : <img src="/logo.png" alt="DocFlow" className="w-full h-full object-contain" />
        }
      </div>

      <div className={`flex flex-col gap-1 max-w-[90%] sm:max-w-[75%] ${isUser ? 'items-end' : 'items-start'}`}>
        {/* Attachments (user messages) */}
        {isUser && message.attachments && message.attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-1 justify-end">
            {message.attachments.map((a, i) =>
              a.isImage ? (
                <img
                  key={i}
                  src={a.preview}
                  alt={a.name}
                  className="max-w-[220px] max-h-[160px] object-cover rounded-xl border border-white/20 shadow-sm"
                />
              ) : (
                <div key={i} className="flex items-center gap-1.5 text-white text-xs px-3 py-1.5 rounded-xl" style={{ background: '#4C6EF5' }}>
                  <FileText size={13} />
                  <span className="max-w-[120px] truncate">{a.name}</span>
                </div>
              )
            )}
          </div>
        )}

        {/* Bubble */}
        {message.content && (
          <>
            {isEditing ? (
              <div className="w-full">
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className={`w-full px-3 sm:px-4 py-2 sm:py-3 rounded-xl sm:rounded-2xl text-xs sm:text-sm resize-none border-2 focus:outline-none ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-900'}`}
                  rows={3}
                />
                <div className="flex gap-1 sm:gap-2 mt-2">
                  <button onClick={handleSaveEdit}
                    className={`flex items-center gap-0.5 sm:gap-1 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-medium transition ${darkMode ? 'bg-slate-600 hover:bg-slate-500 text-white' : 'bg-slate-200 hover:bg-slate-300 text-slate-900'}`}>
                    <Check size={11} className="sm:w-[13px]" />
                    <span className="hidden sm:inline">Save</span>
                  </button>
                  <button onClick={() => { setIsEditing(false); setEditText(message.content); }}
                    className={`flex items-center gap-0.5 sm:gap-1 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-medium transition ${darkMode ? 'bg-slate-600 hover:bg-slate-500 text-white' : 'bg-slate-200 hover:bg-slate-300 text-slate-900'}`}>
                    <X size={11} className="sm:w-[13px]" />
                    <span className="hidden sm:inline">Cancel</span>
                  </button>
                </div>
              </div>
            ) : (
              <div
                className={`px-3 sm:px-4 py-2 sm:py-3 rounded-xl sm:rounded-2xl text-xs sm:text-sm leading-relaxed ${
                  isUser
                    ? 'text-white rounded-tr-none'
                    : darkMode ? 'bg-slate-700 border border-slate-600 text-white rounded-tl-none shadow-sm' : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none shadow-sm'
                } ${message.streaming && message.content ? 'typing-cursor' : ''}`}
                style={isUser ? { background: '#4C6EF5' } : undefined}
              >
                {isUser ? (
                  message.content ? <p className="whitespace-pre-wrap">{message.content}</p> : null
                ) : (
                  <div className="prose-chat">
                    <ReactMarkdown>{message.content || ''}</ReactMarkdown>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Sources (for assistant messages) */}
        {!isUser && message.sources && message.sources.length > 0 && (
          <div className="w-full">
            <button
              onClick={() => setShowSources((v) => !v)}
              className={`flex items-center gap-1 text-xs transition mt-0.5 ${darkMode ? 'text-slate-500 hover:text-slate-400' : 'text-slate-400 hover:text-slate-600'}`}
            >
              {showSources ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              {message.sources.length} source{message.sources.length > 1 ? 's' : ''} used
            </button>
            {showSources && (
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {message.sources.map((s) => (
                  <SourceBadge key={s.id} source={s} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Edit button (user messages only, not editing) */}
        {isUser && !isEditing && message.content && (
          <button
            onClick={() => setIsEditing(true)}
            title="Edit message"
            className={`flex items-center gap-0.5 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-lg text-[10px] sm:text-xs transition mt-0.5 ${darkMode ? 'text-slate-500 hover:text-slate-400 hover:bg-slate-600' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
          >
            <Edit2 size={11} className="sm:w-[13px]" />
            <span className="hidden sm:inline">Edit</span>
          </button>
        )}

        {/* Feedback bar (assistant messages only, after streaming) */}
        {showFeedback && (
          <div className="flex items-center flex-wrap gap-0.5 sm:gap-0.5 mt-0.5">
            {/* Copy */}
            <button
              onClick={handleCopy}
              title="Copy response"
              className={`flex items-center gap-0.5 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-lg text-[10px] sm:text-xs transition ${darkMode ? 'text-slate-500 hover:text-slate-400 hover:bg-slate-600' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
            >
              {copied ? <Check size={11} className="text-green-500 sm:w-[13px]" /> : <Copy size={11} className="sm:w-[13px]" />}
              <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
            </button>

            {/* Try again */}
            {onTryAgain && (
              <button
                onClick={onTryAgain}
                title="Try again"
                className={`flex items-center gap-0.5 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-lg text-[10px] sm:text-xs transition ${darkMode ? 'text-slate-500 hover:text-slate-400 hover:bg-slate-600' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
              >
                <RotateCcw size={11} className="sm:w-[13px]" />
                <span className="hidden sm:inline">Try again</span>
              </button>
            )}

            <div className={`w-px h-2 sm:h-3 mx-0.5 ${darkMode ? 'bg-slate-600' : 'bg-slate-200'}`} />

            {/* Thumbs up */}
            <button
              onClick={handleThumbsUp}
              disabled={upState !== 'idle' || !question}
              title={upState === 'done' ? 'Saved to knowledge base!' : 'Helpful'}
              className={`flex items-center gap-0.5 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-lg text-[10px] sm:text-xs transition ${
                upState === 'done'
                  ? 'text-green-600 bg-green-50'
                  : darkMode ? 'text-slate-500 hover:text-green-400 hover:bg-green-900/20' : 'text-slate-400 hover:text-green-600 hover:bg-green-50'
              } disabled:opacity-50`}
            >
              <ThumbsUp size={11} className={`sm:w-[13px] ${upState === 'loading' ? 'animate-pulse' : ''}`} />
              {upState === 'done' && <span className="hidden sm:inline">Saved!</span>}
            </button>

            {/* Thumbs down */}
            <button
              onClick={handleThumbsDown}
              disabled={downState !== 'idle' || !question}
              title={downState === 'sent' ? 'Reported — we\'ll review it!' : 'Not helpful'}
              className={`flex items-center gap-0.5 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-lg text-[10px] sm:text-xs transition ${
                downState === 'sent'
                  ? 'text-red-500 bg-red-50'
                  : darkMode ? 'text-slate-500 hover:text-red-400 hover:bg-red-900/20' : 'text-slate-400 hover:text-red-500 hover:bg-red-50'
              } disabled:opacity-50`}
            >
              <ThumbsDown size={11} className={`sm:w-[13px] ${downState === 'loading' ? 'animate-pulse' : ''}`} />
              {downState === 'sent' && <span className="hidden sm:inline">Reported</span>}
            </button>

            {/* Generate variants */}
            {onGenerateVariants && (
              <button
                onClick={() => onGenerateVariants(message.id)}
                title="Generate response variants"
                className={`flex items-center gap-0.5 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-lg text-[10px] sm:text-xs transition ${darkMode ? 'text-slate-500 hover:text-slate-400 hover:bg-slate-600' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
              >
                <Sparkles size={11} className="sm:w-[13px]" />
                <span className="hidden sm:inline">Variants</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
