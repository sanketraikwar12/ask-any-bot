import {
  normalizeDomain,
  normalizeMessages,
  parseIntent,
  type Domain,
  type Message,
} from "../../shared/chat.ts";

type ChatRuntimeConfig = {
  url: string;
};

function parseHttpUrl(value: string, envName: string) {
  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`Invalid ${envName}. Use a full http(s) URL.`);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Invalid ${envName}. Use a full http(s) URL.`);
  }

  return parsed;
}

export function resolveChatRuntimeConfig(): ChatRuntimeConfig {
  const functionUrl = import.meta.env.VITE_CHAT_FUNCTION_URL?.trim();

  if (!functionUrl) {
    throw new Error(
      "Missing chat backend configuration. Set VITE_CHAT_FUNCTION_URL to your backend chat endpoint.",
    );
  }

  return {
    url: parseHttpUrl(functionUrl, "VITE_CHAT_FUNCTION_URL").toString(),
  };
}

function isNetworkFetchError(error: unknown) {
  if (!(error instanceof TypeError)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes("failed to fetch") ||
    message.includes("networkerror") ||
    message.includes("load failed")
  );
}

function createNetworkFailureMessage(url: string) {
  const host = (() => {
    try {
      return new URL(url).host;
    } catch {
      return null;
    }
  })();
  const browserOrigin =
    typeof window === "undefined" || !window.location.origin ? null : window.location.origin;

  if (!host) {
    return "Could not reach the chat backend. Check VITE_CHAT_FUNCTION_URL.";
  }

  const localBackend =
    host.startsWith("localhost") || host.startsWith("127.0.0.1") || host.startsWith("[::1]");

  if (localBackend && browserOrigin) {
    return `Could not reach the local chat backend at ${host} from ${browserOrigin}. Stop the old dev server and run npm run dev so Vite and FastAPI start together. If the backend is already running, add ${browserOrigin} to backend ALLOWED_ORIGINS.`;
  }

  return `Could not reach the chat backend at ${host}. Check VITE_CHAT_FUNCTION_URL and confirm the backend is deployed and this browser origin is allowed.`;
}

async function readErrorMessage(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const payload = await response.json().catch(() => null);
    const error =
      typeof payload?.error === "string"
        ? payload.error
        : typeof payload?.message === "string"
          ? payload.message
          : null;

    if (error) {
      return error;
    }
  }

  const text = await response.text().catch(() => "");
  return text.trim() || `Request failed (${response.status})`;
}

function processSseChunk(buffer: string, onDelta: (text: string) => void) {
  let workingBuffer = buffer;

  while (workingBuffer.includes("\n")) {
    const newlineIndex = workingBuffer.indexOf("\n");
    let line = workingBuffer.slice(0, newlineIndex);
    workingBuffer = workingBuffer.slice(newlineIndex + 1);

    if (line.endsWith("\r")) {
      line = line.slice(0, -1);
    }

    if (!line || line.startsWith(":") || !line.startsWith("data: ")) {
      continue;
    }

    const payload = line.slice(6).trim();

    if (payload === "[DONE]") {
      return { buffer: workingBuffer, done: true };
    }

    try {
      const parsed = JSON.parse(payload);

      // Check for backend error messages
      if (typeof parsed.error === "string") {
        throw new Error(parsed.error);
      }

      const content = parsed.choices?.[0]?.delta?.content as string | undefined;

      if (content) {
        onDelta(content);
      }
    } catch (e) {
      if (e instanceof Error && !(e instanceof SyntaxError)) {
        throw e;
      }
      return { buffer: `${line}\n${workingBuffer}`, done: false };
    }
  }

  return { buffer: workingBuffer, done: false };
}

function flushSseBuffer(buffer: string, onDelta: (text: string) => void) {
  if (!buffer.trim()) {
    return;
  }

  for (const rawLine of buffer.split("\n")) {
    const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;

    if (!line.startsWith("data: ")) {
      continue;
    }

    const payload = line.slice(6).trim();

    if (payload === "[DONE]") {
      continue;
    }

    try {
      const parsed = JSON.parse(payload);

      // Check for backend error messages
      if (typeof parsed.error === "string") {
        throw new Error(parsed.error);
      }

      const content = parsed.choices?.[0]?.delta?.content as string | undefined;

      if (content) {
        onDelta(content);
      }
    } catch (e) {
      if (e instanceof Error && !(e instanceof SyntaxError)) {
        throw e;
      }
      // Ignore trailing partial fragments after the stream ends.
    }
  }
}

export { parseIntent };
export type { Domain, Message };

export async function streamChat({
  messages,
  domain,
  onDelta,
  onDone,
  signal,
}: {
  messages: Message[];
  domain: Domain;
  onDelta: (text: string) => void;
  onDone: () => void;
  signal?: AbortSignal;
}) {
  const { url } = resolveChatRuntimeConfig();
  const normalizedMessages = normalizeMessages(messages);
  const normalizedDomain = normalizeDomain(domain);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify({
        messages: normalizedMessages,
        domain: normalizedDomain,
      }),
      signal,
    });

    if (!response.ok || !response.body) {
      throw new Error(await readErrorMessage(response));
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let streamDone = false;

    while (!streamDone) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      const result = processSseChunk(buffer, onDelta);
      buffer = result.buffer;
      streamDone = result.done;
    }

    flushSseBuffer(buffer, onDelta);
  } catch (error) {
    if (signal?.aborted || (error instanceof DOMException && error.name === "AbortError")) {
      throw error;
    }

    if (isNetworkFetchError(error)) {
      throw new Error(createNetworkFailureMessage(url));
    }

    throw error;
  } finally {
    onDone();
  }
}
