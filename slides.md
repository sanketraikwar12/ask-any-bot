---
marp: true
theme: default
paginate: true
style: |
  section {
    background-color: #0f172a;
    color: #e2e8f0;
    font-family: 'Inter', system-ui, sans-serif;
  }
  h1 {
    color: #38bdf8;
    font-size: 3em;
    text-align: center;
  }
  h2 {
    color: #818cf8;
    border-bottom: 2px solid #334155;
    padding-bottom: 0.5em;
  }
  h3 {
    color: #a78bfa;
  }
  strong {
    color: #fbbf24;
  }
  code {
    background: #1e293b;
    color: #a3e635;
    padding: 0.2em 0.4em;
    border-radius: 4px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
  }
  table th {
    background: #1e293b;
    color: #f8fafc;
    border: 1px solid #334155;
  }
  table td {
    border: 1px solid #334155;
    background: #0f172a;
  }
  blockquote {
    border-left: 5px solid #38bdf8;
    background: #1e293b;
    color: #cbd5e1;
  }
  .center {
    text-align: center;
  }
---

# 🤖 Ask Any Bot
## Domain-Aware AI Chat with Streaming Intent Detection

---

## 🎯 Project Overview

**Ask Any Bot** is a production-ready, domain-aware AI chatbot that delivers **real-time streaming answers** with automatic **intent detection**. 

Users pick a knowledge domain and receive tailored, expert-level responses powered by Anthropic's Claude API.

### Tech Stack
* **Frontend:** React 18 · TypeScript · Vite · Tailwind CSS
* **Backend:** FastAPI (Python) · SSE Streaming
* **Database:** SQLite (users → sessions → messages)
* **AI Model:** Anthropic Claude (claude-opus-4-5)

---

## 🔧 System Architecture

The system follows a robust **three-tier architecture**:

1. **Presentation Layer** 
   React SPA with Framer Motion animations and responsive design.
2. **Application Layer** 
   FastAPI handling validation, CORS, streaming proxy, and persistence.
3. **Data Layer** 
   SQLite for server-side storage; `localStorage` for client-side drafts.

> Architecture ensures strict separation of concerns and scalable performance.

---

## 💻 Backend Implementation

The backend is the central orchestrator:

* **Domain-Specific System Prompts:** Curated prompts shape Claude's expertise across four domains (College, Health, Agriculture, General).
* **SSE Streaming:** Responses stream token-by-token via Server-Sent Events, transformed into an OpenAI-compatible format.
* **Input Validation:** Strict limits on message length (4,000 chars), total payload (20,000 chars), and message count.
* **Security:** API keys remain strictly on the server; CORS origin allowlisting blocks unauthorized requests.

---

## 🎨 Frontend Implementation

* **Streaming Client:** Custom buffer-based SSE parser to handle raw data chunks smoothly.
* **Abortable Requests:** Uses `AbortController` to let users stop generation mid-stream.
* **Session Persistence:** Saves domain, messages, and drafts to `localStorage`, restoring instantly on reload.
* **Shared Validation:** Uses a single source of truth (`shared/chat.ts`) for both frontend and backend validation rules.

---

## ⚡ Key Functionality

* **Domain Selection:** Seamless switching between customized knowledge domains.
* **Intent Detection System:** The AI classifies responses into **20 domain-specific sub-intents**, displayed as colorful animated badges.
* **Offline Resilience:** Auto-saves drafts when connection drops and disables send controls safely.
* **Transcript Export:** One-click markdown downloads of full conversations with intent metadata.

---

## 📱 Live Application: Health Domain

![width:900px center](C:/Users/raikw/.gemini/antigravity/brain/eadee3eb-297f-4906-ad8b-6197f59ae697/health_domain.png)

---

## 📱 Live Application: Chat & Intents

![width:900px center](C:/Users/raikw/.gemini/antigravity/brain/eadee3eb-297f-4906-ad8b-6197f59ae697/chat_response.png)

---

## 📊 Results & Quality Assurance

* **Test Suite:** 5 comprehensive test files covering session restore, error recovery, offline behavior, and SSE parsing.
* **CI/CD Pipeline:** GitHub Actions automatically enforces:
  1. ESLint
  2. TypeScript Typechecking
  3. Vitest (Unit/Integration)
  4. Vite Production Build
* **Performance:** `< 1 second` Time to First Token. Instant session restore.

---

# 🎉 Thank You!

**Ask Any Bot** is ready for production deployment.
