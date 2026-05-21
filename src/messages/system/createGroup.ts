import { defineSystemMessage } from "@/messages/helpers/defineSystemMessage";

/** 1001 创建群聊（"X 创建了群聊"） */
export const createGroup = defineSystemMessage({
  type: 1001,
  name: "createGroup" as const,
});
