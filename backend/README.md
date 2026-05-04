# Ask Any Bot - FastAPI Backend

Production-ready FastAPI backend with SQLite database for the domain-aware AI chat application.

## Features

- **Streaming Chat** - Real-time token-by-token responses via Server-Sent Events (SSE)
- **Domain-Aware** - 4 specialized domains: college, health, crops, general
- **Intent Detection** - Automatic intent tag parsing from AI responses
- **Message History** - Persistent SQLite database storage
- **CORS Support** - Configurable origin allowlist
- **Request Validation** - Robust message and payload validation
- **Error Handling** - Comprehensive error responses with retry support
- **Timeout Protection** - Configurable request timeout (default 45s)
- **Health Checks** - Built-in `/health` endpoint for monitoring

## Quick Start

### 1. Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 2. Configure Environment

Copy `.env.example` to `.env` and update with your Anthropic API key:

```bash
cp .env.example .env
```

Edit `.env`:

```env
ANTHROPIC_API_KEY=sk-ant-your-key-here
ALLOWED_ORIGINS=http://localhost:8081,http://127.0.0.1:8081,http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000
PORT=8000
TIMEOUT_SECONDS=45
DATABASE_PATH=ask_any_bot.db
SAVE_TO_DB=true
```

### 3. Run Backend

**Development (with auto-reload):**

```bash
python -m uvicorn main:app --reload
```

**Production:**

```bash
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

Server runs at: `http://localhost:8000`

## API Endpoints

### POST /chat

Streams chat responses using Server-Sent Events (SSE).

**Request:**

```json
{
  "messages": [
    { "role": "user", "content": "What colleges are good for CS?" }
  ],
  "domain": "college",
  "session_id": 1,
  "user_id": 1
}
```

**Response (SSE):**

```
data: {"choices":[{"delta":{"content":"MIT, Stanford, and Carnegie Mellon"}}]}

data: {"choices":[{"delta":{"content":" are top choices"}}]}

...

data: [DONE]
```

**Domains:**

- `college` — College admissions, courses, scholarships, campus life
- `health` — Nutrition, exercise, wellness, mental health
- `crops` — Crop selection, pest management, soil health, irrigation
- `general` — Broad knowledge across all topics

### POST /sessions/create

Create a new chat session.

**Request:**

```json
{
  "session_id": "user-123",
  "domain": "college",
  "title": "College Planning"
}
```

**Response:**

```json
{
  "session_id": 1,
  "user_id": 1,
  "domain": "college",
  "created_at": "2026-04-23T12:00:00"
}
```

### GET /sessions/{user_id}

Get all sessions for a user.

**Response:**

```json
{
  "sessions": [
    {
      "id": 1,
      "domain": "college",
      "title": "College Planning",
      "created_at": "2026-04-23T12:00:00",
      "updated_at": "2026-04-23T12:05:00"
    }
  ],
  "count": 1
}
```

### GET /messages/{session_id}

Get all messages in a session.

**Response:**

```json
{
  "messages": [
    {
      "role": "user",
      "content": "What colleges are good?",
      "intent": null,
      "created_at": "2026-04-23T12:00:00"
    },
    {
      "role": "assistant",
      "content": "MIT is great for CS.",
      "intent": "admissions",
      "created_at": "2026-04-23T12:00:01"
    }
  ],
  "count": 2
}
```

### GET /stats/{user_id}

Get user statistics.

**Response:**

```json
{
  "user_id": 1,
  "total_sessions": 5,
  "total_messages": 47,
  "domain_stats": {
    "college": 2,
    "health": 2,
    "general": 1
  }
}
```

### GET /health

Health check endpoint.

**Response:**

```json
{
  "status": "ok",
  "timestamp": "2026-04-23T12:00:00"
}
```

## Database Schema

### Tables

**users**

```sql
id              INTEGER PRIMARY KEY
session_id      TEXT UNIQUE
created_at      TIMESTAMP
last_active     TIMESTAMP
```

**chat_sessions**

```sql
id              INTEGER PRIMARY KEY
user_id         INTEGER (FK)
domain          TEXT
title           TEXT
created_at      TIMESTAMP
updated_at      TIMESTAMP
```

**messages**

```sql
id              INTEGER PRIMARY KEY
session_id      INTEGER (FK)
role            TEXT (user|assistant)
content         TEXT
intent          TEXT
created_at      TIMESTAMP
```

### Indexes

- `idx_messages_session` — Fast message lookups
- `idx_chat_sessions_user` — Fast session lookups
- `idx_users_session_id` — Fast user lookups

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | ✅ | - | Your Anthropic API key |
| `ALLOWED_ORIGINS` | ❌ | localhost origins | CORS allowlist |
| `PORT` | ❌ | 8000 | Server port |
| `TIMEOUT_SECONDS` | ❌ | 45 | Request timeout |
| `DATABASE_PATH` | ❌ | ask_any_bot.db | SQLite database file |
| `SAVE_TO_DB` | ❌ | true | Save messages to database |

## Error Responses

All errors return JSON with appropriate HTTP status codes:

```json
{ "error": "Error message describing what went wrong" }
```

**Status Codes:**

- `400` — Bad request (invalid JSON, validation failure)
- `403` — Forbidden (CORS origin not allowed)
- `500` — Server error (missing configuration)

## Frontend Integration

### Update Frontend .env

```env
VITE_CHAT_FUNCTION_URL=http://localhost:8000/chat
```

### Send Requests

```typescript
const response = await fetch('http://localhost:8000/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    messages: [{ role: 'user', content: 'Your question' }],
    domain: 'college',
    session_id: 1,
    user_id: 1
  })
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  const chunk = decoder.decode(value);
  // Process SSE chunk
}
```

## Development

### View Database

```bash
# Using Python
python verify_db.py

# Or using sqlite3 CLI
sqlite3 ask_any_bot.db "SELECT * FROM messages;"
```

### Reset Database

```bash
rm ask_any_bot.db
# Restart backend - new database created
```

### Run Tests

```bash
python -m pytest
```

## Deployment

### Docker

Build image:

```bash
docker build -t ask-any-bot-backend:latest .
```

Run container:

```bash
docker run -p 8000:8000 \
  -e ANTHROPIC_API_KEY=your-key \
  -e ALLOWED_ORIGINS=https://yourdomain.com \
  ask-any-bot-backend:latest
```

### Cloud Platforms

**Render:**

1. Push to GitHub
2. Create Web Service on Render
3. Set environment variables
4. Deploy

**Railway:**

```bash
railway init
railway up
```

**Fly.io:**

```bash
fly launch
fly secrets set ANTHROPIC_API_KEY=your-key
fly deploy
```

## Performance

- **Streaming:** Real-time token-by-token responses
- **Timeout:** 45 seconds default (configurable)
- **Database:** Handles 100K+ messages efficiently
- **Memory:** ~150MB base, scales with concurrent streams
- **Indexes:** Optimized queries for common patterns

## Troubleshooting

### "ANTHROPIC_API_KEY is required"

Ensure `.env` file has `ANTHROPIC_API_KEY` set and backend restarted after creating `.env`.

### "Origin not allowed"

Your frontend origin is not in `ALLOWED_ORIGINS`. Update:

```env
ALLOWED_ORIGINS=http://localhost:8081,http://127.0.0.1:8081,https://yourdomain.com
```

Then restart backend.

### "CORS errors in browser"

1. Check frontend URL matches `ALLOWED_ORIGINS`
2. Verify `VITE_CHAT_FUNCTION_URL=http://localhost:8000/chat`
3. Restart both frontend and backend

### Database locked

SQLite locks during writes. If stuck:

```bash
rm ask_any_bot.db
# Restart backend
```

For production, consider PostgreSQL.

## Files

```
backend/
├── main.py ..................... FastAPI application
├── database.py ................. SQLite operations
├── requirements.txt ............ Python dependencies
├── .env ........................ Configuration (local)
├── .env.example ................ Configuration template
├── README.md ................... This file
└── ask_any_bot.db .............. SQLite database
```

## License

See main project LICENSE.

## Support

For issues or questions, check the main Ask Any Bot repository.
