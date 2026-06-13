// Talks to an Ollama server over HTTP(S). Uses global fetch (Node 18+) so it works
// whether OLLAMA_BASE_URL is a local http://localhost:11434 or a remote https tunnel
// (e.g. ngrok) — the old node:http implementation couldn't do TLS or follow the
// 307 http→https redirect a tunnel issues.
const OLLAMA_BASE = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const MODEL = process.env.OLLAMA_LLM_MODEL || 'llama3.2:3b';
// Keep the model loaded in memory between requests so it doesn't get evicted and
// reloaded (a slow cold start) on every call. '30m' = stay resident for 30 minutes.
const KEEP_ALIVE = process.env.OLLAMA_KEEP_ALIVE || '30m';

const HEADERS = {
  'Content-Type': 'application/json',
  // Skip the ngrok free-tier browser interstitial when tunneling to a local Ollama.
  'ngrok-skip-browser-warning': '1',
};

// One-shot completion (non-streaming)
async function ollamaOnce(systemPrompt, userMessage, options = {}) {
  const { maxTokens = 3000, temperature = 0 } = options;
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        stream: false,
        keep_alive: KEEP_ALIVE,
        options: { temperature, num_predict: maxTokens },
      }),
    });
    if (!res.ok) {
      console.error(`[Ollama] Error: ${res.status}`);
      return '';
    }
    const data = await res.json();
    return data.message?.content || '';
  } catch (err) {
    console.error('[Ollama] ollamaOnce error:', err.message);
    return '';
  }
}

// Streaming completion — yields tokens from Ollama's newline-delimited JSON response.
// Throws on a non-OK response so the pipeline can show its safe support message.
async function* ollamaStream(systemPrompt, userMessage, history = []) {
  const historyMessages = history.map((m) => ({
    role: m.role,
    content: m.role === 'assistant'
      ? m.content.slice(0, 600) + (m.content.length > 600 ? '…' : '')
      : m.content,
  }));

  const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        ...historyMessages,
        { role: 'user', content: userMessage },
      ],
      stream: true,
      keep_alive: KEEP_ALIVE,
    }),
  });

  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Ollama HTTP ${res.status}: ${detail.slice(0, 200)}`);
  }

  // Read the NDJSON stream incrementally and yield each token's content.
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const data = JSON.parse(line);
        if (data.message?.content) yield data.message.content;
      } catch {
        // Skip malformed/partial lines
      }
    }
  }
}

// Compatibility exports — the pipeline imports { groqOnce, groqStream } from whichever
// LLM service is wired in, so we expose Ollama under those names.
module.exports = {
  groqOnce: ollamaOnce,
  groqStream: ollamaStream,
  GROQ_FAST_MODEL: MODEL,
  GROQ_SMART_MODEL: MODEL,
};
