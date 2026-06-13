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

async function addEntry(entry) {
  const db = readDB();
  const textToEmbed = buildEmbedText(entry);
  const embedding = await getEmbedding(textToEmbed);
  db.push({ ...entry, embedding, created_at: new Date().toISOString() });
  writeDB(db);
}

async function searchSimilar(query, topK = 5, categoryFilter = null, customerFilter = null) {
  const db = readDB();
  let pool = db.filter((r) => r.embedding && r.embedding.length > 0);
  if (pool.length === 0) return [];

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

  const queryEmbedding = await getEmbedding(query);

  const scored = pool.map((row) => {
    const base = cosineSimilarity(queryEmbedding, row.embedding);
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
  updated.embedding = await getEmbedding(textToEmbed);
  db[index] = updated;
  writeDB(db);
  return true;
}

module.exports = { addEntry, searchSimilar, getAllEntries, getDocumentPassages, deleteEntry, updateEntry, boostEntries };
