import * as XLSX from "xlsx";
import { parseGrid, type MappingEntry } from "./parse-mapping";

export function mappingFromWorkbook(buffer: ArrayBuffer): MappingEntry[] {
  const wb = XLSX.read(buffer, { type: "array" });
  const all: unknown[][] = [];
  for (const name of wb.SheetNames) {
    const sheet = wb.Sheets[name];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(sheet, {
      header: 1,
      raw: false,
      defval: "",
      blankrows: false,
    });
    all.push(...rows);
  }
  return parseGrid(all);
}
