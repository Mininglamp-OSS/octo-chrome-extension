import { defineMessageType } from "@/messages/core/defineMessageType";
import { IMAGE_TYPE, type ImageContent, ImageMessage } from "./ImageMessage";

export type { ImageContent };
export { IMAGE_TYPE, ImageMessage };

export const image = defineMessageType({
  type: IMAGE_TYPE,
  name: "image" as const,
  category: "chat",
  sdkFactory: () => new ImageMessage(),
  toUI: (raw) => {
    const m = raw as ImageMessage;
    const out: ImageContent = { url: m.url, width: m.width, height: m.height };
    if (m.caption !== undefined) out.caption = m.caption;
    if (m.mentionUids.length) out.mentionUids = m.mentionUids;
    if (m.name !== undefined) out.name = m.name;
    return out;
  },
  fromUI: (data) => {
    const m = new ImageMessage();
    m.url = data.url;
    m.width = data.width;
    m.height = data.height;
    if (data.caption !== undefined) m.caption = data.caption;
    if (data.mentionUids?.length) m.mentionUids = data.mentionUids;
    if (data.name !== undefined) m.name = data.name;
    m.remoteUrl = data.url;
    return m;
  },
  digest: () => "[图片]",
  copyable: "none",
  mentionable: true,
  notifiable: true,
  countsAsUnread: true,
});
