const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const LOG_PATH = path.join(__dirname, '../../data/logs.json');
const MAX_LOGS = 300;

function readLogs() {
  try {
    if (!fs.existsSync(LOG_PATH)) return [];
    return JSON.parse(fs.readFileSync(LOG_PATH, 'utf-8'));
  } catch {
    return [];
  }
}

function writeLogs(logs) {
  fs.writeFileSync(LOG_PATH, JSON.stringify(logs, null, 2));
}

/**
 * @param {object} opts
 * @param {string}  opts.query         - User query (truncated to 200 chars)
 * @param {string}  opts.type          - 'kb_hit' | 'web_search' | 'no_results' | 'conversational' | 'escalation' | 'repeat'
 * @param {number}  opts.kbHits        - Number of KB results found
 * @param {boolean} opts.webSearch     - Whether web search was performed
 * @param {number}  opts.responseMs    - Total response time in ms
 * @param {Array}   opts.sources       - KB source titles (if any)
 */
function logRequest(opts) {
  try {
    const logs = readLogs();
    logs.unshift({
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      query: (opts.query || '').slice(0, 200),
      type: opts.type || 'unknown',
      kbHits: opts.kbHits ?? 0,
      webSearch: opts.webSearch ?? false,
      responseMs: opts.responseMs ?? 0,
      sources: (opts.sources || []).slice(0, 3).map((s) => s.title || s),
    });
    writeLogs(logs.slice(0, MAX_LOGS));
  } catch (err) {
    console.warn('[logger] Failed to write log:', err.message);
  }
}

function getLogs() {
  return readLogs();
}

module.exports = { logRequest, getLogs };
