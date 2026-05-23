import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  source: string;
}

export function PreviewText({ source }: Props) {
  const [copied, setCopied] = useState(false);

  async function onCopy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(source);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // 不可用就忽略
    }
  }

  return (
    <div className="relative mx-auto max-w-5xl px-6 py-8">
      <Button
        size="sm"
        variant="outline"
        className="absolute right-6 top-8 z-10"
        onClick={() => void onCopy()}
      >
        {copied ? <Check className="mr-1 h-3.5 w-3.5" /> : <Copy className="mr-1 h-3.5 w-3.5" />}
        {copied ? "已复制" : "复制"}
      </Button>
      <pre className="overflow-x-auto rounded-md border border-(--color-border) bg-(--color-muted)/30 p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap break-words text-(--color-foreground)">
        {source}
      </pre>
    </div>
  );
}
