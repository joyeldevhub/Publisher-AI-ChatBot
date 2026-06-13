const express = require('express');
const { requireAdmin } = require('../middleware/auth');
const { getLogs } = require('../services/logger');

const router = express.Router();

router.get('/', requireAdmin, (req, res) => {
  try {
    res.json(getLogs());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
