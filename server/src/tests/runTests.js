/**
 * DocFlow System Tests — 10 core checks
 * Run: node src/tests/runTests.js  (from /server directory)
 * Requires: Ollama running with nomic-embed-text model
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });
process.env.DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../../data');

const { v4: uuidv4 } = require('uuid');
const { readDB } = require('../db/init');
const { addEntry, searchSimilar, getAllEntries, deleteEntry } = require('../services/vectorStore');

let passed = 0;
let failed = 0;
const TEMP_ID = 'docflow-test-' + uuidv4();

function ok(label, condition, detail = '') {
  if (condition) {
    console.log(`  ✅  ${label}`);
    passed++;
  } else {
    console.log(`  ❌  ${label}${detail ? '  →  ' + detail : ''}`);
    failed++;
  }
}

async function run() {
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║       DocFlow System Tests (10 checks)      ║');
  console.log('╚══════════════════════════════════════════════╝\n');

  // ── Test 1: DB file is valid JSON ──────────────────────────────
  console.log('── DB Layer ──');
  try {
    const raw = readDB();
    ok('DB file exists and parses as valid JSON', Array.isArray(raw));
  } catch (e) {
    ok('DB file exists and parses as valid JSON', false, e.message);
  }

  // ── Test 2: DB has at least 1 entry ───────────────────────────
  const allRaw = readDB();
  ok('DB contains at least 1 entry', allRaw.length > 0, `count = ${allRaw.length}`);

  // ── Test 3: Company info is seeded ─────────────────────────────
  const hasCompany = allRaw.some((e) => e.title === 'What is DocFlow?');
  ok('DocFlow company info entries are seeded', hasCompany);

  // ── Test 4: Entries have required fields ──────────────────────
  const sample = allRaw[0];
  ok(
    'Entries have all required fields (id, title, error_description, solution)',
    !!(sample?.id && sample?.title && sample?.error_description && sample?.solution)
  );

  // ── Test 5: At least one entry has a vector embedding ─────────
  const hasEmbed = allRaw.some((e) => Array.isArray(e.embedding) && e.embedding.length > 100);
  ok('Entries have vector embeddings stored', hasEmbed,
    hasEmbed ? '' : 'No embedding found — re-seed or restart server');

  // ── Embedding / Semantic Search ────────────────────────────────
  console.log('\n── Semantic Search ──');

  // Test 6: Add a test entry with embedding
  let addOk = false;
  try {
    await addEntry({
      id: TEMP_ID,
      title: 'DocFlow Automated Test Entry — please ignore',
      error_description: 'Automated test entry to validate vector store insert and semantic search capability in DocFlow.',
      solution: 'This entry is created by the test runner and deleted automatically. It tests that addEntry works correctly.',
      category: 'General',
      source_files: [],
    });
    addOk = true;
    ok('addEntry() creates embedding and saves to DB', true);
  } catch (e) {
    ok('addEntry() creates embedding and saves to DB', false, e.message);
  }

  // Test 7: Semantic search finds the test entry
  if (addOk) {
    try {
      const res = await searchSimilar('automated test vector store DocFlow validation', 10);
      const found = res.some((r) => r.id === TEMP_ID);
      ok(
        'searchSimilar() finds recently inserted entry',
        found,
        found ? `score: ${res.find(r => r.id === TEMP_ID)?.score?.toFixed(3)}` : `got ${res.length} results, none matched test entry`
      );
    } catch (e) {
      ok('searchSimilar() finds recently inserted entry', false, e.message);
    }
  } else {
    ok('searchSimilar() finds recently inserted entry', false, 'skipped — addEntry failed');
  }

  // Test 8: Known LaTeX KB query returns results
  try {
    const res = await searchSimilar('abstract paragraph split LaTeX', 5);
    ok(
      'KB query for known LaTeX topic returns results (score > 0.25)',
      res.length > 0,
      res.length > 0
        ? `top: "${res[0].title.slice(0, 45)}…" score=${res[0].score.toFixed(3)}`
        : 'No results — check threshold or embeddings'
    );
  } catch (e) {
    ok('KB query for known LaTeX topic returns results', false, e.message);
  }

  // Test 9: Unrelated query returns low scores (< 0.5)
  try {
    const res = await searchSimilar('cricket world cup score india vs australia', 5);
    const topScore = res[0]?.score ?? 0;
    ok(
      'Unrelated query produces low similarity scores (< 0.5)',
      topScore < 0.5,
      `top score = ${topScore.toFixed(3)}`
    );
  } catch (e) {
    ok('Unrelated query produces low similarity scores', false, e.message);
  }

  // ── Cleanup ────────────────────────────────────────────────────
  console.log('\n── Cleanup ──');

  // Test 10: Delete the test entry
  if (addOk) {
    try {
      const deleted = deleteEntry(TEMP_ID);
      ok('deleteEntry() removes the test entry from DB', deleted === true);
    } catch (e) {
      ok('deleteEntry() removes the test entry from DB', false, e.message);
    }
  } else {
    ok('deleteEntry() removes the test entry from DB', false, 'skipped — addEntry failed');
  }

  // ── Summary ────────────────────────────────────────────────────
  const total = passed + failed;
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log(`║  Results: ${passed}/${total} passed${failed > 0 ? `  (${failed} FAILED)` : '  — all good!'}${' '.repeat(Math.max(0, 18 - String(passed).length - String(total).length - (failed > 0 ? String(failed).length + 9 : 12)))}║`);
  console.log('╚══════════════════════════════════════════════╝\n');

  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error('\n[Test runner crash]', err.message);
  process.exit(1);
});
