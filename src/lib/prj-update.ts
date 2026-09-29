import type { MappingEntry } from "./parse-mapping";

export type ChangeStatus = "updated" | "already" | "missing" | "no-incavar";

export type ChangeRow = {
  did: string;
  newValue: string;
  oldValues: string[];
  occurrences: number;
  status: ChangeStatus;
};

export type PatchResult = {
  xml: string;
  changes: ChangeRow[];
  recordsTouched: number;
  mappingCount: number;
};

function escapeXml(s: string): string {
  return s.replace(/&/g, "&").replace(/</g, "<").replace(/>/g, ">");
}

function unescapeXml(s: string): string {
  return s
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/&/g, "&");
}

const RECORD_RE =
  /<COMPONENT format-rev="4" xsi:type="paramRecord">[\s\S]*?<\/COMPONENT>/g;

const NAME_RE = /<NAME xsi:type="string">([^<]+)<\/NAME>/;

const INCA_INNER_RE =
  /(<NAME xsi:type="string">INCAvar<\/NAME>\s*<VALUE format-rev="2" xsi:type="valueBaseExpression">\s*<VALUE xsi:type="string">)([^<]*)(<\/VALUE>)/;

const INCA_SELF_RE =
  /<NAME xsi:type="string">INCAvar<\/NAME>\s*<VALUE format-rev="2" xsi:type="valueBaseExpression"\s*\/>/;

const INCA_EMPTY_RE =
  /(<NAME xsi:type="string">INCAvar<\/NAME>\s*<VALUE format-rev="2" xsi:type="valueBaseExpression">)\s*(<\/VALUE>)/;

function readIncavar(block: string): { value: string | null; kind: "inner" | "self" | "empty" | "none" } {
  const inner = block.match(INCA_INNER_RE);
  if (inner) return { value: unescapeXml(inner[2] ?? ""), kind: "inner" };
  if (INCA_SELF_RE.test(block)) return { value: "", kind: "self" };
  if (INCA_EMPTY_RE.test(block)) return { value: "", kind: "empty" };
  return { value: null, kind: "none" };
}

function writeIncavar(block: string, newVal: string): string {
  const escaped = escapeXml(newVal);
  if (INCA_INNER_RE.test(block)) {
    return block.replace(INCA_INNER_RE, `$1${escaped}$3`);
  }
  if (INCA_SELF_RE.test(block)) {
    return block.replace(
      INCA_SELF_RE,
      `<NAME xsi:type="string">INCAvar</NAME>\n\t\t\t\t\t\t\t<VALUE format-rev="2" xsi:type="valueBaseExpression">\n\t\t\t\t\t\t\t\t<VALUE xsi:type="string">${escaped}</VALUE>\n\t\t\t\t\t\t\t</VALUE>`,
    );
  }
  if (INCA_EMPTY_RE.test(block)) {
    return block.replace(
      INCA_EMPTY_RE,
      `$1\n\t\t\t\t\t\t\t\t<VALUE xsi:type="string">${escaped}</VALUE>\n\t\t\t\t\t\t\t$2`,
    );
  }
  return block;
}

export function patchPrj(xml: string, mapping: MappingEntry[]): PatchResult {
  const map = new Map<string, string>();
  for (const e of mapping) {
    map.set(e.did.toUpperCase(), e.variable);
  }

  const seen = new Map<
    string,
    { oldValues: string[]; occurrences: number; recordsTouched: number; noInca: boolean }
  >();

  let recordsTouched = 0;

  const next = xml.replace(RECORD_RE, (block) => {
    const nameM = block.match(NAME_RE);
    if (!nameM) return block;
    const did = (nameM[1] ?? "").trim().toUpperCase();
    if (!map.has(did)) return block;

    const newVal = map.get(did)!;
    const { value, kind } = readIncavar(block);
    const rec =
      seen.get(did) ??
      { oldValues: [], occurrences: 0, recordsTouched: 0, noInca: false };
    rec.occurrences += 1;

    if (kind === "none" || value === null) {
      rec.noInca = true;
      seen.set(did, rec);
      return block;
    }

    if (!rec.oldValues.includes(value)) rec.oldValues.push(value);

    if (value === newVal) {
      seen.set(did, rec);
      return block;
    }

    rec.recordsTouched += 1;
    recordsTouched += 1;
    seen.set(did, rec);
    return writeIncavar(block, newVal);
  });

  const changes: ChangeRow[] = [];
  for (const [did, newValue] of map) {
    const rec = seen.get(did);
    if (!rec) {
      changes.push({
        did,
        newValue,
        oldValues: [],
        occurrences: 0,
        status: "missing",
      });
      continue;
    }
    if (rec.noInca) {
      changes.push({
        did,
        newValue,
        oldValues: rec.oldValues,
        occurrences: rec.occurrences,
        status: "no-incavar",
      });
      continue;
    }
    const already = rec.oldValues.length > 0 && rec.oldValues.every((v) => v === newValue);
    changes.push({
      did,
      newValue,
      oldValues: rec.oldValues,
      occurrences: rec.occurrences,
      status: already ? "already" : "updated",
    });
  }

  changes.sort((a, b) => a.did.localeCompare(b.did));

  return {
    xml: next,
    changes,
    recordsTouched,
    mappingCount: map.size,
  };
}

export function summarize(result: PatchResult) {
  const updated = result.changes.filter((c) => c.status === "updated").length;
  const already = result.changes.filter((c) => c.status === "already").length;
  const missing = result.changes.filter((c) => c.status === "missing").length;
  const noInca = result.changes.filter((c) => c.status === "no-incavar").length;
  return { updated, already, missing, noInca, recordsTouched: result.recordsTouched };
}
