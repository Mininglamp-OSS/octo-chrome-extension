import { describe, expect, it } from "vitest";
import { resolveApp } from "./urlApps";

describe("resolveApp", () => {
  it("github.com → 🐙 GitHub + cli gh", () => {
    const r = resolveApp("https://github.com/anthropics/claude-code", "github.com");
    expect(r.slug).toBe("github");
    expect(r.name).toBe("GitHub");
    expect(r.cli).toBe("gh");
    expect(r.icon).toBe("🐙");
  });

  it("飞书命中 feishu.cn / larksuite.com", () => {
    expect(resolveApp("https://x.feishu.cn/wiki", "x.feishu.cn").slug).toBe("feishu");
    expect(resolveApp("https://x.larksuite.com/", "x.larksuite.com").slug).toBe("feishu");
  });

  it("twitter / x.com 都识别为 X", () => {
    expect(resolveApp("https://x.com/foo", "x.com").slug).toBe("twitter");
    expect(resolveApp("https://twitter.com/foo", "twitter.com").slug).toBe("twitter");
  });

  it("Confluence 比 Jira 优先（同 atlassian.net）", () => {
    const conf = resolveApp(
      "https://acme.atlassian.net/wiki/spaces/X",
      "acme.atlassian.net",
    );
    expect(conf.slug).toBe("confluence");
    const jira = resolveApp("https://acme.atlassian.net/browse/X-1", "acme.atlassian.net");
    expect(jira.slug).toBe("jira");
  });

  it("未匹配 → generic + host + 🌐", () => {
    const r = resolveApp("https://example.com/path", "example.com");
    expect(r.slug).toBe("generic");
    expect(r.icon).toBe("🌐");
    expect(r.name).toBe("example.com");
  });
});
