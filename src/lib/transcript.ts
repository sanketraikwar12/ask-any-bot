import type { Domain, Message } from "./chat";

export function buildTranscript({
  domain,
  messages,
  exportedAt = new Date(),
}: {
  domain: Domain;
  messages: Message[];
  exportedAt?: Date;
}) {
  const header = [
    "# Ask Any Bot Transcript",
    "",
    `- Domain: ${domain}`,
    `- Exported: ${exportedAt.toISOString()}`,
    "",
  ];

  const body = messages.flatMap((message, index) => {
    const title = message.role === "user" ? "User" : "Assistant";
    const lines = [`## ${index + 1}. ${title}`];

    if (message.intent && message.role === "assistant") {
      lines.push(`Intent: ${message.intent}`);
    }

    lines.push("", message.content, "");
    return lines;
  });

  return [...header, ...body].join("\n");
}

export function createTranscriptFilename(domain: Domain, date = new Date()) {
  const stamp = date.toISOString().replace(/[:.]/g, "-");
  return `ask-any-bot-${domain}-${stamp}.md`;
}

export function downloadTranscript(filename: string, content: string) {
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("Transcript export is only available in the browser.");
  }

  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  anchor.click();

  window.URL.revokeObjectURL(url);
}
