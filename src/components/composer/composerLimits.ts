import { storage } from "wxt/utils/storage";

export const COMPOSER_LIMITS = {
  MAX_MESSAGE_LENGTH: 2000,
  MAX_ATTACHMENTS: 20,
  MAX_TOTAL_SIZE: 100 * 1024 * 1024, // 100 MB
  BLOCKED_EXTENSIONS: [
    "exe",
    "bat",
    "cmd",
    "sh",
    "msi",
    "scr",
    "ps1",
    "vbs",
    "com",
    "dll",
    "app",
    "deb",
    "rpm",
  ] as readonly string[],
} as const;

// 零宽 / 双向控制字符
const INVISIBLE_CHARS_RE =
  /[​-‏‪-‮⁠-⁯﻿­]/g;

/** 去掉零宽 / 双向控制等不可见字符（粘贴来源 PDF/邮件常带） */
export function stripInvisibleChars(input: string): string {
  return input.replace(INVISIBLE_CHARS_RE, "");
}

/** 文件被禁名单 */
export function isBlockedExtension(filename: string): boolean {
  const dot = filename.lastIndexOf(".");
  if (dot < 0) return false;
  const ext = filename.slice(dot + 1).toLowerCase();
  return COMPOSER_LIMITS.BLOCKED_EXTENSIONS.includes(ext);
}

/** 累加附件并执行所有限制校验，返回最终列表 / 拒绝原因 */
export interface AttachmentValidationResult {
  accepted: File[];
  rejected: Array<{ file: File; reason: string }>;
}

export function validateAttachments(
  existing: File[],
  incoming: File[],
): AttachmentValidationResult {
  const accepted: File[] = [];
  const rejected: AttachmentValidationResult["rejected"] = [];
  const totalSize = existing.reduce((s, f) => s + f.size, 0);
  let runningSize = totalSize;
  let runningCount = existing.length;

  for (const f of incoming) {
    if (runningCount >= COMPOSER_LIMITS.MAX_ATTACHMENTS) {
      rejected.push({ file: f, reason: `已达到 ${COMPOSER_LIMITS.MAX_ATTACHMENTS} 个附件上限` });
      continue;
    }
    if (isBlockedExtension(f.name)) {
      rejected.push({ file: f, reason: "该文件类型不允许发送" });
      continue;
    }
    if (runningSize + f.size > COMPOSER_LIMITS.MAX_TOTAL_SIZE) {
      rejected.push({ file: f, reason: "附件总大小不能超过 100 MB" });
      continue;
    }
    accepted.push(f);
    runningSize += f.size;
    runningCount += 1;
  }

  return { accepted, rejected };
}

/** 草稿持久化：按 channelKey 存 wxt/storage local */
function draftKey(channelId: string, channelType: number) {
  return `local:octo:extension:draft:${channelType}:${channelId}` as const;
}

export async function loadDraft(
  channelId: string,
  channelType: number,
): Promise<string> {
  const v = await storage.getItem<string>(draftKey(channelId, channelType));
  return v ?? "";
}

export async function saveDraft(
  channelId: string,
  channelType: number,
  json: string,
): Promise<void> {
  if (!json) {
    await storage.removeItem(draftKey(channelId, channelType));
    return;
  }
  await storage.setItem(draftKey(channelId, channelType), json);
}

export async function clearDraft(channelId: string, channelType: number): Promise<void> {
  await storage.removeItem(draftKey(channelId, channelType));
}
