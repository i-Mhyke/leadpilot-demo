import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const markdownComponents: Components = {
  p: ({ children }) => <p className="assistant-prose-p">{children}</p>,
  strong: ({ children }) => <strong className="assistant-prose-strong">{children}</strong>,
  em: ({ children }) => <em className="assistant-prose-em">{children}</em>,
  ul: ({ children }) => <ul className="assistant-prose-ul">{children}</ul>,
  ol: ({ children }) => <ol className="assistant-prose-ol">{children}</ol>,
  li: ({ children }) => <li className="assistant-prose-li">{children}</li>,
  h1: ({ children }) => <h3 className="assistant-prose-h">{children}</h3>,
  h2: ({ children }) => <h3 className="assistant-prose-h">{children}</h3>,
  h3: ({ children }) => <h3 className="assistant-prose-h">{children}</h3>,
  h4: ({ children }) => <h4 className="assistant-prose-h4">{children}</h4>,
  blockquote: ({ children }) => <blockquote className="assistant-prose-quote">{children}</blockquote>,
  a: ({ href, children }) => (
    <a href={href} className="assistant-prose-link" target="_blank" rel="noreferrer">
      {children}
    </a>
  ),
  hr: () => <hr className="assistant-prose-hr" />,
  code: ({ children }) => <code className="assistant-prose-code">{children}</code>,
};

export function ChatMarkdown({ content }: { content: string }) {
  return (
    <div className="assistant-prose">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
