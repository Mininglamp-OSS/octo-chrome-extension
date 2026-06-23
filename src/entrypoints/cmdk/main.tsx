import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/styles/globals.css";
import { AppBoot } from "@/app/AppBoot";
import { CmdkApp } from "@/app/CmdkApp";
import { Providers } from "@/app/providers";

const root = document.getElementById("root");
if (!root) throw new Error("missing #root");

createRoot(root).render(
  <StrictMode>
    <Providers>
      <AppBoot claimImSlot>
        <CmdkApp />
      </AppBoot>
    </Providers>
  </StrictMode>,
);
