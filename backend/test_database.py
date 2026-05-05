import pytest
import tempfile
import os
import sys
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


@pytest.fixture
def temp_db():
    """Create a temporary database for testing."""
    with tempfile.NamedTemporaryFile(delete=False, suffix=".db") as f:
        db_path = f.name

    # Set environment variable for this test
    os.environ["DATABASE_PATH"] = db_path

    # Import after setting env var
    import database
    database.DATABASE_PATH = db_path

    # Initialize database
    database.init_db()

    yield db_path, database

    # Cleanup
    if os.path.exists(db_path):
        os.remove(db_path)


class TestDatabase:
    def test_init_db_creates_tables(self, temp_db):
        """Test that init_db creates required tables."""
        db_path, db = temp_db

        with db.get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
            tables = {row[0] for row in cursor.fetchall()}

        assert "users" in tables
        assert "chat_sessions" in tables
        assert "messages" in tables

    def test_get_or_create_user_creates_new(self, temp_db):
        """Test creating a new user."""
        db_path, db = temp_db
        user_id = db.get_or_create_user("test_session_123")

        assert user_id is not None
        assert isinstance(user_id, int)

    def test_get_or_create_user_returns_existing(self, temp_db):
        """Test retrieving an existing user."""
        db_path, db = temp_db
        user_id_1 = db.get_or_create_user("test_session")
        user_id_2 = db.get_or_create_user("test_session")

        assert user_id_1 == user_id_2

    def test_create_chat_session(self, temp_db):
        """Test creating a chat session."""
        db_path, db = temp_db
        user_id = db.get_or_create_user("test_user")
        session_id = db.create_chat_session(user_id, "health", "My health questions")

        assert session_id is not None
        assert isinstance(session_id, int)

    def test_create_chat_session_defaults_domain(self, temp_db):
        """Test that domain defaults to general."""
        db_path, db = temp_db
        user_id = db.get_or_create_user("test_user")
        session_id = db.create_chat_session(user_id)

        sessions = db.get_user_sessions(user_id)
        assert sessions[0]["domain"] == "general"

    def test_get_user_sessions(self, temp_db):
        """Test retrieving user sessions."""
        db_path, db = temp_db
        user_id = db.get_or_create_user("test_user")

        session_id_1 = db.create_chat_session(user_id, "college", "College info")
        session_id_2 = db.create_chat_session(user_id, "health", "Health tips")

        sessions = db.get_user_sessions(user_id)
        assert len(sessions) == 2
        assert sessions[0]["domain"] in ["college", "health"]

    def test_save_and_get_messages(self, temp_db):
        """Test saving and retrieving messages."""
        db_path, db = temp_db
        user_id = db.get_or_create_user("test_user")
        session_id = db.create_chat_session(user_id, "college")

        db.save_message(session_id, "user", "What's the best college?")
        db.save_message(session_id, "assistant", "[INTENT:admissions] Great question!", "admissions")

        messages = db.get_session_messages(session_id)
        assert len(messages) == 2
        assert messages[0]["role"] == "user"
        assert messages[0]["content"] == "What's the best college?"
        assert messages[1]["role"] == "assistant"
        assert messages[1]["intent"] == "admissions"

    def test_get_user_stats(self, temp_db):
        """Test retrieving user statistics."""
        db_path, db = temp_db
        user_id = db.get_or_create_user("test_user")

        session_id = db.create_chat_session(user_id, "health", "Session 1")
        db.save_message(session_id, "user", "Help me")
        db.save_message(session_id, "assistant", "I will help you", "general")

        stats = db.get_user_stats(user_id)
        assert stats["user_id"] == user_id
        assert stats["total_sessions"] == 1
        assert stats["total_messages"] == 2
        assert "health" in stats["domain_stats"]

    def test_get_user_stats_multiple_domains(self, temp_db):
        """Test stats with multiple domains."""
        db_path, db = temp_db
        user_id = db.get_or_create_user("test_user")

        session_1 = db.create_chat_session(user_id, "health")
        session_2 = db.create_chat_session(user_id, "college")
        session_3 = db.create_chat_session(user_id, "health")

        db.save_message(session_1, "user", "msg")
        db.save_message(session_2, "user", "msg")
        db.save_message(session_3, "user", "msg")

        stats = db.get_user_stats(user_id)
        assert stats["total_sessions"] == 3
        assert stats["domain_stats"]["health"] == 2
        assert stats["domain_stats"]["college"] == 1

    def test_db_connection_context_manager_commits(self, temp_db):
        """Test that context manager commits changes."""
        db_path, db = temp_db
        user_id = db.get_or_create_user("test_user_commit")

        # Verify the user was actually saved
        with db.get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM users WHERE id = ?", (user_id,))
            count = cursor.fetchone()[0]

        assert count == 1

    def test_db_connection_context_manager_rollback_on_error(self, temp_db):
        """Test that context manager rolls back on error."""
        db_path, db = temp_db
        initial_count = 0

        with db.get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM users")
            initial_count = cursor.fetchone()[0]

        # Try to insert and cause an error
        try:
            with db.get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("INSERT INTO users (session_id) VALUES (?)", ("error_test",))
                # Simulate an error
                raise ValueError("Test error")
        except ValueError:
            pass

        # Verify the insert was rolled back
        with db.get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM users")
            final_count = cursor.fetchone()[0]

        assert final_count == initial_count
