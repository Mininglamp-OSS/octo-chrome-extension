/** 频道类型 —— 沿用 wukongim 协议数值 */
export const ChannelType = {
  person: 1,
  group: 2,
  customerService: 3,
  communityTopic: 5,
} as const;
export type ChannelType = (typeof ChannelType)[keyof typeof ChannelType];

/** 群成员角色 */
export const GroupRole = {
  normal: 0,
  owner: 1,
  manager: 2,
} as const;
export type GroupRole = (typeof GroupRole)[keyof typeof GroupRole];

/** 频道订阅状态 */
export const SubscriberStatus = {
  unknown: 0,
  normal: 1,
  blacklist: 2,
} as const;
export type SubscriberStatus = (typeof SubscriberStatus)[keyof typeof SubscriberStatus];

/** 好友关系 */
export const Relation = {
  stranger: 0,
  friend: 1,
  blacklist: 2,
} as const;
export type Relation = (typeof Relation)[keyof typeof Relation];
