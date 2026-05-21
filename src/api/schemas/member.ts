import { z } from "zod";

export const MemberSchema = z
  .object({
    uid: z.string(),
    name: z.string(),
    remark: z.string().optional().default(""),
    avatar: z.string().optional(),
    role: z.number().optional(),
    status: z.number().optional(),
    /** "bot" | "user" 等；后端约定 */
    category: z.string().optional(),
    /**
     * mirror datasource.subscribers() 把响应每条直接挂到 member.orgData,
     * 所以 robot 是顶层字段，不是嵌套；保留 org_data 兼容并存的情况
     */
    robot: z.number().optional(),
    bot_type: z.number().optional(),
    org_data: z.object({ robot: z.number().optional() }).loose().optional(),
  })
  .loose();
export type Member = z.infer<typeof MemberSchema>;

export const MemberListSchema = z.array(MemberSchema);

export function isMemberBot(
  m: Pick<Member, "category" | "robot" | "bot_type" | "org_data">,
): boolean {
  if (m.category === "bot") return true;
  if (m.robot === 1) return true;
  if (typeof m.bot_type === "number" && m.bot_type > 0) return true;
  if (m.org_data?.robot === 1) return true;
  return false;
}
