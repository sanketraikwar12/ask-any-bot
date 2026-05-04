import { afterEach, describe, expect, it } from "vitest";
import {
  CHAT_SESSION_STORAGE_KEY,
  clearChatSession,
  loadChatSession,
  saveChatSession,
} from "./chat-session";

afterEach(() => {
  window.localStorage.clear();
});

describe("chat session storage", () => {
  it("saves and restores a normalized chat session", () => {
    saveChatSession({
      domain: "health",
      draft: "Draft note",
      messages: [
        { role: "user", content: "  Need sleep help  " },
        { role: "assistant", content: "  Try a consistent bedtime.  ", intent: "Recommendation" },
      ],
    });

    expect(loadChatSession()).toEqual({
      domain: "health",
      draft: "Draft note",
      messages: [
        { role: "user", content: "Need sleep help" },
        { role: "assistant", content: "Try a consistent bedtime.", intent: "recommendation" },
      ],
    });
  });

  it("returns null for malformed persisted data", () => {
    window.localStorage.setItem(CHAT_SESSION_STORAGE_KEY, "{bad json");

    expect(loadChatSession()).toBeNull();
  });

  it("clears the stored session", () => {
    window.localStorage.setItem(
      CHAT_SESSION_STORAGE_KEY,
      JSON.stringify({
        domain: "general",
        draft: "",
        messages: [{ role: "user", content: "hello" }],
      }),
    );

    clearChatSession();

    expect(window.localStorage.getItem(CHAT_SESSION_STORAGE_KEY)).toBeNull();
  });
});
