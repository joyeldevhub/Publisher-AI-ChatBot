const http = require('http');

const OLLAMA_BASE = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const MODEL = process.env.OLLAMA_LLM_MODEL || 'llama3.2:3b';
// Keep the model loaded in memory between requests so it doesn't get evicted and
// reloaded (a slow cold start) on every call. '30m' = stay resident for 30 minutes.
const KEEP_ALIVE = process.env.OLLAMA_KEEP_ALIVE || '30m';

// One-shot completion (non-streaming)
async function ollamaOnce(systemPrompt, userMessage, options = {}) {
  const { maxTokens = 3000, temperature = 0 } = options;

  return new Promise((resolve) => {
    try {
      const url = new URL(OLLAMA_BASE + '/api/chat');
      const payload = JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        stream: false,
        keep_alive: KEEP_ALIVE,
      });

      const req = http.request(
        {
          hostname: url.hostname,
          port: url.port,
          path: url.pathname,
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            try {
              if (res.statusCode === 200) {
                const parsed = JSON.parse(data);
                resolve(parsed.message?.content || '');
              } else {
                console.error(`[Ollama] Error: ${res.statusCode}`);
                resolve('');
              }
            } catch (err) {
              console.error('[Ollama] Parse error:', err.message);
              resolve('');
            }
          });
        }
      );

      req.on('error', (err) => {
        console.error('[Ollama] Request error:', err.message);
        resolve('');
      });

      req.write(payload);
      req.end();
    } catch (err) {
      console.error('[Ollama] ollamaOnce error:', err.message);
      resolve('');
    }
  });
}

// Streaming completion — yields tokens from newline-delimited JSON response
async function* ollamaStream(systemPrompt, userMessage, history = []) {
  const historyMessages = history.map((m) => ({
    role: m.role,
    content: m.role === 'assistant'
      ? m.content.slice(0, 600) + (m.content.length > 600 ? '…' : '')
      : m.content,
  }));

  const payload = JSON.stringify({
    model: MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      ...historyMessages,
      { role: 'user', content: userMessage },
    ],
    stream: true,
    keep_alive: KEEP_ALIVE,
  });

  // Use a promise-based approach to collect streaming chunks
  const chunks = await new Promise((resolve, reject) => {
    try {
      const url = new URL(OLLAMA_BASE + '/api/chat');
      const collected = [];

      const req = http.request(
        {
          hostname: url.hostname,
          port: url.port,
          path: url.pathname,
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk.toString();
          });

          res.on('end', () => {
            if (res.statusCode !== 200) {
              console.error(`[Ollama] Stream error: ${res.statusCode}`, data.slice(0, 500));
              reject(new Error(`HTTP ${res.statusCode}`));
              return;
            }
            resolve(data);
          });
        }
      );

      req.on('error', reject);
      req.write(payload);
      req.end();
    } catch (err) {
      reject(err);
    }
  });

  // Parse newline-delimited JSON and yield tokens
  try {
    const lines = chunks.trim().split('\n');
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const data = JSON.parse(line);
        if (data.message?.content) {
          yield data.message.content;
        }
      } catch {
        // Skip malformed lines
      }
    }
  } catch (err) {
    console.error('[Ollama] Stream parsing error:', err.message);
  }
}

// Compatibility exports
module.exports = {
  groqOnce: ollamaOnce,
  groqStream: ollamaStream,
  GROQ_FAST_MODEL: MODEL,
  GROQ_SMART_MODEL: MODEL,
};
