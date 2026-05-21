import { defineMessageType } from "@/messages/core/defineMessageType";
import { FILE_TYPE, type FileContent, FileMessage } from "./FileMessage";

export type { FileContent };
export { FILE_TYPE, FileMessage };

export const file = defineMessageType({
  type: FILE_TYPE,
  name: "file" as const,
  category: "chat",
  sdkFactory: () => new FileMessage(),
  toUI: (raw) => {
    const m = raw as FileMessage;
    const out: FileContent = {
      name: m.name,
      extension: m.extension,
      size: m.size,
      url: m.url,
    };
    if (m.caption !== undefined) out.caption = m.caption;
    if (m.mentionUids.length) out.mentionUids = m.mentionUids;
    return out;
  },
  fromUI: (data) => {
    const m = new FileMessage();
    m.name = data.name;
    m.extension = data.extension;
    m.size = data.size;
    m.url = data.url;
    if (data.caption !== undefined) m.caption = data.caption;
    if (data.mentionUids?.length) m.mentionUids = data.mentionUids;
    m.remoteUrl = data.url;
    return m;
  },
  digest: () => "[文件]",
  copyable: "none",
  mentionable: true,
  notifiable: true,
  countsAsUnread: true,
});
