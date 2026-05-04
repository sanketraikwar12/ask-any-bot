import {
  MAX_MESSAGE_LENGTH,
  normalizeDomain,
  normalizeMessages,
  type Domain,
  type Message,
} from "../../shared/chat.ts";

const CHAT_SESSION_STORAGE_KEY = "ask-any-bot:session:v1";
const MAX_INTENT_LENGTH = 64;

type ChatSession = {
  domain: Domain;
  messages: Message[];
  draft: string;
};

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function normalizeSessionMessages(input: unknown): Message[] {
  const normalizedMessages = normalizeMessages(input);
  const rawMessages = Array.isArray(input) ? input.slice(-normalizedMessages.length) : [];

  return normalizedMessages.map((message, index) => {
    const rawMessage = rawMessages[index];
    const rawIntent =
      rawMessage &&
      typeof rawMessage === "object" &&
      "intent" in rawMessage &&
      typeof rawMessage.intent === "string"
        ? rawMessage.intent.trim().toLowerCase()
        : "";

    if (!rawIntent) {
      return message;
    }

    return {
      ...message,
      intent: rawIntent.slice(0, MAX_INTENT_LENGTH),
    };
  });
}

export function loadChatSession(): ChatSession | null {
  if (!canUseStorage()) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(CHAT_SESSION_STORAGE_KEY);

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as { domain?: unknown; messages?: unknown };
    const draft =
      typeof (parsed as { draft?: unknown }).draft === "string"
        ? (parsed as { draft: string }).draft.slice(0, MAX_MESSAGE_LENGTH)
        : "";

    return {
      domain: normalizeDomain(parsed.domain),
      messages: normalizeSessionMessages(parsed.messages),
      draft,
    };
  } catch {
    return null;
  }
}

export function saveChatSession(session: ChatSession) {
  if (!canUseStorage()) {
    return;
  }

  try {
    window.localStorage.setItem(
      CHAT_SESSION_STORAGE_KEY,
      JSON.stringify({
        domain: normalizeDomain(session.domain),
        messages: normalizeSessionMessages(session.messages),
        draft: session.draft.slice(0, MAX_MESSAGE_LENGTH),
      }),
    );
  } catch {
    // Ignore storage failures to keep chat usable in restricted browsers.
  }
}

export function clearChatSession() {
  if (!canUseStorage()) {
    return;
  }

  try {
    window.localStorage.removeItem(CHAT_SESSION_STORAGE_KEY);
  } catch {
    // Ignore storage failures to keep chat usable in restricted browsers.
  }
}

export { CHAT_SESSION_STORAGE_KEY };
