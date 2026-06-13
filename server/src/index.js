const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const knowledgeRoutes = require('./routes/knowledge');
const authRoutes = require('./routes/auth');
const chatRoutes = require('./routes/chat');
const conversationRoutes = require('./routes/conversations');
const feedbackRoutes = require('./routes/feedback');
const logsRoutes = require('./routes/logs');
const healthCheckRoutes = require('./routes/healthCheck');
const { initDB } = require('./db/init');
const { seedCompanyInfo } = require('./db/companyInfo');
const { requireUser } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3001;

// Ensure uploads and images directories exist
const uploadsDir = path.join(__dirname, '../uploads');
const imagesDir  = path.join(__dirname, '../data/images');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
if (!fs.existsSync(imagesDir))  fs.mkdirSync(imagesDir,  { recursive: true });

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve saved KB screenshots
app.use('/kb-images', express.static(imagesDir));

initDB();
// Entries are created ONLY via "Add Entry"; documents are added via "Import Document".
// Company info is no longer auto-seeded. (Re-enable seedCompanyInfo() to bring back the
// built-in DocFlow company/support entries.)
// seedCompanyInfo();

app.use('/api/auth', authRoutes);
app.use('/api/knowledge', knowledgeRoutes);
app.use('/api/chat', requireUser, chatRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/logs', logsRoutes);
app.use('/api/health', healthCheckRoutes);

app.get('/api/ping', (req, res) => res.json({ status: 'ok' }));

// ── Serve the built React client (production / single-service deploy) ────────
const clientDist = path.join(__dirname, '../../client/dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  // SPA fallback: hand any non-API route to index.html so client-side routing works
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`\n  Support Bot server running → http://localhost:${PORT}\n`);
});
