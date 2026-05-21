import { defineSystemMessage } from "@/messages/helpers/defineSystemMessage";

/**
 * 1009 审批群成员 —— 群主/管理员收到「X 申请加入...」时附带「去审核」按钮。
 *
 * core 元数据走默认 SystemPill 渲染；带按钮的「去审核」UI 由
 * src/messages/renders.tsx 的 approveGroupMemberRender 提供。
 */
export const approveGroupMember = defineSystemMessage({
  type: 1009,
  name: "approveGroupMember" as const,
});
