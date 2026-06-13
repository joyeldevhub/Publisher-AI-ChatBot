// OpenRouter — an OpenAI-compatible cloud LLM gateway. Free ":free" models cost nothing
// and run in the cloud, so the bot stays up 24/7 even when the user's laptop is off.
// Uses global fetch (Node 18+). Exposes the same { groqOnce, groqStream } interface the
// RAG pipeline expects, so swapping providers is a one-line import change in ragPipeline.
const OPENROUTER_BASE = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
const API_KEY = process.env.OPENROUTER_API_KEY || '';

// Free models (override via env). 8B for fast classify/reformulate, 70B for answers.
const FAST_MODEL  = process.env.OPENROUTER_FAST_MODEL  || 'meta-llama/llama-3.1-8b-instruct:free';
const SMART_MODEL = process.env.OPENROUTER_SMART_MODEL || 'meta-llama/llama-3.3-70b-instruct:free';

const HEADERS = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${API_KEY}`,
  // Optional attribution headers OpenRouter recommends.
  'HTTP-Referer': process.env.CLIENT_URL || 'https://publisher-ai-chatbot-jdhm.onrender.com',
  'X-Title': 'Publisher AI ChatBot',
};

// One-shot completion — classify, reformulate, relevance, titles. Returns '' on failure
// so internal callers degrade gracefully (the pipeline shows a safe support message).
async function openrouterOnce(systemPrompt, userMessage, options = {}) {
  const { smart = false, maxTokens = 3000, temperature = 0 } = options;
  const model = smart ? SMART_MODEL : FAST_MODEL;
  try {
    const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
      method: 'POST',
      headers: HEADERS,
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
    if (!res.ok) {
      console.warn(`[OpenRouter] once failed: HTTP ${res.status}`);
      return '';
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
  } catch (err) {
    console.warn('[OpenRouter] openrouterOnce error:', err.message);
    return '';
  }
}

// Streaming chat — yields text deltas. Throws on a non-OK response so the pipeline can
// show its safe "assistant busy" message instead of hanging or hallucinating.
async function* openrouterStream(systemPrompt, userMessage, history = []) {
  const historyMessages = history.map((m) => ({
    role: m.role,
    content: m.role === 'assistant'
      ? m.content.slice(0, 600) + (m.content.length > 600 ? '…' : '')
      : m.content,
  }));

  const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: 'POST',
    headers: HEADERS,
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

  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => '');
    throw new Error(`OpenRouter HTTP ${res.status}: ${detail.slice(0, 200)}`);
  }

  // OpenAI-style SSE: "data: {json}" lines, terminated by "data: [DONE]".
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
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === '[DONE]') return;
      try {
        const token = JSON.parse(payload).choices?.[0]?.delta?.content;
        if (token) yield token;
      } catch {
        // skip keep-alive / partial lines
      }
    }
  }
}

// Connectivity/auth check — used by the health route if wired in.
async function openrouterPing() {
  const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({
      model: FAST_MODEL,
      messages: [{ role: 'user', content: 'ok' }],
      max_tokens: 1,
      stream: false,
    }),
  });
  return res.ok;
}

// Exported under the groqOnce/groqStream names so the pipeline needs no other changes.
module.exports = {
  groqOnce: openrouterOnce,
  groqStream: openrouterStream,
  groqPing: openrouterPing,
  GROQ_FAST_MODEL: FAST_MODEL,
  GROQ_SMART_MODEL: SMART_MODEL,
};
