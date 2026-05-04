import { describe, expect, it } from "vitest";
import { buildTranscript, createTranscriptFilename } from "./transcript";

describe("transcript helpers", () => {
  it("builds a readable markdown transcript", () => {
    const transcript = buildTranscript({
      domain: "college",
      exportedAt: new Date("2026-03-16T00:00:00.000Z"),
      messages: [
        { role: "user", content: "How do I find scholarships?" },
        {
          role: "assistant",
          content: "Start with merit-based and department-specific programs.",
          intent: "scholarships",
        },
      ],
    });

    expect(transcript).toContain("# Ask Any Bot Transcript");
    expect(transcript).toContain("- Domain: college");
    expect(transcript).toContain("## 1. User");
    expect(transcript).toContain("## 2. Assistant");
    expect(transcript).toContain("Intent: scholarships");
  });

  it("creates a stable export filename", () => {
    expect(
      createTranscriptFilename("general", new Date("2026-03-16T12:34:56.789Z")),
    ).toBe("ask-any-bot-general-2026-03-16T12-34-56-789Z.md");
  });
});
