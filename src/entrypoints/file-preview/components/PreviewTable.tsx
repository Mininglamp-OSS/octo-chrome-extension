import type { TableData } from "../utils/fileParser";

interface Props {
  data: TableData;
}

export function PreviewTable({ data }: Props) {
  if (data.headers.length === 0 && data.rows.length === 0) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-8 text-sm text-(--color-muted-foreground)">
        表格为空
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-6">
      <div className="overflow-x-auto rounded-md border border-(--color-border)">
        <table className="w-full text-left text-xs">
          <thead className="bg-(--color-muted)/40">
            <tr>
              {data.headers.map((h, i) => (
                <th
                  // biome-ignore lint/suspicious/noArrayIndexKey: 表头按位置稳定
                  key={i}
                  className="border-b border-(--color-border) px-3 py-2 font-semibold whitespace-nowrap"
                >
                  {h || `列 ${i + 1}`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, ri) => (
              <tr
                // biome-ignore lint/suspicious/noArrayIndexKey: 行按位置稳定
                key={ri}
                className="border-b border-(--color-border) last:border-b-0 hover:bg-(--color-muted)/30"
              >
                {row.map((cell, ci) => (
                  <td
                    // biome-ignore lint/suspicious/noArrayIndexKey: 单元格按位置稳定
                    key={ci}
                    className="px-3 py-1.5 align-top whitespace-pre-wrap break-words"
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2 text-xs text-(--color-muted-foreground)">
        共 {data.rows.length} 行
      </div>
    </div>
  );
}
