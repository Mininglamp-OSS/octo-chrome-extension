import { z } from "zod";

export const MeSchema = z.object({
  uid: z.string(),
  name: z.string().optional(),
  short_no: z.string().optional(),
  sex: z.number().optional(),
  role: z.string().optional(),
});
export type Me = z.infer<typeof MeSchema>;
