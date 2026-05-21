import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/styles/globals.css";
import { Providers } from "@/app/providers";
import { SidepanelApp } from "@/app/SidepanelApp";

const root = document.getElementById("root");
if (!root) throw new Error("missing #root");

createRoot(root).render(
  <StrictMode>
    <Providers>
      <SidepanelApp />
    </Providers>
  </StrictMode>,
);
