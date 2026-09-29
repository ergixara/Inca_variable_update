export type MeasurementIndex = {
  names: Set<string>;
  byLowerName: Map<string, string[]>;
  bySymbolName: Map<string, string[]>;
  byStem: Map<string, string[]>;
  count: number;
};

const MEASUREMENT_BLOCK_RE = /^[ \t]*\/begin[ \t]+MEASUREMENT[ \t]*\r?\n[ \t]*([A-Za-z_][A-Za-z0-9_]*)([\s\S]*?)^[ \t]*\/end[ \t]+MEASUREMENT/gm;
const SYMBOL_LINK_RE = /\bSYMBOL_LINK[ \t]+"([^"]+)"/;
const TERMINAL_VARIANT_RE = /_(?:in_(?:D9E\d+_)?IRV|out_IRV|IRV_out|IRV|out)$/i;

export function measurementStem(name: string): string {
  return name.replace(TERMINAL_VARIANT_RE, "").toLowerCase();
}

function add(map: Map<string, string[]>, key: string, name: string) {
  const values = map.get(key);
  if (values) values.push(name);
  else map.set(key, [name]);
}

/** Only declared A2L MEASUREMENT names are offered as replacement values. */
export function parseA2lMeasurements(text: string): MeasurementIndex {
  const names = new Set<string>();
  const byLowerName = new Map<string, string[]>();
  const bySymbolName = new Map<string, string[]>();
  const byStem = new Map<string, string[]>();
  for (const match of text.matchAll(MEASUREMENT_BLOCK_RE)) {
    const name = match[1];
    if (!name || names.has(name)) continue;
    names.add(name);
    add(byLowerName, name.toLowerCase(), name);
    add(byStem, measurementStem(name), name);
    const symbol = match[2]?.match(SYMBOL_LINK_RE)?.[1];
    if (symbol) {
      add(bySymbolName, symbol, name);
      const tail = symbol.split(".").at(-1);
      if (tail && tail !== symbol) add(bySymbolName, tail, name);
    }
  }
  return { names, byLowerName, bySymbolName, byStem, count: names.size };
}

export function findDeclaredCandidates(current: string, index: MeasurementIndex): string[] {
  if (index.names.has(current)) return [current];
  const capitalizationMatch = index.byLowerName.get(current.toLowerCase());
  if (capitalizationMatch?.length) return capitalizationMatch;
  const symbolMatch = index.bySymbolName.get(current);
  if (symbolMatch?.length) return [...new Set(symbolMatch)];
  const stem = measurementStem(current);
  if (stem.length < 8) return [];
  return index.byStem.get(stem) ?? [];
}
