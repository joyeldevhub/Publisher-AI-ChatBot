# 📚 DocFlow — Publishing Support AI Assistant

## 1️⃣ Why This AI Assistant Bot?

**DocFlow** is an intelligent AI assistant bot specifically designed for **publishing industry support**. It helps users with:

- **LaTeX Setter Formatting Guidelines** — answers questions about LaTeX proof generation, formatting issues, and troubleshooting
- **Equation & Table Problems** — solves complex formatting issues in academic publishing
- **Multi-User Support** — works like ChatGPT with separate login, conversation history for each user
- **Knowledge Base Search** — semantic search across 320+ publishing support articles
- **Document Analysis** — imports and analyzes publishing documents

---

## 2️⃣ How to Use DocFlow

### For End Users
1. Login/Signup with email or Google
2. Start chatting - ask questions about publishing/LaTeX issues
3. Attach files (PDFs, images) for analysis
4. View all conversations in sidebar
5. Export conversations as Markdown/PDF

### For Admins
1. Login with admin credentials
2. Manage knowledge base articles
3. Bulk import documents
4. View analytics and user feedback

---

## 3️⃣ What's Included?

✨ **Core Features:**
- Multi-User Authentication (Email + Google OAuth)
- ChatGPT-style conversations with history
- Semantic search (320+ articles)
- File upload (PDF, images, docs)
- Export to Markdown/PDF
- Dark/Light mode
- Voice-to-text support
- Admin panel for KB management
- Real-time AI responses with streaming

---

## 4️⃣ Technology Stack

### Frontend
- React, Vite, TailwindCSS, Lucide Icons
- React Router, Axios, Google OAuth

### Backend
- Node.js, Express, Nodemon
- UUID, Bcryptjs, JWT authentication

### AI & Search
- **Groq API** — Fast LLM (primary chat)
- **Ollama** — Local embeddings for semantic search
- Fallbacks: Claude, DeepSeek, OpenAI

### Data Storage
- JSON files (users, conversations, knowledge base)
- In-memory caching for speed
- Vector store for embeddings

---

## 5️⃣ AI Models Used

### Primary LLM: Groq
- Model: mixtral-8x7b-32768
- Speed: 500+ tokens/sec
- Perfect for real-time chat
- Low cost, high quality

### Embeddings: Ollama (Local)
- Model: nomic-embed-text
- Runs offline, no API costs
- 768-dimensional vectors
- Fast semantic search

### Authentication: Google OAuth 2.0
- Server-side verification
- Auto-user creation
- 30-day JWT tokens

---

## 6️⃣ How to Set Up & Run

### Requirements
- Node.js v18+
- npm v9+
- Ollama with embeddings model
- Git

### Quick Setup

```bash
# 1. Clone repository
git clone https://github.com/yourusername/claude-support-bot.git
cd claude-support-bot

# 2. Install dependencies
npm install
cd server && npm install && cd ..
cd client && npm install && cd ..

# 3. Create .env file with your API keys
# GROQ_API_KEY=your-key
# GOOGLE_CLIENT_ID=your-id (optional)
# JWT_SECRET=your-secret

# 4. Start Ollama (another terminal)
ollama serve
ollama pull nomic-embed-text

# 5. Start dev servers
npm run dev

# 6. Open browser
# http://localhost:5173

# 7. Login with test user
# Email: publisher@gmail.com
# Password: User123
```

### Environment Variables (.env)

```env
# Server
PORT=3001
CLIENT_URL=http://localhost:5173
ADMIN_PASSWORD=admin123
JWT_SECRET=change-this-to-random-string

# Groq API (required)
GROQ_API_KEY=your-groq-api-key

# Ollama (required for embeddings)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_EMBED_MODEL=nomic-embed-text
OLLAMA_LLM_MODEL=llama3.2:3b

# Google OAuth (optional)
GOOGLE_CLIENT_ID=your-google-client-id

# Alternatives (optional)
DEEPSEEK_API_KEY=your-key
ANTHROPIC_API_KEY=your-key
```

---

## 7️⃣ Deployment Status

### ⚠️ NOT LIVE IN PRODUCTION YET

This is a development/self-hosted solution. Choose an option:

**Option 1: Self-Hosted** (Recommended for teams)
- Deploy to your own server
- Full data control
- Private knowledge base

**Option 2: Docker**
```bash
docker-compose up
```

**Option 3: Cloud Services**
- Vercel (frontend)
- Railway/Render (backend)

**Option 4: Use Alternatives**
- ChatGPT, Claude.ai, Perplexity AI

---

## 8️⃣ Testing Instructions

### Clone & Test

```bash
# 1. Clone repo
git clone https://github.com/yourusername/claude-support-bot.git
cd claude-support-bot

# 2. Install everything
npm install

# 3. Configure .env with your API keys

# 4. Start Ollama (terminal 1)
ollama serve

# 5. Start app (terminal 2)
npm run dev

# 6. Test in browser
# Go to http://localhost:5173
# Login: publisher@gmail.com / User123

# 7. Test Features
- Send message → AI responds
- Upload file (PDF/image)
- Create new conversation
- Switch between chats
- Delete conversation
- Toggle dark mode
```

### Testing Checklist

- [ ] Login/Signup works
- [ ] Chat responds in real-time
- [ ] Loading animation shows
- [ ] Messages save to history
- [ ] Conversations persist
- [ ] File upload works
- [ ] Dark mode toggles
- [ ] Logo visible in loading state
- [ ] Colors match DocFlow brand

### Commands

```bash
npm run dev           # Start dev servers
npm run dev:server    # Backend only
npm run dev:client    # Frontend only
cd server && node src/db/seedUser.js  # Create test user
npm run build         # Production build
npm run preview       # Preview build
```

### Troubleshooting

| Problem | Solution |
|---------|----------|
| Port 3001 in use | Kill the process using it |
| Ollama won't connect | Run `ollama serve` in terminal |
| Google OAuth fails | Add Client ID to .env files |
| Messages not saving | Check localStorage for auth_token |

---

## 📁 Project Structure

```
claude-support-bot/
├── server/
│   ├── src/
│   │   ├── index.js (main server)
│   │   ├── db/ (data files)
│   │   ├── routes/ (API endpoints)
│   │   ├── middleware/ (auth)
│   │   └── services/ (AI integrations)
│
├── client/
│   ├── src/
│   │   ├── pages/ (Login, Chat)
│   │   ├── components/ (UI)
│   │   ├── services/ (API calls)
│   │   └── index.css (styling)
│
├── data/ (created at runtime)
│   ├── users.json
│   ├── conversations.json
│   ├── kb.json
│   └── feedback.json
│
├── .env (your config)
├── README.md
└── GOOGLE_OAUTH_SETUP.md
```

---

## 🔐 Security

✅ Implemented:
- Bcryptjs password hashing
- JWT tokens (30-day expiration)
- Server-side OAuth verification
- CORS protection
- XSS prevention
- Input validation

⚠️ Before Production:
- Change admin password
- Use strong JWT secret
- Enable HTTPS
- Don't commit .env files
- Validate all inputs

---

## 📞 Help

- Check browser console (F12) for errors
- Read terminal logs
- See GOOGLE_OAUTH_SETUP.md for OAuth help
- Review DEPLOYMENT.md for production

---

## 📝 License

Internal use and educational purposes.

---

## 🙏 Credits

- **Frontend:** React, Vite, TailwindCSS
- **Backend:** Node.js, Express
- **AI:** Groq, Ollama, Claude API
- **Icons:** Lucide React

---

**Last Updated:** 2026-06-13
**Status:** ✅ Development Ready | ⚠️ Not Production Deployed

Happy coding! 🚀
