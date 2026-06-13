import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, FileText, Image, Code, Video, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { addKnowledge } from '../../services/api';

const CATEGORIES = [
  'LaTeX Setter', 'XML', 'HTML', 'EPUB', 'Crossref Validation',
  'DTD Validation', 'Probe Validation', 'Table Formats', 'Metadata',
  'Upload', 'Rendering', 'InDesign', 'PDF Publishing', 'Calibre', 'General',
];

function FileIcon({ type }) {
  if (type.startsWith('image/')) return <Image size={14} className="text-blue-500" />;
  if (type.startsWith('video/')) return <Video size={14} className="text-purple-500" />;
  if (type === 'application/pdf') return <FileText size={14} className="text-red-500" />;
  if (type.includes('word') || type.includes('docx')) return <FileText size={14} className="text-blue-600" />;
  return <Code size={14} className="text-green-600" />;
}

export default function FeedForm({ onAdded }) {
  const [form, setForm] = useState({
    title: '',
    error_description: '',
    solution: '',
    category: 'General',
    aliases: '',
  });
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);

  const onDrop = useCallback((accepted) => {
    setFiles((prev) => [...prev, ...accepted]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': [],
      'video/*': ['.mp4', '.mov', '.avi', '.webm'],
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/xml': ['.xml'],
      'application/xml': ['.xml'],
      'text/*': ['.txt', '.log', '.sh', '.py', '.js', '.ts', '.sql', '.json', '.yaml', '.yml'],
    },
    maxSize: 50 * 1024 * 1024,
  });

  function removeFile(index) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function handleImagePaste(e) {
    const imageItem = Array.from(e.clipboardData?.items || []).find((i) => i.type.startsWith('image/'));
    if (!imageItem) return; // text paste — let browser handle normally
    e.preventDefault();
    const file = imageItem.getAsFile();
    if (!file) return;
    const ext = imageItem.type.split('/')[1] || 'png';
    const named = new File([file], `screenshot-${Date.now()}.${ext}`, { type: imageItem.type });
    setFiles((prev) => [...prev, named]);
    toast.success('Screenshot pasted!');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim() || !form.error_description.trim() || !form.solution.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      const data = new FormData();
      data.append('title', form.title);
      data.append('error_description', form.error_description);
      data.append('solution', form.solution);
      data.append('category', form.category);
      data.append('aliases', form.aliases);
      files.forEach((f) => data.append('files', f));

      await addKnowledge(data);
      toast.success('Knowledge entry added and indexed!');
      setForm({ title: '', error_description: '', solution: '', category: 'General', aliases: '' });
      setFiles([]);
      onAdded?.();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add entry');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          Title <span className="text-red-400">*</span>
        </label>
        <input
          name="title"
          value={form.title}
          onChange={handleChange}
          placeholder="e.g. Equation not rendering in proof"
          className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
        />
      </div>

      {/* Category */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Category</label>
        <select
          name="category"
          value={form.category}
          onChange={handleChange}
          className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
        >
          {CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Aliases / keywords */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          Aliases / Keywords <span className="text-slate-400 font-normal">(optional)</span>
        </label>
        <input
          name="aliases"
          value={form.aliases}
          onChange={handleChange}
          placeholder="Other ways users describe this, comma-separated — e.g. table too big, overflow, won't fit, wide table"
          className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
        />
        <p className="text-xs text-slate-400 mt-1">Boosts search — list slang, abbreviations, and alternate phrasings so more queries match this entry.</p>
      </div>

      {/* Error description */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          Error / Problem Description <span className="text-red-400">*</span>
        </label>
        <textarea
          name="error_description"
          value={form.error_description}
          onChange={handleChange}
          onPaste={handleImagePaste}
          rows={4}
          placeholder="Describe the issue — e.g. Equation label missing when using \begin{align*}... (Ctrl+V to paste screenshot)"
          className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition font-mono"
        />
      </div>

      {/* Solution */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          Solution / Steps to Resolve <span className="text-red-400">*</span>
        </label>
        <textarea
          name="solution"
          value={form.solution}
          onChange={handleChange}
          onPaste={handleImagePaste}
          rows={5}
          placeholder="Explain the fix step by step. e.g. 1. Remove the * from \begin{align*}  2. Recompile the proof... (Ctrl+V to paste screenshot)"
          className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
        />
      </div>

      {/* File upload */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          Attach Files{' '}
          <span className="text-slate-400 font-normal">(screenshots, docx, scripts, logs)</span>
        </label>
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition ${
            isDragActive
              ? 'border-brand-500 bg-brand-50'
              : 'border-slate-200 hover:border-brand-400 hover:bg-slate-50'
          }`}
        >
          <input {...getInputProps()} />
          <Upload size={22} className="mx-auto mb-2 text-slate-400" />
          <p className="text-sm text-slate-500">
            {isDragActive ? 'Drop files here…' : 'Drag & drop or click to attach files'}
          </p>
          <p className="text-xs text-slate-400 mt-1">Images, Videos, PDF, DOCX, scripts, logs — max 50MB each</p>
        </div>

        {files.length > 0 && (
          <ul className="mt-2 space-y-1.5">
            {files.map((f, i) => (
              <li key={i} className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                <FileIcon type={f.type} />
                <span className="text-xs text-slate-700 flex-1 truncate">{f.name}</span>
                <span className="text-xs text-slate-400">{(f.size / 1024).toFixed(0)} KB</span>
                <button type="button" onClick={() => removeFile(i)}>
                  <X size={14} className="text-slate-400 hover:text-red-500 transition" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-60"
      >
        {loading ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Indexing into knowledge base…
          </>
        ) : (
          'Add to Knowledge Base'
        )}
      </button>
    </form>
  );
}
