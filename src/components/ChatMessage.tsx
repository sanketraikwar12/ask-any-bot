import { Suspense, lazy, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Bot, Check, Copy, User } from "lucide-react";
import { toast } from "sonner";
import { IntentBadge } from "./IntentBadge";
import type { Message } from "@/lib/chat";

const MarkdownContent = lazy(() =>
  import("./MarkdownContent").then((module) => ({ default: module.MarkdownContent })),
);

async function copyToClipboard(text: string) {
  if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
    throw new Error("Clipboard access is not available in this browser.");
  }

  await navigator.clipboard.writeText(text);
}

export function ChatMessage({ message }: { message: Message }) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setCopied(false);
    }, 1_500);

    return () => window.clearTimeout(timeoutId);
  }, [copied]);

  const handleCopy = async () => {
    try {
      await copyToClipboard(message.content);
      setCopied(true);
      toast.success("Answer copied to clipboard.");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unable to copy this response.";
      toast.error(errorMessage);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`group flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}
    >
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
          isUser ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
        }`}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      <div className={`max-w-[85%] space-y-1.5 sm:max-w-[75%] ${isUser ? "text-right" : ""}`}>
        {!isUser && (
          <div className="flex items-center gap-2">
            {message.intent ? <IntentBadge intent={message.intent} /> : <div className="h-5" />}
            <button
              type="button"
              onClick={() => void handleCopy()}
              className="inline-flex h-7 items-center gap-1 rounded-full border border-border bg-card px-2 text-[11px] font-medium text-muted-foreground opacity-0 transition hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 group-hover:opacity-100"
              aria-label="Copy answer"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  Copy
                </>
              )}
            </button>
          </div>
        )}

        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
            isUser
              ? "rounded-tr-sm bg-primary text-primary-foreground"
              : "rounded-tl-sm border border-border bg-card text-card-foreground"
          }`}
        >
          <Suspense fallback={<div className="whitespace-pre-wrap break-words">{message.content}</div>}>
            <MarkdownContent content={message.content} />
          </Suspense>
        </div>
      </div>
    </motion.div>
  );
}
