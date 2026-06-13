const express = require('express');
const {
  listConversations,
  getConversation,
  createConversation,
  saveConversation,
  deleteConversation,
} = require('../db/conversations');
const { requireUser } = require('../middleware/auth');

const router = express.Router();
router.use(requireUser);

// List all (non-expired) conversations as sidebar summaries
router.get('/', (req, res) => {
  res.json(listConversations(req.user.userId));
});

// Create a new empty conversation
router.post('/', (req, res) => {
  res.json(createConversation(req.user.userId));
});

// Get one conversation with its full message history
router.get('/:id', (req, res) => {
  const convo = getConversation(req.params.id);
  if (!convo) return res.status(404).json({ error: 'Conversation not found' });
  if (convo.userId !== req.user.userId) return res.status(403).json({ error: 'Forbidden' });
  res.json(convo);
});

// Save messages for a conversation (and auto-title it on first save)
router.put('/:id', async (req, res) => {
  const { messages } = req.body || {};
  if (!Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array is required' });
  }
  const convo = await saveConversation(req.params.id, messages);
  if (!convo) return res.status(404).json({ error: 'Conversation not found' });
  if (convo.userId !== req.user.userId) return res.status(403).json({ error: 'Forbidden' });
  res.json({ id: convo.id, title: convo.title, updatedAt: convo.updatedAt });
});

// Delete a conversation
router.delete('/:id', (req, res) => {
  const convo = getConversation(req.params.id);
  if (!convo) return res.status(404).json({ error: 'Conversation not found' });
  if (convo.userId !== req.user.userId) return res.status(403).json({ error: 'Forbidden' });
  res.json({ ok: deleteConversation(req.params.id) });
});

module.exports = router;
