import { z } from "zod";

export const LoginResponseSchema = z.object({
  uid: z.string(),
  token: z.string(),
  name: z.string().optional(),
  short_no: z.string().optional(),
  sex: z.number().optional(),
  role: z.string().optional(),
});
export type LoginResponse = z.infer<typeof LoginResponseSchema>;

export const MeSchema = z.object({
  uid: z.string(),
  name: z.string().optional(),
  short_no: z.string().optional(),
  sex: z.number().optional(),
  role: z.string().optional(),
});
export type Me = z.infer<typeof MeSchema>;
