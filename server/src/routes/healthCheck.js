const express = require('express');
const http = require('http');
const { EMBED_MODEL } = require('../services/ollamaService');
const { groqPing } = require('../services/groqService');

const router = express.Router();

const OLLAMA_BASE = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

// Embeddings (and the LLM fallback) run on Ollama — confirm it's reachable and the
// embed model is installed via /api/tags (instant, no inference).
function listOllamaModels(timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const url = new URL(OLLAMA_BASE + '/api/tags');
    const req = http.get(
      { hostname: url.hostname, port: url.port, path: url.pathname, timeout: timeoutMs },
      (res) => {
        let data = '';
        res.on('data', (c) => { data += c; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve((parsed.models || []).map((m) => m.name));
          } catch (err) {
            reject(err);
          }
        });
      }
    );
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.on('error', reject);
  });
}

router.get('/services', async (req, res) => {
  const results = { groq: 'checking', ollama: 'checking', timestamp: new Date().toISOString() };

  // ── Groq (primary LLM) ───────────────────────────────────────────────────
  if (!process.env.GROQ_API_KEY) {
    results.groq = 'error';
  } else {
    try {
      await Promise.race([
        groqPing(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 6000)),
      ]);
      results.groq = 'ok';
    } catch (err) {
      results.groq = err.message === 'timeout' ? 'timeout' : 'error';
    }
  }

  // ── Ollama (embeddings + local fallback) ───────────────────────────────────
  try {
    const installed = await listOllamaModels();
    const has = (name) => installed.some((m) => m === name || m.startsWith(name.split(':')[0]));
    results.ollama = has(EMBED_MODEL) ? 'ok' : 'error';
  } catch (err) {
    results.ollama = err.message === 'timeout' ? 'timeout' : 'error';
  }

  res.json(results);
});

module.exports = router;
