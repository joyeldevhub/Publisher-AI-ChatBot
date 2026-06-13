const https = require('https');
const zlib = require('zlib');

// Stack Exchange sites searched in order of relevance for e-publishing topics
const SE_SITES = ['tex', 'academia', 'stackoverflow'];

function soGet(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.stackexchange.com',
      path: `/2.3${path}`,
      headers: {
        'Accept-Encoding': 'gzip',
        'User-Agent': 'SupportBot/1.0',
      },
    };

    const req = https.request(options, (res) => {
      const gunzip = zlib.createGunzip();
      let data = '';
      res.pipe(gunzip);
      gunzip.on('data', (chunk) => { data += chunk; });
      gunzip.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve({ items: [] }); }
      });
      gunzip.on('error', () => resolve({ items: [] }));
    });

    req.setTimeout(8000, () => { req.destroy(); resolve({ items: [] }); });
    req.on('error', () => resolve({ items: [] }));
    req.end();
  });
}

function stripHtml(html = '') {
  return html
    .replace(/<pre[^>]*>[\s\S]*?<\/pre>/gi, (m) =>
      '\n```\n' + m.replace(/<[^>]+>/g, '').trim() + '\n```\n'
    )
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function searchOneSite(query, site, maxResults) {
  const searchPath = `/search/advanced?q=${encodeURIComponent(query)}&site=${site}` +
    `&order=desc&sort=relevance&pagesize=${maxResults * 2}&filter=default`;

  const data = await soGet(searchPath);
  return (data.items || [])
    .filter((q) => q.is_answered || q.answer_count > 0)
    .slice(0, maxResults)
    .map((q) => ({
      title: q.title,
      url: q.link,
      tags: (q.tags || []).join(', '),
      site,
    }));
}

async function searchWeb(query, maxResults = 3) {
  try {
    // Search all relevant sites in parallel
    const allResults = await Promise.all(
      SE_SITES.map((site) => searchOneSite(query, site, maxResults).catch(() => []))
    );

    // Merge: tex > academia > stackoverflow, deduplicate by title similarity, take top N
    const seen = new Set();
    const merged = [];
    for (const siteResults of allResults) {
      for (const r of siteResults) {
        const key = r.title.toLowerCase().slice(0, 40);
        if (!seen.has(key)) {
          seen.add(key);
          merged.push(r);
        }
        if (merged.length >= maxResults) break;
      }
      if (merged.length >= maxResults) break;
    }

    return merged;
  } catch (err) {
    console.error('[webSearch] Search failed:', err.message);
    return [];
  }
}

module.exports = { searchWeb };
