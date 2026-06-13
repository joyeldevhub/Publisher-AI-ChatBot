const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../../data');
const DB_PATH = path.join(dataDir, 'knowledge.json');

// In-memory copy of the KB. The file is large (each entry carries an embedding
// vector), so re-reading + parsing it on every search is the main bottleneck.
// We load it once and keep it in sync on every write — only the server writes here.
let cache = null;

function ensureDB() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH, JSON.stringify([], null, 2));
}

function readDB() {
  if (cache) return cache;
  ensureDB();
  cache = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
  return cache;
}

function writeDB(data) {
  cache = data; // keep the in-memory copy in sync
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function initDB() {
  ensureDB();
  readDB(); // warm the cache at startup
  console.log('  Database initialized (JSON store, in-memory cached)');
}

module.exports = { initDB, readDB, writeDB };
