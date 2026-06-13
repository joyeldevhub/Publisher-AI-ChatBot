const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { groqOnce } = require('../services/groqService');

const DATA_DIR = path.join(__dirname, '../../data');
const DB_PATH = path.join(DATA_DIR, 'conversations.json');

const TTL_MS = 24 * 60 * 60 * 1000; // conversations expire 24 hours after their last update
// Conversation length is unlimited for now — add a message cap before production if needed.

function readAll() {
  try {
    if (!fs.existsSync(DB_PATH)) return [];
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
  } catch {
    return [];
  }
}

function writeAll(list) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(list, null, 2));
}

// Drop conversations untouched for longer than TTL_MS. Persists if anything changed.
function prune(list) {
  const cutoff = Date.now() - TTL_MS;
  const kept = list.filter((c) => new Date(c.updatedAt).getTime() >= cutoff);
  if (kept.length !== list.length) writeAll(kept);
  return kept;
}

// Sidebar summaries — newest first, no message bodies. Filter by userId if provided.
function listConversations(userId) {
  let convos = prune(readAll());
  if (userId) convos = convos.filter((c) => c.userId === userId);
  return convos
    .map((c) => ({ id: c.id, title: c.title, createdAt: c.createdAt, updatedAt: c.updatedAt }))
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

function getConversation(id) {
  return prune(readAll()).find((c) => c.id === id) || null;
}

function createConversation(userId) {
  const list = readAll();
  const now = new Date().toISOString();
  const convo = { id: uuidv4(), userId, title: 'New chat', createdAt: now, updatedAt: now, messages: [] };
  list.push(convo);
  writeAll(list);
  return convo;
}

async function saveConversation(id, messages) {
  const list = readAll();
  const convo = list.find((c) => c.id === id);
  if (!convo) return null;

  convo.messages = Array.isArray(messages) ? messages : [];
  convo.updatedAt = new Date().toISOString();

  // Generate a title once, from the first real user message (like ChatGPT).
  if (!convo.title || convo.title === 'New chat') {
    const firstUser = convo.messages.find((m) => m.role === 'user' && m.content);
    if (firstUser) convo.title = await generateTitle(firstUser.content);
  }

  writeAll(list);
  return convo;
}

function deleteConversation(id) {
  const list = readAll();
  const next = list.filter((c) => c.id !== id);
  writeAll(next);
  return next.length !== list.length;
}

const TITLE_PROMPT = `Generate a short, specific title (3 to 6 words) summarizing this support question. No quotes, no trailing punctuation. Reply with ONLY the title.`;

// Fails safe — falls back to a trimmed version of the user's message.
async function generateTitle(firstMessage) {
  const fallback = firstMessage.trim().slice(0, 40) || 'New chat';
  try {
    const raw = await groqOnce(TITLE_PROMPT, firstMessage.slice(0, 500), { smart: false, maxTokens: 20 });
    const clean = raw.replace(/^["'`\s]+/, '').replace(/["'`\s.]+$/, '').trim();
    return clean.length >= 2 && clean.length <= 60 ? clean : fallback;
  } catch {
    return fallback;
  }
}

module.exports = {
  listConversations,
  getConversation,
  createConversation,
  saveConversation,
  deleteConversation,
};
