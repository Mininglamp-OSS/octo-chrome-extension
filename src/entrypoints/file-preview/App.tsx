import { useEffect, useState } from "react";
import { formatFileSize } from "@/components/octo/FileTypeIcon";
import { FileHeader } from "./components/FileHeader";
import { PreviewContainer } from "./components/PreviewContainer";
import {
  type TableData,
  decodeText,
  parseCsv,
  parseJson,
  parseXlsx,
} from "./utils/fileParser";
import {
  PREVIEW_SIZE_LIMIT,
  getPreviewKind,
  parseFilePreviewParams,
} from "./utils/urlParams";

type Payload = string | unknown | TableData | null;

interface State {
  status: "loading" | "ok" | "error";
  payload: Payload;
  error: string;
}

export function FilePreviewApp() {
  const params = parseFilePreviewParams();
  const kind = getPreviewKind(params.ext);
  const [state, setState] = useState<State>({ status: "loading", payload: null, error: "" });

  useEffect(() => {
    if (!params.url) {
      setState({ status: "error", payload: null, error: "缺少文件 URL" });
      return;
    }
    if (kind === "unknown") {
      setState({
        status: "error",
        payload: null,
        error: `不支持预览 .${params.ext || "未知"} 类型`,
      });
      return;
    }
    if (params.size > PREVIEW_SIZE_LIMIT) {
      setState({
        status: "error",
        payload: null,
        error: `文件 ${formatFileSize(params.size)} 超过 ${formatFileSize(PREVIEW_SIZE_LIMIT)} 上限，无法预览`,
      });
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const resp = await fetch(params.url);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const buf = await resp.arrayBuffer();
        if (cancelled) return;
        if (buf.byteLength > PREVIEW_SIZE_LIMIT) {
          throw new Error(
            `文件 ${formatFileSize(buf.byteLength)} 超过 ${formatFileSize(PREVIEW_SIZE_LIMIT)} 上限，无法预览`,
          );
        }

        let payload: Payload;
        if (kind === "markdown" || kind === "text") {
          payload = decodeText(buf);
        } else if (kind === "json") {
          payload = parseJson(buf);
        } else if (kind === "table") {
          payload = params.ext === "xlsx" ? await parseXlsx(buf) : await parseCsv(buf);
        } else {
          payload = null;
        }
        if (cancelled) return;
        setState({ status: "ok", payload, error: "" });
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        setState({ status: "error", payload: null, error: msg || "加载失败" });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [params.url, params.ext, params.size, kind]);

  useEffect(() => {
    document.title = params.name ? `${params.name} · 预览` : "文件预览";
  }, [params.name]);

  return (
    <div className="min-h-screen">
      <FileHeader name={params.name} size={params.size} extLabel={params.ext} url={params.url} />
      {state.status === "loading" && <LoadingView />}
      {state.status === "error" && <ErrorView message={state.error} />}
      {state.status === "ok" && kind !== "unknown" && (
        <PreviewContainer kind={kind} payload={state.payload} />
      )}
    </div>
  );
}

function LoadingView() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12 text-center text-sm text-(--color-muted-foreground)">
      加载中…
    </div>
  );
}

function ErrorView({ message }: { message: string }) {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12 text-center text-sm text-(--color-destructive)">
      {message}
    </div>
  );
}
