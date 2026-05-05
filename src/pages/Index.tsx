import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Download, Trash2 } from "lucide-react";
import { ChatMessage } from "@/components/ChatMessage";
import { DomainSelector } from "@/components/DomainSelector";
import { TypingIndicator } from "@/components/TypingIndicator";
import { ChatInputArea } from "@/components/ChatInputArea";
import { parseIntent, streamChat, type Message, type Domain } from "@/lib/chat";
import {
  clearChatSession,
  loadChatSession,
  saveChatSession,
} from "@/lib/chat-session";
import {
  buildTranscript,
  createTranscriptFilename,
  downloadTranscript,
} from "@/lib/transcript";
import { toast } from "sonner";
import { DOMAIN_SUGGESTIONS, MAX_MESSAGE_LENGTH } from "../../shared/chat.ts";

type FailedRequest = {
  baseMessages: Message[];
  text: string;
  domain: Domain;
  error: string;
};

function getFailureUi(error: string) {
  if (error.includes("ANTHROPIC_API_KEY")) {
    return {
      title: "Chat backend needs one more secret.",
      message: "The chat backend is online, but it cannot call Anthropic until ANTHROPIC_API_KEY is configured.",
      detail: "Set ANTHROPIC_API_KEY in backend/.env, then restart the backend.",
    };
  }

  if (error.includes("valid Anthropic API key")) {
    return {
      title: "Anthropic API key rejected.",
      message:
        "The backend reached Anthropic, but the configured key was rejected. Use a valid Anthropic API key.",
      detail: null,
    };
  }

  return {
    title: "Last request failed.",
    message: error,
    detail: null,
  };
}

function getInitialOnlineState() {
  if (typeof navigator === "undefined") {
    return true;
  }

  return navigator.onLine;
}

const Index = () => {
  const [initialSession] = useState(() => loadChatSession());
  const [messages, setMessages] = useState<Message[]>(() => initialSession?.messages ?? []);
  const [input, setInput] = useState(() => initialSession?.draft ?? "");
  const [domain, setDomain] = useState<Domain>(() => initialSession?.domain ?? "general");
  const [isLoading, setIsLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(getInitialOnlineState);
  const [failedRequest, setFailedRequest] = useState<FailedRequest | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const requestAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, isLoading]);

  useEffect(() => {
    const inputElement = inputRef.current;

    if (!inputElement) {
      return;
    }

    inputElement.style.height = "0px";
    inputElement.style.height = `${Math.min(inputElement.scrollHeight, 180)}px`;
  }, [input]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success("Back online.");
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.error("You are offline. Drafts stay saved locally.");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    if (messages.length === 0 && !input && domain === "general") {
      clearChatSession();
      return;
    }

    saveChatSession({ domain, messages, draft: input });
  }, [domain, input, messages]);

  useEffect(
    () => () => {
      requestAbortRef.current?.abort();
    },
    [],
  );

  const handleClear = useCallback(() => {
    requestAbortRef.current?.abort();
    requestAbortRef.current = null;
    setMessages([]);
    setInput("");
    setIsLoading(false);
    setFailedRequest(null);
    clearChatSession();
    inputRef.current?.focus();
  }, []);

  const handleExport = useCallback(() => {
    try {
      const transcript = buildTranscript({ domain, messages });
      const filename = createTranscriptFilename(domain);
      downloadTranscript(filename, transcript);
      toast.success("Transcript downloaded.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to export this conversation.";
      toast.error(message);
    }
  }, [domain, messages]);

  const startRequest = useCallback(
    async ({
      baseMessages,
      text,
      activeDomain,
    }: {
      baseMessages: Message[];
      text: string;
      activeDomain: Domain;
    }) => {
      const trimmedText = text.trim();

      if (!trimmedText || isLoading) {
        return;
      }

      if (!isOnline) {
        toast.error("You are offline. Reconnect to send your question.");
        return;
      }

      const userMsg: Message = { role: "user", content: trimmedText };
      const outgoingMessages = [...baseMessages, userMsg];
      const controller = new AbortController();

      requestAbortRef.current?.abort();
      requestAbortRef.current = controller;
      setFailedRequest(null);

      setMessages(outgoingMessages);
      setInput("");
      setIsLoading(true);

      let fullText = "";

      const updateAssistant = (chunk: string) => {
        fullText += chunk;

        const { intent, cleanText } = parseIntent(fullText);

        setMessages((prev) => {
          const last = prev[prev.length - 1];

          if (last?.role === "assistant") {
            return prev.map((message, index) =>
              index === prev.length - 1
                ? { ...message, content: cleanText, intent: intent || message.intent }
                : message,
            );
          }

          return [...prev, { role: "assistant", content: cleanText, intent: intent || undefined }];
        });
      };

      try {
        await streamChat({
          messages: outgoingMessages,
          domain: activeDomain,
          signal: controller.signal,
          onDelta: updateAssistant,
          onDone: () => {
            if (requestAbortRef.current === controller) {
              requestAbortRef.current = null;
            }

            setIsLoading(false);
          },
        });
      } catch (error: unknown) {
        if (
          controller.signal.aborted ||
          (error instanceof DOMException && error.name === "AbortError")
        ) {
          return;
        }

        const message =
          error instanceof Error
            ? error.message
            : typeof error === "string"
              ? error
              : "Something went wrong.";

        setFailedRequest({
          baseMessages,
          text: trimmedText,
          domain: activeDomain,
          error: message,
        });
        toast.error(message);
      }
    },
    [isLoading, isOnline],
  );

  const send = useCallback(
    async (text: string) => {
      await startRequest({
        baseMessages: messages,
        text,
        activeDomain: domain,
      });
    },
    [domain, messages, startRequest],
  );

  const handleRetry = useCallback(() => {
    if (!failedRequest) {
      return;
    }

    void startRequest({
      baseMessages: failedRequest.baseMessages,
      text: failedRequest.text,
      activeDomain: failedRequest.domain,
    });
  }, [failedRequest, startRequest]);

  const handleFeatureSelect = useCallback((featureId: string) => {
    switch (featureId) {
      case "photos":
        toast.info("Click the file icon to upload photos & files");
        break;
      case "image":
        toast.info("Image generation feature coming soon!");
        break;
      case "thinking":
        toast.info("Extended thinking mode coming soon!");
        break;
      case "research":
        toast.info("Deep research feature coming soon!");
        break;
    }
  }, []);

  const suggestions = DOMAIN_SUGGESTIONS[domain];
  const failureUi = failedRequest ? getFailureUi(failedRequest.error) : null;

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      <header className="border-b border-border px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="glow-amber flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl">
              <img src="/logo.svg" alt="Ask Any Bot logo" className="h-10 w-10" />
            </div>
            <div>
              <h1 className="text-base font-bold text-foreground">Ask Any Bot</h1>
              <p className="text-xs text-muted-foreground">
                Domain-aware AI answers with streaming intent detection
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <DomainSelector selected={domain} onChange={setDomain} />
            {messages.length > 0 && (
              <>
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleExport}
                  className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  aria-label="Download transcript"
                >
                  <Download className="h-4 w-4" />
                </motion.button>
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleClear}
                  className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  aria-label="Clear chat history"
                >
                  <Trash2 className="h-4 w-4" />
                </motion.button>
              </>
            )}
          </div>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-8">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center"
            >
              <div className="glow-amber mx-auto mb-4 flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl">
                <img src="/logo.svg" alt="Ask Any Bot logo" className="h-16 w-16" />
              </div>
              <h2 className="text-xl font-bold text-foreground">
                Ask a question and get a domain-tuned answer.
              </h2>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                Pick a domain above, then ask anything from admissions and health basics to crop
                planning and general research.
              </p>
            </motion.div>

            <div className="grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
              {suggestions.map((suggestion, index) => (
                <motion.button
                  key={suggestion}
                  type="button"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.08 }}
                  onClick={() => void send(suggestion)}
                  disabled={!isOnline}
                  className="rounded-xl border border-border bg-card p-4 text-left text-sm text-card-foreground transition-colors hover:border-primary/40 hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {suggestion}
                </motion.button>
              ))}
            </div>
          </div>
        ) : (
          <div
            className="mx-auto max-w-3xl space-y-6"
            role="log"
            aria-live="polite"
            aria-busy={isLoading}
            aria-relevant="additions text"
          >
            {messages.map((message, index) => (
              <ChatMessage key={`${message.role}-${index}`} message={message} />
            ))}
            {isLoading && messages[messages.length - 1]?.role === "user" && <TypingIndicator />}
          </div>
        )}
      </div>

      <div className="border-t border-border bg-background/95 px-4 py-4 backdrop-blur sm:px-6">
        <div className="mx-auto max-w-3xl space-y-3">
          {failedRequest && (
            <div
              role="alert"
              className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-foreground"
            >
              <p className="font-semibold text-destructive">{failureUi?.title}</p>
              <p className="mt-1 text-muted-foreground">{failureUi?.message}</p>
              {failureUi?.detail && (
                <p className="mt-3 rounded-xl border border-border/60 bg-background/60 px-3 py-2 font-mono text-xs text-foreground">
                  {failureUi.detail}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleRetry}
                  disabled={isLoading || !isOnline}
                  className="rounded-lg border border-border bg-card px-3 py-1 text-sm text-foreground transition-colors hover:bg-secondary disabled:opacity-60"
                >
                  Retry last question
                </button>
                <button
                  type="button"
                  onClick={() => setFailedRequest(null)}
                  disabled={isLoading}
                  className="rounded-lg bg-transparent px-3 py-1 text-sm text-foreground transition-colors hover:bg-secondary disabled:opacity-60"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {!isOnline && (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-foreground">
              <p className="font-semibold text-amber-300">Offline mode</p>
              <p className="mt-1 text-muted-foreground">
                You can keep writing. Your draft stays saved locally and you can send it when the
                connection returns.
              </p>
            </div>
          )}

          <ChatInputArea
            input={input}
            onInputChange={setInput}
            onSend={send}
            selectedFiles={selectedFiles}
            onFilesSelected={(files) => {
              setSelectedFiles([...selectedFiles, ...files]);
              toast.success(`${files.length} file(s) added`);
            }}
            onFileRemove={(index) => {
              setSelectedFiles(selectedFiles.filter((_, i) => i !== index));
            }}
            isLoading={isLoading}
            isOnline={isOnline}
            onFeatureSelect={handleFeatureSelect}
            maxLength={MAX_MESSAGE_LENGTH}
          />
        </div>
      </div>
    </div>
  );
};

export default Index;
