const { readDB, writeDB } = require('../db/init');
const { getEmbedding } = require('./ollamaService');

function cosineSimilarity(vecA, vecB) {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    magA += vecA[i] * vecA[i];
    magB += vecB[i] * vecB[i];
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

// Text used for the entry's vector. Aliases are included so alternate phrasings,
// slang, and abbreviations a user might type also match this entry.
function buildEmbedText(entry) {
  return [entry.title, entry.aliases, entry.error_description, entry.solution]
    .filter(Boolean)
    .join('\n');
}

// Embed text but never throw — when no embedding service is reachable (e.g. hosted
// without a local Ollama), store the entry without a vector. It stays searchable via
// the keyword fallback in searchSimilar().
async function safeEmbed(text) {
  try {
    return await getEmbedding(text);
  } catch (err) {
    console.warn('[vectorStore] embedding unavailable — storing entry without a vector:', err.message);
    return [];
  }
}

const KW_STOP = new Set([
  'the','is','a','an','of','to','in','for','and','or','my','i','how','do','does',
  'what','why','with','on','it','this','that','help','me','understand','about',
  'can','you','please','need','want','get','got','am','are','was','were','will',
]);

// Fraction of the query's distinct meaningful words that appear in the entry's text.
// Used when vector embeddings aren't available so the KB still works. Returns 0..1,
// the same range cosine similarity produces, so the pipeline's score gates carry over.
function keywordScore(query, row) {
  const terms = [...new Set(
    String(query || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
      .filter((w) => w.length > 2 && !KW_STOP.has(w))
  )];
  if (terms.length === 0) return 0;
  const hay = `${row.title || ''} ${row.aliases || ''} ${row.error_description || ''} ${row.solution || ''}`.toLowerCase();
  let hits = 0;
  for (const t of terms) if (hay.includes(t)) hits++;
  return hits / terms.length;
}

async function addEntry(entry) {
  const db = readDB();
  const textToEmbed = buildEmbedText(entry);
  const embedding = await safeEmbed(textToEmbed);
  db.push({ ...entry, embedding, created_at: new Date().toISOString() });
  writeDB(db);
}

async function searchSimilar(query, topK = 5, categoryFilter = null, customerFilter = null) {
  const db = readDB();
  let pool = db;

  // Category filter — only search within specified category
  if (categoryFilter) {
    pool = pool.filter((r) => r.category === categoryFilter);
  }

  // Customer scoping — the customer is the main scope:
  //   • customer named → answer ONLY from that customer's documents (filename irrelevant,
  //     no other customers, no general entries).
  //   • no customer named → search everything: general curated entries (Add Entry) AND
  //     all documents across every customer. The pipeline then applies a confidence gate.
  if (customerFilter) {
    const cf = customerFilter.toLowerCase();
    pool = pool.filter((r) => r.source_type === 'document' && (r.customer || '').toLowerCase() === cf);
  }

  if (pool.length === 0) return [];

  // Prefer semantic (vector) search, but it needs an embedding service. When no entry
  // has a stored vector — or the embedding service is unreachable — fall back to a
  // keyword-overlap score so the KB still works (the LLM relevance gate keeps precision).
  const haveVectors = pool.some((r) => r.embedding && r.embedding.length > 0);
  let queryEmbedding = null;
  if (haveVectors) {
    try {
      queryEmbedding = await getEmbedding(query);
    } catch (err) {
      console.warn('[vectorStore] embedding unavailable — using keyword search:', err.message);
    }
  }

  const scored = pool.map((row) => {
    const useVector = queryEmbedding && row.embedding && row.embedding.length > 0;
    const base = useVector
      ? cosineSimilarity(queryEmbedding, row.embedding)
      : keywordScore(query, row);
    const boost = 1 + Math.min(row.helpfulness || 0, 15) * 0.02;
    return { ...row, score: base * boost };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK).filter((r) => r.score > 0.25);
}

// Increment helpfulness on KB entries that were confirmed useful by user thumbs-up
function boostEntries(ids = []) {
  if (!ids.length) return;
  const db = readDB();
  let changed = false;
  for (const id of ids) {
    const idx = db.findIndex((r) => r.id === id);
    if (idx !== -1) {
      db[idx].helpfulness = (db[idx].helpfulness || 0) + 1;
      changed = true;
    }
  }
  if (changed) writeDB(db);
}

function getAllEntries() {
  return readDB()
    .map(({ embedding, ...rest }) => rest)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

// All passages of an imported document, in original order — used to reconstruct
// the full document for context expansion at answer time. Optionally scoped to a
// customer so same-named files under different customers don't get mixed.
function getDocumentPassages(source, customer = null) {
  const cf = customer ? customer.toLowerCase() : null;
  return readDB()
    .filter((r) => r.source_type === 'document' && (r.source_files || []).includes(source)
      && (!cf || (r.customer || '').toLowerCase() === cf))
    .map(({ embedding, ...rest }) => rest)
    .sort((a, b) => (a.chunk_index ?? 0) - (b.chunk_index ?? 0));
}

function deleteEntry(id) {
  const db = readDB();
  const index = db.findIndex((r) => r.id === id);
  if (index === -1) return false;
  db.splice(index, 1);
  writeDB(db);
  return true;
}

async function updateEntry(id, fields) {
  const db = readDB();
  const index = db.findIndex((r) => r.id === id);
  if (index === -1) return false;
  const updated = { ...db[index], ...fields, updated_at: new Date().toISOString() };
  // Re-embed since content changed
  const textToEmbed = buildEmbedText(updated);
  updated.embedding = await safeEmbed(textToEmbed);
  db[index] = updated;
  writeDB(db);
  return true;
}

module.exports = { addEntry, searchSimilar, getAllEntries, getDocumentPassages, deleteEntry, updateEntry, boostEntries };
