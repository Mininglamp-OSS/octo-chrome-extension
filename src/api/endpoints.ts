import { stripSpacePrefix } from "@/utils/avatar";

/** API base URL. 来自 VITE_API_URL 环境变量，缺省为 mirror 默认值 */
export const DEFAULT_API_URL =
  (import.meta as unknown as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL ??
  "https://im.deepminer.com.cn/api/v1/";

/** RESTful 接口路径常量 —— 全部相对路径，由 ky 拼接 baseURL */
export const Endpoints = {
  // 鉴权
  logout: "user/logout",
  me: "user/info",

  // SSO / OIDC
  appconfig: "common/appconfig",
  thirdloginAuthcode: "user/thirdlogin/authcode",
  thirdloginAuthstatus: "user/thirdlogin/authstatus",

  // 会话
  conversations: "conversation/sync",
  /**
   * mirror DataSourceModule.setChannelInfoCallback 等价：传给后端的 channelId 必须是真实 uid/group_no，
   * 不能带 `s{spaceId}_` 前缀。stripSpacePrefix 的 regex 只匹配 `^s[0-9A-Za-z]+_`，
   * 对 group_no（纯数字）/ topic（`t...`）不匹配，统一调用安全。
   * 不剥前缀的话，后端找不到对应 user，logo 字段返回空 → bot 头像落 fallback。
   */
  channelInfo: (channelId: string, channelType: number) =>
    `channels/${stripSpacePrefix(channelId)}/${channelType}`,
  /** 拉取频道历史消息（mirror: message/channel/sync） */
  messageChannelSync: "message/channel/sync",

  // 分组
  spaceCategories: (spaceId: string) => `spaces/${spaceId}/categories`,
  category: (spaceId: string, categoryId: string) => `spaces/${spaceId}/categories/${categoryId}`,
  sortCategories: (spaceId: string) => `spaces/${spaceId}/categories/sort`,
  moveGroupToCategory: (groupNo: string) => `groups/${groupNo}/category`,

  // 置顶
  pinned: "user/pinned",

  // Space
  spaces: "space/my",
  spaceInfo: (spaceId: string) => `space/${spaceId}`,
  spaceMembers: (spaceId: string) => `space/${spaceId}/members`,

  // IM 连接地址
  imRoute: (uid: string) => `users/${uid}/im`,

  // 群成员（mention 候选）
  groupMembers: (channelId: string) => `groups/${channelId}/members`,
  // 退群 / 改名 / 设置
  groupExit: (channelId: string) => `groups/${channelId}/exit`,
  groupRename: (channelId: string) => `groups/${channelId}`,
  groupSetting: (channelId: string) => `groups/${channelId}/setting`,
  userSetting: (uid: string) => `users/${uid}/setting`,

  // 消息撤回
  revokeMessage: "message/revoke",
  // 清空 channel 消息
  channelClearMessages: "message/channel/clear",
  // 已读
  clearUnread: "conversation/clearUnread",
  messageReaded: "message/readed",
  // 提醒（@ / 系统提醒）
  messageReminderSync: "message/reminder/sync",
  messageReminderDone: "message/reminder/done",

  // 全局搜索
  searchGlobal: "search/global",

  // 联系人 / 通讯录
  friendSync: "friend/sync",
  myBots: "robot/my_bots",
  spaceBots: "robot/space_bots",

  // 语音
  voiceTranscribe: "voice/transcribe",
  voiceConfig: "voice/config",
  voiceContext: "voice/context",

  // 表情包
  stickerCategories: "sticker/user/category",
  stickers: (category: string) => `sticker/user/sticker?category=${encodeURIComponent(category)}`,
} as const;
