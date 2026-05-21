import { z } from "zod";

export const AuthcodeResponseSchema = z.object({
  authcode: z.string(),
});
export type AuthcodeResponse = z.infer<typeof AuthcodeResponseSchema>;

/** authstatus 内嵌的 result —— 与 /user/login 的 LoginResponse 字段对齐 */
export const AuthStatusResultSchema = z.object({
  uid: z.string(),
  token: z.string(),
  name: z.string().optional(),
  short_no: z.string().optional(),
  sex: z.number().optional(),
  role: z.string().optional(),
  app_id: z.string().optional(),
});
export type AuthStatusResult = z.infer<typeof AuthStatusResultSchema>;

/** status: 0=pending, 1=success, 2=fail */
export const AuthStatusResponseSchema = z.object({
  status: z.number(),
  msg: z.string().optional(),
  result: AuthStatusResultSchema.optional(),
});
export type AuthStatusResponse = z.infer<typeof AuthStatusResponseSchema>;
