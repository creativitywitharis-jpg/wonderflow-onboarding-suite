import { useRef, useState } from "react";
import { Check, FileUp, Sparkles, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { autoMap, coerceRows, parseCsv, type FieldSpec } from "@/lib/csv";
import { askAI } from "@/lib/ai";

const INPUT = "w-full rounded-lg border border-border bg-background/40 px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-gold/50";

/**
 * Reusable CSV importer with AI column mapping. Parses a file, maps its columns
 * to the target fields (heuristically, plus an optional Claude pass for tricky
 * headers), previews, then bulk-inserts via `onImport`.
 */
export function CsvImport({
  entityLabel,
  fields,
  orgId,
  onImport,
  onClose,
}: {
  entityLabel: string;
  fields: FieldSpec[];
  orgId: string | undefined;
  onImport: (rows: Record<string, unknown>[]) => Promise<{ error: Error | null }>;
  onClose: (importedCount?: number) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [fileName, setFileName] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = coerceRows(rows, headers, mapping, fields);

  function loadText(text: string, name: string) {
    const { headers: h, rows: r } = parseCsv(text);
    if (h.length === 0) {
      setError("That file didn't look like a CSV with a header row.");
      return;
    }
    setError(null);
    setFileName(name);
    setHeaders(h);
    setRows(r);
    setMapping(autoMap(h, fields));
  }

  function onFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => loadText(String(reader.result ?? ""), file.name);
    reader.readAsText(file);
  }

  async function aiMap() {
    if (!headers.length || aiBusy) return;
    setAiBusy(true);
    try {
      const prompt =
        `I'm importing a CSV into a "${entityLabel}" table. The CSV columns are: ${headers.join(", ")}. ` +
        `Map them to these target fields: ${fields.map((f) => f.key).join(", ")}. ` +
        `Reply with ONLY a JSON object mapping each target field to the exact CSV column name that best matches (or null if none). No prose.`;
      const reply = await askAI([{ role: "user", content: prompt }], { id: orgId });
      const json = reply.slice(reply.indexOf("{"), reply.lastIndexOf("}") + 1);
      const guess = JSON.parse(json) as Record<string, string | null>;
      const next: Record<string, string> = {};
      for (const f of fields) {
        const v = guess[f.key];
        if (v && headers.includes(v)) next[f.key] = v;
      }
      setMapping((m) => ({ ...m, ...next }));
    } catch {
      setError("AI mapping didn't work — map the columns manually below.");
    } finally {
      setAiBusy(false);
    }
  }

  async function doImport() {
    if (!parsed.length || busy) return;
    setBusy(true);
    setError(null);
    const { error: err } = await onImport(parsed);
    setBusy(false);
    if (err) setError(err.message);
    else onClose(parsed.length);
  }

  const required = fields.filter((f) => f.required);
  const missingRequired = required.some((f) => !mapping[f.key]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={() => onClose()} />
      <div className="glass relative flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-border p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-xl border border-gold/25 bg-glass"><FileUp className="size-4 text-gold" /></span>
            <div>
              <p className="text-sm font-semibold">Import {entityLabel}</p>
              <p className="text-xs text-muted-foreground">Upload a CSV — AI maps the columns for you.</p>
            </div>
          </div>
          <button onClick={() => onClose()} aria-label="Close" className="grid size-8 place-items-center rounded-full border border-border text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
        </div>

        {headers.length === 0 ? (
          <button
            onClick={() => fileRef.current?.click()}
            className="mt-6 flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-background/30 py-12 text-center transition-colors hover:border-gold/40"
          >
            <Upload className="size-7 text-gold" />
            <div>
              <p className="text-sm font-medium text-foreground">Choose a CSV file</p>
              <p className="mt-1 text-xs text-muted-foreground">First row should be column headers</p>
            </div>
          </button>
        ) : (
          <div className="mt-5 flex min-h-0 flex-col">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                <span className="text-foreground/85">{fileName}</span> · {rows.length} row{rows.length === 1 ? "" : "s"} · {headers.length} columns
              </p>
              <div className="flex gap-2">
                <button onClick={aiMap} disabled={aiBusy} className="flex items-center gap-1.5 rounded-full border border-gold/30 bg-glass px-3 py-1.5 text-xs font-medium text-foreground/85 transition-colors hover:border-gold/60 disabled:opacity-60">
                  <Sparkles className="size-3.5 text-gold" /> {aiBusy ? "Mapping…" : "AI auto-map"}
                </button>
                <button onClick={() => fileRef.current?.click()} className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">Change file</button>
              </div>
            </div>

            {/* mapping */}
            <div className="mt-4 grid max-h-[38vh] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
              {fields.map((f) => (
                <label key={f.key} className="flex items-center gap-2 rounded-xl border border-border bg-background/30 px-3 py-2">
                  <span className="w-28 shrink-0 text-xs text-foreground/80">
                    {f.label}
                    {f.required && <span className="text-gold"> *</span>}
                  </span>
                  <select value={mapping[f.key] ?? ""} onChange={(e) => setMapping((m) => ({ ...m, [f.key]: e.target.value }))} className={INPUT}>
                    <option value="">— skip —</option>
                    {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </label>
              ))}
            </div>

            {parsed[0] && (
              <p className="mt-3 truncate rounded-lg border border-border bg-background/30 px-3 py-2 text-xs text-muted-foreground">
                Preview: {fields.filter((f) => mapping[f.key] && parsed[0][f.key] != null).slice(0, 4).map((f) => `${f.label}=${String(parsed[0][f.key])}`).join(" · ")}
              </p>
            )}
          </div>
        )}

        {error && <p className="mt-3 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">{error}</p>}

        {headers.length > 0 && (
          <div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-4">
            <span className="text-xs text-muted-foreground">
              {parsed.length} of {rows.length} rows ready{missingRequired ? ` · map ${required.map((f) => f.label).join(", ")}` : ""}
            </span>
            <button onClick={doImport} disabled={busy || !parsed.length || missingRequired} className="flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50" style={{ background: "var(--gradient-gold)", boxShadow: "var(--shadow-gold)" }}>
              <Check className="size-4" /> {busy ? "Importing…" : `Import ${parsed.length}`}
            </button>
          </div>
        )}

        <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
      </div>
    </div>
  );
}
