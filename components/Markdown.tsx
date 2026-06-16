import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { SafeLink } from "./SafeLink";

// Renders user markdown safely: react-markdown does not emit raw HTML, and links
// are routed through SafeLink (external ones via the /go interstitial).
export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={`md text-sm leading-relaxed text-ink break-words ${className ?? ""}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <SafeLink href={href ?? "#"} className="text-pin-teal underline underline-offset-2">
              {children}
            </SafeLink>
          ),
          p: ({ children }) => <p className="my-1.5 first:mt-0 last:mb-0">{children}</p>,
          h1: ({ children }) => <h1 className="mb-1.5 mt-3 font-display text-base font-bold">{children}</h1>,
          h2: ({ children }) => <h2 className="mb-1.5 mt-3 font-display text-base font-semibold">{children}</h2>,
          h3: ({ children }) => <h3 className="mb-1 mt-2.5 font-display text-sm font-semibold">{children}</h3>,
          ul: ({ children }) => <ul className="my-1.5 list-disc pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="my-1.5 list-decimal pl-5">{children}</ol>,
          li: ({ children }) => <li className="my-0.5">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="my-1.5 border-l-2 border-paper-edge pl-3 text-ink-soft">{children}</blockquote>
          ),
          code: ({ className: cls, children }) => {
            const isBlock = (cls ?? "").includes("language-");
            return isBlock ? (
              <code className="block overflow-x-auto rounded-md bg-board px-3 py-2 font-mono text-[0.8rem]">{children}</code>
            ) : (
              <code className="rounded-sm bg-board px-1 py-0.5 font-mono text-[0.82em]">{children}</code>
            );
          },
          pre: ({ children }) => <pre className="my-2">{children}</pre>,
          table: ({ children }) => (
            <table className="my-2 w-full border-collapse text-[0.82rem]">{children}</table>
          ),
          th: ({ children }) => <th className="border border-paper-edge bg-board px-2 py-1 text-left">{children}</th>,
          td: ({ children }) => <td className="border border-paper-edge px-2 py-1">{children}</td>,
          hr: () => <hr className="my-3 border-paper-edge" />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
