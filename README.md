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
│  │  │  (orchestrator)│  │ (Embeddings +  │  │ (Groq SDK)   │  │  │
│  │  │                │  │  Similarity)   │  │              │  │  │
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
   ┌─────────────┐                          ┌────────────────┐
   │ JSON KB DB  │                          │ Ollama Service │
   │ (Entries +  │                          │ (Embeddings)   │
   │ Documents)  │                          │ nomic-embed    │
   └─────────────┘                          └────────────────┘
        │
        └─ Customer-scoped Filtering
           (source_type + customer field)
```

---

## 🔧 Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 18, Vite 5.4.21 | SPA with streaming UI |
| **Backend** | Node.js, Express | REST + SSE endpoints |
| **LLM** | Groq (llama-3.3-70b) | Primary inference; 8b-instant for classify/reformulate |
| **Embeddings** | Ollama (nomic-embed-text) | 768-dim vector embeddings |
| **Vector Search** | In-memory cosine similarity | Real-time semantic ranking |
| **Storage** | JSON files + file-based cache | Knowledge base + conversation logs |
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
      └─ Generate embeddings (Ollama)
           │
           ▼
      Index in JSON KB
      (source_type=document, customer=ASM)
```

**Key Details:**
- Chunking: Sentence-aware sliding window with 150-token overlap
- Embedding: Async batch via Ollama nomic-embed-text (768-dim)
- Tagging: Every passage tagged with `customer` field (multi-tenant scope)
- Deduplication: Source-file + chunk index prevents re-indexing

---

### 2. **Chat Query Resolution Flow**

```
User message: "In ASM, how do I fix JATS validation?"
      │
      ▼
[RAG Pipeline] - chat endpoint (SSE streaming)
      │
      ├─ detectCustomer("ASM") → customerFilter = "ASM"
      │
      ├─ intentClassify()
      │  └─ SOCIAL vs TASK (reject off-topic)
      │
      ├─ isDomainRelated() 
      │  └─ Groq classify: is this e-publishing? (fail-open when LLM down)
      │
      ├─ Dual-query search
      │  ├─ Raw: "JATS validation" 
      │  └─ Reformulated: Groq 8b expands intent
      │
      ├─ searchSimilar(query, topK=5, customerFilter="ASM")
      │  └─ Filter: source_type=document AND customer=ASM
      │     Rank by cosine similarity + helpfulness boost
      │
      ├─ Score gating
      │  ├─ If customer-scoped: gate=0.62
      │  └─ If no customer: gate=0.50 (loose, allow common solutions)
      │
      ├─ Retrieve full document context
      │  └─ getDocumentPassages(source, customer="ASM")
      │     Expand to surrounding passages
      │
      ├─ Synthesis (Groq 70b streaming)
      │  ├─ SYSTEM_PROMPT: e-publishing expert, support tone
      │  ├─ DOC_SYNTHESIS_PROMPT: ground in passages
      │  └─ Fallback injection: "if docs don't answer → say not in ASM docs → route to support"
      │
      └─ [safeStream] wrapper
         ├─ If Groq available: stream response
         └─ If Groq 429/down: yield SERVICE_BUSY_RESPONSE (no hallucination)

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
      ├─ User selects: "ASM" (or types "NewCustomer")
      │
      ▼
All passages tagged: { customer: "ASM", source_type: "document", ... }
      │
      ▼
[Stored in JSON KB]
      │
      ▼
Chat Query: "In ASM, how do I..."
      │
      ├─ detectCustomer("ASM") ✓
      │
      ▼
searchSimilar(query, customerFilter="ASM")
      │
      └─ Pool = [entries where source_type=document AND customer=ASM]
         (exclude entries, exclude other customers)
```

**Multi-Tenant Isolation:**
- Same filename across customers (e.g., `guide.pdf` in both ASM and BMJ) stays separate via `customer` + `source_files` composite key
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
  - **Filter:** `type=entry|document`, `customer=ASM`
  
- **POST** `/api/documents/analyze` — Analyze uploaded file
  - **Body:** `FormData { file, customer }`
  - **Returns:** `{ entries, documentMetadata }`

### Document Management
- **GET** `/api/documents` — List all imported documents grouped by customer
  - **Returns:** `{ ASM: [...], BMJ: [...], ... }`
  
- **DELETE** `/api/documents/:source/:customer` — Remove document passages
  - **Scope:** Only deletes passages matching `source` + `customer`

### Health
- **GET** `/api/health` — LLM + embedding service status
  - **Returns:** `{ groq: "ok"|"error", ollama: "ok"|"error" }`

---

## 🧠 Vector Search Implementation

### Embedding & Indexing
```javascript
// buildEmbedText(entry)
return [title, aliases, error_description, solution].join('\n')
  ↓ (Ollama nomic-embed-text)
[768-dimensional dense vector]
  ↓
Stored in KB[i].embedding
```

### Search: Cosine Similarity + Ranking
```javascript
cosineSimilarity(queryVec, docVec) = 
  dot(q, d) / (norm(q) * norm(d))

score = base_similarity * (1 + min(helpfulness, 15) * 0.02)
  // Boost entries with user thumbs-up
```

### Filtering Pipeline
```
pool = KB entries
  ├─ Remove entries without embeddings
  ├─ Filter by category (if categoryFilter set)
  ├─ Filter by customer (if customerFilter set)
  │  └─ source_type=document AND customer=customerFilter
  └─ Rank by cosine similarity
      └─ Return topK (default 5) where score > 0.25
```

---

## 🛡️ LLM Resilience & Fallback Strategy

### Groq Service (Primary)
- **Models:**
  - Fast: `llama-3.1-8b-instant` (classify, reformulate)
  - Smart: `llama-3.3-70b-versatile` (synthesis, reasoning)
- **Failure Handling:**
  - `groqOnce()` returns `""` on error (internal callers degrade gracefully)
  - `groqStream()` throws on error (pipeline catches via safeStream)

### Safe Fallback Strategy
```javascript
safeStream(systemPrompt, userMessage, history) {
  try {
    return groqStream(...)
  } catch (err) {
    if (err.code === 'rate_limit_exceeded') {
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
- Weak local model (Ollama llama3.2:3b) hallucinated MOBI/XML instructions when Groq was rate-limited
- User feedback: "Safe message + support" > "risky local answer"
- Result: No hallucination fallback; fail gracefully instead

### Domain Gating (Fail-Open)
```javascript
isDomainRelated(text) {
  const relevant = groqOnce(DOMAIN_PROMPT, text)
  // If Groq fails (returns ''), assume relevant (fail-open)
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
│   │       ├── vectorStore.js       # Search + filtering
│   │       ├── groqService.js       # Groq SDK wrapper
│   │       ├── ollamaService.js     # Embeddings
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
# LLM provider — OpenRouter (deployed default: free cloud models, works 24/7)
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_FAST_MODEL=meta-llama/llama-3.1-8b-instruct:free
OPENROUTER_SMART_MODEL=meta-llama/llama-3.3-70b-instruct:free

# Alternative providers — swap the import in server/src/services/ragPipeline.js:
#   Groq:   GROQ_API_KEY=gsk_...
#   Ollama: OLLAMA_BASE_URL=http://localhost:11434   OLLAMA_LLM_MODEL=llama3.2:1b

# Server
PORT=3001                 # Render sets this automatically
CLIENT_URL=http://localhost:5173
ADMIN_PASSWORD=admin       # admin dashboard login
JWT_SECRET=<random>        # signs user auth tokens (Render: auto-generated)
```

### Local Development
```bash
# Terminal 1: Start Ollama
ollama run nomic-embed-text

# Terminal 2: Backend
cd server && npm install && npm start

# Terminal 3: Frontend
cd client && npm install && npm run dev
```

### Production Considerations
- **Scaling:** Move JSON KB to PostgreSQL with pgvector for large corpora
- **Embeddings:** Host Ollama on dedicated GPU VM for speed
- **Groq rate limits:** Implement token budgeting; alert when approaching daily cap
- **Monitoring:** Track LLM latency, hallucination rate, customer satisfaction
- **Fallback LLM:** Evaluate DeepSeek / Claude API as secondary provider

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
| **Embeddings Latency** | ~200ms | nomic-embed-text (CPU) |
| **Search Latency** | ~50ms | In-memory cosine similarity |
| **Groq Inference** | 3–8s | 70b-versatile; varies by response length |
| **SSE Streaming** | <1s first token | Real-time token delivery |
| **Daily Token Limit** | 100k | Groq free tier; cumulative 8b + 70b |
| **KB Size** | Tested to 500+ passages | JSON file; recommend DB at >10k |

---

## 📝 License & Contributing

Internal project. For modifications:
1. Test full RAG pipeline (intent → search → synthesis)
2. Verify customer scoping with multi-tenant queries
3. Check LLM resilience (simulate Groq failures)
4. Update this README for architectural changes

---

**Last Updated:** June 2026  
**Project:** DocFlow — Publishing AI Support Bot
