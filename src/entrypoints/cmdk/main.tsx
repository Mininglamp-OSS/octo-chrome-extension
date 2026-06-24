import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/styles/globals.css";
import { AppBoot } from "@/app/AppBoot";
import { CmdkApp } from "@/app/CmdkApp";
import { Providers } from "@/app/providers";

const root = document.getElementById("root");
if (!root) throw new Error("missing #root");

// 把 cmdk 的 IM slot claim id 上报父帧 content script（CmdKOverlay）。
// 父帧据此能在硬移除 iframe 前可靠释放 slot —— iframe 被移除时本 realm 的 React
// cleanup 不会执行，deferred releaseImSlot 永不触发，claim 会残留到 TTL 才过期，
// 期间后台 offscreen 起不来 → 通知/角标丢失。
function reportSlotClaimToParent(id: string): void {
  window.parent?.postMessage({ type: "CMDK_SLOT_CLAIMED", id }, "*");
}

createRoot(root).render(
  <StrictMode>
    <Providers>
      <AppBoot claimImSlot onImSlotClaimed={reportSlotClaimToParent}>
        <CmdkApp />
      </AppBoot>
    </Providers>
  </StrictMode>,
);
