export interface TableData {
  headers: string[];
  rows: string[][];
}

export function decodeText(buf: ArrayBuffer): string {
  return new TextDecoder("utf-8").decode(buf);
}

export function parseJson(buf: ArrayBuffer): unknown {
  const text = decodeText(buf);
  return JSON.parse(text);
}

export async function parseCsv(buf: ArrayBuffer): Promise<TableData> {
  const text = decodeText(buf);
  const Papa = await import("papaparse");
  const result = Papa.default.parse<string[]>(text, {
    skipEmptyLines: true,
    header: false,
  });
  if (!result.data || result.data.length === 0) {
    return { headers: [], rows: [] };
  }
  const [headerRow, ...dataRows] = result.data;
  const headers = (headerRow ?? []).map((h) => String(h).trim());
  const rows = dataRows.map((row) => row.map((c) => String(c)));
  return { headers, rows };
}

export async function parseXlsx(buf: ArrayBuffer): Promise<TableData> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(buf, { type: "array" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return { headers: [], rows: [] };
  const sheet = wb.Sheets[sheetName];
  if (!sheet) return { headers: [], rows: [] };
  const json = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
  if (json.length === 0) return { headers: [], rows: [] };
  const headers = (json[0] as unknown[]).map((c) => String(c));
  const rows = json.slice(1).map((row) => (row as unknown[]).map((c) => String(c)));
  return { headers, rows };
}
