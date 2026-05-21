/** 从 ky/axios reject 错误对象里提取 msg 字段，找不到返回空串 */
export function extractErrorMsg(err: unknown): string {
  if (!err || typeof err !== "object") return "";
  if ("msg" in err && typeof (err as { msg: unknown }).msg === "string") {
    return (err as { msg: string }).msg;
  }
  if ("message" in err && typeof (err as { message: unknown }).message === "string") {
    return (err as { message: string }).message;
  }
  return "";
}
