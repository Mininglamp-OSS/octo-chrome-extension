import { defineSystemMessage } from "@/messages/helpers/defineSystemMessage";

/** 1008 新管理员（"X 成为了新管理员"） */
export const newGroupOwner = defineSystemMessage({
  type: 1008,
  name: "newGroupOwner" as const,
});
