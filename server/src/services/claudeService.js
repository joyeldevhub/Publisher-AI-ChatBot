const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Fast model for everything by default. Set CLAUDE_SMART_MODEL to a stronger model
// (e.g. a Sonnet) if you want the "smart" tasks (relevance, classification) upgraded.
const FAST_MODEL  = process.env.CLAUDE_FAST_MODEL  || 'claude-haiku-4-5-20251001';
const SMART_MODEL = process.env.CLAUDE_SMART_MODEL || 'claude-haiku-4-5-20251001';

// Claude requires the first message to be from "user" and roles to alternate.
// Normalize chat history: drop leading assistant turns and collapse any accidental
// consecutive same-role messages so the API never rejects the request.
function normalizeHistory(history = []) {
  const out = [];
  for (const m of history) {
    if (!m || !m.content) continue;
    const role = m.role === 'assistant' ? 'assistant' : 'user';
    if (out.length === 0 && role === 'assistant') continue; // can't start with assistant
    if (out.length > 0 && out[out.length - 1].role === role) {
      out[out.length - 1].content += `\n${m.content}`; // merge same-role neighbours
    } else {
      out.push({ role, content: m.content });
    }
  }
  return out;
}

// One-shot completion — classify, reformulate, titles, synthesis, relevance, etc.
// Mirrors the old groqOnce(systemPrompt, userMessage, { smart, maxTokens, temperature }).
async function claudeOnce(systemPrompt, userMessage, options = {}) {
  const { smart = false, maxTokens = 3000, temperature = 0 } = options;
  const model = smart ? SMART_MODEL : FAST_MODEL;

  try {
    const message = await client.messages.create({
      model,
      max_tokens: maxTokens,
      temperature,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });
    return message.content?.[0]?.text || '';
  } catch (err) {
    console.error('[Claude] claudeOnce failed:', err.message);
    return '';
  }
}

// Streaming chat — yields text deltas for real-time responses.
// Mirrors the old groqStream(systemPrompt, userMessage, history).
async function* claudeStream(systemPrompt, userMessage, history = []) {
  const historyMessages = normalizeHistory(
    history.map((m) => ({
      role: m.role,
      content: m.role === 'assistant'
        ? m.content.slice(0, 600) + (m.content.length > 600 ? '…' : '')
        : m.content,
    }))
  );

  // Ensure the final user turn doesn't collide with a trailing user history message.
  const messages = [...historyMessages];
  if (messages.length > 0 && messages[messages.length - 1].role === 'user') {
    messages[messages.length - 1].content += `\n${userMessage}`;
  } else {
    messages.push({ role: 'user', content: userMessage });
  }

  try {
    const stream = await client.messages.create({
      model: SMART_MODEL,
      max_tokens: 800,
      temperature: 0.3,
      system: systemPrompt,
      messages,
      stream: true,
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
        if (event.delta.text) yield event.delta.text;
      }
    }
  } catch (err) {
    console.error('[Claude] claudeStream failed:', err.message);
  }
}

// Lightweight connectivity/auth check — a minimal 1-token call. Used by the health route.
async function claudePing() {
  const message = await client.messages.create({
    model: FAST_MODEL,
    max_tokens: 1,
    messages: [{ role: 'user', content: 'ok' }],
  });
  return !!message;
}

// Existing document-extraction helper (kept for compatibility).
async function claudeExtractEntries(documentText) {
  const message = await client.messages.create({
    model: FAST_MODEL,
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: `You are a knowledge base builder for DocFlow, a publishing support chatbot covering citations, XML, validation, proofreading, and standards.
Analyze the document and extract every distinct issue/problem and its solution.

Return ONLY a valid JSON array — no explanation, no markdown, no code fences.
Each object must have exactly these keys:
- "title": short issue title (max 80 chars)
- "category": one of: Citations & References, Proofreading & Editing, XML & Structure, DTD & Validation, Tables & Formatting, EPUB & PDF, Standards & Validation, Fonts & Colors, Images & Media, Metadata, General Best Practices
- "error_description": 2-3 sentences describing the problem clearly
- "solution": numbered step-by-step fix

Document content:
${documentText.slice(0, 8000)}`,
      },
    ],
  });

  return message.content?.[0]?.text || '';
}

// Exported under the groqOnce/groqStream names so call sites need no changes.
module.exports = {
  groqOnce: claudeOnce,
  groqStream: claudeStream,
  claudePing,
  claudeExtractEntries,
  FAST_MODEL,
  SMART_MODEL,
};
