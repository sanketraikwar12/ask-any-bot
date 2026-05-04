import ReactMarkdown from "react-markdown";

export function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="prose prose-sm max-w-none break-words text-inherit prose-headings:text-inherit prose-p:text-inherit prose-strong:text-inherit prose-code:text-inherit prose-pre:bg-background/80 prose-pre:text-inherit [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}
