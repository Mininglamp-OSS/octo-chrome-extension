import WKSDK from "wukongimjssdk";
import { bumpChannelAvatar } from "@/im/avatarBump";
import { defineSystemMessage } from "@/messages/helpers/defineSystemMessage";

/**
 * 1005 频道更新（改群名 / 头像 / 公告等）—— 副作用：
 *  1. 强制 bumpAvatarTag —— channelInfo.logo 字段经常恒空（默认头像走 URL 兜底），
 *     不能依赖 fetchChannelInfo 里的 logo diff 来触发 bump（diff 永远 false）
 *  2. setQueryData 触发该 channel 订阅者 re-render；group 级联子区订阅者
 *  3. fetchChannelInfo 拉最新 name / description / etc.（步骤 2 已让 Avatar 用新 tag URL，
 *     这步是为了非头像字段的更新，比如群名）
 */
export const channelUpdate = defineSystemMessage({
  type: 1005,
  name: "channelUpdate" as const,
  onReceive: (m) => {
    bumpChannelAvatar(m.channel.channelID, m.channel.channelType);
    void WKSDK.shared().channelManager.fetchChannelInfo(m.channel);
  },
});
