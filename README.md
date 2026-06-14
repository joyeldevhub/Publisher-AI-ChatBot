# DocFlow — RAG-Powered AI Support Bot for Publishing

Enterprise-grade **Retrieval-Augmented Generation (RAG)** system for contextual customer support across document repositories and curated knowledge bases, with customer-scoped semantic search, confidence gating, and graceful LLM resilience. Built for the publishing industry.

---

## 🚀 Live Demo

**Live app:** https://publisher-ai-chatbot-jdhm.onrender.com

Deployed on **Render** as a single web service — Express serves the React build **and** the API. The chatbot LLM runs on **OpenRouter** (free cloud models), so the demo stays available 24/7 without any local machine.

**Demo logins:**

| Role | Login | Password |
|------|-------|----------|
| User (chat) | `publisher@gmail.com` | `User123` |
| Admin (KB dashboard) | admin login | `admin` |

> ⚠️ These are demo credentials in a public repo — change them for any real deployment.
> ℹ️ The free Render instance sleeps after ~15 min idle, so the first request may take ~30–60s to wake.

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT (React 18 + Vite)                    │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │  Chat Interface  │  │  Admin Dashboard │  │   Doc Manager    │  │
│  │  (Streaming SSE) │  │  (KB Management) │  │  (Import/Manage) │  │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘  │
│           │                     │                     │             │
└───────────┼─────────────────────┼─────────────────────┼─────────────┘
            │ HTTP/SSE            │ REST API            │ REST API
            │                     │                     │
┌───────────┼─────────────────────┼─────────────────────┼─────────────┐
│           ▼                     ▼                     ▼             │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │         SERVER (Node.js + Express)                          │  │
│  │  ┌────────────────┐  ┌────────────────┐  ┌──────────────┐  │  │
│  │  │  RAG Pipeline  │  │ Vector Store   │  │ LLM Service  │  │  │
│  │  │  (orchestrator)│  │ (Cosine Sim +  │  │(OpenRouter)  │  │  │
│  │  │                │  │  Keyword Fall) │  │  Cloud API   │  │  │
│  │  └────────┬───────┘  └────────┬───────┘  └──────┬───────┘  │  │
│  │           │                   │                 │           │  │
│  │           └──────────────────┬┴─────────────────┘           │  │
│  │                              ▼                             │  │
│  │                    ┌──────────────────┐                    │  │
│  │                    │ Intent Classifier│                    │  │
│  │                    │ (Domain Gating)  │                    │  │
│  │                    └──────────────────┘                    │  │
│  │                                                             │  │
│  └──────────────────┬──────────────────┬──────────────────────┘  │
└─────────────────────┼──────────────────┼──────────────────────────┘
                      │                  │
        ┌─────────────┘                  └────────────┐
        │                                             │
        ▼                                             ▼
   ┌─────────────┐                    ┌──────────────────────┐
   │ JSON KB DB  │                    │ OpenRouter Cloud API │
   │ (Entries +  │                    │ (Chat Completions)   │
   │ Documents)  │                    │ google/gemma-4-31b   │
   └─────────────┘                    └──────────────────────┘
        │
        └─ Customer-scoped Filtering
           (source_type + customer field)
```

---

## 🔧 Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 18, Vite 5.4.21 | SPA with streaming UI |
| **Backend** | Node.js, Express | REST + SSE endpoints (single service) |
| **LLM** | OpenRouter (Google Gemma-4-31b:free) | Cloud-based inference, 24/7 availability |
| **Embeddings** | Local fallback: keyword search | Vector embeddings when available; degrades to keyword matching |
| **Vector Search** | Cosine similarity + keyword fallback | Real-time semantic ranking with graceful degradation |
| **Storage** | JSON files + file-based cache | Knowledge base + conversation logs |
| **Deployment** | Render (free tier) | Single Node.js web service, Oregon region |
| **State** | localStorage (client), SSE (server-sent) | Conversation persistence |

---

## 📊 Data Flow: End-to-End

### 1. **Document Ingestion Pipeline**

```
User uploads PDF/DOCX
      │
      ▼
[Client] analyzeDoc()
      │
      ▼ (chunking service)
Extract passages
(sliding window, 150 overlap)
      │
      ▼
[Server] /api/documents/analyze
      │
      ├─ Store metadata
      └─ Generate embeddings (when available)
           │
           ▼
      Index in JSON KB
      (source_type=document, customer=selected)
```

**Key Details:**
- Chunking: Sentence-aware sliding window with 150-token overlap
- Embedding: Async batch with fallback to keyword search (no external embeddings needed on Render)
- Tagging: Every passage tagged with `customer` field (multi-tenant scope)
- Deduplication: Source-file + chunk index prevents re-indexing
- Vector Fallback: If embeddings unavailable, search pool uses keyword scoring instead of cosine similarity

---

### 2. **Chat Query Resolution Flow**

```
User message: "In [customer name], how do I fix an issue?"
      │
      ▼
[RAG Pipeline] - chat endpoint (SSE streaming)
      │
      ├─ detectCustomer("[customer name]") → customerFilter = "[customer name]"
      │
      ├─ intentClassify()
      │  └─ SOCIAL vs TASK (reject off-topic)
      │
      ├─ isDomainRelated() 
      │  └─ OpenRouter classify: is this e-publishing? (fail-open when LLM down)
      │
      ├─ Dual-query search
      │  ├─ Raw: "issue search query" 
      │  └─ Reformulated: OpenRouter expands intent
      │
      ├─ searchSimilar(query, topK=5, customerFilter="[customer name]")
      │  └─ Filter: source_type=document AND customer=[customer name]
      │     Rank by cosine similarity (or keyword match if vectors unavailable)
      │
      ├─ Score gating
      │  ├─ If customer-scoped: gate=0.62
      │  └─ If no customer: gate=0.50 (loose, allow common solutions)
      │
      ├─ Retrieve full document context
      │  └─ getDocumentPassages(source, customer="[customer name]")
      │     Expand to surrounding passages
      │
      ├─ Synthesis (OpenRouter streaming, google/gemma-4-31b)
      │  ├─ SYSTEM_PROMPT: e-publishing expert, support tone
      │  ├─ DOC_SYNTHESIS_PROMPT: ground in passages
      │  └─ Fallback injection: "if docs don't answer → say not in customer docs → route to support"
      │
      └─ [safeStream] wrapper
         ├─ If OpenRouter available: stream response
         └─ If OpenRouter 429/down: yield SERVICE_BUSY_RESPONSE (no hallucination)

Response streamed via SSE → Client UI
```

**Confidence Gating Logic:**
- **Customer-scoped (ASM named):** Require 62% similarity → if below, respond "not in ASM docs" + support route
- **No customer named:** Require 50% similarity → if below, generate brief general e-publishing guidance + support route
- **Below threshold fallback:** Never hallucinate; always offer escalation

---

### 3. **Customer Scoping & Multi-Tenancy**

```
Import Document Form
      │
      ├─ User selects or enters a customer name
      │
      ▼
All passages tagged: { customer: "[customer]", source_type: "document", ... }
      │
      ▼
[Stored in JSON KB]
      │
      ▼
Chat Query: "In [customer], how do I..."
      │
      ├─ detectCustomer("[customer]") ✓
      │
      ▼
searchSimilar(query, customerFilter="[customer]")
      │
      └─ Pool = [entries where source_type=document AND customer=[customer]]
         (exclude entries, exclude other customers)
```

**Multi-Tenant Isolation:**
- Same filename across customers stays separate via `customer` + `source_files` composite key
- Query without customer name searches ALL (entries + all documents), applies 50% gate
- Dynamic customer addition: Type in import form → added to dropdown for session

---

## 🔌 API Endpoints

### Chat
- **POST** `/api/chat` — Stream chat response (SSE)
  - **Params:** `message`, `conversationId` (optional), `history`
  - **Returns:** `text/event-stream` with chunked tokens
  - **Resilience:** safeStream wrapper catches Groq errors → SERVICE_BUSY_RESPONSE

### Knowledge Base
- **POST** `/api/knowledge/bulk` — Ingest multiple passages
  - **Body:** `[{ title, solution, customer, source_type, ... }]`
  - **Reindex:** Auto-embed via Ollama
  
- **GET** `/api/knowledge/entries` — List all entries/documents
  - **Filter:** `type=entry|document`, `customer=[customer]`
  
- **POST** `/api/documents/analyze` — Analyze uploaded file
  - **Body:** `FormData { file, customer }`
  - **Returns:** `{ entries, documentMetadata }`

### Document Management
- **GET** `/api/documents` — List all imported documents grouped by customer
  - **Returns:** `{ ASM: [...], BMJ: [...], ... }`
  
- **DELETE** `/api/documents/:source/:customer` — Remove document passages
  - **Scope:** Only deletes passages matching `source` + `customer` pair

### Health
- **GET** `/api/health` — LLM + embedding service status
  - **Returns:** `{ groq: "ok"|"error", ollama: "ok"|"error" }`

---

## 🧠 Vector Search Implementation

### Embedding & Indexing
```javascript
// buildEmbedText(entry)
return [title, aliases, error_description, solution].join('\n')
  ↓ (local embeddings when available)
[768-dimensional dense vector]
  ↓
Stored in KB[i].embedding
// Fallback: if embeddings unavailable, score by keyword overlap
```

### Search: Cosine Similarity with Keyword Fallback
```javascript
// If vectors available:
cosineSimilarity(queryVec, docVec) = 
  dot(q, d) / (norm(q) * norm(d))

// If vectors unavailable (e.g., Render environment):
keywordScore(query, text) = 
  overlap(query_words, text_words) / max(len(query), len(text))

score = base_score * (1 + min(helpfulness, 15) * 0.02)
  // Boost entries with user thumbs-up
```

### Filtering Pipeline
```
pool = KB entries (includes all entries with or without embeddings)
  ├─ Filter by category (if categoryFilter set)
  ├─ Filter by customer (if customerFilter set)
  │  └─ source_type=document AND customer=customerFilter
  └─ Rank by available method:
      ├─ If embeddings exist: cosine similarity
      └─ Otherwise: keyword overlap scoring
      └─ Return topK (default 5) where score > 0.25
```

---

## 🛡️ LLM Resilience & Fallback Strategy

### OpenRouter Service (Primary, Cloud-Based)
- **Provider:** OpenRouter (cloud LLM gateway)
- **Models:**
  - Fast: `google/gemma-4-31b-it:free` (classify, reformulate)
  - Smart: `google/gemma-4-31b-it:free` (synthesis, reasoning)
- **Availability:** Works 24/7 without local machine (unlike Ollama)
- **Failure Handling:**
  - `openrouterOnce()` returns `""` on error (internal callers degrade gracefully)
  - `openrouterStream()` throws on error (pipeline catches via safeStream)

### Safe Fallback Strategy
```javascript
safeStream(systemPrompt, userMessage, history) {
  try {
    return openrouterStream(...)
  } catch (err) {
    if (err.code === 'rate_limit_exceeded' || err.status >= 500) {
      // Don't fallback to weak local model
      // Risk of hallucination > value of weak answer
      yield SERVICE_BUSY_RESPONSE
    }
  }
}

SERVICE_BUSY_RESPONSE = 
  "I'm having trouble reaching our assistant right now. 
   Please contact our support team for immediate help."
```

**Rationale:** 
- Weak local model would hallucinate when cloud LLM unavailable
- User feedback: "Safe message + support" > "risky local answer"
- Result: No hallucination fallback; fail gracefully instead

### Domain Gating (Fail-Open)
```javascript
isDomainRelated(text) {
  const relevant = openrouterOnce(DOMAIN_PROMPT, text)
  // If OpenRouter fails (returns ''), assume relevant (fail-open)
  return relevant !== 'no'
}
```

---

## 🎯 Intent Classification & De-Escalation

### Intent Types
- **SOCIAL:** Greetings, appreciation, off-topic ("Hello", "Thank you", "How are you?")
- **TASK:** Support requests, troubleshooting, how-tos

### Processing
```javascript
isSocialMessage(text) {
  // Regex: common greetings
  if (/^(hi|hello|hey|good\s+(morning|night)|thank)/i.test(text))
    return true
  
  // If ambiguous (e.g., "Good."), use Groq 70b classifier
  if (text.length < 10 || text.includes('.')) {
    const classification = groqOnce(CLASSIFY_PROMPT, text, { smart: true })
    return classification === 'social'
  }
  return false
}
```

### Angry/Frustrated User Handling
```
User tone detected (keywords: frustrated, angry, error, broken)
      │
      ▼
Escalate intent to TASK (not rejected)
      │
      ▼
DE_ESCALATION_PROMPT: "calm, kind, understanding tone"
      │
      ▼
Always route to "our support team" (not robotic)
```

---

## 📁 Project Structure

```
claude-support-bot/
├── client/                          # React SPA
│   ├── src/
│   │   ├── components/
│   │   │   ├── chat/ChatInterface.jsx
│   │   │   ├── admin/
│   │   │   │   ├── DocImportForm.jsx      # Multi-customer doc upload
│   │   │   │   ├── DocumentsView.jsx      # Grouped by customer
│   │   │   │   └── KBManager.jsx          # Add Entry / Search
│   │   ├── services/
│   │   │   └── api.js                     # Client-side API calls
│   │   └── App.jsx
│   ├── index.html
│   └── vite.config.js
│
├── server/                          # Node.js backend
│   ├── src/
│   │   ├── index.js                 # Express server entry
│   │   ├── routes/
│   │   │   ├── chat.js              # POST /api/chat (SSE)
│   │   │   ├── knowledge.js         # KB CRUD
│   │   │   ├── documents.js         # Doc import/analyze
│   │   │   ├── health.js            # Health check
│   │   │   └── conversations.js     # Chat history
│   │   └── services/
│   │       ├── ragPipeline.js       # Core orchestrator
│   │       ├── vectorStore.js       # Search + keyword fallback
│   │       ├── openrouterService.js # OpenRouter cloud LLM
│   │       ├── groqService.js       # Groq SDK wrapper (optional)
│   │       ├── ollamaService.js     # Ollama embeddings (optional)
│   │       ├── documentChunker.js   # PDF/DOCX → passages
│   │       └── conversationStore.js # Persistence
│   ├── data/
│   │   ├── kb.json                  # Knowledge base (entries + docs)
│   │   └── conversations.json       # Chat history by user
│   └── nodemon.json                 # Watch config (ignore data/ writes)
│
├── .env                             # LLM API keys
├── package.json
└── README.md (this file)
```

---

## 🚀 Deployment & Configuration

### Environment Variables
```bash
# LLM Provider — OpenRouter (default, cloud-based, works 24/7)
OPENROUTER_API_KEY=sk-or-v1-...           # Required for production
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1  # Optional, defaults shown
OPENROUTER_FAST_MODEL=google/gemma-4-31b-it:free  # Fast classify/reformulate
OPENROUTER_SMART_MODEL=google/gemma-4-31b-it:free # Smart synthesis/reasoning

# Alternative providers — swap the import in server/src/services/ragPipeline.js:
#   Groq:   import './groqService'
#           GROQ_API_KEY=gsk_...
#   Ollama: import './ollamaLlmService'
#           OLLAMA_BASE_URL=http://localhost:11434
#           OLLAMA_LLM_MODEL=llama3.2:1b

# Vector Embeddings (optional, falls back to keyword search if unavailable)
OLLAMA_BASE_URL=http://localhost:11434   # Optional local embeddings
OLLAMA_EMBED_MODEL=nomic-embed-text      # Default embedding model

# Server
PORT=3001                    # Render sets this automatically
NODE_VERSION=20              # Render Node.js version
CLIENT_URL=https://publisher-ai-chatbot-jdhm.onrender.com  # Client URL for attribution
ADMIN_PASSWORD=admin         # Admin dashboard login password
JWT_SECRET=<random>          # Signing key for auth tokens (Render: auto-generated)
```

### Local Development

**Option A: Cloud LLM (recommended for development without local GPU)**
```bash
# Set OpenRouter API key
export OPENROUTER_API_KEY=sk-or-v1-...

# Terminal 1: Backend
cd server && npm install && npm start

# Terminal 2: Frontend
cd client && npm install && npm run dev
# Client available at http://localhost:5173
```

**Option B: Local LLM + Embeddings**
```bash
# Terminal 1: Start Ollama (embeddings only, LLM still uses OpenRouter)
ollama run nomic-embed-text

# Terminal 2: Backend
export OPENROUTER_API_KEY=sk-or-v1-...
cd server && npm install && npm start

# Terminal 3: Frontend
cd client && npm install && npm run dev
```

**Note:** 
- OpenRouter is free tier with rate limits; consider setting `OPENROUTER_FAST_MODEL` and `OPENROUTER_SMART_MODEL` to test different models
- Without Ollama, vector search gracefully degrades to keyword matching
- Ollama is optional; KB search works fine with keyword fallback alone

### Production Considerations
- **Scaling:** Move JSON KB to PostgreSQL with pgvector for large corpora
- **Embeddings:** Optional — add Ollama on dedicated GPU VM for better semantic search vs keyword fallback
- **OpenRouter Cost:** Monitor free tier usage; may hit rate limits with high traffic (consider paid tier)
- **Vector Search:** Current keyword-fallback works well for <1000 entries; add embeddings for >10k entries
- **Monitoring:** Track LLM latency, fallback frequency (when SERVICE_BUSY_RESPONSE used), hallucination rate
- **Fallback LLM:** Consider Claude API (via claude-3.5-sonnet) or DeepSeek as paid backup
- **24/7 Availability:** Current architecture (Render + OpenRouter) needs no local machine; works while laptop off

---

## 🔍 Key Features

✅ **Semantic Search:** Dual-query (raw + reformulated) with cosine similarity  
✅ **Customer Scoping:** Documents partitioned by customer; queries auto-scope  
✅ **Confidence Gating:** 50–62% threshold depending on customer context  
✅ **Safe Fallback:** SERVICE_BUSY_RESPONSE instead of hallucinated answers  
✅ **Conversation Persistence:** 2-day retention, then rolling 24-hour expiry  
✅ **Streaming UI:** SSE for real-time token output  
✅ **Multi-intent:** Social/task distinction with LLM classifier  
✅ **De-escalation:** Calm tone for frustrated users  
✅ **Helpfulness Ranking:** Thumbs-up boost for popular answers  
✅ **Alias/Keyword Matching:** Custom search terms in KB entries  

---

## 📈 Performance & Limits

| Metric | Value | Notes |
|--------|-------|-------|
| **Embeddings Latency** | N/A (keyword fallback) | Falls back to keyword search; no external embeddings on Render |
| **Search Latency** | ~50ms | In-memory cosine similarity or keyword matching |
| **OpenRouter Inference** | 4–8s | google/gemma-4-31b:free; varies by response length |
| **First Token** | ~1–2s | OpenRouter cold start, then streaming |
| **SSE Streaming** | <100ms per token | Real-time token delivery after first token |
| **Rate Limits** | Free tier variable | OpenRouter free models subject to availability |
| **KB Size** | Tested to 500+ passages | JSON file; recommend PostgreSQL at >10k |

---

## 📝 License & Contributing

Internal project. For modifications:
1. Test full RAG pipeline (intent → search → synthesis)
2. Verify customer scoping with multi-tenant queries
3. Check LLM resilience (simulate Groq failures)
4. Update this README for architectural changes

---

**Last Updated:** 2026-06-14  
**Status:** ✅ Live on Render + OpenRouter (24/7 cloud deployment)  
**Project:** DocFlow — Publishing AI Support Bot
