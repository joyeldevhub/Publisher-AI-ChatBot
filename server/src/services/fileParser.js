const mammoth = require('mammoth');
const Tesseract = require('tesseract.js');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

// ── JATS XML structural analyzer ─────────────────────────────────────────────
// Checks all required JATS elements and returns a structured issues list.
// Output format is designed to be used as KB search query AND LLM context.
function analyzeJATSXML(xmlText) {
  const $ = cheerio.load(xmlText, { xmlMode: true });
  const issues = [];

  // ── article-id checks ──────────────────────────────────────────────────────
  const idTypes = [];
  $('article-id').each((_, el) => idTypes.push($(el).attr('pub-id-type') || ''));
  if (!idTypes.includes('doi'))  issues.push('article-meta: missing <article-id pub-id-type="doi">');
  if (!idTypes.includes('pmid') && !idTypes.includes('pmc'))
    issues.push('article-meta: missing <article-id pub-id-type="pmid"> (required for PMC submission)');

  // ── journal-meta checks ────────────────────────────────────────────────────
  if ($('journal-id').length === 0)    issues.push('journal-meta: missing <journal-id>');
  if ($('journal-title').length === 0) issues.push('journal-meta: missing <journal-title>');
  if ($('issn').length === 0)          issues.push('journal-meta: missing <issn>');
  if ($('publisher-name').length === 0)issues.push('journal-meta: missing <publisher-name>');

  // ── article-meta required fields ───────────────────────────────────────────
  if ($('abstract').length === 0) issues.push('article-meta: missing <abstract>');
  if ($('kwd-group').length === 0) issues.push('article-meta: missing <kwd-group> (keywords)');
  if ($('pub-date').length === 0)  issues.push('article-meta: missing <pub-date>');

  $('pub-date').each((i, el) => {
    const type = $(el).attr('pub-type') || $(el).attr('date-type') || '';
    if (!type) issues.push(`pub-date #${i + 1}: missing pub-type or date-type attribute`);
    if (!$(el).find('year').length) issues.push(`pub-date #${i + 1}: missing <year> element`);
  });

  if ($('volume').length === 0) issues.push('article-meta: missing <volume>');
  if ($('fpage').length === 0 && $('elocation-id').length === 0)
    issues.push('article-meta: missing <fpage>/<lpage> or <elocation-id>');

  // ── permissions ────────────────────────────────────────────────────────────
  if ($('permissions').length === 0)         issues.push('article-meta: missing <permissions> block');
  if ($('copyright-statement').length === 0) issues.push('permissions: missing <copyright-statement>');
  if ($('license').length === 0)             issues.push('permissions: missing <license> element (required for PMC/open-access)');

  // ── contrib-group / authors ────────────────────────────────────────────────
  if ($('contrib-group').length === 0) {
    issues.push('article-meta: missing <contrib-group>');
  } else {
    $('contrib').each((i, el) => {
      if (!$(el).find('name,collab').length)
        issues.push(`contrib #${i + 1}: missing <name> or <collab>`);
    });
    // Affiliations without labels
    $('aff').each((i, el) => {
      if (!$(el).find('label').length && !$(el).attr('id'))
        issues.push(`aff #${i + 1}: missing <label> in affiliation`);
    });
  }

  // ── history dates ──────────────────────────────────────────────────────────
  if ($('history date').length === 0) issues.push('article-meta: missing <history> dates (received/accepted)');

  // ── abstract structure ─────────────────────────────────────────────────────
  $('abstract').each((_, abs) => {
    if (!$(abs).find('p').length && !$(abs).find('sec').length)
      issues.push('abstract: no <p> or <sec> content found inside abstract');
  });

  // ── figures ────────────────────────────────────────────────────────────────
  $('fig').each((i, el) => {
    if (!$(el).find('label').length)   issues.push(`fig #${i + 1}: missing <label>`);
    if (!$(el).find('caption').length) issues.push(`fig #${i + 1}: missing <caption>`);
    if (!$(el).find('graphic').length) issues.push(`fig #${i + 1}: missing <graphic>`);
  });

  // ── tables ─────────────────────────────────────────────────────────────────
  $('table-wrap').each((i, el) => {
    if (!$(el).find('label').length)   issues.push(`table-wrap #${i + 1}: missing <label>`);
    if (!$(el).find('caption').length) issues.push(`table-wrap #${i + 1}: missing <caption>`);
  });

  // ── references ─────────────────────────────────────────────────────────────
  const refs = $('ref');
  refs.each((i, el) => {
    const hasCitation = $(el).find('element-citation,mixed-citation').length > 0;
    if (!hasCitation) issues.push(`ref #${i + 1}: missing <element-citation> or <mixed-citation>`);

    // element-citation checks
    $(el).find('element-citation').each((_, cit) => {
      if (!$(cit).find('person-group,collab').length) issues.push(`ref #${i + 1}: citation missing <person-group>`);
      if (!$(cit).find('year').length) issues.push(`ref #${i + 1}: citation missing <year>`);
      if (!$(cit).find('pub-id').length) issues.push(`ref #${i + 1}: citation missing <pub-id> (doi/pmid)`);
    });
  });

  // ── funding ────────────────────────────────────────────────────────────────
  if ($('funding-group').length === 0) issues.push('article-meta: missing <funding-group> (may be required by journal)');

  // ── Build structured output ────────────────────────────────────────────────
  const articleTitle = $('article-title').first().text().replace(/<[^>]+>/g, '').trim().slice(0, 100);
  const journal = $('journal-title').text().trim();
  const category = $('subj-group').first().find('subject').first().text().trim();
  const refCount = refs.length;
  const figCount = $('fig').length;

  let output = `[JATS XML STRUCTURE ANALYSIS]\n`;
  output += `Article: ${articleTitle || 'Unknown'}\n`;
  output += `Journal: ${journal || 'Unknown'} | Category: ${category || 'Unknown'}\n`;
  output += `References: ${refCount} | Figures: ${figCount}\n\n`;

  if (issues.length === 0) {
    output += `✓ No structural issues detected.\n`;
  } else {
    output += `Issues found (${issues.length}):\n`;
    issues.forEach((iss, i) => { output += `${i + 1}. ${iss}\n`; });
  }

  output += `\n[RAW XML EXCERPT — first 3000 chars]\n${xmlText.slice(0, 3000)}`;

  return { text: output, issues, issueCount: issues.length };
}

// ── Main file parser ──────────────────────────────────────────────────────────
async function parseFile(filePath, mimetype, originalName) {
  const ext = path.extname(originalName).toLowerCase();

  // JATS XML — structural analysis
  if (ext === '.xml' || mimetype === 'text/xml' || mimetype === 'application/xml') {
    const xmlText = fs.readFileSync(filePath, 'utf-8');
    const { text } = analyzeJATSXML(xmlText);
    return text;
  }

  // DOCX
  if (ext === '.docx' || mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value.trim();
  }

  // PDF — extract text (lazy-require so it only loads when needed)
  if (ext === '.pdf' || mimetype === 'application/pdf') {
    const pdfParse = require('pdf-parse');
    const dataBuffer = fs.readFileSync(filePath);
    const { text } = await pdfParse(dataBuffer);
    return text.trim();
  }

  // Images — OCR
  if (mimetype.startsWith('image/')) {
    const { data } = await Tesseract.recognize(filePath, 'eng');
    return data.text.trim();
  }

  // Plain text, scripts, logs, etc.
  return fs.readFileSync(filePath, 'utf-8').trim();
}

// ── Document chunker ──────────────────────────────────────────────────────────
// Splits full document text into overlapping passages for full-text (NotebookLM-
// style) indexing — so nothing in the document is lost. Prefers paragraph/sentence
// boundaries near the target size, and overlaps chunks for context continuity.
function chunkText(text, { size = 1000, overlap = 150, maxChunks = 300 } = {}) {
  const clean = (text || '').replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (!clean) return [];
  if (clean.length <= size) return [clean];

  const chunks = [];
  let start = 0;
  while (start < clean.length && chunks.length < maxChunks) {
    let end = Math.min(start + size, clean.length);
    if (end < clean.length) {
      const slice = clean.slice(start, end);
      const para = slice.lastIndexOf('\n\n');
      const sentence = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('.\n'), slice.lastIndexOf('! '), slice.lastIndexOf('? '));
      // Only break early if the boundary is past the halfway point (avoids tiny chunks)
      if (para > size * 0.5) end = start + para;
      else if (sentence > size * 0.5) end = start + sentence + 1;
    }
    const chunk = clean.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    if (end >= clean.length) break;
    start = Math.max(end - overlap, start + 1);
  }
  return chunks;
}

module.exports = { parseFile, analyzeJATSXML, chunkText };
