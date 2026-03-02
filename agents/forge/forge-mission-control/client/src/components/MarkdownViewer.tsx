import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";
import { cn } from "@/lib/utils";

interface MarkdownViewerProps {
  content: string;
  className?: string;
  size?: "default" | "sm";
}

export function MarkdownViewer({
  content,
  className,
  size = "default",
}: MarkdownViewerProps) {
  return (
    <article
      className={cn(
        "prose prose-invert max-w-none",
        // Heading styles
        "prose-headings:text-foreground prose-headings:font-semibold",
        "prose-h1:text-2xl prose-h1:border-b prose-h1:border-border prose-h1:pb-2 prose-h1:mb-4",
        "prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-3",
        "prose-h3:text-lg prose-h3:mt-6",
        // Text
        "prose-p:text-foreground/90 prose-p:leading-relaxed",
        "prose-strong:text-foreground",
        "prose-em:text-foreground/80",
        // Links
        "prose-a:text-primary prose-a:no-underline hover:prose-a:underline",
        // Lists
        "prose-li:text-foreground/90 prose-li:marker:text-muted-foreground",
        // Code
        "prose-code:text-foreground prose-code:bg-muted prose-code:rounded prose-code:px-1.5 prose-code:py-0.5 prose-code:text-sm prose-code:font-normal prose-code:before:content-none prose-code:after:content-none",
        "prose-pre:bg-[oklch(0.16_0.02_250)] prose-pre:border prose-pre:border-border prose-pre:rounded-lg",
        // Blockquotes
        "prose-blockquote:border-l-primary/50 prose-blockquote:bg-muted/30 prose-blockquote:rounded-r-lg prose-blockquote:py-1 prose-blockquote:not-italic",
        // Tables
        "prose-table:border-collapse",
        "prose-th:bg-muted/50 prose-th:border prose-th:border-border prose-th:px-3 prose-th:py-2 prose-th:text-left prose-th:font-semibold prose-th:text-foreground",
        "prose-td:border prose-td:border-border prose-td:px-3 prose-td:py-2 prose-td:text-foreground/90",
        // HR
        "prose-hr:border-border",
        // Images
        "prose-img:rounded-lg prose-img:border prose-img:border-border",
        // Size variant
        size === "sm" && "prose-sm",
        className,
      )}
    >
      <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
        {content}
      </Markdown>
    </article>
  );
}
