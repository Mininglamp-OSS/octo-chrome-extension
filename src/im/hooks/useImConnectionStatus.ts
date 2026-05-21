import { useEffect, useState } from "react";
import { ConnectStatus, imGetStatus, onImStatus } from "@/im/proxy";

/** sidepanel/cmdk 用 —— 通过 messaging 拉 + 订阅 offscreen 状态 */
export function useImConnectionStatus(): number {
  const [status, setStatus] = useState<number>(ConnectStatus.Disconnect);

  useEffect(() => {
    let cancelled = false;
    void imGetStatus().then((s) => {
      if (!cancelled) setStatus(s);
    });
    const off = onImStatus((s) => setStatus(s));
    return () => {
      cancelled = true;
      off();
    };
  }, []);

  return status;
}
