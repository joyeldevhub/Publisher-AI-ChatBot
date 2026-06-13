const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { ragStream, hasKeywordOverlap, isDomainRelated } = require('../services/ragPipeline');
const { parseFile, analyzeJATSXML } = require('../services/fileParser');
const { searchSimilar } = require('../services/vectorStore');

const router = express.Router();
const upload = multer({
  dest: path.join(__dirname, '../../uploads/'),
  limits: { fileSize: 20 * 1024 * 1024 },
});

// Filter XML issues to only those related to the user's reported error.
// e.g. "PMC error permissions" → only show permissions-related issues, not all 15.
function focusIssuesForError(issues, userMsg) {
  if (!issues.length || !userMsg) return issues;
  const msg = userMsg.toLowerCase();
  const focus = new Set();

  if (/permission|license|copyright|open.?access/.test(msg))           { focus.add('permission'); focus.add('license'); focus.add('copyright'); }
  if (/doi|article.?id|identifier/.test(msg))                          { focus.add('article-id'); focus.add('doi'); }
  if (/pmid|pmc|pubmed/.test(msg))                                     { focus.add('pmid'); focus.add('pmc'); focus.add('license'); focus.add('permission'); }
  if (/author|contrib|affili|aff\b/.test(msg))                         { focus.add('contrib'); focus.add('aff'); }
  if (/ref\b|citation|bibliograph|element.citation|reference/.test(msg)){ focus.add('ref'); focus.add('citation'); focus.add('pub-id'); }
  if (/fig\b|figure|graphic|image/.test(msg))                          { focus.add('fig'); focus.add('graphic'); }
  if (/table/.test(msg))                                                { focus.add('table'); }
  if (/abstract/.test(msg))                                             { focus.add('abstract'); }
  if (/pub.?date|date/.test(msg))                                       { focus.add('pub-date'); }
  if (/keyword|kwd/.test(msg))                                          { focus.add('kwd'); focus.add('keyword'); }
  if (/funding|grant/.test(msg))                                        { focus.add('funding'); }
  if (/journal|issn/.test(msg))                                         { focus.add('journal'); focus.add('issn'); }
  if (/history|received|accepted/.test(msg))                            { focus.add('history'); }
  if (/volume|fpage|lpage|page/.test(msg))                              { focus.add('volume'); focus.add('fpage'); }

  // DTD / Probe with no specific element → return all structural issues
  if (focus.size === 0) return issues;

  const filtered = issues.filter(iss => [...focus].some(k => iss.toLowerCase().includes(k)));
  return filtered.length > 0 ? filtered : issues;
}

router.post('/stream', upload.array('files', 5), async (req, res) => {
  const message = (req.body.message || '').trim();
  const files = req.files || [];

  if (!message && files.length === 0) {
    return res.status(400).json({ error: 'Message or file is required' });
  }

  let history = [];
  try {
    const raw = req.body.history;
    if (raw) history = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch { history = []; }

  // Extract text from uploaded files; XML files get JATS structural analysis
  let attachedText = '';
  let xmlIssues = [];

  if (files.length > 0) {
    try {
      const results = await Promise.all(
        files.map(async (f) => {
          const ext = path.extname(f.originalname).toLowerCase();
          const isXML = ext === '.xml' || f.mimetype === 'text/xml' || f.mimetype === 'application/xml';
          if (isXML) {
            const xmlText = fs.readFileSync(f.path, 'utf-8');
            const analysis = analyzeJATSXML(xmlText);
            const focused = focusIssuesForError(analysis.issues, message);
            xmlIssues = [...xmlIssues, ...focused];
            const header = `[JATS XML ANALYSIS — ${focused.length} issue(s) related to your error]\n`;
            const body = focused.map((iss, i) => `${i + 1}. ${iss}`).join('\n')
              || analysis.issues.map((iss, i) => `${i + 1}. ${iss}`).join('\n');
            return `${header}${body}`;
          }
          return parseFile(f.path, f.mimetype, f.originalname).catch(() => '');
        })
      );
      attachedText = results.filter(Boolean).join('\n\n---\n\n');
    } finally {
      files.forEach((f) => fs.unlink(f.path, () => {}));
    }
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    for await (const chunk of ragStream(message, attachedText, history, 'full', xmlIssues)) {
      res.write(`data: ${chunk}\n\n`);
    }
  } catch (err) {
    console.error('Chat stream error:', err);
    res.write(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`);
  } finally {
    res.write('data: [DONE]\n\n');
    res.end();
  }
});

const KB_CONFIRM_THRESHOLD = 0.58;

router.post('/find', async (req, res) => {
  const { message } = req.body;
  if (!message?.trim()) return res.json({ matches: [] });
  try {
    const domainOk = await isDomainRelated(message.trim());
    if (!domainOk) return res.json({ matches: [], domainOk: false });

    const results = await searchSimilar(message.trim(), 3);
    const confident = results
      .filter((r) => r.score >= KB_CONFIRM_THRESHOLD)
      .filter((r) => hasKeywordOverlap(message.trim(), r));

    res.json({
      matches: confident.map((r) => ({
        id: r.id, title: r.title, category: r.category,
        score: r.score, solution: r.solution, error_description: r.error_description,
      })),
      domainOk: true,
    });
  } catch {
    res.json({ matches: [] });
  }
});

module.exports = router;
