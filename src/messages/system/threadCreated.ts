import { defineSystemMessage } from "@/messages/helpers/defineSystemMessage";

/** 1100 子区创建通知（mirror Const.threadCreated） */
export const threadCreated = defineSystemMessage({
  type: 1100,
  name: "threadCreated" as const,
});
