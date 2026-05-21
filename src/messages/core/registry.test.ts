import { describe, expect, it } from "vitest";
import WKSDK, { SystemContent } from "wukongimjssdk";
import {
  MESSAGE_TYPES,
  MessageContentType,
  getModule,
  getModuleOrUnknown,
} from "./registry";

describe("registry", () => {
  it("所有模块 type 唯一", () => {
    const ids = MESSAGE_TYPES.map((m) => m.type);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("所有模块 name 唯一", () => {
    const names = MESSAGE_TYPES.map((m) => m.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("MessageContentType 派生常量包含所有模块名", () => {
    for (const m of MESSAGE_TYPES) {
      expect((MessageContentType as Record<string, number>)[m.name]).toBe(m.type);
    }
  });

  it("getModule 找不到时返回 undefined", () => {
    expect(getModule(99999)).toBeUndefined();
  });

  it("getModuleOrUnknown 找不到时回退 unknown", () => {
    const mod = getModuleOrUnknown(99999);
    expect(mod.name).toBe("unknown");
  });

  it("注册到 WKSDK 后 getMessageContent 拿到的是模块 sdkFactory 产物（image 不是 SDK 默认 MessageImage）", () => {
    // registry 模块加载已经调用过 sdk.register，这里只是验证效果
    const inst = WKSDK.shared().getMessageContent(2); // image
    expect(inst.constructor.name).toBe("ImageMessage");
  });
});

describe("registry roundtrip", () => {
  it("text 模块 fromUI(toUI(decoded)) 字段保持", () => {
    const text = MESSAGE_TYPES.find((m) => m.name === "text");
    if (!text) throw new Error("text module missing");
    const sdk = text.sdkFactory();
    // 协议：mention.uids 嵌在 mention 子对象；SDK base.decode() 会把它写到 this.mention，
    // 但测试不走 base.decode，所以这里手动设置 this.mention 模拟解码后状态
    sdk.decodeJSON({ content: "hello", mention: { uids: ["u1"] } });
    (sdk as unknown as { mention: { uids: string[]; all: boolean } }).mention = {
      uids: ["u1"],
      all: false,
    };
    const ui = text.toUI(sdk);
    expect(ui).toEqual({ text: "hello", mentionUids: ["u1"] });
    const back = text.fromUI(ui) as unknown as {
      text: string;
      mention?: { uids?: string[]; all?: boolean };
    };
    expect(back.text).toBe("hello");
    expect(back.mention?.uids).toEqual(["u1"]);
  });

  it("image 模块 toUI 给出 url/width/height", () => {
    const image = MESSAGE_TYPES.find((m) => m.name === "image");
    if (!image) throw new Error("image module missing");
    const sdk = image.sdkFactory();
    sdk.decodeJSON({ url: "https://x/y.png", width: 100, height: 200 });
    const ui = image.toUI(sdk) as { url: string; width: number; height: number };
    expect(ui.url).toBe("https://x/y.png");
    expect(ui.width).toBe(100);
    expect(ui.height).toBe(200);
  });
});

describe("system messages", () => {
  it("addMembers (1002) 通过 SystemContent decode display_text → digest", () => {
    const addMembers = MESSAGE_TYPES.find((m) => m.name === "addMembers");
    if (!addMembers) throw new Error("addMembers module missing");
    const sdk = addMembers.sdkFactory();
    expect(sdk).toBeInstanceOf(SystemContent);
    sdk.decodeJSON({ content: "张三 邀请 李四 加入群聊" });
    const ui = addMembers.toUI(sdk);
    expect(addMembers.digest(ui)).toBe("张三 邀请 李四 加入群聊");
  });

  it("system 消息 notifiable=false, countsAsUnread=false", () => {
    const addMembers = MESSAGE_TYPES.find((m) => m.name === "addMembers");
    if (!addMembers) throw new Error("addMembers module missing");
    expect(addMembers.notifiable).toBe(false);
    expect(addMembers.countsAsUnread).toBe(false);
    expect(addMembers.category).toBe("system");
  });

  it("unknown 模块识别 SystemContent → 渲染 displayText", () => {
    // 模拟后端未来加新系统消息（如 1010），registry 没注册时落到 unknown
    const sdk = new SystemContent();
    sdk.decodeJSON({ content: "你被踢出了群聊" });
    const unknownMod = getModuleOrUnknown(1010);
    expect(unknownMod.name).toBe("unknown");
    const ui = unknownMod.toUI(sdk) as { displayText: string; realType: number };
    expect(ui.displayText).toBe("你被踢出了群聊");
    expect(unknownMod.digest(ui)).toBe("你被踢出了群聊");
  });
});
