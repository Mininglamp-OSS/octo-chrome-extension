import type { Thread } from "@/im/thread";

/** mittBus 事件契约 —— 用于 non-React 层之间通信 */
export type MittEvents = {
  /** Space 切换 */
  "space-changed": { spaceId: string | null };

  /** 子区面板的占位消息（点击文件 → 子区编辑器需要替换） */
  "wk:pending-thread": {
    groupNo: string;
    thread: Thread | null;
  };

  /** 关闭子区面板 */
  "wk:close-thread-panel": undefined;

  /** sidepanel 内切换 tab（会话 / 联系人 / 设置 等） */
  "wk:switch-sidebar-tab": string;

  /** 文件预览弹层 */
  "wk:file-preview": {
    url: string;
    name: string;
    extension: string;
    size?: number;
    sourceChannelId?: string;
    sourceChannelType?: number;
    messageId?: string;
    messageSeq?: number;
    fromUID?: string;
  };

  /** 关闭文件预览 */
  "wk:close-file-preview": undefined;

  /** 好友申请未读数变化 */
  "friend-applys-unread-count": number;

  /** 上传失败 */
  "task-upload-failed": { channelKey: string };
};
