import { findDeclaredCandidates, measurementStem, type MeasurementIndex } from "./a2l-match.ts";

export type RecordStatus = "change" | "already" | "unmatched" | "no-inca";

export type ProjectRecord = {
  id: number;
  did: string;
  currentRaw: string | null;
  currentName: string | null;
  selectedName: string | null;
  candidates: string[];
  status: RecordStatus;
  changeKind: "name" | "format" | null;
  valueStart: number | null;
  valueEnd: number | null;
};

export type ProjectPlan = {
  records: ProjectRecord[];
  measurementCount: number;
  stats: { change: number; nameChanges: number; formatChanges: number; already: number; unmatched: number; noInca: number; multiple: number };
};

const RECORD_RE = /<COMPONENT format-rev="4" xsi:type="paramRecord">[\s\S]*?<\/COMPONENT>/g;
const NAME_RE = /<NAME xsi:type="string">([^<]+)<\/NAME>/;
const INCA_VALUE_RE = /(<NAME xsi:type="string">INCAvar<\/NAME>\s*<VALUE format-rev="2" xsi:type="valueBaseExpression">\s*<VALUE xsi:type="string">)([^<]*)(<\/VALUE>)/;
const INCA_VALUE_GLOBAL_RE = /(<NAME xsi:type="string">INCAvar<\/NAME>\s*<VALUE format-rev="2" xsi:type="valueBaseExpression">\s*<VALUE xsi:type="string">)([^<]*)(<\/VALUE>)/g;

function nameFromRaw(raw: string): string {
  const trimmed = raw.trim();
  return trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length >= 2
    ? trimmed.slice(1, -1)
    : trimmed;
}

/** Random selection happens once during analysis; the review and download share this plan. */
export function planProject(
  xml: string,
  index: MeasurementIndex,
  random: () => number = Math.random,
): ProjectPlan {
  const records: ProjectRecord[] = [];
  const chosenForDidAndStem = new Map<string, string>();
  for (const block of xml.matchAll(RECORD_RE)) {
    const content = block[0];
    const did = content.match(NAME_RE)?.[1]?.trim().toUpperCase();
    if (!did || !/^[0-9A-F]{4}$/.test(did)) continue;
    const inca = content.match(INCA_VALUE_RE);
    const id = records.length;
    if (!inca || inca.index === undefined || block.index === undefined) {
      records.push({ id, did, currentRaw: null, currentName: null, selectedName: null,
        candidates: [], status: "no-inca", changeKind: null, valueStart: null, valueEnd: null });
      continue;
    }
    const raw = inca[2];
    const currentName = nameFromRaw(raw);
    const valueStart = block.index + inca.index + inca[1].length;
    const valueEnd = valueStart + raw.length;
    const candidates = currentName ? findDeclaredCandidates(currentName, index) : [];
    const exactName = index.names.has(currentName);
    const choiceKey = `${did}\u0000${measurementStem(currentName)}`;
    const priorChoice = chosenForDidAndStem.get(choiceKey);
    const selectedName = exactName ? currentName : candidates.length
      ? priorChoice && candidates.includes(priorChoice)
        ? priorChoice
        : candidates[Math.min(candidates.length - 1, Math.floor(random() * candidates.length))]
      : null;
    if (!exactName && selectedName) chosenForDidAndStem.set(choiceKey, selectedName);
    // ECU-TEST displays string expressions with quotes, but EIX stores the
    // variable name itself in this XML node. Writing quote characters here
    // makes the imported expression invalid.
    const nextRaw = selectedName;
    const status: RecordStatus = !selectedName ? "unmatched" : raw === nextRaw ? "already" : "change";
    records.push({
      id, did, currentRaw: raw, currentName, selectedName, candidates,
      status, changeKind: status === "change" ? exactName ? "format" : "name" : null,
      valueStart, valueEnd,
    });
  }
  const stats = { change: 0, nameChanges: 0, formatChanges: 0, already: 0, unmatched: 0, noInca: 0, multiple: 0 };
  for (const record of records) {
    if (record.status === "no-inca") stats.noInca++;
    else stats[record.status]++;
    if (record.changeKind === "name") stats.nameChanges++;
    if (record.changeKind === "format") stats.formatChanges++;
    if (record.status === "change" && record.candidates.length > 1) stats.multiple++;
  }
  return { records, measurementCount: index.count, stats };
}

export function patchProject(xml: string, plan: ProjectPlan): string {
  const edits = plan.records
    .filter((record) => record.status === "change" && record.valueStart !== null && record.valueEnd !== null)
    .sort((a, b) => b.valueStart! - a.valueStart!);
  let result = xml;
  for (const record of edits) {
    const start = record.valueStart!;
    const end = record.valueEnd!;
    if (xml.slice(start, end) !== record.currentRaw || !record.selectedName) {
      throw new Error(`Project changed during review at DID ${record.did}. Load the files again.`);
    }
    result = result.slice(0, start) + record.selectedName + result.slice(end);
  }
  if (maskIncaValues(xml) !== maskIncaValues(result)) {
    throw new Error("Integrity check failed: content outside INCAvar values would change.");
  }
  return result;
}

export function maskIncaValues(xml: string): string {
  return xml.replace(INCA_VALUE_GLOBAL_RE, "$1__INCA_VALUE__$3");
}

export function decodeProjectBytes(bytes: Uint8Array): string {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    throw new Error("This project is not valid UTF-8, so it cannot be edited byte-for-byte.");
  }
  const roundTrip = new TextEncoder().encode(text);
  if (roundTrip.length !== bytes.length || roundTrip.some((byte, i) => byte !== bytes[i])) {
    throw new Error("This project cannot be read and written byte-for-byte as UTF-8.");
  }
  if (!text.includes("<PROJECT") || !text.includes('xsi:type="paramRecord"')) {
    throw new Error("This file does not appear to be an ETAS INCA project.");
  }
  return text;
}
