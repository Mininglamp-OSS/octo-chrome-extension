import type { TableData } from "../utils/fileParser";
import type { PreviewKind } from "../utils/urlParams";
import { PreviewJson } from "./PreviewJson";
import { PreviewMarkdown } from "./PreviewMarkdown";
import { PreviewTable } from "./PreviewTable";
import { PreviewText } from "./PreviewText";

interface Props {
  kind: Exclude<PreviewKind, "unknown">;
  payload: string | unknown | TableData;
}

export function PreviewContainer({ kind, payload }: Props) {
  switch (kind) {
    case "markdown":
      return <PreviewMarkdown source={payload as string} />;
    case "text":
      return <PreviewText source={payload as string} />;
    case "json":
      return <PreviewJson data={payload} />;
    case "table":
      return <PreviewTable data={payload as TableData} />;
  }
}
