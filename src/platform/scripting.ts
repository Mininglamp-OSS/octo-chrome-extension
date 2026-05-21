import { browser } from "wxt/browser";

export interface ExecuteOpts {
  tabId: number;
  files?: string[];
  world?: "MAIN" | "ISOLATED";
  func?: () => unknown;
}

interface ScriptingLikeApi {
  executeScript?: (opts: {
    target: { tabId: number };
    files?: string[];
    func?: () => unknown;
    world?: "MAIN" | "ISOLATED";
  }) => Promise<unknown[]>;
}

function api(): ScriptingLikeApi | undefined {
  return (browser as unknown as { scripting?: ScriptingLikeApi }).scripting;
}

export async function executeScript(opts: ExecuteOpts): Promise<unknown[]> {
  const s = api();
  if (!s?.executeScript) return [];
  return s.executeScript({
    target: { tabId: opts.tabId },
    ...(opts.files && { files: opts.files }),
    ...(opts.func && { func: opts.func }),
    ...(opts.world && { world: opts.world }),
  });
}
