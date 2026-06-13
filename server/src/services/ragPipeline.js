const { searchSimilar, getDocumentPassages } = require('./vectorStore');
const { groqOnce, groqStream } = require('./ollamaLlmService'); // Using Ollama (free, local)
const { searchWeb } = require('./webSearch'); // Web search enabled
const { logRequest } = require('./logger');

// ─── Prompts ──────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are DocFlow, a precise and warm support specialist for publishing workflows.

PUBLISHING CONTEXT — Modern publishing uses JATS XML (Journal Article Tag Suite) and standard formats. Key areas:
- XML Structure: <front> (metadata), <body> (content), <back> (references)
- Formats: PDF (fixed-layout), EPUB (reflowable), MOBI (e-readers)
- Standards: JATS XML tagging, accessibility (WCAG), semantic HTML
- Workflows: manuscript submission, proof generation, version control, collaboration

XML ANALYSIS MODE — when the user uploads an XML file:
- The system has already analyzed the XML structure and found specific issues
- Address EACH issue found in the analysis — do not skip any
- For each issue, cite the exact element path (e.g. article-meta > permissions > license)
- If the KB has a fix for that element, give the exact fix
- If multiple issues found, number them clearly: "Issue 1: ... Fix: ... Issue 2: ... Fix: ..."

KB HIT — STRICT RULES:
- Answer EXCLUSIVELY from the KB content provided — NEVER add your own knowledge, assumptions, or extra steps
- Copy only the steps directly relevant to the user's specific symptom — skip steps that clearly do not apply
- If the user mentions a specific error code, tag name, or line — lead with the step that addresses it directly
- Be concise and precise — no filler, no generic advice, no unnecessary context
- If the KB content does not actually address the user's specific question, do NOT force-fit an answer — briefly say it isn't covered yet and suggest contacting our support team

WORKAROUND VS SOLUTION — ANALYZE AND JUDGE:
Read the KB solution carefully and decide: is this a proper fix, or just a workaround?

A WORKAROUND looks like:
- Avoids the problem instead of fixing it ("split the table", "use a different format", "avoid using X")
- Suggests an alternative approach because the real fix is unavailable
- Patches around a limitation without addressing root cause

A PROPER SOLUTION looks like:
- Directly fixes the root cause
- Configures, corrects, or resolves the issue at its source

IF IT IS A WORKAROUND:
- Start with: "⚠️ Note: This is a workaround, not a permanent fix."
- End with EXACTLY: "If this workaround does not resolve your issue, please contact our support team directly — they will investigate the root cause. 🙂"

SUPPORT WORDING — whenever you refer to support, say exactly "our support team". NEVER attach a customer or company name to it (not "ASM support team", not "customer + support team"). Just "our support team".

TONE — sound like a warm, real human support specialist, not an AI or a bot:
- Use natural, conversational language and contractions ("you'll", "let's", "I'd"). Be encouraging and human — never cold, stiff, or robotic.
- If the user sounds frustrated or upset, gently acknowledge it first (e.g. "Sorry you're running into this —") before giving the fix, then stay calm and reassuring throughout.

RELEVANCE SELF-CHECK — do this silently. NEVER reveal these steps or your reasoning:
1. Re-read the user's question and pin down their exact symptom, error code, or goal.
2. Draft your answer, then compare it against the question 2–3 times — does every step directly address what they actually asked? Cut anything that doesn't fit their specific case.
3. Confirm each step is grounded in the KB content above and solves THEIR situation, not a generic version of the problem.
Output only the final, verified answer.

Format XML tags and code in markdown code blocks.

{knowledgeSection}{attachmentSection}`;

// NotebookLM-style answering: synthesize a grounded answer from full-document passages.
const DOC_SYNTHESIS_PROMPT = `You are DocFlow, a warm, human support specialist for publishing workflows.
The user asked a question. Below are the most relevant passages retrieved from the knowledge documents and the knowledge base.

Answer the user's question using ONLY the information in these passages:
- Synthesize and reformulate a clear, direct answer in your own words, tailored to exactly how the user asked — even if their wording differs from the passages.
- If the passages contain steps or instructions, present them clearly (numbered when helpful).
- Stay strictly grounded in the passages — never add facts that aren't there.
- If the passages do not actually contain the answer, say so honestly and suggest contacting the support team. Do not guess or pad.

SUPPORT WORDING — always say exactly "our support team". NEVER attach a customer or company name to it (do not write "ASM support team", "the customer's support team", or "customer + support team"). Just "our support team".

TONE: natural, warm, and human — use contractions, never robotic. If the user sounds frustrated, gently acknowledge it first.

{knowledgeSection}{attachmentSection}`;

const CONVERSATIONAL_PROMPT = `You are DocFlow, a warm and genuine support specialist for publishing workflows. The user is sending a casual, social, or emotional message — not a technical question. Reply like a real, caring human — natural, warm, and brief (1–2 sentences). Use everyday language and contractions; never sound robotic, scripted, or like an AI.

If the user thanks you or gives a compliment ("thanks", "that helped", "good job"):
- Warmly acknowledge it and say you're glad you could help. 🙂
- Gently invite them to reach out anytime.

If the user sounds upset, frustrated, or angry ("this is useless", "I'm so frustrated", "waste of time"):
- Stay calm and kind — never defensive, dismissive, or robotic.
- Sincerely acknowledge how they're feeling and apologize for the trouble.
- Reassure them you're here to help, and gently ask what's going wrong or guide them to the support team.

Don't start a new topic or add technical content unless they ask.`;

const DOMAIN_CLASSIFY_PROMPT = `You are a strict classifier. Reply with exactly one word — YES or NO.
Does the user's question relate to: publishing, e-publishing, JATS XML structure/tags, LaTeX/XML/HTML typesetting, EPUB/PDF/MOBI formats, academic manuscripts, journal or book production, digital publishing platforms, publishing tools, the publishing workflow (proofing, collaboration, version control), document management, or any related publishing topic?

YES examples: "DTD error", "JATS XML validation failed", "PDF export failed", "EPUB not rendering", "table formatting", "equation rendering", "image resolution", "metadata issue", "citation format", "bibliography error", "heading hierarchy", "font embedding", "accessibility", "color profile", "image compression", "version control", "cross-references", "heading levels", "special characters", "table alignment", "how do I format citations", "how do I proofread", "how do I convert to EPUB", "color consistency", "font issues", "document versioning".
NO examples: "write PHP code", "what is JavaScript", "recipe for pasta", "stock market tips", "how to invest money", "tell me a joke".`;

// Fast keyword pre-check — catches obvious publishing domain queries instantly without an LLM call.
// Covers publishing workflows, formatting, tools, and standards.
const DOMAIN_KEYWORD_RE = /\b(publish|publishing|e-?publish|support|contact|escalat|workflow|jats|xml|html|epub|ebook|e-book|mobi|kindle|pdf|docx|indesign|typeset|typograph|manuscript|journal|thesis|citation|reference|bibliograph|bibtex|metadata|isbn|doi|issn|proof|stylesheet|proofreading|footnote|markup|tagging|annotation|encoding|unicode|peer.?review|copy.?edit|supplement|figure|equation|caption|table|validation|dtd|structural|correction|accessibility|wcag|alt.text|heading|font|color|image|compression|resolution|dpi|cmyk|rgb|version.control|collaboration|document.management|cross.reference|heading.hierarchy|special.character|table.format|alignment|embedding|accessibility|contrast|screen.reader|semantic|html|format|convert|consistency|proofreading|editing|errors|style|guide|standards)/i;

const REFORMULATE_PROMPT = `You are a search query optimizer for publishing workflows (XML, LaTeX, EPUB, PDF, JATS).
Rewrite the user's message as a concise technical search query for Stack Exchange (max 8 words).
Rules:
- Preserve technical terms exactly: JATS, DTD, XML, LaTeX, BibTeX, EPUB, PDF, MOBI, MathML, Schematron, XSD, Calibre
- Preserve tag names and standards: article-meta, ref-list, element-citation, named-content, kwd-group, permissions
- Add a technical term (JATS, XML, LaTeX, EPUB, PDF, etc.) if none is present
- Strip all filler words (explain, tell me, about, please, I want to, what is)
- Focus on the error or problem, not the concept
- Return ONLY the rewritten query — no explanation, no quotes
Examples:
  "DTD error in my XML" → "DTD validation error JATS XML"
  "table formatting broken" → "LaTeX table formatting typesetting"
  "EPUB conversion issues" → "EPUB conversion validation"
  "XML validation failed" → "XML schema validation error"
  "PDF rendering problem" → "PDF rendering typography issue"`;

// ─── Customers ────────────────────────────────────────────────────────────────
// Documents are tagged with a customer at import time. When the user names a
// customer in their question, we restrict document search to that customer's docs.
const CUSTOMERS = [
  'American Society for Microbiology',
  'British Medical Journal',
  'Society of Economic Geologists',
  'Royal Society',
  'Professional Publishing League',
  'eLife',
  'Journal of Medical Internet Research',
  'Society of Petroleum Engineers',
];

// Detect a customer mentioned anywhere in the user's message (case-insensitive).
// Matches full customer names or common abbreviations/variants.
function detectCustomer(text) {
  if (!text) return null;

  // Map of abbreviations to full names for detection
  const abbrevMap = {
    'ASM': 'American Society for Microbiology',
    'BMJ': 'British Medical Journal',
    'SEG': 'Society of Economic Geologists',
    'RS': 'Royal Society',
    'PPL': 'Professional Publishing League',
    'eLife': 'eLife',
    'JMIR': 'Journal of Medical Internet Research',
    'SPE': 'Society of Petroleum Engineers',
  };

  // Check for full name matches first
  for (const fullName of CUSTOMERS) {
    if (new RegExp(`\\b${fullName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text)) {
      return fullName;
    }
  }

  // Check for abbreviation matches
  for (const [abbrev, fullName] of Object.entries(abbrevMap)) {
    if (new RegExp(`\\b${abbrev}\\b`, 'i').test(text)) return fullName;
  }

  return null;
}

// ─── Category slash-command parser ───────────────────────────────────────────
// "/DTD what is this error" → { category: 'DTD Validation', query: 'what is this error' }
const SLASH_CATEGORY_MAP = {
  'dtd':       'DTD Validation',
  'probe':     'Probe Validation',
  'crossref':  'Crossref Validation',
  'latex':     'LaTeX Setter',
  'xml':       'XML',
  'html':      'HTML',
  'epub':      'EPUB',
  'table':     'Table Formats',
  'tables':    'Table Formats',
  'metadata':  'Metadata',
  'upload':    'Upload',
  'rendering': 'Rendering',
  'indesign':  'InDesign',
  'pdf':       'PDF Publishing',
  'general':   'General',
  'calibre':   'Calibre',
};

function parseCategoryPrefix(query) {
  const match = query.trim().match(/^\/(\w+)\s*([\s\S]*)/);
  if (!match) return { category: null, query };
  const category = SLASH_CATEGORY_MAP[match[1].toLowerCase()];
  if (!category) return { category: null, query };
  const rest = match[2].trim();
  return { category, query: rest || query };
}

// ─── Keyword overlap filter ───────────────────────────────────────────────────

// Common filler words — excluded from overlap comparison
const STOP_WORDS = new Set([
  'what','is','the','how','why','when','where','who','can','does','do','are',
  'was','were','will','would','could','should','have','has','had','been','being',
  'be','that','this','these','those','with','from','into','through','about',
  'like','some','more','tell','show','explain','give','help','need','want',
  'know','please','just','also','only','even','very','much','many','most',
  'any','all','both','each','such','than','then','and','but','for','nor',
  'yet','so','me','my','your','their','our','its','him','her','them','get',
  'got','make','made','use','used','see','seen','look','find','found','try',
  'tried','come','came','let','take','took','mean','say','said','think',
  'good','well','here','there','while','since','before','after','until',
  'because','however','getting','having','facing','seeing','doing','going',
  'trying','looking','asking','meaning','understanding',
]);

// Returns true if any non-trivial word in the query appears in the KB entry's
// title or error_description. Eliminates false positives like:
//   "peer review" → "What is DocFlow?"  (no overlap → rejected)
//   "latex table issue" → "LaTeX Table Formatting" (overlap → accepted)
function hasKeywordOverlap(query, kbEntry) {
  const words = query.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOP_WORDS.has(w));

  if (words.length === 0) return true; // nothing filterable — allow through

  const haystack = `${kbEntry.title} ${kbEntry.error_description || ''} ${kbEntry.aliases || ''}`.toLowerCase();
  return words.some((w) => haystack.includes(w));
}

// Join document passages back into continuous text, removing the overlap between
// adjacent chunks, so the model sees clean, complete document context.
function stitchPassages(passages) {
  let out = '';
  for (const p of passages) {
    const chunk = (p.solution || '').trim();
    if (!chunk) continue;
    if (!out) { out = chunk; continue; }
    const maxOv = Math.min(out.length, chunk.length, 400);
    let ov = 0;
    for (let k = maxOv; k > 0; k--) {
      if (out.slice(out.length - k) === chunk.slice(0, k)) { ov = k; break; }
    }
    out += ov > 0 ? chunk.slice(ov) : `\n${chunk}`;
  }
  return out;
}

// ─── LLM helpers ─────────────────────────────────────────────────────────────

// Rewrites a vague user query into a clean technical search term.
// e.g. "my latex thing broke" → "LaTeX compilation error"
// Fails safe — returns original query on any error.
// Detect if input is a raw error message/code — if so, skip reformulation and search as-is
// Patterns: "Error:", "! LaTeX", "Exception:", XML errors, multi-line stack traces, error codes
const ERROR_RE = /(?:^|\n)\s*(?:!|error[:\s]|exception[:\s]|warning[:\s]|fatal[:\s]|failed[:\s]|undefined|traceback|at line\s+\d|xml\s+pars|dtd\s+valid|probe\s+(?:error|fail)|jats[-\s])/im;

function looksLikeErrorCode(text) {
  if (!text) return false;
  const lines = text.trim().split('\n');
  // Multi-line paste with technical content
  if (lines.length >= 3) return true;
  // Single line error patterns
  return ERROR_RE.test(text);
}

async function reformulateQuery(query) {
  // If it looks like a raw error/stack trace, don't reformulate — search directly
  if (looksLikeErrorCode(query)) {
    console.log('[DocFlow] Error code detected — skipping reformulation');
    return query;
  }
  try {
    const result = await groqOnce(REFORMULATE_PROMPT, query, { smart: false, maxTokens: 30 });
    const clean = result.replace(/^["'`]|["'`]$/g, '').trim();
    return clean.length > 3 && clean.length < 200 ? clean : query;
  } catch {
    return query;
  }
}

// Two-stage domain check:
//   Stage 1 — instant keyword match (no API call, covers 90% of cases)
//   Stage 2 — Groq llama-3.1-8b-instant YES/NO for ambiguous queries
// Fails open (returns true) on any error.
async function isDomainRelated(query) {
  if (DOMAIN_KEYWORD_RE.test(query)) return true;

  try {
    const answer = await groqOnce(DOMAIN_CLASSIFY_PROMPT, query, { smart: false, maxTokens: 5 });
    if (!answer) return true; // LLM unavailable — fail open, let KB search / safe message decide
    return answer.trim().toUpperCase().startsWith('YES');
  } catch {
    return true;
  }
}

// Decide if a message is just social/casual (greeting, thanks, acknowledgement,
// small talk) rather than a request for help. Used as a smart fallback when the
// fast conversational patterns miss — so we never reply with a cold "not in our
// knowledge base" message to a simple "good" or "hello, good morning".
const SOCIAL_CLASSIFY_PROMPT = `Reply with exactly one word — SOCIAL or TASK.
SOCIAL = a greeting, goodbye, thank-you, compliment, acknowledgement (e.g. "ok", "good", "nice", "good morning"), OR an emotional/venting message — frustration, anger, a complaint, or a rhetorical/frustrated remark that isn't really asking for a specific solution (e.g. "this is useless", "why is this so hard", "ugh"). Anything not actually asking for a concrete answer.
TASK = a specific question, problem, error report, or request for help/information about an actual topic.
Examples:
"good" → SOCIAL
"good job" → SOCIAL
"good work, thanks" → SOCIAL
"very good answer" → SOCIAL
"looks good" → SOCIAL
"good bot" → SOCIAL
"well done" → SOCIAL
"hello, good morning" → SOCIAL
"that's perfect, thanks!" → SOCIAL
"this is so frustrating" → SOCIAL
"you're useless" → SOCIAL
"this is a waste of time" → SOCIAL
"worst experience ever" → SOCIAL
"why is this so complicated, ugh" → SOCIAL
"why is this so hard" → SOCIAL
"ugh" → SOCIAL
"my DTD validation failed" → TASK
"how do I fix table overflow" → TASK
"is this good practice for JATS" → TASK`;

async function isSocialMessage(text) {
  try {
    const answer = await groqOnce(SOCIAL_CLASSIFY_PROMPT, text, { smart: true, maxTokens: 3 });
    return answer.trim().toUpperCase().startsWith('SOCIAL');
  } catch {
    return false; // on error, fall through to the normal KB / domain path
  }
}

// ─── Relevance gate ────────────────────────────────────────────────────────────
// Verify which retrieved KB entries DIRECTLY address the user's actual question,
// dropping tangential matches. Keeps answers precise instead of "unrelatable".
const RELEVANCE_PROMPT = `A user asked a support question. Below are candidate knowledge base entries.
Reply with ONLY the numbers of the entries that DIRECTLY address the user's exact question — comma-separated (e.g. "1,3"), or the single word NONE if none truly fit.
Be strict: an entry that is merely on a similar topic but does NOT solve their specific issue is NOT a match.`;

async function filterRelevant(userQuery, candidates) {
  if (candidates.length === 0) return [];
  try {
    const list = candidates
      .map((r, i) => `[${i + 1}] ${r.title} — ${r.error_description || ''}`)
      .join('\n');
    const input = `User question: "${userQuery}"\n\nEntries:\n${list}`;
    const answer = await groqOnce(RELEVANCE_PROMPT, input, { smart: true, maxTokens: 20 });

    if (answer.toUpperCase().includes('NONE')) return [];
    const picked = (answer.match(/\d+/g) || [])
      .map(Number)
      .filter((n) => n >= 1 && n <= candidates.length)
      .map((n) => candidates[n - 1]);
    const unique = [...new Set(picked)];
    // If the model returned something unparseable, fail safe to the top match.
    return unique.length > 0 ? unique : candidates.slice(0, 1);
  } catch {
    return candidates.slice(0, 1); // gate failed — don't block, keep the best match
  }
}

// ─── Detection helpers ────────────────────────────────────────────────────────

const CONVERSATIONAL_PATTERNS = [
  /^(hi|hello|hey|howdy|hiya)\b[\s!.]*$/i,
  /^(thanks?|thank you|thx|ty|cheers|appreciate it|much appreciated)[\s!.]*$/i,
  /^thanks?\s+(a lot|so much|very much|for (everything|your help|the help))[\s!.]*$/i,
  /^(ok|okay|alright|got it|i see|understood|makes sense|noted|cool|great|awesome|perfect|nice|sounds good|good|very good|fine|done)[\s!.]*$/i,
  /^that.?s?\s+(great|helpful|perfect|good|awesome|nice|cool|wonderful)[\s!.]*$/i,
  /^(good|great|nice|excellent|awesome|amazing|fantastic|superb|wonderful|well)\s+(job|work|one|going|stuff|answer|answers|response|reply|replies|bot|effort|done)[\s!.]*$/i,
  /^(looks|sounds|so|very|really|too|all|pretty)\s+good[\s!.]*$/i,
  /^(bye|goodbye|cya|see you|take care|have a good (day|one))[\s!.]*$/i,
  /^(yes|no|yeah|nope|yep|nah|sure|of course|absolutely|definitely)[\s!.]*$/i,
  /^(hi|hey|hello|hiya|howdy)?[\s,!]*good\s+(morning|afternoon|evening|night)[\s!.]*$/i,
  /^(how are you|what.?s up|how.?s it going)\?*$/i,
  /^(who are you|what are you|what can you do)\?*$/i,
  /^(you.?re (welcome|great|helpful|awesome))[\s!.]*$/i,
  /^(no problem|no worries|don.?t worry|it.?s (fine|okay|ok|all good))[\s!.]*$/i,
  /^(wow|amazing|wonderful|brilliant|fantastic|excellent)[\s!.]*$/i,
  /^(ugh+|argh+|aargh+|grr+|ffs|smh)\b/i,
  /^why\s+(is|are|does|do)\s+(this|it|that|everything|things|your\s+\w+)\s+(so\s+|always\s+|such\s+|really\s+)?\w*(hard|difficult|complicated|confusing|annoying|frustrating|slow|broken|painful|tedious|impossible)/i,
];

const ESCALATION_PATTERNS = [
  /still\s+(not\s+)?(work(?:ing)?|resolv(?:ed|ing)?|fix(?:ed|ing)?)/i,
  /still\s+(getting|having|facing|seeing|occurring|happening)\b/i,
  /(tried|already tried|have tried)\s+(everything|all|these|the steps|your suggestions?|those)/i,
  /none\s+of\s+(these|this|them)\s+(work(?:ed)?|help(?:ed)?)/i,
  /nothing\s+(worked|is working|helps?|helped)/i,
  /didn'?t\s+(work|help|fix|resolve)/i,
  /doesn'?t\s+work\s+after/i,
  /(same|exact same)\s+(problem|issue|error)\s+(again|still|persist)/i,
  /(error|issue|problem)\s+(still|persists?|continues?|keeps?\s+\w+)/i,
  /not\s+(yet\s+)?resolved/i,
  /still\s+(the\s+same|broken|failing)/i,
  /after\s+(trying|following|doing)\s+(all|those|these|your)/i,
  /it\s+(still\s+)?(doesn'?t|isn'?t)\s+work/i,
];

function isConversational(text) {
  if (!text) return false;
  return CONVERSATIONAL_PATTERNS.some((p) => p.test(text.trim()));
}

function isUserEscalating(text) {
  if (!text) return false;
  return ESCALATION_PATTERNS.some((p) => p.test(text));
}

// ─── Hardcoded responses ──────────────────────────────────────────────────────

const ESCALATION_RESPONSE = "I'm really sorry those steps didn't sort it out! 😔\n\nLet me make sure you get the right help — please contact our support team and mention the steps you've already tried. That'll help them jump straight to the root cause and get it resolved for you much faster. 🙂";

const NOT_IN_SCOPE_RESPONSE = "This doesn't appear to be in our knowledge base yet. Once it's updated, I'll be able to help right away!\n\nUntil then, please reach out to our **support team** — they'll assist you directly. 🙂";

// Shown when the LLM (Groq) is unreachable/rate-limited. We deliberately do NOT fall back
// to a weak local model for answers — it could hallucinate — so we route to support instead.
const SERVICE_BUSY_RESPONSE = "I'm having a bit of trouble reaching our assistant right now. 😔\n\nPlease reach out to our **support team** and they'll help you directly. Sorry for the inconvenience — thanks for your patience! 🙂";

// Used when no customer is named and nothing in the KB clears the 50% confidence bar.
// The bot gives a brief, genuinely useful GENERAL answer, then points to support.
const COMMON_SOLUTION_PROMPT = `You are DocFlow, a warm, human support specialist for publishing workflows (JATS XML, LaTeX, EPUB, PDF, formatting, proofing).

We don't have a specific, confident knowledge-base match for the user's question. Still help them:
- Give a brief, practical GENERAL solution based on common publishing best practices (2–4 sentences). Be genuinely useful — this is a "common solution", not a refusal.
- Be honest that this is general guidance, not their exact documented procedure.
- Then warmly invite them to reach our support team for help tailored to their specific case.

SUPPORT WORDING — always say exactly "our support team". NEVER attach a company name to it. Just "our support team".

TONE: natural, warm, human — use contractions, never robotic.`;

// Wrap groqStream so any LLM failure (rate limit, outage) yields the safe support
// message instead of crashing or hallucinating. If Groq dies before emitting anything,
// the user gets the safe message; partial-then-fail is essentially never seen because
// failures happen at connection time.
async function* safeStream(systemPrompt, userMessage, history = []) {
  let emitted = false;
  try {
    for await (const token of groqStream(systemPrompt, userMessage, history)) {
      emitted = true;
      yield token;
    }
  } catch (err) {
    console.warn('[DocFlow] LLM unavailable — serving safe support message:', err.message);
    if (!emitted) yield SERVICE_BUSY_RESPONSE;
  }
}

// ─── Main pipeline ────────────────────────────────────────────────────────────

async function* ragStream(userQuery, attachedText = '', history = [], mode = 'full', xmlIssues = []) {
  const startMs = Date.now();

  // 1. Explicit escalation → redirect to support immediately
  if (isUserEscalating(userQuery)) {
    logRequest({ query: userQuery, type: 'escalation', kbHits: 0, webSearch: false, responseMs: Date.now() - startMs });
    yield JSON.stringify({ type: 'sources', sources: [] });
    yield '\n';
    yield JSON.stringify({ type: 'token', token: ESCALATION_RESPONSE });
    return;
  }

  let conversational = isConversational(userQuery) && !attachedText;

  // If the fast patterns didn't catch it and there's no domain keyword, let the
  // model judge whether it's just a social message — analyze intent BEFORE ever
  // falling through to a "not in our knowledge base" reply.
  if (!conversational && userQuery?.trim() && !attachedText && !DOMAIN_KEYWORD_RE.test(userQuery)) {
    conversational = await isSocialMessage(userQuery.trim());
  }

  // 2. Explicitly social message (hi / thanks / ok / bye) → natural reply, no search
  // Everything else — even if it has no domain keywords — goes through KB + domain check
  // so each question is evaluated independently, never inferred from chat history
  if (conversational || (!userQuery?.trim() && !attachedText)) {
    yield JSON.stringify({ type: 'sources', sources: [] });
    yield '\n';
    for await (const token of safeStream(CONVERSATIONAL_PROMPT, userQuery || 'Hello!', history)) {
      yield JSON.stringify({ type: 'token', token });
      yield '\n';
    }
    logRequest({ query: userQuery, type: 'conversational', kbHits: 0, webSearch: false, responseMs: Date.now() - startMs });
    return;
  }

  // Parse optional /Category prefix before everything else
  const { category: categoryFilter, query: strippedQuery } = parseCategoryPrefix(userQuery || '');
  const searchQuery = strippedQuery || (attachedText ? attachedText.slice(0, 400) : '');

  // Detect a customer named in the question — restricts document search to that customer.
  const customerFilter = detectCustomer(userQuery || '');
  if (customerFilter) console.log(`[DocFlow] Customer detected: ${customerFilter} — scoping documents to it`);

  // 3. Domain check + query reformulation.
  //    Full mode: both run in PARALLEL (domain check gates everything).
  //    web_only mode: domain already confirmed by /find — only reformulate for better web results.
  let refinedQuery = searchQuery;
  let domainOk = true;
  if (searchQuery) {
    // XML upload always treated as domain-related (it's a JATS XML file)
    const skipDomainCheck = xmlIssues.length > 0;

    const [domainResult, reformulated] = await Promise.all([
      skipDomainCheck ? Promise.resolve(true) : isDomainRelated(searchQuery),
      reformulateQuery(searchQuery),
    ]);

    // Don't gate on domain here — always search documents + entries first so the bot
    // can answer from imported documents however the user phrases the question
    // (NotebookLM-style). The domain result is only used as a fallback when nothing
    // matches, to choose between "no results" and "out of scope".
    domainOk = domainResult;
    refinedQuery = reformulated;

    if (refinedQuery !== searchQuery) {
      console.log(`[DocFlow] Reformulated: "${searchQuery.slice(0, 60)}" → "${refinedQuery}"`);
    }
  }

  // 4. KB search — search with BOTH the user's original wording AND the reformulated
  //    query, then merge (best score per entry). The embedding model handles natural
  //    language well, so the raw query is usually the most precise match; reformulation
  //    only adds recall. Category-scoped first, fall back to full KB if nothing passes.
  // Confidence gate. When no customer is named we search entries + ALL documents, so we
  // use a 50% floor across the board (the user's "50%" rule): anything below that isn't a
  // confident match → we fall back to a general common solution + support.
  const KB_MIN_SCORE = customerFilter ? 0.62 : 0.50;
  const DOC_MIN_SCORE = 0.50; // imported document passages match more liberally — synthesis filters them

  const searchQueries = [];
  if (searchQuery) searchQueries.push(searchQuery);
  if (refinedQuery && refinedQuery !== searchQuery) searchQueries.push(refinedQuery);

  async function searchMerged(category) {
    // Run the raw + reformulated searches in parallel, then merge by best score.
    const perQuery = await Promise.all(
      searchQueries.map((q) => searchSimilar(q, 5, category, customerFilter))
    );
    const byId = new Map();
    for (const results of perQuery) {
      for (const r of results) {
        const prev = byId.get(r.id);
        if (!prev || r.score > prev.score) byId.set(r.id, r);
      }
    }
    return [...byId.values()].sort((a, b) => b.score - a.score);
  }

  let rawKbResults = [];
  if (searchQueries.length) {
    rawKbResults = await searchMerged(categoryFilter || null);
    // If a category filter found nothing solid, retry across the whole KB
    if (categoryFilter && rawKbResults.filter((r) => r.score >= KB_MIN_SCORE).length === 0) {
      rawKbResults = await searchMerged(null);
    }
  }

  // Strict keyword overlap filter — eliminates false positives
  let kbResults = rawKbResults
    .filter((r) => r.score >= (r.source_type === 'document' ? DOC_MIN_SCORE : KB_MIN_SCORE))
    // Keyword-overlap filter applies to curated entries only (precision). Document
    // passages are matched semantically and their content lives in `solution`, so the
    // overlap check (title + error_description) would wrongly reject them — skip it.
    .filter((r) => r.source_type === 'document'
      || hasKeywordOverlap(searchQuery, r)
      || hasKeywordOverlap(refinedQuery, r));

  // XML analysis mode: search KB for each detected issue and merge results
  if (xmlIssues.length > 0) {
    const seen = new Set(kbResults.map((r) => r.id));
    const issueQueries = xmlIssues.slice(0, 8); // top 8 issues max
    for (const issue of issueQueries) {
      const issueResults = await searchSimilar(issue, 3, categoryFilter, customerFilter);
      for (const r of issueResults) {
        if (r.score >= KB_MIN_SCORE && !seen.has(r.id)) {
          seen.add(r.id);
          kbResults.push(r);
        }
      }
    }
    // Re-sort by score descending, keep top 6
    kbResults.sort((a, b) => b.score - a.score);
    kbResults = kbResults.slice(0, 6);
  }

  // Normal (non-XML) path: rank by score, then choose how to answer.
  let docMode = false;
  if (xmlIssues.length === 0 && kbResults.length > 0) {
    kbResults.sort((a, b) => b.score - a.score);
    // If any imported document passage is relevant, switch to synthesis mode and
    // analyze BOTH the documents and the curated entries together (NotebookLM-style).
    docMode = kbResults.some((r) => r.source_type === 'document');

    if (docMode) {
      kbResults = kbResults.slice(0, 5);
    } else {
      // Curated entries only: verify true relevance, keep the best one or two —
      // this prevents tangential matches from producing "unrelatable" answers.
      if (userQuery?.trim()) {
        kbResults = await filterRelevant(userQuery.trim(), kbResults.slice(0, 4));
      }
      kbResults = kbResults.slice(0, 2);
    }
  }

  let knowledgeSection = '';
  let responseType = 'kb_hit';
  const didWebSearch = false;

  if (kbResults.length > 0) {
    // ── KB hit ───────────────────────────────────────────────────────────────
    if (docMode) {
      // Context expansion: a matched passage opens the door to the WHOLE document
      // (when reasonably sized) or the matched section + neighbours (for large docs),
      // so the answer is built from complete context — nothing missed.
      const WHOLE_DOC_CHARS = 48000;  // ~12k tokens → include the entire document
      const NEIGHBOR = 2;             // else include matched passages ± this many
      const TOTAL_CAP = 60000;        // overall context budget (~15k tokens)

      const docGroups = new Map();    // source -> { score, indexes:Set }
      const curated = [];
      for (const r of kbResults) {
        if (r.source_type === 'document') {
          const src = r.source_files?.[0] || 'document';
          if (!docGroups.has(src)) docGroups.set(src, { source: src, score: r.score, indexes: new Set() });
          const g = docGroups.get(src);
          g.score = Math.max(g.score, r.score);
          g.indexes.add(typeof r.chunk_index === 'number' ? r.chunk_index : 0);
        } else {
          curated.push(r);
        }
      }

      const blocks = [];
      let used = 0;
      for (const g of [...docGroups.values()].sort((a, b) => b.score - a.score)) {
        const passages = getDocumentPassages(g.source, customerFilter);
        if (!passages.length) continue;
        const totalChars = passages.reduce((s, p) => s + (p.solution?.length || 0), 0);

        let selected;
        if (totalChars <= WHOLE_DOC_CHARS) {
          selected = passages; // small/medium doc → the WHOLE document
        } else {
          const keep = new Set();
          for (const idx of g.indexes) for (let i = idx - NEIGHBOR; i <= idx + NEIGHBOR; i++) keep.add(i);
          selected = passages.filter((p) => keep.has(p.chunk_index ?? 0));
        }

        let text = stitchPassages(selected);
        if (used + text.length > TOTAL_CAP) text = text.slice(0, Math.max(0, TOTAL_CAP - used));
        if (!text) break;
        blocks.push(`[Document — ${g.source}]\n${text}`);
        used += text.length;
        if (used >= TOTAL_CAP) break;
      }

      for (const r of curated) {
        if (used >= TOTAL_CAP) break;
        const body = `${r.error_description ? r.error_description + '\n' : ''}${r.solution}`;
        blocks.push(`[Knowledge base — ${r.title}]\n${body}`);
        used += body.length;
      }

      knowledgeSection = `RETRIEVED CONTEXT — from your documents and knowledge base (answer using only these):\n${blocks.join('\n\n---\n\n')}\n\n`;
    } else {
      const context = kbResults
        .map((r, i) => `[${i + 1}] Title: ${r.title}\nError: ${r.error_description}\nSolution: ${r.solution}`)
        .join('\n\n---\n\n');
      knowledgeSection = `KNOWLEDGE BASE (answer strictly from this):\n${context}\n\n`;
    }

  } else {
    // ── No confident match (nothing cleared the 50% bar) ──────────────────────
    responseType = domainOk ? 'no_results' : 'out_of_scope';
    console.log(`[DocFlow] ${responseType}: "${refinedQuery?.slice(0, 80)}"`);
    yield JSON.stringify({ type: 'sources', sources: [] });
    yield '\n';

    if (xmlIssues.length > 0) {
      // If XML was analyzed, show the issues list even without KB match
      const issueList = xmlIssues.map((iss, i) => `${i + 1}. ${iss}`).join('\n');
      const xmlResponse = `I analyzed your XML file and found **${xmlIssues.length} structural issue${xmlIssues.length > 1 ? 's' : ''}**:\n\n${issueList}\n\nI don't have specific KB solutions for these yet. Please share this list with our **support team** — they'll resolve each issue directly. 🙂`;
      yield JSON.stringify({ type: 'token', token: xmlResponse });
      logRequest({ query: userQuery, type: responseType, kbHits: 0, webSearch: false, responseMs: Date.now() - startMs });
    } else if (!customerFilter && domainOk) {
      // No customer named + in-domain but below the 50% bar → give a general common
      // solution and route to support (instead of a flat "not in our KB" reply).
      responseType = 'common_solution';
      const csUser = userQuery || (attachedText ? attachedText.slice(0, 400) : 'Please help with my question.');
      for await (const token of safeStream(COMMON_SOLUTION_PROMPT, csUser, history)) {
        yield JSON.stringify({ type: 'token', token });
        yield '\n';
      }
      logRequest({ query: userQuery, type: responseType, kbHits: 0, webSearch: false, responseMs: Date.now() - startMs });
    } else {
      yield JSON.stringify({ type: 'token', token: NOT_IN_SCOPE_RESPONSE });
      logRequest({ query: userQuery, type: responseType, kbHits: 0, webSearch: false, responseMs: Date.now() - startMs });
    }
    return;
  }

  const attachmentSection = attachedText
    ? `USER'S UPLOADED FILE / SCREENSHOT (extracted text):\n${attachedText}\n\n`
    : '';

  // In document mode, collapse matched passages to their source documents so the
  // user sees "GEO Style Guide.pdf" once, not five "passage N" rows.
  let sources;
  if (docMode) {
    const bySource = new Map();
    for (const r of kbResults) {
      const key = r.source_type === 'document' ? (r.source_files?.[0] || 'document') : r.title;
      const score = Math.round(r.score * 100);
      const prev = bySource.get(key);
      if (!prev || score > prev.score) {
        bySource.set(key, {
          id: r.id,
          title: key,
          category: r.source_type === 'document' ? 'Document' : r.category,
          score,
        });
      }
    }
    sources = [...bySource.values()];
  } else {
    sources = kbResults.map((r) => ({
      id: r.id,
      title: r.title,
      category: r.category,
      score: Math.round(r.score * 100),
    }));
  }

  yield JSON.stringify({ type: 'sources', sources });
  yield '\n';

  const categoryNote = categoryFilter ? `User searched within category: ${categoryFilter}.\n` : '';
  // What to do if the retrieved context doesn't actually answer the question:
  //  • customer scoped → don't invent general advice; say it's not in that customer's
  //    docs and route to our support team.
  //  • no customer → give a brief general common solution, then route to our support team.
  const fallbackNote = customerFilter
    ? `IF THE CONTEXT ABOVE DOES NOT ANSWER THE QUESTION: say honestly that you couldn't find it in ${customerFilter}'s documents, and suggest contacting our support team. Do not add outside facts. Always say just "our support team" — never "${customerFilter} support team".\n\n`
    : `IF THE CONTEXT ABOVE DOES NOT FULLY ANSWER THE QUESTION: give a brief, practical GENERAL common solution from common e-publishing best practices (2–4 sentences, clearly marked as general guidance), then suggest contacting our support team for help specific to their case. Always say just "our support team".\n\n`;
  const filledPrompt = (docMode ? DOC_SYNTHESIS_PROMPT : SYSTEM_PROMPT)
    .replace('{knowledgeSection}', categoryNote + fallbackNote + knowledgeSection)
    .replace('{attachmentSection}', attachmentSection);

  let userMessage = userQuery || '';
  if (attachedText && !userQuery) {
    userMessage = 'I have attached a file/screenshot. Please analyze it and help me understand what is happening and how to fix it.';
  } else if (attachedText && userQuery) {
    userMessage = `${userQuery}\n\n(I also attached a file/screenshot — its extracted content is in the system context above.)`;
  }

  for await (const token of safeStream(filledPrompt, userMessage, history)) {
    yield JSON.stringify({ type: 'token', token });
    yield '\n';
  }

  logRequest({
    query: userQuery || attachedText?.slice(0, 200),
    type: responseType,
    kbHits: kbResults.length,
    webSearch: false,
    responseMs: Date.now() - startMs,
    sources: kbResults,
  });
}

module.exports = { ragStream, hasKeywordOverlap, isDomainRelated };
