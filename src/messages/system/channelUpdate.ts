import WKSDK from "wukongimjssdk";
import { defineSystemMessage } from "@/messages/helpers/defineSystemMessage";

/** 1005 频道更新（改群名/头像/公告等）—— 副作用：刷新 channelInfo */
export const channelUpdate = defineSystemMessage({
  type: 1005,
  name: "channelUpdate" as const,
  onReceive: (m) => {
    void WKSDK.shared().channelManager.fetchChannelInfo(m.channel);
  },
});
