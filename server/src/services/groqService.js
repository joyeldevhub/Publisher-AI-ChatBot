const Groq = require('groq-sdk');

// Use a placeholder if the key is missing so construction never throws — a real call
// will then fail (and the pipeline shows a safe "assistant busy" message).
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || 'missing-key' });

// llama-3.3-70b for quality tasks; 8b-instant for fast classify/reformulate.
const GROQ_FAST_MODEL  = process.env.GROQ_FAST_MODEL  || 'llama-3.1-8b-instant';
const GROQ_SMART_MODEL = process.env.GROQ_SMART_MODEL || 'llama-3.3-70b-versatile';

// One-shot completion — classify, reformulate, analyze-doc, titles.
// On failure returns '' (no local fallback) — internal callers degrade gracefully, and
// user-facing answers fall back to a safe support message rather than a hallucinated one.
async function groqOnce(systemPrompt, userMessage, options = {}) {
  const { smart = false, maxTokens = 3000, temperature = 0 } = options;
  const model = smart ? GROQ_SMART_MODEL : GROQ_FAST_MODEL;

  try {
    const response = await groq.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature,
      max_tokens: maxTokens,
      stream: false,
    });
    return response.choices[0]?.message?.content || '';
  } catch (err) {
    console.warn('[Groq] groqOnce failed:', err.message);
    return '';
  }
}

// Streaming chat — for real-time user responses. No local fallback: if Groq can't be
// reached, this THROWS so the pipeline can show a safe "assistant busy → support" message
// instead of risking a hallucinated answer from a weak local model.
async function* groqStream(systemPrompt, userMessage, history = []) {
  const historyMessages = history.map((m) => ({
    role: m.role,
    content: m.role === 'assistant'
      ? m.content.slice(0, 600) + (m.content.length > 600 ? '…' : '')
      : m.content,
  }));

  const stream = await groq.chat.completions.create({
    model: GROQ_SMART_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      ...historyMessages,
      { role: 'user', content: userMessage },
    ],
    temperature: 0.3,
    max_tokens: 800,
    stream: true,
  });

  for await (const chunk of stream) {
    const token = chunk.choices[0]?.delta?.content;
    if (token) yield token;
  }
}

// Direct Groq connectivity/auth check — used by the health route.
async function groqPing() {
  const response = await groq.chat.completions.create({
    model: GROQ_FAST_MODEL,
    messages: [{ role: 'user', content: 'ok' }],
    max_tokens: 1,
    stream: false,
  });
  return !!response;
}

module.exports = { groqOnce, groqStream, groqPing, GROQ_FAST_MODEL, GROQ_SMART_MODEL };
