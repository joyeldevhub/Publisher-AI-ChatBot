const { Ollama } = require('ollama');

const ollama = new Ollama({
  host: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
});

const CHAT_MODEL = process.env.OLLAMA_CHAT_MODEL || 'qwen3:8b';
const EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text';
// Keep the embedding model resident in memory between calls (avoids slow reloads).
const KEEP_ALIVE = process.env.OLLAMA_KEEP_ALIVE || '30m';

// Embeddings are deterministic for a fixed model, so cache by text. This skips
// the Ollama round-trip for repeated queries (and the raw/reformulated overlap).
const embedCache = new Map();
const EMBED_CACHE_MAX = 500;

async function getEmbedding(text) {
  const cached = embedCache.get(text);
  if (cached) return cached;

  const response = await ollama.embeddings({
    model: EMBED_MODEL,
    prompt: text,
    keep_alive: KEEP_ALIVE,
  });
  const embedding = response.embedding;

  if (embedCache.size >= EMBED_CACHE_MAX) {
    embedCache.delete(embedCache.keys().next().value); // evict oldest (FIFO)
  }
  embedCache.set(text, embedding);
  return embedding;
}

async function* streamChat(systemPrompt, userMessage, history = []) {
  const historyMessages = history.map((m) => ({
    role: m.role,
    content: m.role === 'assistant'
      ? m.content.slice(0, 600) + (m.content.length > 600 ? '…' : '')
      : m.content,
  }));

  const stream = await ollama.chat({
    model: CHAT_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      ...historyMessages,
      { role: 'user', content: userMessage },
    ],
    stream: true,
    options: {
      num_ctx: 2048,   // smaller context = faster attention
      num_predict: 600, // cap output length
    },
  });

  for await (const chunk of stream) {
    if (chunk.message?.content) {
      yield chunk.message.content;
    }
  }
}

async function chatOnce(systemPrompt, userMessage, options = {}) {
  const response = await ollama.chat({
    model: CHAT_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    stream: false,
    options: { num_ctx: 4096, num_predict: 3000, ...options },
  });
  return response.message.content;
}

// Minimal YES/NO classification — fast, thinking disabled for qwen3
async function classify(systemPrompt, userMessage) {
  const response = await ollama.chat({
    model: CHAT_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `/no_think\n${userMessage}` },
    ],
    stream: false,
    options: { num_ctx: 512, num_predict: 10, temperature: 0 },
  });
  const raw = response.message.content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  return raw;
}

// Short text generation — used for query reformulation, thinking disabled for qwen3
async function reformulate(systemPrompt, userMessage) {
  const response = await ollama.chat({
    model: CHAT_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `/no_think\n${userMessage}` },
    ],
    stream: false,
    options: { num_ctx: 512, num_predict: 40, temperature: 0 },
  });
  const raw = response.message.content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  return raw;
}

module.exports = { getEmbedding, streamChat, chatOnce, classify, reformulate, CHAT_MODEL, EMBED_MODEL };