export type MappingEntry = {
  did: string;
  variable: string;
};

const DID_RE = /\b([0-9A-Fa-f]{4})\b/;
const VAR_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

function stripQuotes(s: string): string {
  return s.replace(/^[\s"'\\]+|[\s"'\\]+$/g, "").trim();
}

export function extractDid(raw: string): string | null {
  const cleaned = raw
    .replace(/\\[rn]/gi, " ")
    .replace(/[\r\n\\]+/g, " ")
    .replace(/["']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return null;

  const labeled = cleaned.match(/DID_EOL_CHECK\s+([0-9A-Fa-f]{4})\b/i);
  if (labeled) return labeled[1].toUpperCase();

  const standalone = cleaned.match(/^([0-9A-Fa-f]{4})$/);
  if (standalone) return standalone[1].toUpperCase();

  const last = cleaned.match(DID_RE);
  if (last && /DID/i.test(cleaned)) return last[1].toUpperCase();

  return null;
}

export function extractVariable(raw: string): string | null {
  const cleaned = stripQuotes(
    raw.replace(/\\[rn]/gi, " ").replace(/[\r\n]+/g, " "),
  );
  if (!cleaned) return null;
  const token = cleaned.split(/\s+/)[0] ?? "";
  if (!VAR_RE.test(token)) return null;
  return token;
}

export function parseLine(line: string): MappingEntry | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const noSlashN = trimmed.replace(/\\[rn]/gi, " ");
  const parts = noSlashN.split(/\t+/);
  if (parts.length >= 2) {
    const did = extractDid(parts[0] ?? "");
    const rest = parts.slice(1).join(" ");
    const variable = extractVariable(rest);
    if (did && variable) return { did, variable };
  }

  const csv = noSlashN.split(/,/);
  if (csv.length >= 2) {
    const did = extractDid(csv[0] ?? "");
    const variable = extractVariable(csv.slice(1).join(","));
    if (did && variable) return { did, variable };
  }

  const cleaned = noSlashN.replace(/["']/g, " ").replace(/\s+/g, " ").trim();
  const labeled = cleaned.match(
    /DID_EOL_CHECK\s+([0-9A-Fa-f]{4})\s+([A-Za-z_][A-Za-z0-9_]*)/i,
  );
  if (labeled) {
    return { did: labeled[1].toUpperCase(), variable: labeled[2] };
  }

  const pair = cleaned.match(/^([0-9A-Fa-f]{4})\s+([A-Za-z_][A-Za-z0-9_]*)$/);
  if (pair) {
    return { did: pair[1].toUpperCase(), variable: pair[2] };
  }

  return null;
}

/** Parse pasted TSV / CSV / free text (the Excel copy-paste we used together). */
export function parseMappingText(text: string): MappingEntry[] {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const map = new Map<string, string>();

  for (const line of normalized.split("\n")) {
    const entry = parseLine(line);
    if (entry) map.set(entry.did, entry.variable);
  }

  if (map.size === 0) {
    const collapsed = normalized.replace(/\\\n/g, " ");
    const re =
      /DID_EOL_CHECK[\s\\]*([0-9A-Fa-f]{4})[\s"']+([A-Za-z_][A-Za-z0-9_]*)/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(collapsed))) {
      map.set(m[1].toUpperCase(), m[2]);
    }
  }

  return [...map.entries()].map(([did, variable]) => ({ did, variable }));
}

/**
 * Non-destructive analysis used only for the review panel (row counts,
 * duplicate DIDs, invalid lines). Does not change how mapping is parsed or
 * applied — parseMappingText / parseGrid remain the source of truth.
 */
export type MappingAnalysis = {
  totalLines: number;
  validCount: number;
  duplicateDids: string[];
  invalidLines: number;
};

export function analyzeMappingText(text: string): MappingAnalysis {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const seen = new Map<string, number>();
  let invalidLines = 0;

  for (const line of lines) {
    const entry = parseLine(line);
    if (!entry) {
      invalidLines += 1;
      continue;
    }
    seen.set(entry.did, (seen.get(entry.did) ?? 0) + 1);
  }

  return {
    totalLines: lines.length,
    validCount: seen.size,
    duplicateDids: [...seen.entries()].filter(([, n]) => n > 1).map(([did]) => did),
    invalidLines,
  };
}

export function parseGrid(rows: unknown[][]): MappingEntry[] {
  const map = new Map<string, string>();
  for (const row of rows) {
    if (!row || row.length === 0) continue;
    const cells = row.map((c) => (c == null ? "" : String(c)));
    const joined = cells.join("\t");
    const entry = parseLine(joined);
    if (entry) {
      map.set(entry.did, entry.variable);
      continue;
    }
    let did: string | null = null;
    let variable: string | null = null;
    for (const cell of cells) {
      if (!did) did = extractDid(cell);
      else if (!variable) variable = extractVariable(cell);
    }
    if (did && variable) map.set(did, variable);
  }
  return [...map.entries()].map(([did, variable]) => ({ did, variable }));
}
