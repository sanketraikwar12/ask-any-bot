import { afterEach, describe, expect, it, vi } from "vitest";
import { normalizeMessages } from "../../shared/chat.ts";
import { parseIntent, resolveChatRuntimeConfig, streamChat } from "./chat";

const originalFetch = global.fetch;

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  global.fetch = originalFetch;
});

describe("parseIntent", () => {
  it("extracts the intent tag and returns clean text", () => {
    expect(parseIntent("[INTENT:Recommendation] Try this")).toEqual({
      intent: "recommendation",
      cleanText: "Try this",
    });
  });
});

describe("normalizeMessages", () => {
  it("trims messages and keeps valid roles", () => {
    expect(
      normalizeMessages([
        { role: "user", content: "  Hello  " },
        { role: "assistant", content: "  Hi there  " },
      ]),
    ).toEqual([
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi there" },
    ]);
  });

  it("rejects invalid message roles", () => {
    expect(() =>
      normalizeMessages([{ role: "system", content: "nope" }]),
    ).toThrow("Each message role must be either 'user' or 'assistant'.");
  });
});

describe("resolveChatRuntimeConfig", () => {
  it("resolves chat function URL from environment", () => {
    vi.stubEnv("VITE_CHAT_FUNCTION_URL", "https://chat.example.com");

    expect(resolveChatRuntimeConfig()).toEqual({
      url: "https://chat.example.com/",
    });
  });

  it("rejects invalid custom chat function URLs", () => {
    vi.stubEnv("VITE_CHAT_FUNCTION_URL", "chat.example.com");

    expect(() => resolveChatRuntimeConfig()).toThrow(
      "Invalid VITE_CHAT_FUNCTION_URL. Use a full http(s) URL.",
    );
  });

  it("throws when VITE_CHAT_FUNCTION_URL is not configured", () => {
    vi.stubEnv("VITE_CHAT_FUNCTION_URL", "");

    expect(() => resolveChatRuntimeConfig()).toThrow(
      "Missing chat backend configuration. Set VITE_CHAT_FUNCTION_URL to your backend chat endpoint.",
    );
  });
});

describe("streamChat", () => {
  it("streams SSE chunks and signals completion", async () => {
    vi.stubEnv("VITE_CHAT_FUNCTION_URL", "https://demo.example.com/chat");

    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          encoder.encode('data: {"choices":[{"delta":{"content":"[INTENT:question] Hel"}}]}\n'),
        );
        controller.enqueue(
          encoder.encode('data: {"choices":[{"delta":{"content":"lo world"}}]}\n'),
        );
        controller.enqueue(encoder.encode("data: [DONE]\n"));
        controller.close();
      },
    });

    global.fetch = vi.fn().mockResolvedValue(
      new Response(body, {
        status: 200,
        headers: {
          "Content-Type": "text/event-stream",
        },
      }),
    );

    const received: string[] = [];
    const onDone = vi.fn();

    await streamChat({
      messages: [{ role: "user", content: "Hello" }],
      domain: "general",
      onDelta: (chunk) => received.push(chunk),
      onDone,
    });

    expect(received.join("")).toBe("[INTENT:question] Hello world");
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      "https://demo.example.com/chat",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Accept: "text/event-stream",
        }),
      }),
    );
  });

  it("turns generic fetch failures into an actionable backend error", async () => {
    vi.stubEnv("VITE_CHAT_FUNCTION_URL", "https://demo.example.com/chat");

    global.fetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));

    const onDone = vi.fn();

    await expect(
      streamChat({
        messages: [{ role: "user", content: "Hello" }],
        domain: "general",
        onDelta: vi.fn(),
        onDone,
      }),
    ).rejects.toThrow(
      "Could not reach the chat backend at demo.example.com. Check VITE_CHAT_FUNCTION_URL and confirm the backend is deployed and this browser origin is allowed.",
    );

    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("explains how to restart local dev when the local backend cannot be reached", async () => {
    vi.stubEnv("VITE_CHAT_FUNCTION_URL", "http://localhost:8000/chat");

    global.fetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(
      streamChat({
        messages: [{ role: "user", content: "Hello" }],
        domain: "general",
        onDelta: vi.fn(),
        onDone: vi.fn(),
      }),
    ).rejects.toThrow(
      "Could not reach the local chat backend at localhost:8000 from http://localhost:3000. Stop the old dev server and run npm run dev so Vite and FastAPI start together. If the backend is already running, add http://localhost:3000 to backend ALLOWED_ORIGINS.",
    );
  });
});
