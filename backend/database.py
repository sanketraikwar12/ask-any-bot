import sqlite3
import os
from datetime import datetime
from typing import Optional, List
from contextlib import contextmanager

DATABASE_PATH = os.getenv("DATABASE_PATH", "ask_any_bot.db")


def init_db():
    """Initialize SQLite database with schema."""
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()

    # Users table
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT UNIQUE NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """
    )

    # Chat sessions table
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS chat_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            domain TEXT NOT NULL DEFAULT 'general',
            title TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    """
    )

    # Messages table
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            intent TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE,
            CHECK (role IN ('user', 'assistant'))
        )
    """
    )

    # Create indexes for performance
    cursor.execute(
        "CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id)"
    )
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_chat_sessions_user ON chat_sessions(user_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_users_session_id ON users(session_id)")

    conn.commit()
    conn.close()


@contextmanager
def get_db_connection():
    """Context manager for database connections."""
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def get_or_create_user(session_id: str) -> int:
    """Get or create user by session ID."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM users WHERE session_id = ?", (session_id,))
        row = cursor.fetchone()

        if row:
            cursor.execute(
                "UPDATE users SET last_active = CURRENT_TIMESTAMP WHERE id = ?",
                (row["id"],),
            )
            return row["id"]

        cursor.execute("INSERT INTO users (session_id) VALUES (?)", (session_id,))
        return cursor.lastrowid


def create_chat_session(user_id: int, domain: str = "general", title: Optional[str] = None) -> int:
    """Create a new chat session."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO chat_sessions (user_id, domain, title) VALUES (?, ?, ?)",
            (user_id, domain, title),
        )
        return cursor.lastrowid


def get_user_sessions(user_id: int, limit: int = 50) -> List[dict]:
    """Get sessions for a user."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT id, domain, title, created_at, updated_at
            FROM chat_sessions
            WHERE user_id = ?
            ORDER BY updated_at DESC
            LIMIT ?
            """,
            (user_id, limit),
        )
        return [dict(row) for row in cursor.fetchall()]


def get_session_messages(session_id: int) -> List[dict]:
    """Get all messages in a session."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT role, content, intent, created_at
            FROM messages
            WHERE session_id = ?
            ORDER BY created_at ASC
            """,
            (session_id,),
        )
        return [dict(row) for row in cursor.fetchall()]


def save_message(
    session_id: int, role: str, content: str, intent: Optional[str] = None
) -> int:
    """Save a message to the database."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO messages (session_id, role, content, intent)
            VALUES (?, ?, ?, ?)
            """,
            (session_id, role, content, intent),
        )
        # Update session timestamp
        cursor.execute(
            "UPDATE chat_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (session_id,),
        )
        return cursor.lastrowid


def get_user_stats(user_id: int) -> dict:
    """Get user statistics."""
    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Total sessions
        cursor.execute("SELECT COUNT(*) as count FROM chat_sessions WHERE user_id = ?", (user_id,))
        total_sessions = cursor.fetchone()["count"]

        # Total messages
        cursor.execute(
            """
            SELECT COUNT(*) as count FROM messages
            WHERE session_id IN (SELECT id FROM chat_sessions WHERE user_id = ?)
            """,
            (user_id,),
        )
        total_messages = cursor.fetchone()["count"]

        # Domain breakdown
        cursor.execute(
            """
            SELECT domain, COUNT(*) as count
            FROM chat_sessions
            WHERE user_id = ?
            GROUP BY domain
            """,
            (user_id,),
        )
        domain_stats = {row["domain"]: row["count"] for row in cursor.fetchall()}

        return {
            "user_id": user_id,
            "total_sessions": total_sessions,
            "total_messages": total_messages,
            "domain_stats": domain_stats,
        }
