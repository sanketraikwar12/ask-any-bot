# Ask Any Bot

A production-ready baseline for a domain-aware AI chat app built with React, Vite, Tailwind, and a FastAPI Python backend (or Supabase Edge Function).

## What changed

- Added FastAPI Python backend as the primary recommended backend (replaces Supabase requirement).
- Maintained Supabase Edge Function as an alternative deployment option.
- Removed the browser-to-Groq architecture and moved chat traffic behind a backend proxy.
- Replaced hardcoded API secrets with environment-based configuration.
- Added request validation, upstream timeout handling, and better SSE response headers.
- Tightened the frontend chat flow with abortable requests, offline-aware drafts, reconnect-safe send controls, transcript export, copy-to-clipboard answers, and safer runtime errors.
- Added real tests for chat parsing, validation, runtime config, and streaming.
- Cleaned the app shell, build config, lint setup, and dependency graph for a leaner production path.

## Local setup

1. Install dependencies.

```bash
npm install
```

2. Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

3. Configure the FastAPI backend:

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY
```

The backend runs at `http://localhost:8000` and serves the chat endpoint at `http://localhost:8000/chat`.

4. Serve the app and backend together from the repo root:

```bash
npm run dev
```

See [backend/README.md](./backend/README.md) for advanced FastAPI setup and cloud deployment options.

## Quality checks

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

You can also run the full local verification bundle with:

```bash
npm run check
```

## Production notes

- The app expects a backend proxy. Do not put provider API keys in browser env vars.
- Deploy FastAPI backend to any cloud (Render, Railway, Fly.io, AWS, GCP, Azure). See [backend/README.md](./backend/README.md).
- Set `ALLOWED_ORIGINS` in your backend configuration to restrict which browser origins can call the chat function.
- A GitHub Actions workflow is included at `.github/workflows/ci.yml` to enforce lint, typecheck, test, and build on every PR.
