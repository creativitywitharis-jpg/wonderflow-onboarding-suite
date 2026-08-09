// Dependency-free CSV parsing + smart column mapping for the import flow.

/** Parse CSV text into headers + rows, handling quoted fields, escaped quotes,
 *  and commas/newlines inside quotes. */
export function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const s = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const records: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      records.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    records.push(row);
  }
  const nonEmpty = records.filter((r) => r.some((cell) => cell.trim() !== ""));
  const headers = (nonEmpty.shift() ?? []).map((h) => h.trim());
  return { headers, rows: nonEmpty };
}

export type FieldSpec = {
  key: string;
  label: string;
  required?: boolean;
  type?: "text" | "number" | "tags";
  aliases?: string[];
  enum?: string[]; // allowed values (case-insensitive); non-matching values are dropped
};

const norm = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Heuristically match CSV headers to target fields by name/alias. */
export function autoMap(headers: string[], fields: FieldSpec[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const f of fields) {
    const cands = [f.key, f.label, ...(f.aliases ?? [])].map(norm);
    const hit = headers.find((h) => cands.includes(norm(h)));
    if (hit) map[f.key] = hit;
  }
  return map;
}

/** Turn raw string rows into typed objects using the column mapping. Rows
 *  missing a required field are dropped. */
export function coerceRows(
  rows: string[][],
  headers: string[],
  mapping: Record<string, string>,
  fields: FieldSpec[],
): Record<string, unknown>[] {
  const colIndex = (h: string) => headers.indexOf(h);
  const out: Record<string, unknown>[] = [];
  for (const r of rows) {
    const obj: Record<string, unknown> = {};
    for (const f of fields) {
      const h = mapping[f.key];
      if (!h) continue;
      const raw = (r[colIndex(h)] ?? "").trim();
      if (raw === "") continue;
      if (f.enum) {
        const match = f.enum.find((v) => norm(v) === norm(raw));
        if (match) obj[f.key] = match;
        continue;
      }
      if (f.type === "number") {
        const n = Number(raw.replace(/[^0-9.\-]/g, ""));
        if (!Number.isNaN(n)) obj[f.key] = n;
      } else if (f.type === "tags") {
        obj[f.key] = raw.split(/[;,|]/).map((t) => t.trim()).filter(Boolean);
      } else {
        obj[f.key] = raw;
      }
    }
    if (fields.filter((f) => f.required).every((f) => obj[f.key] != null && obj[f.key] !== "")) {
      out.push(obj);
    }
  }
  return out;
}
