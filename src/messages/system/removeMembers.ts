import WKSDK from "wukongimjssdk";
import { defineSystemMessage } from "@/messages/helpers/defineSystemMessage";

/** 1003 移除群成员 —— 副作用：同步成员列表 */
export const removeMembers = defineSystemMessage({
  type: 1003,
  name: "removeMembers" as const,
  onReceive: (m) => {
    void WKSDK.shared().channelManager.syncSubscribes(m.channel);
  },
});
