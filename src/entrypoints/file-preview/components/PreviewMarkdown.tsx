import matter from "gray-matter";
import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import "highlight.js/styles/github-dark.css";

interface Props {
  source: string;
}

export function PreviewMarkdown({ source }: Props) {
  const { content, frontmatter } = useMemo(() => {
    try {
      const parsed = matter(source);
      const fm = parsed.data && Object.keys(parsed.data).length > 0 ? parsed.data : null;
      return { content: parsed.content, frontmatter: fm as Record<string, unknown> | null };
    } catch {
      return { content: source, frontmatter: null };
    }
  }, [source]);

  return (
    <article className="prose prose-sm dark:prose-invert mx-auto max-w-3xl px-6 py-8">
      {frontmatter && (
        <table className="not-prose mb-6 w-full overflow-hidden rounded-md border border-(--color-border) text-xs">
          <tbody>
            {Object.entries(frontmatter).map(([k, v]) => (
              <tr key={k} className="border-b border-(--color-border) last:border-b-0">
                <td className="bg-(--color-muted)/40 px-3 py-1.5 font-medium text-(--color-muted-foreground)">
                  {k}
                </td>
                <td className="px-3 py-1.5 font-mono">{stringify(v)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
        {content}
      </ReactMarkdown>
    </article>
  );
}

function stringify(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}
