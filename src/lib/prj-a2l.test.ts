import assert from "node:assert/strict";
import test from "node:test";
import { parseA2lMeasurements } from "./a2l-match.ts";
import { decodeProjectBytes, maskIncaValues, patchProject, planProject } from "./prj-a2l.ts";

function record(did: string, value: string | null) {
  const field = value === null
    ? '<NAME xsi:type="string">INCAvar</NAME>\r\n<VALUE format-rev="2" xsi:type="valueBaseExpression"/>'
    : `<NAME xsi:type="string">INCAvar</NAME>\r\n<VALUE format-rev="2" xsi:type="valueBaseExpression">\r\n<VALUE xsi:type="string">${value}</VALUE>\r\n</VALUE>`;
  return `<COMPONENT format-rev="4" xsi:type="paramRecord">\r\n<NAME xsi:type="string">${did}</NAME>\r\n<NAME xsi:type="string">ConvGain</NAME><VALUE>1.0</VALUE>\r\n${field}\r\n</COMPONENT>`;
}

test("chooses one declared IRV variant and changes no text outside INCAvar", () => {
  const a2l = [
    "/begin MEASUREMENT\nBeIPMR_y_EOL_RegP2418_in_IRV\n/end MEASUREMENT",
    "/begin MEASUREMENT\nBeIPMR_y_EOL_RegP2418_out\n/end MEASUREMENT",
    "/begin MEASUREMENT\nBeIPMR_y_EOL_RegP2418_out_IRV\n/end MEASUREMENT",
  ].join("\n");
  const xml = `<?xml version="1.0" encoding="utf-8"?>\r\n<PROJECT>\r\n${record("9D96", "BeIPMR_y_EOL_RegP2418_IRV")}\r\n${record("9D97", "No_Safe_Candidate")}\r\n</PROJECT>`;
  const plan = planProject(xml, parseA2lMeasurements(a2l), () => 0.99);
  assert.equal(plan.records[0]?.selectedName, "BeIPMR_y_EOL_RegP2418_out_IRV");
  assert.equal(plan.records[0]?.candidates.length, 3);
  assert.equal(plan.records[1]?.status, "unmatched");
  const result = patchProject(xml, plan);
  assert.equal(result, xml.replace("BeIPMR_y_EOL_RegP2418_IRV", "BeIPMR_y_EOL_RegP2418_out_IRV"));
  assert.equal(maskIncaValues(result), maskIncaValues(xml));
  assert.ok(result.includes("No_Safe_Candidate"));
});

test("keeps the native bare XML form and removes quote characters from an existing value", () => {
  const a2l = "/begin MEASUREMENT\nKnown_out\n/end MEASUREMENT";
  const xml = `<PROJECT>${record("9901", "Known_out")}${record("9902", "'Known_out'")}${record("9903", null)}</PROJECT>`;
  const plan = planProject(xml, parseA2lMeasurements(a2l));
  assert.deepEqual(plan.records.map((item) => item.status), ["already", "change", "no-inca"]);
  assert.equal(plan.records[1]?.changeKind, "format");
  assert.equal(patchProject(xml, plan), xml.replace("<VALUE xsi:type=\"string\">'Known_out'</VALUE>", "<VALUE xsi:type=\"string\">Known_out</VALUE>"));
});

test("uses a declared measurement alias when the old name is a SYMBOL_LINK tail", () => {
  const a2l = '/begin MEASUREMENT\nCamCrksftDif_LrndEdgeDifVldExh1\n"description"\nECU_ADDRESS 0x1234\nSYMBOL_LINK "RamBlock.EeCAMR_b_LrndEdgeDifVldExh1" 0\n/end MEASUREMENT';
  const xml = `<PROJECT>${record("6095", "EeCAMR_b_LrndEdgeDifVldExh1")}</PROJECT>`;
  const plan = planProject(xml, parseA2lMeasurements(a2l));
  assert.equal(plan.records[0]?.selectedName, "CamCrksftDif_LrndEdgeDifVldExh1");
  assert.ok(patchProject(xml, plan).includes("<VALUE xsi:type=\"string\">CamCrksftDif_LrndEdgeDifVldExh1</VALUE>"));
});

test("reuses one random choice for duplicate DID records with the same stem", () => {
  const a2l = '/begin MEASUREMENT\nLongSignal_in_IRV\n/end MEASUREMENT\n/begin MEASUREMENT\nLongSignal_out_IRV\n/end MEASUREMENT';
  const xml = `<PROJECT>${record("9D96", "LongSignal_IRV")}${record("9D96", "LongSignal_IRV")}</PROJECT>`;
  let calls = 0;
  const plan = planProject(xml, parseA2lMeasurements(a2l), () => { calls++; return calls === 1 ? 0 : 0.99; });
  assert.equal(calls, 1);
  assert.equal(plan.records[0]?.selectedName, plan.records[1]?.selectedName);
});

test("preserves source bytes when decoding a UTF-8 project", () => {
  const xml = `\uFEFF<?xml version="1.0"?><PROJECT>${record("9901", "Known_out")}</PROJECT>`;
  assert.equal(decodeProjectBytes(new TextEncoder().encode(xml)), xml);
  assert.throws(() => decodeProjectBytes(new Uint8Array([0xff, 0xfe])), /UTF-8/);
});
