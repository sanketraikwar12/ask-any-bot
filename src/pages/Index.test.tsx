import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import Index from "./Index";
import { CHAT_SESSION_STORAGE_KEY } from "@/lib/chat-session";

const { streamChatMock } = vi.hoisted(() => ({
  streamChatMock: vi.fn(),
}));

vi.mock("@/lib/chat", async () => {
  const actual = await vi.importActual<typeof import("@/lib/chat")>("@/lib/chat");

  return {
    ...actual,
    streamChat: streamChatMock,
  };
});

describe("Index", () => {
  let isOnline = true;

  beforeEach(() => {
    window.localStorage.clear();
    streamChatMock.mockReset();
    isOnline = true;
    vi.spyOn(window.navigator, "onLine", "get").mockImplementation(() => isOnline);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("restores persisted messages and assistant intent badges from session storage", () => {
    window.localStorage.setItem(
      CHAT_SESSION_STORAGE_KEY,
      JSON.stringify({
        domain: "college",
        messages: [
          { role: "user", content: "Need scholarship advice" },
          {
            role: "assistant",
            content: "Start with merit and department-specific awards.",
            intent: "scholarships",
          },
        ],
      }),
    );

    render(<Index />);

    expect(screen.getByText("Need scholarship advice")).toBeInTheDocument();
    expect(
      screen.getByText("Start with merit and department-specific awards."),
    ).toBeInTheDocument();
    expect(screen.getByText("scholarships")).toBeInTheDocument();
  });

  it("shows an inline retry state after a failed request and can recover", async () => {
    streamChatMock.mockImplementationOnce(async ({ onDone }) => {
      onDone();
      throw new Error("Network down");
    });

    streamChatMock.mockImplementationOnce(async ({ onDelta, onDone }) => {
      onDelta("[INTENT:question] Recovered answer");
      onDone();
    });

    render(<Index />);

    const input = screen.getByLabelText("Message input");
    fireEvent.change(input, { target: { value: "Hello" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Network down");
    });

    fireEvent.click(screen.getByRole("button", { name: /retry last question/i }));

    await waitFor(() => {
      expect(screen.getByText("Recovered answer")).toBeInTheDocument();
    });

    expect(streamChatMock).toHaveBeenCalledTimes(2);
  });

  it("shows setup instructions when the backend is missing the Anthropic secret", async () => {
    streamChatMock.mockImplementationOnce(async ({ onDone }) => {
      onDone();
      throw new Error(
        "Server is missing ANTHROPIC_API_KEY configuration.",
      );
    });

    render(<Index />);

    const input = screen.getByLabelText("Message input");
    fireEvent.change(input, { target: { value: "Hello" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Chat backend needs one more secret.");
    });

    expect(
      screen.getByText(
        "The chat backend is online, but it cannot call Anthropic until ANTHROPIC_API_KEY is configured.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/Set ANTHROPIC_API_KEY in backend\/.env/i)).toBeInTheDocument();
  });

  it("explains when the configured Anthropic key is invalid", async () => {
    streamChatMock.mockImplementationOnce(async ({ onDone }) => {
      onDone();
      throw new Error(
        "The AI provider rejected the request. Check that you configured a valid Anthropic API key.",
      );
    });

    render(<Index />);

    const input = screen.getByLabelText("Message input");
    fireEvent.change(input, { target: { value: "Hello" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Anthropic API key rejected.");
    });

    expect(
      screen.getByText(
        "The backend reached Anthropic, but the configured key was rejected. Use a valid Anthropic API key.",
      ),
    ).toBeInTheDocument();
  });

  it("keeps drafts editable offline and only enables send controls again after reconnect", async () => {
    isOnline = false;

    streamChatMock.mockImplementationOnce(async ({ onDelta, onDone }) => {
      onDelta("[INTENT:question] Connected again");
      onDone();
    });

    render(<Index />);

    expect(screen.getByText("Offline mode")).toBeInTheDocument();

    const sendButton = screen.getByRole("button", { name: /send message/i });
    expect(sendButton).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "What are the latest trends in AI?" }),
    ).toBeDisabled();

    const input = screen.getByLabelText("Message input");
    fireEvent.change(input, { target: { value: "Offline draft" } });

    await waitFor(() => {
      expect(JSON.parse(window.localStorage.getItem(CHAT_SESSION_STORAGE_KEY) ?? "{}")).toMatchObject(
        {
          draft: "Offline draft",
        },
      );
    });

    act(() => {
      isOnline = true;
      window.dispatchEvent(new Event("online"));
    });

    await waitFor(() => {
      expect(screen.queryByText("Offline mode")).not.toBeInTheDocument();
      expect(sendButton).toBeEnabled();
    });

    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(screen.getByText("Connected again")).toBeInTheDocument();
    });

    expect(streamChatMock).toHaveBeenCalledTimes(1);
  });
});
