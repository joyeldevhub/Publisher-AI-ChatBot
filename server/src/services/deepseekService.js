const ollama = require('./ollamaLlmService'); // local fallback (exposes groqOnce/groqStream)

// DeepSeek exposes an OpenAI-compatible API. Models: deepseek-chat (V3), deepseek-reasoner (R1).
const DEEPSEEK_BASE = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
const API_KEY       = process.env.DEEPSEEK_API_KEY || '';
const FAST_MODEL    = process.env.DEEPSEEK_FAST_MODEL  || 'deepseek-chat';
const SMART_MODEL   = process.env.DEEPSEEK_SMART_MODEL || 'deepseek-chat';

function authHeaders() {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` };
}

// One-shot completion. Tries DeepSeek; on ANY failure falls back to local Ollama.
async function deepseekOnce(systemPrompt, userMessage, options = {}) {
  const { smart = false, maxTokens = 3000, temperature = 0 } = options;
  const model = smart ? SMART_MODEL : FAST_MODEL;

  try {
    const res = await fetch(`${DEEPSEEK_BASE}/chat/completions`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature,
        max_tokens: maxTokens,
        stream: false,
      }),
    });
    if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
  } catch (err) {
    console.warn('[DeepSeek] once failed — falling back to Ollama:', err.message);
    return ollama.groqOnce(systemPrompt, userMessage, options);
  }
}

// Streaming chat. Tries DeepSeek; if the stream can't be opened, falls back to Ollama.
async function* deepseekStream(systemPrompt, userMessage, history = []) {
  const historyMessages = history.map((m) => ({
    role: m.role,
    content: m.role === 'assistant'
      ? m.content.slice(0, 600) + (m.content.length > 600 ? '…' : '')
      : m.content,
  }));

  let res;
  try {
    res = await fetch(`${DEEPSEEK_BASE}/chat/completions`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        model: SMART_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          ...historyMessages,
          { role: 'user', content: userMessage },
        ],
        temperature: 0.3,
        max_tokens: 800,
        stream: true,
      }),
    });
    if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`);
  } catch (err) {
    console.warn('[DeepSeek] stream failed — falling back to Ollama:', err.message);
    yield* ollama.groqStream(systemPrompt, userMessage, history);
    return;
  }

  // Parse the OpenAI-style SSE stream: lines of "data: {json}", terminated by "data: [DONE]".
  let buffer = '';
  for await (const chunk of res.body) {
    buffer += Buffer.from(chunk).toString('utf8');
    const lines = buffer.split('\n');
    buffer = lines.pop(); // keep the incomplete trailing line
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === '[DONE]') return;
      try {
        const json = JSON.parse(payload);
        const token = json.choices?.[0]?.delta?.content;
        if (token) yield token;
      } catch { /* skip keep-alives / malformed lines */ }
    }
  }
}

// Direct DeepSeek connectivity/auth check (no fallback) — used by the health route.
async function deepseekPing() {
  const res = await fetch(`${DEEPSEEK_BASE}/chat/completions`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      model: FAST_MODEL,
      messages: [{ role: 'user', content: 'ok' }],
      max_tokens: 1,
      stream: false,
    }),
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return true;
}

module.exports = {
  groqOnce: deepseekOnce,
  groqStream: deepseekStream,
  deepseekPing,
  FAST_MODEL,
  SMART_MODEL,
};
