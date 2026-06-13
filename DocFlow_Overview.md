# DocFlow — AI Support Assistant for Publishing Workflows
### Project Overview & Demo Guide

---

## What is DocFlow?

DocFlow is an **AI-powered support chatbot** for any publishing company, platform, or workflow. It answers user support questions by searching a curated Knowledge Base (KB) first, then falling back to a live web search — all without sending data to any external AI API. Everything runs locally on the server using **Ollama** (open-source local LLM).

> **Core idea:** User asks a question → check KB → if not found, search the web → always give a useful answer.

---

## Problem It Solves

Publishing support teams repeatedly answer the same questions around:
- Citation formatting (APA, MLA, Chicago, DOI)
- XML & JATS validation
- DTD and XSD validation
- Proofreading & editing guidelines
- Table, figure, and equation formatting issues
- PDF/EPUB generation and rendering problems
- Metadata, accessibility, and validation errors
- Publishing standards (PMC, Crossref, ISSN, ISBN, WCAG)

DocFlow **automates first-level support** — users get instant answers to known issues 24/7, without waiting for a support engineer.

---

## Architecture Overview

```
User Message
     │
     ▼
┌─────────────────────────────────┐
│         CHAT PIPELINE           │
│                                 │
│  1. Conversational? (hi/thanks) │──► Natural reply (no search)
│  2. Escalating? (nothing works) │──► Redirect to human support
│  3. Domain check                │──► Out of scope? → Decline
│  4. Reformulate query (LLM)     │
│  5. Search Knowledge Base       │──► Match found → Confirmation card
│  6. Web search fallback         │──► Web results → Answer
└─────────────────────────────────┘
     │
     ▼
 Streamed response to user
```

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | React 18 + Vite + Tailwind CSS | Chat UI + Admin Portal |
| **Backend** | Node.js + Express | API server, file handling |
| **AI Model** | Ollama — `llama3.2:3b` (free, local) | Domain check, query reformulation, answer generation |
| **Embeddings** | Ollama — `nomic-embed-text` | Vector similarity search in KB |
| **Vector DB** | JSON file + cosine similarity | Lightweight local KB storage |
| **File Parsing** | Mammoth (DOCX) + Tesseract (OCR) | Extract text from uploaded documents |
| **Web Search** | Stack Exchange API | Fallback search (tex, academia, stackoverflow) |
| **Auth** | JWT tokens | Admin portal protection |
| **Email** | Nodemailer (Gmail) | Alert developer on negative feedback |
| **Dev Tools** | concurrently + PowerShell script | One-command start/stop/restart |

> No external AI API costs. Everything runs offline on the local server.

---

## Key Features

### 1. Intelligent Chat Pipeline

Every user message goes through a multi-stage pipeline:

| Stage | What happens |
|---|---|
| Conversational check | "Hi", "Thanks", "OK" → friendly reply, no search |
| Escalation check | "Nothing worked", "Still failing" → redirect to human support |
| Domain check | Keyword regex + LLM classifies if question is e-publishing related |
| Query reformulation | LLM rewrites vague question into a precise technical search query |
| KB search | Vector similarity + keyword overlap filter (prevents false matches) |
| Confirmation card | If KB match found (score ≥ 0.58), user confirms before showing answer |
| Web search fallback | If not in KB, searches tex.stackexchange, academia.stackexchange, stackoverflow |

---

### 2. Knowledge Base (KB)

The KB is the heart of DocFlow. It stores structured entries:

```
Title:             How do I format citations in APA style?
Category:          Citations & References
Error Description: User needs to know proper APA citation format for different sources
Solution:          APA format: Author(s) (Year). Title of work. Publisher.
                   Example: Smith, J. (2023). Publishing best practices. Academic Press.
                   Always include: Authors, year in parentheses, title (italicized), publisher
```

Supported issue categories:
`Citations & References · Proofreading & Editing · XML & Structure · DTD & Validation · Tables & Formatting · Errors & Troubleshooting · EPUB & PDF · Standards & Validation · Fonts & Colors · Images & Media · Headings & Structure · Metadata · General Best Practices`

---

### 3. Two-Stage KB Match Filter

Vector similarity alone causes **false positives** (e.g., "peer review" matching "What is DocFlow?" at 60% similarity). DocFlow uses a two-stage filter:

```
Stage 1: Vector similarity score ≥ 0.58
Stage 2: Keyword overlap — at least one non-trivial word from
         the query must appear in the KB entry title/description
```

Only entries passing both stages reach the user.

---

### 4. Admin Portal

Protected by password + JWT token. Tabs:

#### Import Document
- Upload a KT (Knowledge Transfer) document (DOCX/TXT)
- LLM automatically extracts all issues and solutions as structured KB entries
- Admin previews extracted entries, selects which ones to save

#### Add Entry (Manual)
- Form to add a single KB entry with title, error description, solution, category
- Attach screenshots, logs, or DOCX files for richer content

#### All Entries
- Browse all KB entries with expand/collapse
- **Inline Edit** — edit any field directly, auto re-embeds the entry
- **Delete** — removes entry and its embedding

#### KB Gap Analyzer
- Reads all "no results" logs — queries that had no KB or web answer
- LLM generates suggested KB entries for those unanswered questions
- Admin can **Add to KB** or **Dismiss** each suggestion

#### Request Logs
- Full audit trail of every user query
- Stats: Total / KB Hits / Web Search / No Results / Out of Scope / Chat / Escalations
- Each row: timestamp, query, type badge, response time, KB sources

---

### 5. User Feedback Loop

| Feedback | What happens |
|---|---|
| 👍 Thumbs Up | The Q&A pair is saved directly to the KB as a new entry |
| 👎 Thumbs Down | Developer receives an email alert with the question and the bad answer |

---

### 6. File Attachments in Chat

Users can attach up to **5 files** per message:
- Images (PNG, JPG) → OCR extracts text → included in LLM context
- DOCX, TXT, logs, scripts → text extracted → included in context

---

### 7. Auto-Train

When a web search answer is generated, it is **automatically saved to the KB** with `auto_trained: true`. Next time someone asks the same question, it will be answered from the KB directly (no web search needed).

---

### 8. Escalation Detection

DocFlow recognises when a user is frustrated with repeated failures:

> "I've tried everything and it still doesn't work"
> "None of these steps helped"
> "The issue still persists after following your suggestions"

Instead of giving another unhelpful answer, it immediately redirects to the human support team.

---

## How the Answer Quality Works

### KB Hit (TIER 1)
- Answer comes **exclusively from the KB** — no hallucination
- LLM personalises the answer to the user's specific symptom/error
- Source badge shows which KB entry was used and its match score

### Web Search Hit (TIER 2)
- LLM infers 3–5 checkpoints from web results
- Ends with: *"Give these a try! If the issue still persists, please contact our support team."*
- Answer is auto-saved to KB for next time

### Out of Scope
- Non-e-publishing questions ("Write PHP code", "Recipe for pasta") get a polite decline
- Logged as `out_of_scope` — not counted as a knowledge gap

---

## Supported Issue Types (Publishing & Academic)

DocFlow is pre-configured to recognise all standard publishing issue categories:

```
APA/MLA citation formatting    DOI & URL formatting
In-text citations             Citation management tools
XML validation errors          JATS element errors
Well-formed XML               XML namespaces
DTD validation                DTD vs XSD comparison
XSD validation                Error message interpretation
Table formatting              XML table structure
Cell merging issues           Accessible tables
EPUB conversion               EPUB rendering issues
PDF quality & compatibility   PDF rendering fixes
PDF color management          Schematron validation
PMC requirements              Crossref DOI registration
ISSN vs ISBN                  WCAG accessibility
Document tagging              Font embedding
Color consistency             International characters
Image best practices          Figure tagging
Supplementary materials       Heading hierarchy
Document structure            Cross-references
Metadata & information        Publication dates
Keywords & tagging            Author roles
Licensing & permissions       Version management
```

---

## Running the Project

### Prerequisites
- Node.js 18+
- Ollama installed with `llama3.2:3b` and `nomic-embed-text` models (free, fully local)

### One-Command Start
```powershell
# From project root
npm start       # Start both frontend and backend
npm stop        # Stop both
npm run restart # Restart both
```

### URLs
| Service | URL |
|---|---|
| Chat (Users) | http://localhost:5173 |
| Admin Portal | http://localhost:5173/admin/login |
| Backend API | http://localhost:3001/api |

---

## Project File Structure

```
Claude-support-bot/
├── client/                    # React frontend (Vite)
│   └── src/
│       ├── pages/
│       │   ├── ChatPage.jsx          # Main chat interface
│       │   ├── AdminPage.jsx         # Admin dashboard
│       │   └── AdminLogin.jsx        # Admin login
│       ├── components/
│       │   ├── chat/
│       │   │   └── ChatMessage.jsx   # Message + feedback UI
│       │   └── admin/
│       │       ├── FeedForm.jsx      # Manual KB entry form
│       │       ├── KnowledgeList.jsx # KB list with edit/delete
│       │       ├── DocImportForm.jsx # Document → KB extractor
│       │       ├── GapsView.jsx      # KB gap analyzer
│       │       └── LogsView.jsx      # Request logs + stats
│       └── services/
│           └── api.js                # All API calls
│
├── server/                    # Express backend
│   └── src/
│       ├── routes/
│       │   ├── chat.js              # /api/chat (stream + find)
│       │   ├── knowledge.js         # /api/knowledge (CRUD + gaps)
│       │   ├── feedback.js          # /api/feedback (thumbs)
│       │   └── logs.js              # /api/logs
│       ├── services/
│       │   ├── ragPipeline.js       # Core AI pipeline
│       │   ├── vectorStore.js       # KB vector search
│       │   ├── ollamaService.js     # LLM calls (chat/embed/classify)
│       │   ├── webSearch.js         # Stack Exchange search
│       │   ├── fileParser.js        # DOCX + image OCR
│       │   ├── emailService.js      # Thumbsdown alerts
│       │   └── logger.js            # Request logging
│       └── db/
│           ├── init.js              # JSON file DB
│           └── companyInfo.js       # Seed DocFlow info
│
├── manage.ps1                 # Start / Stop / Restart script
└── package.json               # Root scripts
```

---

## What Makes DocFlow Different

| Feature | Typical Support Bot | DocFlow |
|---|---|---|
| AI model | Cloud API (paid, data leaves) | Local Ollama (free, private) |
| Hallucination control | Hard to prevent | KB-exclusive answers for known issues |
| False match prevention | Vector similarity only | Vector + keyword overlap filter |
| Knowledge growth | Manual only | Auto-train from web + thumbs up + doc import |
| Gap visibility | No insight | KB Gap Analyzer shows what's missing |
| Feedback | Rating only | Saves good answers, alerts on bad ones |
| Domain control | Generic | Tuned for 65+ publishing issue types |

---

*Built for any publishing company · Powered by Ollama llama3.2:3b + nomic-embed-text · No external AI API costs*
