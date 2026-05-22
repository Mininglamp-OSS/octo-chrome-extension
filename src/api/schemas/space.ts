import { z } from "zod";

/**
 * mirror SpaceService.Space: { space_id, name, description, logo, member_count, max_users, role:number, created_at }
 * 我们只关心 UI 用到的几个字段，其他全部 passthrough，避免 schema 抖动导致整个查询失败。
 */
export const SpaceSchema = z
  .object({
    space_id: z.string(),
    name: z.string(),
    /** mirror 用 logo，部分接口可能用 avatar */
    avatar: z.string().optional(),
    logo: z.string().optional(),
    description: z.string().optional(),
    /** mirror role 是 number；保留为 unknown 让上层自行判断 */
    role: z.union([z.string(), z.number()]).optional(),
    is_member: z.boolean().optional(),
    member_count: z.number().optional(),
    max_users: z.number().optional(),
    created_at: z.string().optional(),
  })
  .loose();
export type Space = z.infer<typeof SpaceSchema>;

/** 后端可能返回 null（无任何 space），统一回退为空数组 */
export const SpaceListSchema = z.union([z.array(SpaceSchema), z.null()]).transform((v) => v ?? []);

/** 空间成员（space/{id}/members 列表项） */
export const SpaceMemberSchema = z
  .object({
    uid: z.string(),
    name: z.string(),
    avatar: z.string().optional().default(""),
    /** 1=owner 2=admin 3=member */
    role: z.number().optional().default(3),
    /** 0=user 1=bot */
    robot: z.number().optional().default(0),
    created_at: z.string().optional().default(""),
  })
  .loose();
export type SpaceMember = z.infer<typeof SpaceMemberSchema>;

export const SpaceMemberListSchema = z
  .union([z.array(SpaceMemberSchema), z.null()])
  .transform((v) => v ?? []);
