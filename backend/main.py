import json
import os
import re
from typing import Literal, Optional
from contextlib import asynccontextmanager
from datetime import datetime

from dotenv import load_dotenv
from fastapi import FastAPI, Request, Response, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
import anthropic

from database import (
    init_db,
    get_or_create_user,
    create_chat_session,
    save_message,
    get_user_sessions,
    get_session_messages,
    get_user_stats,
)

# Load environment variables
load_dotenv()

# Constants - synced with frontend (shared/chat.ts)
DOMAINS = ["college", "health", "crops", "general"]
DEFAULT_DOMAIN = "general"
MAX_MESSAGE_COUNT = 20
MAX_MESSAGE_LENGTH = 4_000
MAX_TOTAL_MESSAGE_LENGTH = 20_000

DOMAIN_PROMPTS = {
    "college": (
        "You are an expert college advisor. You help students with admissions, course selection, "
        "campus life, scholarships, and academic planning. Detect the user's intent and respond helpfully. "
        "Always start your response with an intent tag like [INTENT:admissions], [INTENT:courses], "
        "[INTENT:scholarships], [INTENT:campus_life], or [INTENT:general_college]."
    ),
    "health": (
        "You are a knowledgeable health assistant. You provide general health information about nutrition, "
        "exercise, common ailments, mental wellness, and preventive care. You are not a doctor. Be careful, "
        "avoid definitive diagnoses, and recommend consulting a qualified healthcare professional when appropriate. "
        "Detect intent and start with [INTENT:nutrition], [INTENT:exercise], [INTENT:mental_health], "
        "[INTENT:symptoms], or [INTENT:general_health]."
    ),
    "crops": (
        "You are an agricultural expert assistant. You help farmers and gardeners with crop selection, "
        "pest management, soil health, irrigation, seasonal planning, and market trends. Detect intent and start "
        "with [INTENT:pest_management], [INTENT:soil_health], [INTENT:irrigation], [INTENT:crop_selection], "
        "or [INTENT:general_agriculture]."
    ),
    "general": (
        "You are a helpful AI assistant with broad knowledge. Answer clearly, stay practical, and detect "
        "the user's intent. Start with [INTENT:question], [INTENT:explanation], [INTENT:recommendation], "
        "[INTENT:creative], or [INTENT:general]."
    ),
}

# Configuration from environment
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
ALLOWED_ORIGINS_STR = os.getenv(
    "ALLOWED_ORIGINS",
    (
        "http://localhost:8081,http://127.0.0.1:8081,"
        "http://localhost:5173,http://127.0.0.1:5173,"
        "http://localhost:3000,http://127.0.0.1:3000"
    ),
)
PORT = int(os.getenv("PORT", "8000"))
TIMEOUT_SECONDS = int(os.getenv("TIMEOUT_SECONDS", "45"))
MODEL = "claude-opus-4-5"
SAVE_TO_DB = os.getenv("SAVE_TO_DB", "true").lower() == "true"


# Validation Functions
def is_domain(value) -> bool:
    return isinstance(value, str) and value in DOMAINS


def normalize_domain(value) -> str:
    return value if is_domain(value) else DEFAULT_DOMAIN


def get_domain_prompt(domain) -> str:
    normalized = normalize_domain(domain)
    return DOMAIN_PROMPTS[normalized]


def parse_intent(text: str) -> dict:
    """Extract [INTENT:*] tag from response text."""
    match = re.match(r"^\[INTENT:([^\]]+)\]\s*", text)
    if match:
        return {
            "intent": match.group(1).strip().lower(),
            "cleanText": text[match.end() :],
        }
    return {"intent": None, "cleanText": text}


def normalize_messages(data) -> list:
    """Validate and normalize message array."""
    if not isinstance(data, list):
        raise ValueError("Messages must be provided as an array.")

    # Take only last MAX_MESSAGE_COUNT messages
    trimmed = data[-MAX_MESSAGE_COUNT:]

    normalized = []
    for message in trimmed:
        if not isinstance(message, dict):
            raise ValueError("Each message must be an object.")

        role = message.get("role")
        content = message.get("content")

        if role not in ["user", "assistant"]:
            raise ValueError("Each message role must be either 'user' or 'assistant'.")

        if not isinstance(content, str):
            raise ValueError("Each message content must be a string.")

        normalized_content = content.strip()

        if not normalized_content:
            raise ValueError("Messages cannot be empty.")

        if len(normalized_content) > MAX_MESSAGE_LENGTH:
            raise ValueError(
                f"Messages cannot exceed {MAX_MESSAGE_LENGTH:,} characters each."
            )

        normalized.append({"role": role, "content": normalized_content})

    # Check total length
    total_length = sum(len(msg["content"]) for msg in normalized)
    if total_length > MAX_TOTAL_MESSAGE_LENGTH:
        raise ValueError(
            f"Conversation payload cannot exceed {MAX_TOTAL_MESSAGE_LENGTH:,} characters."
        )

    return normalized


# CORS Functions
def parse_allowed_origins(raw: Optional[str]) -> list:
    if not raw:
        return []
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


def is_request_origin_allowed(allowed_origins: list, request_origin: Optional[str]) -> bool:
    if not request_origin:
        return len(allowed_origins) == 0
    return request_origin in allowed_origins


def resolve_cors_allow_origin(allowed_origins: list, request_origin: Optional[str]) -> str:
    if not allowed_origins:
        return "*"
    if is_request_origin_allowed(allowed_origins, request_origin):
        return request_origin or "*"
    return ""


# Initialize FastAPI app with lifespan
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup validation
    if not ANTHROPIC_API_KEY:
        raise RuntimeError("ANTHROPIC_API_KEY environment variable is required")

    # Initialize database
    init_db()
    print("[+] Database initialized")
    print(f"[+] Saving to DB: {SAVE_TO_DB}")

    yield
    # Shutdown (if needed)


app = FastAPI(title="Ask Any Bot", lifespan=lifespan)

# Parse allowed origins
allowed_origins = parse_allowed_origins(ALLOWED_ORIGINS_STR)

# CORS Middleware
if allowed_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=True,
        allow_methods=["POST", "OPTIONS", "GET"],
        allow_headers=[
            "authorization",
            "x-client-info",
            "apikey",
            "content-type",
        ],
    )


def create_cors_headers(request: Request) -> dict:
    """Create CORS headers matching the request origin."""
    request_origin = request.headers.get("origin")
    allow_origin = resolve_cors_allow_origin(allowed_origins, request_origin)

    return {
        "Access-Control-Allow-Origin": allow_origin,
        "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
        "Access-Control-Allow-Headers": (
            "authorization, x-client-info, apikey, content-type"
        ),
        "Vary": "Origin",
    }


def json_response(status: int, payload: dict, request: Request) -> Response:
    """Return JSON error response with CORS headers."""
    return Response(
        content=json.dumps(payload),
        status_code=status,
        headers={
            **create_cors_headers(request),
            "Cache-Control": "no-store",
            "Content-Type": "application/json; charset=utf-8",
        },
    )


@app.options("/chat")
async def options_chat(request: Request):
    """Handle CORS preflight requests."""
    return Response(
        status_code=204,
        headers=create_cors_headers(request),
    )


@app.post("/chat")
async def chat(request: Request):
    """Main chat endpoint that streams responses using SSE."""
    request_origin = request.headers.get("origin")

    # Check CORS origin
    if allowed_origins and not is_request_origin_allowed(allowed_origins, request_origin):
        return json_response(
            403,
            {"error": "Origin not allowed. Configure ALLOWED_ORIGINS in backend."},
            request,
        )

    # Parse JSON
    try:
        payload = await request.json()
    except Exception:
        return json_response(400, {"error": "Request body must be valid JSON."}, request)

    # Validate messages
    try:
        messages = normalize_messages(payload.get("messages"))
    except ValueError as e:
        return json_response(400, {"error": str(e)}, request)

    # Validate domain
    domain = normalize_domain(payload.get("domain"))

    # Get session info for DB saving
    session_id = payload.get("session_id")
    user_id = payload.get("user_id")

    # Create streaming generator
    async def generate():
        full_response = ""
        detected_intent = None

        try:
            client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

            with client.messages.stream(
                model=MODEL,
                max_tokens=1024,
                system=get_domain_prompt(domain),
                messages=messages,
                timeout=TIMEOUT_SECONDS,
            ) as stream:
                for text in stream.text_stream:
                    full_response += text

                    # Transform Anthropic format to OpenAI format
                    openai_format = {
                        "choices": [{"delta": {"content": text}}],
                    }
                    yield f"data: {json.dumps(openai_format)}\n\n"

            # Parse intent from full response
            intent_info = parse_intent(full_response)
            detected_intent = intent_info["intent"]

            # Save to database if enabled
            if SAVE_TO_DB and session_id and user_id:
                try:
                    # Save user message
                    if messages and messages[-1]["role"] == "user":
                        save_message(session_id, "user", messages[-1]["content"])

                    # Save assistant response
                    save_message(session_id, "assistant", full_response, detected_intent)
                except Exception as e:
                    print(f"[!] Error saving to DB: {e}")

            # Send done marker
            yield "data: [DONE]\n\n"

        except anthropic.RateLimitError as e:
            print(f"[!] Rate limit error: {e}")
            yield f"data: {json.dumps({'error': 'AI service is busy. Try again shortly.'})}\n\n"
        except anthropic.AuthenticationError as e:
            print(f"[!] Authentication error: {e}")
            yield f"data: {json.dumps({'error': 'Invalid API key. Check ANTHROPIC_API_KEY.'})}\n\n"
        except anthropic.APIConnectionError as e:
            print(f"[!] API connection error: {e}")
            if "timeout" in str(e).lower():
                yield f"data: {json.dumps({'error': 'AI service took too long. Try again.'})}\n\n"
            else:
                yield f"data: {json.dumps({'error': 'AI service error. Try again.'})}\n\n"
        except Exception as e:
            print(f"[!] Unexpected error: {e}")
            yield f"data: {json.dumps({'error': 'Processing error. Try again.'})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            **create_cors_headers(request),
            "Cache-Control": "no-store, no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok", "timestamp": datetime.now().isoformat()}


@app.post("/sessions/create")
async def create_session(request: Request):
    """Create a new chat session."""
    try:
        payload = await request.json()
    except Exception:
        return json_response(400, {"error": "Invalid JSON."}, request)

    session_identifier = payload.get("session_id", "anonymous")
    domain = normalize_domain(payload.get("domain", "general"))
    title = payload.get("title")

    try:
        user_id = get_or_create_user(session_identifier)
        session_id = create_chat_session(user_id, domain, title)
        return {
            "session_id": session_id,
            "user_id": user_id,
            "domain": domain,
            "created_at": datetime.now().isoformat(),
        }
    except Exception as e:
        return json_response(500, {"error": str(e)}, request)


@app.get("/sessions/{user_id}")
async def get_sessions(request: Request, user_id: int):
    """Get all sessions for a user."""
    try:
        sessions = get_user_sessions(user_id)
        return {"sessions": sessions, "count": len(sessions)}
    except Exception as e:
        return json_response(500, {"error": str(e)}, request)


@app.get("/messages/{session_id}")
async def get_messages(request: Request, session_id: int):
    """Get all messages in a session."""
    try:
        messages = get_session_messages(session_id)
        return {"messages": messages, "count": len(messages)}
    except Exception as e:
        return json_response(500, {"error": str(e)}, request)


@app.get("/stats/{user_id}")
async def get_stats(request: Request, user_id: int):
    """Get user statistics."""
    try:
        stats = get_user_stats(user_id)
        return stats
    except Exception as e:
        return json_response(500, {"error": str(e)}, request)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=PORT)
