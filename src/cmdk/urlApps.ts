export interface ResolvedApp {
  slug: string;
  name: string;
  cli: string | null;
  icon: string;
  host: string;
}

interface UrlAppRule {
  slug: string;
  pattern: RegExp;
  name: string;
  cli: string | null;
  icon: string;
}

const RULES: UrlAppRule[] = [
  { slug: "overleaf", pattern: /overleaf\.(com|cn|io)/i, name: "Overleaf", cli: "overleaf-cli", icon: "📝" },
  { slug: "github", pattern: /github\.com/i, name: "GitHub", cli: "gh", icon: "🐙" },
  { slug: "gitlab", pattern: /gitlab\.com/i, name: "GitLab", cli: "glab", icon: "🦊" },
  { slug: "notion", pattern: /notion\.(so|site)/i, name: "Notion", cli: "notion-cli", icon: "📋" },
  { slug: "feishu", pattern: /feishu\.(cn|com)|larksuite\.com/i, name: "飞书", cli: "lark-cli", icon: "🪶" },
  { slug: "gdocs", pattern: /docs\.google\.com/i, name: "Google Docs", cli: "gdocs-cli", icon: "📄" },
  { slug: "figma", pattern: /figma\.com/i, name: "Figma", cli: "figma-cli", icon: "🎨" },
  { slug: "linear", pattern: /linear\.app/i, name: "Linear", cli: "linear-cli", icon: "📊" },
  { slug: "confluence", pattern: /\.atlassian\.net\/wiki/i, name: "Confluence", cli: "confluence-cli", icon: "📚" },
  { slug: "jira", pattern: /\.atlassian\.net/i, name: "Jira", cli: "jira-cli", icon: "🎯" },
  { slug: "slack", pattern: /slack\.com/i, name: "Slack", cli: "slack-cli", icon: "💬" },
  { slug: "chatgpt", pattern: /chat(gpt)?\.openai\.com|chatgpt\.com/i, name: "ChatGPT", cli: null, icon: "🤖" },
  { slug: "claude", pattern: /claude\.ai/i, name: "Claude", cli: null, icon: "🔶" },
  { slug: "gemini", pattern: /gemini\.google/i, name: "Gemini", cli: null, icon: "✨" },
  { slug: "cursor", pattern: /cursor\.(com|sh)/i, name: "Cursor", cli: null, icon: "⌨️" },
  { slug: "youtube", pattern: /youtube\.com|youtu\.be/i, name: "YouTube", cli: null, icon: "▶️" },
  { slug: "twitter", pattern: /(^|\.)twitter\.com|(^|\.)x\.com/i, name: "X", cli: null, icon: "✖️" },
  { slug: "wechat", pattern: /mp\.weixin\.qq\.com/i, name: "微信公众号", cli: null, icon: "💚" },
  { slug: "zhihu", pattern: /zhihu\.com/i, name: "知乎", cli: null, icon: "🫐" },
  { slug: "stackoverflow", pattern: /stackoverflow\.com/i, name: "Stack Overflow", cli: null, icon: "📚" },
];

const GENERIC_ICON = "🌐";

export function resolveApp(url: string, host: string): ResolvedApp {
  for (const r of RULES) {
    if (r.pattern.test(host) || r.pattern.test(url)) {
      return { slug: r.slug, name: r.name, cli: r.cli, icon: r.icon, host };
    }
  }
  return { slug: "generic", name: host || "web", cli: null, icon: GENERIC_ICON, host };
}

export { GENERIC_ICON };
