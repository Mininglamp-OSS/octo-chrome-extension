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
  channelInfo: (channelId: string, channelType: number) => `channels/${channelId}/${channelType}`,
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

  // 表情包
  stickerCategories: "sticker/user/category",
  stickers: (category: string) => `sticker/user/sticker?category=${encodeURIComponent(category)}`,
} as const;
