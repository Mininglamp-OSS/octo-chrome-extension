import WKSDK from "wukongimjssdk";
import { defineSystemMessage } from "@/messages/helpers/defineSystemMessage";

/** 1002 添加群成员 —— 副作用：同步成员列表（不刷新名字看不到新人） */
export const addMembers = defineSystemMessage({
  type: 1002,
  name: "addMembers" as const,
  onReceive: (m) => {
    void WKSDK.shared().channelManager.syncSubscribes(m.channel);
  },
});
