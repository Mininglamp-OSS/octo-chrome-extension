import { describe, expect, it } from "vitest";
import type { Conversation } from "@/api/schemas/conversation";
import { ChannelType } from "@/const/channel";
import { shouldSkipForSpace, sortConversations, toConversationView } from "./conversation";

function fixture(overrides: Partial<Conversation> = {}): Conversation {
  return {
    channel_id: "c1",
    channel_type: ChannelType.group,
    unread: 0,
    timestamp: 0,
    ...overrides,
  };
}

describe("toConversationView", () => {
  it("默认字段", () => {
    const v = toConversationView(fixture({ unread: 3, timestamp: 1234 }));
    expect(v.channelId).toBe("c1");
    // wire 不带 name，统一回退 channel_id；显示名走 channelInfo
    expect(v.name).toBe("c1");
    expect(v.unread).toBe(3);
    expect(v.pinned).toBe(false);
    expect(v.lastDigest).toBe("");
  });

  it("image payload digest（从 recents[0].payload 读）", () => {
    const v = toConversationView(fixture({ recents: [{ payload: { type: 2 } }] }));
    expect(v.lastDigest).toBe("[图片]");
  });

  it("system message payload digest 透传 display_text", () => {
    const v = toConversationView(
      fixture({ recents: [{ payload: { type: 1002, content: "张三 邀请 李四 加入群聊" } }] }),
    );
    expect(v.lastDigest).toBe("张三 邀请 李四 加入群聊");
  });

  it("stick=1 → pinned", () => {
    const v = toConversationView(fixture({ stick: 1 }));
    expect(v.pinned).toBe(true);
  });
});

describe("sortConversations", () => {
  it("pinned 优先 + 按时间倒序", () => {
    const a = toConversationView(fixture({ channel_id: "a", timestamp: 1 }));
    const b = toConversationView(fixture({ channel_id: "b", timestamp: 2 }));
    const c = toConversationView(fixture({ channel_id: "c", timestamp: 0, stick: 1 }));
    const out = sortConversations([a, b, c]);
    expect(out.map((x) => x.channelId)).toEqual(["c", "b", "a"]);
  });
});

describe("shouldSkipForSpace", () => {
  it("person 永远不跳过", () => {
    const conv = toConversationView(fixture({ channel_type: ChannelType.person }));
    expect(shouldSkipForSpace(conv, "spaceA", new Map())).toBe(false);
  });

  it("group 不属于当前 space → 跳过", () => {
    const conv = toConversationView(fixture({ channel_id: "g1" }));
    const map = new Map([[`g1_${ChannelType.group}`, "spaceB"]]);
    expect(shouldSkipForSpace(conv, "spaceA", map)).toBe(true);
  });

  it("group 属于当前 space → 不跳过", () => {
    const conv = toConversationView(fixture({ channel_id: "g1" }));
    const map = new Map([[`g1_${ChannelType.group}`, "spaceA"]]);
    expect(shouldSkipForSpace(conv, "spaceA", map)).toBe(false);
  });
});
