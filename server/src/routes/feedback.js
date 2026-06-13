const express = require('express');
const { boostEntries } = require('../services/vectorStore');
const { sendThumbsDownAlert } = require('../services/emailService');

const router = express.Router();

// Thumbs up — user confirms the answer was helpful
// Boosts helpfulness score on the KB entries that generated the answer
// so they rank higher in future similar searches
router.post('/thumbsup', async (req, res) => {
  const { question, sourceIds = [] } = req.body;
  if (!question?.trim()) {
    return res.status(400).json({ error: 'question is required' });
  }
  try {
    if (sourceIds.length > 0) {
      boostEntries(sourceIds);
      console.log(`[feedback] 👍 Boosted ${sourceIds.length} KB entries for: "${question.slice(0, 50)}"`);
    } else {
      console.log(`[feedback] 👍 Thumbs up (no KB sources to boost): "${question.slice(0, 50)}"`);
    }
    res.json({ success: true });
  } catch (err) {
    console.error('[feedback/thumbsup]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Thumbs down — response wasn't helpful → email alert
router.post('/thumbsdown', async (req, res) => {
  const { question, answer } = req.body;
  if (!question?.trim() || !answer?.trim()) {
    return res.status(400).json({ error: 'question and answer are required' });
  }
  try {
    await sendThumbsDownAlert(question, answer);
    console.log(`[feedback] 👎 Alert sent for: "${question.slice(0, 50)}"`);
    res.json({ success: true });
  } catch (err) {
    console.error('[feedback/thumbsdown]', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
