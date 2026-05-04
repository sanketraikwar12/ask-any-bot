# Backend Setup - Quick Start

## What Was Created

✅ `main.py` — FastAPI application with all endpoints
✅ `database.py` — SQLite database module
✅ `requirements.txt` — Python dependencies
✅ `.env` — Configuration with your API key
✅ `.env.example` — Configuration template
✅ `README.md` — Complete documentation

## Backend Status

- **Installed:** FastAPI, Uvicorn, Anthropic SDK, Python-dotenv
- **Database:** SQLite with 3 tables (users, chat_sessions, messages)
- **API Endpoints:** 6 endpoints ready
- **CORS:** Configured for localhost
- **Streaming:** SSE support for real-time responses

## Run Backend

### Development

```bash
cd backend
python -m uvicorn main:app --reload
```

Server starts at: `http://localhost:8000`

### Production

```bash
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

## Configure Frontend

Update frontend `.env`:

```env
VITE_CHAT_FUNCTION_URL=http://localhost:8000/chat
```

Restart frontend:

```bash
npm run dev
```

## API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/chat` | Stream AI responses |
| POST | `/sessions/create` | Create new session |
| GET | `/sessions/{user_id}` | Get user sessions |
| GET | `/messages/{session_id}` | Get session messages |
| GET | `/stats/{user_id}` | Get user statistics |
| GET | `/health` | Health check |

## Environment Variables

```env
ANTHROPIC_API_KEY=sk-ant-your-key          # Required
ALLOWED_ORIGINS=http://localhost:8081      # Frontend URL
PORT=8000                                   # Server port
TIMEOUT_SECONDS=45                          # AI response timeout
DATABASE_PATH=ask_any_bot.db               # Database file
SAVE_TO_DB=true                            # Save messages
```

## Database

Automatically created on first run.

**Tables:**
- `users` — Track unique users
- `chat_sessions` — Store conversations
- `messages` — Store chat messages with intent

**Location:** `backend/ask_any_bot.db`

## Test It

1. Start backend: `python -m uvicorn main:app --reload`
2. Start frontend: `npm run dev`
3. Visit `http://localhost:8081`
4. Ask a question in any domain
5. Check database: `python verify_db.py` (if available)

## Features

✓ Domain-aware chat (college, health, crops, general)
✓ Real-time streaming responses
✓ Intent detection with [INTENT:*] tags
✓ Persistent message history
✓ User session tracking
✓ Statistics & analytics
✓ CORS support
✓ Error handling & validation
✓ Auto-reload in development

## Troubleshooting

**Backend won't start?**
- Check `.env` has `ANTHROPIC_API_KEY`
- Verify port 8000 is available
- Check dependencies: `pip list | grep -i fastapi`

**Frontend can't reach backend?**
- Verify backend running on `http://localhost:8000`
- Check frontend `.env` has correct `VITE_CHAT_FUNCTION_URL`
- Hard refresh browser: Ctrl+Shift+R

**Messages not saving?**
- Check `SAVE_TO_DB=true` in `.env`
- Verify database file created: `ls -la backend/ask_any_bot.db`
- Check user_id and session_id passed in request

## Next Steps

1. ✅ Backend created
2. ✅ Database configured
3. ✅ API endpoints ready
4. 📱 Update frontend .env
5. 🚀 Run both frontend and backend
6. 💬 Start chatting!

---

**Backend:** http://localhost:8000
**Frontend:** http://localhost:8081
**Database:** backend/ask_any_bot.db

Everything is ready! 🎉
