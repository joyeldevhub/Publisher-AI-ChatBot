const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { requireAdmin, generateAdminToken, verifyAdminPassword } = require('../middleware/auth');
const { addEntry, getAllEntries, deleteEntry, updateEntry } = require('../services/vectorStore');
const { parseFile, chunkText } = require('../services/fileParser');
const { groqOnce } = require('../services/groqService');

const router = express.Router();

const upload = multer({
  dest: path.join(__dirname, '../../uploads'),
  limits: { fileSize: 50 * 1024 * 1024 },
});

// Admin login
router.post('/login', (req, res) => {
  const { password } = req.body;
  if (!password || !verifyAdminPassword(password)) {
    return res.status(401).json({ error: 'Invalid password' });
  }
  res.json({ token: generateAdminToken() });
});

// Get all knowledge entries (admin only).
// "All Entries" shows only curated entries (Add Entry) — imported document
// passages are kept separately and excluded here.
router.get('/', requireAdmin, (req, res) => {
  try {
    const entries = getAllEntries().filter((e) => e.source_type !== 'document');
    res.json(entries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List imported documents, grouped by source file with passage counts (admin).
// NOTE: must be defined before the "/:id" routes so "documents" isn't read as an id.
router.get('/documents', requireAdmin, (req, res) => {
  try {
    const docs = getAllEntries().filter((e) => e.source_type === 'document');
    const grouped = {};
    for (const e of docs) {
      const src = (e.source_files && e.source_files[0]) || 'Unknown';
      const customer = e.customer || '';
      const key = `${customer}|${src}`; // group per customer + file so same-named files don't merge
      if (!grouped[key]) grouped[key] = { source: src, customer, passages: 0, createdAt: e.created_at || null };
      grouped[key].passages += 1;
      if (e.created_at && (!grouped[key].createdAt || e.created_at > grouped[key].createdAt)) {
        grouped[key].createdAt = e.created_at;
      }
    }
    res.json(Object.values(grouped).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete an imported document and all its passages (admin)
router.delete('/documents', requireAdmin, (req, res) => {
  const { source, customer } = req.body || {};
  if (!source) return res.status(400).json({ error: 'source is required' });
  try {
    const cf = customer != null ? String(customer).toLowerCase() : null;
    const passages = getAllEntries().filter(
      (e) => e.source_type === 'document'
        && (e.source_files || []).includes(source)
        && (cf == null || (e.customer || '').toLowerCase() === cf)
    );
    let removed = 0;
    for (const p of passages) { if (deleteEntry(p.id)) removed += 1; }
    res.json({ removed });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add new knowledge entry (admin only)
router.post('/', requireAdmin, upload.array('files', 10), async (req, res) => {
  const { title, error_description, solution, category, aliases, source_type } = req.body;

  if (!title || !error_description || !solution) {
    return res.status(400).json({ error: 'title, error_description, and solution are required' });
  }

  const IMAGES_DIR = path.join(__dirname, '../../data/images');

  try {
    let fullErrorText = error_description;
    let fullSolutionText = solution;
    const sourceFiles = [];
    const images = [];

    // Save ALL uploaded files as permanent attachments; also extract text for images/docs
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const isImage   = file.mimetype.startsWith('image/');
        const isVideo   = file.mimetype.startsWith('video/');
        const isDoc     = !isImage && !isVideo;

        sourceFiles.push(file.originalname);

        // Save every file permanently (image, video, document)
        const ext = path.extname(file.originalname) || (isImage ? '.png' : isVideo ? '.mp4' : '.bin');
        const savedName = `${uuidv4()}${ext}`;
        const savedPath = path.join(IMAGES_DIR, savedName);
        fs.copyFileSync(file.path, savedPath);

        const fileType = isImage ? 'image' : isVideo ? 'video' : 'document';
        images.push({ url: `/kb-images/${savedName}`, name: file.originalname, fileType });

        // Text extraction for images and documents (not video) — enriches KB search
        if (!isVideo) {
          try {
            const extracted = await parseFile(file.path, file.mimetype, file.originalname);
            if (extracted) {
              const fname = file.originalname.toLowerCase();
              if (isDoc || fname.includes('error') || fname.includes('log')) {
                fullErrorText += `\n\n[From: ${file.originalname}]\n${extracted}`;
              } else {
                fullSolutionText += `\n\n[From: ${file.originalname}]\n${extracted}`;
              }
            }
          } catch { /* skip extraction errors */ }
        }

        fs.unlinkSync(file.path);
      }
    }

    const entry = {
      id: uuidv4(),
      title,
      error_description: fullErrorText,
      solution: fullSolutionText,
      category: category || 'General',
      aliases: aliases || '',
      source_type: source_type || '',
      source_files: sourceFiles,
      images,
    };

    await addEntry(entry);
    res.json({ success: true, id: entry.id });
  } catch (err) {
    console.error('Error adding entry:', err);
    res.status(500).json({ error: err.message });
  }
});

// Bulk ingest — save many entries/passages at once (used by Import Document)
router.post('/bulk', requireAdmin, async (req, res) => {
  const { entries } = req.body || {};
  if (!Array.isArray(entries) || entries.length === 0) {
    return res.status(400).json({ error: 'entries array is required' });
  }
  let saved = 0;
  for (const e of entries) {
    if (!e || !e.solution) continue;
    try {
      await addEntry({
        id: uuidv4(),
        title: e.title || 'Untitled',
        category: e.category || 'General',
        error_description: e.error_description || '',
        solution: e.solution,
        aliases: e.aliases || '',
        source_type: e.source_type || '',
        customer: e.customer || '',
        ...(typeof e.chunk_index === 'number' ? { chunk_index: e.chunk_index } : {}),
        source_files: e.source ? [e.source] : [],
        images: [],
      });
      saved++;
    } catch (err) {
      console.warn('[bulk] failed to save an entry:', err.message);
    }
  }
  res.json({ saved, total: entries.length });
});

// Robust JSON array extractor — tries full parse first, falls back to per-object extraction
function extractJsonArray(raw) {
  // Strip think tokens and markdown fences
  const cleaned = raw
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  // ── Attempt 1: parse the complete array ──────────────────────────────────
  const arrStart = cleaned.indexOf('[');
  if (arrStart !== -1) {
    // Walk brackets to find matching ]
    let depth = 0;
    for (let i = arrStart; i < cleaned.length; i++) {
      if (cleaned[i] === '[' || cleaned[i] === '{') depth++;
      else if (cleaned[i] === ']' || cleaned[i] === '}') {
        depth--;
        if (depth === 0 && cleaned[i] === ']') {
          // Try full parse
          try { return JSON.parse(cleaned.slice(arrStart, i + 1)); } catch {}
          // Try removing last truncated object
          const repaired = cleaned.slice(arrStart, i + 1).replace(/,\s*\{[^}]*$/, ']');
          try { return JSON.parse(repaired); } catch {}
          break;
        }
      }
    }
  }

  // ── Attempt 2: extract every valid {…} object individually ───────────────
  // Works even when the outer array is truncated mid-way
  const objects = [];
  let depth = 0;
  let objStart = -1;
  for (let i = 0; i < cleaned.length; i++) {
    if (cleaned[i] === '{') {
      if (depth === 0) objStart = i;
      depth++;
    } else if (cleaned[i] === '}') {
      depth--;
      if (depth === 0 && objStart !== -1) {
        try {
          const obj = JSON.parse(cleaned.slice(objStart, i + 1));
          if (obj && typeof obj === 'object') objects.push(obj);
        } catch {}
        objStart = -1;
      }
    }
  }
  return objects.length > 0 ? objects : null;
}

// Analyze a document and auto-generate KB entries (admin only)
router.post('/analyze-doc', requireAdmin, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file provided' });

  try {
    const text = await parseFile(req.file.path, req.file.mimetype, req.file.originalname);
    fs.unlinkSync(req.file.path);

    if (!text || text.trim().length < 30) {
      return res.status(400).json({ error: 'Could not extract readable text from the file' });
    }

    // Full-text (NotebookLM-style) indexing: split the WHOLE document into overlapping
    // passages so nothing is missed. Answers are synthesized from the matched passages
    // at query time — not from pre-extracted Q&A entries.
    const docName = req.file.originalname;
    const chunks = chunkText(text);

    const entries = chunks.map((chunk, i) => ({
      title: `${docName} — passage ${i + 1}`,
      category: 'General',
      error_description: `Excerpt from ${docName}`,
      solution: chunk,
      aliases: '',
      source_type: 'document',
      source: docName,
      chunk_index: i,
    }));

    if (entries.length === 0) {
      return res.status(400).json({ error: 'No readable text found in the document.' });
    }

    res.json({ entries, source: docName });
  } catch (err) {
    if (req.file?.path) fs.unlink(req.file.path, () => {});
    console.error('[analyze-doc]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Update a knowledge entry (admin only)
router.put('/:id', requireAdmin, async (req, res) => {
  const { title, error_description, solution, category, aliases } = req.body;
  if (!title || !error_description || !solution) {
    return res.status(400).json({ error: 'title, error_description, and solution are required' });
  }
  try {
    const fields = { title, error_description, solution, category: category || 'General' };
    if (aliases !== undefined) fields.aliases = aliases; // preserve existing aliases if not sent
    const ok = await updateEntry(req.params.id, fields);
    if (!ok) return res.status(404).json({ error: 'Entry not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a knowledge entry (admin only)
router.delete('/:id', requireAdmin, (req, res) => {
  const deleted = deleteEntry(req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Entry not found' });
  res.json({ success: true });
});

// KB Gap Analyzer — reads no_results logs, generates AI-suggested KB entries (admin only)
router.get('/gaps', requireAdmin, async (req, res) => {
  try {
    const { getLogs } = require('../services/logger');
    const logs = getLogs();

    // Collect unique unanswered queries (type no_results, non-empty query)
    const seen = new Set();
    const unanswered = logs
      .filter((l) => l.type === 'no_results' && l.query && l.query.trim().length > 4)
      .map((l) => l.query.trim())
      .filter((q) => { if (seen.has(q.toLowerCase())) return false; seen.add(q.toLowerCase()); return true; })
      .slice(0, 20);

    if (unanswered.length === 0) {
      return res.json({ analyzed: 0, suggestions: [] });
    }

    const prompt = `You are a knowledge base curator for DocFlow, a publishing support chatbot.
Below are questions users asked that were NOT in the knowledge base.
For each question that is clearly related to publishing, citations, XML, EPUB, PDF, proofreading, or academic publishing workflows — generate a KB entry.
Skip questions that are clearly unrelated to publishing.

Return a raw JSON array (no markdown, no explanation) with this exact structure:
[{"title":"...","error_description":"...","solution":"...","category":"..."}]

Valid categories: Citations & References, Proofreading & Editing, XML & Structure, DTD & Validation, Tables & Formatting, EPUB & PDF, Standards & Validation, Fonts & Colors, Images & Media, Metadata, General Best Practices

Unanswered questions:
${unanswered.map((q, i) => `${i + 1}. ${q}`).join('\n')}`;

    const raw = await groqOnce('You output only valid JSON arrays. No markdown. No explanation.', prompt, { smart: true, maxTokens: 2000, temperature: 0 });
    const match = raw.match(/\[[\s\S]*\]/);
    const suggestions = match ? JSON.parse(match[0]) : [];

    res.json({ analyzed: unanswered.length, suggestions: Array.isArray(suggestions) ? suggestions : [] });
  } catch (err) {
    console.error('[gaps]', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
