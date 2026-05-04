export const DOMAINS = ["college", "health", "crops", "general"] as const;

export type Domain = (typeof DOMAINS)[number];
export type MessageRole = "user" | "assistant";

export type Message = {
  role: MessageRole;
  content: string;
  intent?: string;
};

export const DEFAULT_DOMAIN: Domain = "general";
export const MAX_MESSAGE_COUNT = 20;
export const MAX_MESSAGE_LENGTH = 4_000;
export const MAX_TOTAL_MESSAGE_LENGTH = 20_000;

export const DOMAIN_PROMPTS: Record<Domain, string> = {
  college:
    "You are an expert college advisor. You help students with admissions, course selection, campus life, scholarships, and academic planning. Detect the user's intent and respond helpfully. Always start your response with an intent tag like [INTENT:admissions], [INTENT:courses], [INTENT:scholarships], [INTENT:campus_life], or [INTENT:general_college].",
  health:
    "You are a knowledgeable health assistant. You provide general health information about nutrition, exercise, common ailments, mental wellness, and preventive care. You are not a doctor. Be careful, avoid definitive diagnoses, and recommend consulting a qualified healthcare professional when appropriate. Detect intent and start with [INTENT:nutrition], [INTENT:exercise], [INTENT:mental_health], [INTENT:symptoms], or [INTENT:general_health].",
  crops:
    "You are an agricultural expert assistant. You help farmers and gardeners with crop selection, pest management, soil health, irrigation, seasonal planning, and market trends. Detect intent and start with [INTENT:pest_management], [INTENT:soil_health], [INTENT:irrigation], [INTENT:crop_selection], or [INTENT:general_agriculture].",
  general:
    "You are a helpful AI assistant with broad knowledge. Answer clearly, stay practical, and detect the user's intent. Start with [INTENT:question], [INTENT:explanation], [INTENT:recommendation], [INTENT:creative], or [INTENT:general].",
};

export const DOMAIN_SUGGESTIONS: Record<Domain, string[]> = {
  college: [
    "What are the best scholarships for CS students?",
    "How do I write a strong personal statement?",
  ],
  health: [
    "What are the benefits of intermittent fasting?",
    "How can I improve my sleep quality?",
  ],
  crops: [
    "What crops grow best in sandy soil?",
    "How do I manage aphid infestations organically?",
  ],
  general: ["Explain quantum computing simply", "What are the latest trends in AI?"],
};

export function isDomain(value: unknown): value is Domain {
  return typeof value === "string" && DOMAINS.includes(value as Domain);
}

export function getDomainPrompt(domain: unknown): string {
  return DOMAIN_PROMPTS[isDomain(domain) ? domain : DEFAULT_DOMAIN];
}

export function normalizeDomain(domain: unknown): Domain {
  return isDomain(domain) ? domain : DEFAULT_DOMAIN;
}

export function parseIntent(text: string): { intent: string | null; cleanText: string } {
  const match = text.match(/^\[INTENT:([^\]]+)\]\s*/);

  if (!match) {
    return { intent: null, cleanText: text };
  }

  return {
    intent: match[1].trim().toLowerCase(),
    cleanText: text.slice(match[0].length),
  };
}

export function normalizeMessages(input: unknown): Message[] {
  if (!Array.isArray(input)) {
    throw new Error("Messages must be provided as an array.");
  }

  const trimmed = input
    .slice(-MAX_MESSAGE_COUNT)
    .map((message) => {
      if (!message || typeof message !== "object") {
        throw new Error("Each message must be an object.");
      }

      const role = "role" in message ? message.role : undefined;
      const content = "content" in message ? message.content : undefined;

      if (role !== "user" && role !== "assistant") {
        throw new Error("Each message role must be either 'user' or 'assistant'.");
      }

      if (typeof content !== "string") {
        throw new Error("Each message content must be a string.");
      }

      const normalizedContent = content.trim();

      if (!normalizedContent) {
        throw new Error("Messages cannot be empty.");
      }

      if (normalizedContent.length > MAX_MESSAGE_LENGTH) {
        throw new Error(
          `Messages cannot exceed ${MAX_MESSAGE_LENGTH.toLocaleString()} characters each.`,
        );
      }

      return { role, content: normalizedContent } satisfies Message;
    });

  const totalLength = trimmed.reduce((sum, message) => sum + message.content.length, 0);

  if (totalLength > MAX_TOTAL_MESSAGE_LENGTH) {
    throw new Error(
      `Conversation payload cannot exceed ${MAX_TOTAL_MESSAGE_LENGTH.toLocaleString()} characters.`,
    );
  }

  return trimmed;
}
