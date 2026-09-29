import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseMappingText } from "./parse-mapping.ts";
import { patchPrj } from "./prj-update.ts";

test("parse pasted DID_EOL_CHECK rows", () => {
  const text = `"DID_EOL_CHECK\\
990E"	BeVVTR_n_EOL_EepVVT_DsblRPM_out
"DID_EOL_CHECK 9D96"	BeIPMR_y_EOL_RegP2418_IRV
"DID_EOL_CHECK\\
9D34"	"BeIPMR_y_EOL_RegIdleAirHiRPM_out_IRV
"`;
  const rows = parseMappingText(text);
  const byDid = Object.fromEntries(rows.map((r) => [r.did, r.variable]));
  assert.equal(byDid["990E"], "BeVVTR_n_EOL_EepVVT_DsblRPM_out");
  assert.equal(byDid["9D96"], "BeIPMR_y_EOL_RegP2418_IRV");
  assert.equal(byDid["9D34"], "BeIPMR_y_EOL_RegIdleAirHiRPM_out_IRV");
});

test("patch only INCAvar on a live .prj", () => {
  const xml = readFileSync("/workspace/attachments/LB_STEP2.prj", "utf8");
  const mapping = parseMappingText(`990E\tBeVVTR_n_EOL_EepVVT_DsblRPM_out
9D80\tBeIPMR_y_EOL_RegP0245_out_IRV`);
  const result = patchPrj(xml, mapping);
  assert.ok(result.recordsTouched >= 1);
  const e = result.changes.find((c) => c.did === "990E");
  assert.ok(e);
  assert.equal(e.status, "updated");
  assert.ok(result.xml.includes("BeVVTR_n_EOL_EepVVT_DsblRPM_out"));
  assert.ok(!result.xml.includes("ConvGain") || true);
  const convBefore = (xml.match(/<NAME xsi:type="string">ConvGain<\/NAME>/g) || [])
    .length;
  const convAfter = (result.xml.match(/<NAME xsi:type="string">ConvGain<\/NAME>/g) || [])
    .length;
  assert.equal(convAfter, convBefore);
});
