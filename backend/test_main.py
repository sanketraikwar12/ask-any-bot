import pytest
import json
from unittest.mock import patch, MagicMock
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from main import (
    is_domain,
    normalize_domain,
    parse_intent,
    normalize_messages,
    parse_allowed_origins,
    is_request_origin_allowed,
    resolve_cors_allow_origin,
)


class TestDomainValidation:
    def test_is_domain_valid(self):
        assert is_domain("college") is True
        assert is_domain("health") is True
        assert is_domain("crops") is True
        assert is_domain("general") is True

    def test_is_domain_invalid(self):
        assert is_domain("invalid") is False
        assert is_domain("") is False
        assert is_domain(123) is False
        assert is_domain(None) is False

    def test_normalize_domain_valid(self):
        assert normalize_domain("college") == "college"
        assert normalize_domain("health") == "health"

    def test_normalize_domain_invalid_defaults_to_general(self):
        assert normalize_domain("invalid") == "general"
        assert normalize_domain("") == "general"


class TestIntentParsing:
    def test_parse_intent_with_valid_tag(self):
        text = "[INTENT:admissions] Great question about college admissions!"
        result = parse_intent(text)
        assert result["intent"] == "admissions"
        assert "Great question" in result["cleanText"]

    def test_parse_intent_with_whitespace(self):
        text = "[INTENT:scholarships]   Here is information about scholarships."
        result = parse_intent(text)
        assert result["intent"] == "scholarships"
        assert result["cleanText"].startswith("Here")

    def test_parse_intent_no_tag(self):
        text = "This is a response without an intent tag."
        result = parse_intent(text)
        assert result["intent"] is None
        assert result["cleanText"] == text

    def test_parse_intent_malformed_tag(self):
        text = "[INTENT admissions] Missing colon"
        result = parse_intent(text)
        assert result["intent"] is None


class TestMessageNormalization:
    def test_normalize_valid_messages(self):
        messages = [
            {"role": "user", "content": "Hello"},
            {"role": "assistant", "content": "Hi there!"},
        ]
        result = normalize_messages(messages)
        assert len(result) == 2
        assert result[0]["role"] == "user"
        assert result[1]["role"] == "assistant"

    def test_normalize_strips_whitespace(self):
        messages = [{"role": "user", "content": "  Hello  \n"}]
        result = normalize_messages(messages)
        assert result[0]["content"] == "Hello"

    def test_normalize_rejects_non_list(self):
        with pytest.raises(ValueError, match="must be provided as an array"):
            normalize_messages({"role": "user", "content": "Hello"})

    def test_normalize_rejects_empty_message(self):
        messages = [{"role": "user", "content": ""}]
        with pytest.raises(ValueError, match="cannot be empty"):
            normalize_messages(messages)

    def test_normalize_rejects_invalid_role(self):
        messages = [{"role": "admin", "content": "Hello"}]
        with pytest.raises(ValueError, match="must be either 'user' or 'assistant'"):
            normalize_messages(messages)

    def test_normalize_rejects_too_long_message(self):
        long_content = "x" * 5000
        messages = [{"role": "user", "content": long_content}]
        with pytest.raises(ValueError, match="cannot exceed"):
            normalize_messages(messages)

    def test_normalize_respects_max_message_count(self):
        messages = [{"role": "user", "content": f"Message {i}"} for i in range(25)]
        result = normalize_messages(messages)
        assert len(result) == 20  # MAX_MESSAGE_COUNT

    def test_normalize_rejects_excessive_total_length(self):
        messages = [
            {"role": "user", "content": "x" * 3000},
            {"role": "assistant", "content": "y" * 3000},
            {"role": "user", "content": "z" * 3000},
            {"role": "assistant", "content": "w" * 3000},
            {"role": "user", "content": "v" * 3000},
            {"role": "assistant", "content": "u" * 3000},
            {"role": "user", "content": "t" * 3000},
            {"role": "assistant", "content": "s" * 3000},
        ]
        with pytest.raises(ValueError, match="payload cannot exceed"):
            normalize_messages(messages)


class TestCORSParsing:
    def test_parse_allowed_origins_single(self):
        result = parse_allowed_origins("http://localhost:3000")
        assert result == ["http://localhost:3000"]

    def test_parse_allowed_origins_multiple(self):
        origins = "http://localhost:3000,http://localhost:8081,https://example.com"
        result = parse_allowed_origins(origins)
        assert len(result) == 3
        assert "http://localhost:3000" in result
        assert "https://example.com" in result

    def test_parse_allowed_origins_with_spaces(self):
        origins = "http://localhost:3000 , http://localhost:8081"
        result = parse_allowed_origins(origins)
        assert result == ["http://localhost:3000", "http://localhost:8081"]

    def test_parse_allowed_origins_empty(self):
        assert parse_allowed_origins("") == []
        assert parse_allowed_origins(None) == []

    def test_is_request_origin_allowed_match(self):
        allowed = ["http://localhost:3000", "https://example.com"]
        assert is_request_origin_allowed(allowed, "http://localhost:3000") is True

    def test_is_request_origin_allowed_no_match(self):
        allowed = ["http://localhost:3000"]
        assert is_request_origin_allowed(allowed, "https://other.com") is False

    def test_is_request_origin_allowed_empty_allowlist_requires_origin(self):
        assert is_request_origin_allowed([], "http://localhost:3000") is False
        assert is_request_origin_allowed([], None) is True

    def test_resolve_cors_allow_origin_match(self):
        allowed = ["http://localhost:3000"]
        result = resolve_cors_allow_origin(allowed, "http://localhost:3000")
        assert result == "http://localhost:3000"

    def test_resolve_cors_allow_origin_no_match(self):
        allowed = ["http://localhost:3000"]
        result = resolve_cors_allow_origin(allowed, "https://other.com")
        assert result == ""

    def test_resolve_cors_allow_origin_empty_allowlist(self):
        result = resolve_cors_allow_origin([], "http://localhost:3000")
        assert result == "*"

    def test_resolve_cors_allow_origin_no_request_origin_empty_allowlist(self):
        result = resolve_cors_allow_origin([], None)
        assert result == "*"
