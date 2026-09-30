import { i as __toESM } from "../_runtime.mjs";
import { L as require_react, v as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as ShieldCheck, c as LockKeyhole, d as ChevronDown, f as Check, i as Shuffle, l as FileSearch2, m as ArrowDownToLine, n as Upload, o as Search, p as ArrowRight, s as RotateCcw, t as X, u as FileCode2 } from "../_libs/lucide-react.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-bdQ8dDTl.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var MEASUREMENT_BLOCK_RE = /^[ \t]*\/begin[ \t]+MEASUREMENT[ \t]*\r?\n[ \t]*([A-Za-z_][A-Za-z0-9_]*)([\s\S]*?)^[ \t]*\/end[ \t]+MEASUREMENT/gm;
var SYMBOL_LINK_RE = /\bSYMBOL_LINK[ \t]+"([^"]+)"/;
var TERMINAL_VARIANT_RE = /_(?:in_(?:D9E\d+_)?IRV|out_IRV|IRV_out|IRV|out)$/i;
function measurementStem(name) {
	return name.replace(TERMINAL_VARIANT_RE, "").toLowerCase();
}
function add(map, key, name) {
	const values = map.get(key);
	if (values) values.push(name);
	else map.set(key, [name]);
}
/** Only declared A2L MEASUREMENT names are offered as replacement values. */
function parseA2lMeasurements(text) {
	const names = /* @__PURE__ */ new Set();
	const byLowerName = /* @__PURE__ */ new Map();
	const bySymbolName = /* @__PURE__ */ new Map();
	const byStem = /* @__PURE__ */ new Map();
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
	return {
		names,
		byLowerName,
		bySymbolName,
		byStem,
		count: names.size
	};
}
function findDeclaredCandidates(current, index) {
	if (index.names.has(current)) return [current];
	const capitalizationMatch = index.byLowerName.get(current.toLowerCase());
	if (capitalizationMatch?.length) return capitalizationMatch;
	const symbolMatch = index.bySymbolName.get(current);
	if (symbolMatch?.length) return [...new Set(symbolMatch)];
	const stem = measurementStem(current);
	if (stem.length < 8) return [];
	return index.byStem.get(stem) ?? [];
}
var RECORD_RE = /<COMPONENT format-rev="4" xsi:type="paramRecord">[\s\S]*?<\/COMPONENT>/g;
var NAME_RE = /<NAME xsi:type="string">([^<]+)<\/NAME>/;
var INCA_VALUE_RE = /(<NAME xsi:type="string">INCAvar<\/NAME>\s*<VALUE format-rev="2" xsi:type="valueBaseExpression">\s*<VALUE xsi:type="string">)([^<]*)(<\/VALUE>)/;
var INCA_VALUE_GLOBAL_RE = /(<NAME xsi:type="string">INCAvar<\/NAME>\s*<VALUE format-rev="2" xsi:type="valueBaseExpression">\s*<VALUE xsi:type="string">)([^<]*)(<\/VALUE>)/g;
function nameFromRaw(raw) {
	const trimmed = raw.trim();
	return trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length >= 2 ? trimmed.slice(1, -1) : trimmed;
}
/** Random selection happens once during analysis; the review and download share this plan. */
function planProject(xml, index, random = Math.random) {
	const records = [];
	const chosenForDidAndStem = /* @__PURE__ */ new Map();
	for (const block of xml.matchAll(RECORD_RE)) {
		const content = block[0];
		const did = content.match(NAME_RE)?.[1]?.trim().toUpperCase();
		if (!did || !/^[0-9A-F]{4}$/.test(did)) continue;
		const inca = content.match(INCA_VALUE_RE);
		const id = records.length;
		if (!inca || inca.index === void 0 || block.index === void 0) {
			records.push({
				id,
				did,
				currentRaw: null,
				currentName: null,
				selectedName: null,
				candidates: [],
				status: "no-inca",
				changeKind: null,
				valueStart: null,
				valueEnd: null
			});
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
		const selectedName = exactName ? currentName : candidates.length ? priorChoice && candidates.includes(priorChoice) ? priorChoice : candidates[Math.min(candidates.length - 1, Math.floor(random() * candidates.length))] : null;
		if (!exactName && selectedName) chosenForDidAndStem.set(choiceKey, selectedName);
		const status = !selectedName ? "unmatched" : raw === selectedName ? "already" : "change";
		records.push({
			id,
			did,
			currentRaw: raw,
			currentName,
			selectedName,
			candidates,
			status,
			changeKind: status === "change" ? exactName ? "format" : "name" : null,
			valueStart,
			valueEnd
		});
	}
	const stats = {
		change: 0,
		nameChanges: 0,
		formatChanges: 0,
		already: 0,
		unmatched: 0,
		noInca: 0,
		multiple: 0
	};
	for (const record of records) {
		if (record.status === "no-inca") stats.noInca++;
		else stats[record.status]++;
		if (record.changeKind === "name") stats.nameChanges++;
		if (record.changeKind === "format") stats.formatChanges++;
		if (record.status === "change" && record.candidates.length > 1) stats.multiple++;
	}
	return {
		records,
		measurementCount: index.count,
		stats
	};
}
function patchProject(xml, plan) {
	const edits = plan.records.filter((record) => record.status === "change" && record.valueStart !== null && record.valueEnd !== null).sort((a, b) => b.valueStart - a.valueStart);
	let result = xml;
	for (const record of edits) {
		const start = record.valueStart;
		const end = record.valueEnd;
		if (xml.slice(start, end) !== record.currentRaw || !record.selectedName) throw new Error(`Project changed during review at DID ${record.did}. Load the files again.`);
		result = result.slice(0, start) + record.selectedName + result.slice(end);
	}
	if (maskIncaValues(xml) !== maskIncaValues(result)) throw new Error("Integrity check failed: content outside INCAvar values would change.");
	return result;
}
function maskIncaValues(xml) {
	return xml.replace(INCA_VALUE_GLOBAL_RE, "$1__INCA_VALUE__$3");
}
function decodeProjectBytes(bytes) {
	let text;
	try {
		text = new TextDecoder("utf-8", {
			fatal: true,
			ignoreBOM: true
		}).decode(bytes);
	} catch {
		throw new Error("This project is not valid UTF-8, so it cannot be edited byte-for-byte.");
	}
	const roundTrip = new TextEncoder().encode(text);
	if (roundTrip.length !== bytes.length || roundTrip.some((byte, i) => byte !== bytes[i])) throw new Error("This project cannot be read and written byte-for-byte as UTF-8.");
	if (!text.includes("<PROJECT") || !text.includes("xsi:type=\"paramRecord\"")) throw new Error("This file does not appear to be an ETAS INCA project.");
	return text;
}
function formatBytes(bytes) {
	return bytes < 1048576 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
function Home() {
	const [projectFile, setProjectFile] = (0, import_react.useState)(null);
	const [a2lFile, setA2lFile] = (0, import_react.useState)(null);
	const [analysis, setAnalysis] = (0, import_react.useState)(null);
	const [busy, setBusy] = (0, import_react.useState)(false);
	const [error, setError] = (0, import_react.useState)(null);
	const [filter, setFilter] = (0, import_react.useState)("all");
	const [search, setSearch] = (0, import_react.useState)("");
	const visible = (0, import_react.useMemo)(() => {
		const records = analysis?.plan.records ?? [];
		const term = search.trim().toLowerCase();
		return records.filter((record) => (filter === "all" || record.status === filter) && (!term || `${record.did} ${record.currentName ?? ""} ${record.selectedName ?? ""}`.toLowerCase().includes(term)));
	}, [
		analysis,
		filter,
		search
	]);
	function updateProject(file) {
		setProjectFile(file);
		setAnalysis(null);
		setError(null);
	}
	function updateA2l(file) {
		setA2lFile(file);
		setAnalysis(null);
		setError(null);
	}
	async function analyze() {
		if (!projectFile || !a2lFile) return;
		setBusy(true);
		setError(null);
		setAnalysis(null);
		setFilter("all");
		setSearch("");
		try {
			if (!/\.prj$/i.test(projectFile.name)) throw new Error("Choose an ETAS .prj project file.");
			if (!/\.a2l$/i.test(a2lFile.name)) throw new Error("Choose an .a2l description file.");
			await new Promise((resolve) => window.setTimeout(resolve, 30));
			const [projectBuffer, a2lText] = await Promise.all([projectFile.arrayBuffer(), a2lFile.text()]);
			const projectText = decodeProjectBytes(new Uint8Array(projectBuffer));
			const measurements = parseA2lMeasurements(a2lText);
			if (!measurements.count) throw new Error("No A2L MEASUREMENT declarations were found.");
			const plan = planProject(projectText, measurements);
			if (!plan.records.length) throw new Error("No DID parameter records were found in this project.");
			const patched = patchProject(projectText, plan);
			const outputBytes = new TextEncoder().encode(patched);
			setAnalysis({
				plan,
				outputBytes,
				projectName: projectFile.name,
				a2lName: a2lFile.name
			});
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "These files could not be analyzed.");
		} finally {
			setBusy(false);
		}
	}
	function download() {
		if (!analysis) return;
		const name = analysis.projectName.replace(/\.prj$/i, "") + "_A2L_matched.prj";
		const blob = new Blob([new Uint8Array(analysis.outputBytes)], { type: "application/octet-stream" });
		const url = URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.href = url;
		link.download = name;
		document.body.append(link);
		link.click();
		link.remove();
		window.setTimeout(() => URL.revokeObjectURL(url), 3e4);
	}
	const stats = analysis?.plan.stats;
	const filters = analysis ? [
		{
			key: "all",
			label: "All records",
			count: analysis.plan.records.length
		},
		{
			key: "change",
			label: "Will change",
			count: stats.change
		},
		{
			key: "unmatched",
			label: "No match",
			count: stats.unmatched
		},
		{
			key: "already",
			label: "Already ready",
			count: stats.already
		},
		{
			key: "no-inca",
			label: "No value",
			count: stats.noInca
		}
	] : [];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "min-h-screen bg-bg text-fg",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "app-glow pointer-events-none fixed inset-0",
			"aria-hidden": "true"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "relative mx-auto max-w-7xl px-4 pb-16 sm:px-8 lg:px-10",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
					className: "flex min-h-20 items-center justify-between gap-4 border-b border-border/80",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "brand-mark flex size-9 items-center justify-center rounded-lg border border-accent/40 bg-accent/10 font-mono text-sm font-semibold text-accent",
							children: "IV"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "leading-tight",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-sm font-semibold tracking-wide",
								children: "INCA Variable Studio"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "font-mono text-xs tracking-wide text-fg-subtle",
								children: "PRJ / A2L MATCHING"
							})]
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "hidden items-center gap-2 rounded-full border border-border bg-surface/80 px-3 py-1.5 text-xs text-fg-muted sm:flex",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LockKeyhole, { className: "size-3.5 text-accent" }), " Files stay in your browser"]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "grid gap-8 py-10 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-end lg:py-14",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mb-4 flex items-center gap-2 font-mono text-xs tracking-widest text-accent uppercase",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "h-px w-7 bg-accent" }), " Project alignment"]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h1", {
							className: "max-w-3xl text-4xl font-semibold tracking-tight text-fg sm:text-5xl lg:text-6xl",
							children: [
								"Match the variable.",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("br", {}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-fg-muted",
									children: "Preserve the project."
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "mt-5 max-w-2xl text-sm leading-7 text-fg-muted sm:text-base",
							children: [
								"Compare every DID in an INCA project with declared A2L measurements. Review the exact value each record will receive, then download a project with changes confined to ",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
									className: "text-fg",
									children: "INCAvar"
								}),
								" values."
							]
						})
					] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "rounded-2xl border border-border bg-surface/85 p-5 shadow-panel",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2 text-sm font-medium",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldCheck, { className: "size-4 text-accent" }), " Change boundary"]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "mt-3 text-sm leading-6 text-fg-muted",
							children: [
								"The app writes only the contents of selected ",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
									className: "text-fg",
									children: "INCAvar"
								}),
								" value nodes. It verifies that everything outside those values is identical."
							]
						})]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					"aria-labelledby": "source-heading",
					className: "rounded-3xl border border-border bg-surface/75 p-4 shadow-panel sm:p-6",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mb-5 flex flex-wrap items-start justify-between gap-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "section-kicker",
								children: "01 / SOURCE FILES"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
								id: "source-heading",
								className: "mt-2 text-xl font-semibold",
								children: "Add the two files"
							})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "rounded-full border border-border px-3 py-1.5 font-mono text-xs text-fg-subtle",
								children: "LOCAL ANALYSIS"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "grid gap-4 md:grid-cols-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileDrop, {
								number: "01",
								title: "INCA project",
								detail: "The .prj containing your current DIDs and INCAvar values",
								accept: ".prj",
								file: projectFile,
								onFile: updateProject,
								icon: "project"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileDrop, {
								number: "02",
								title: "A2L description",
								detail: "Declared measurement names used to find replacement candidates",
								accept: ".a2l",
								file: a2lFile,
								onFile: updateA2l,
								icon: "a2l"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "max-w-xl text-xs leading-5 text-fg-subtle",
								children: "ECU-TEST shows names in single quotes, but its PRJ file stores the name without those quote characters. Unmatched records remain untouched."
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								onClick: analyze,
								disabled: !projectFile || !a2lFile || busy,
								className: "action-button inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-accent px-5 text-sm font-semibold text-accent-foreground transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40",
								children: [
									busy ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RotateCcw, { className: "size-4 animate-spin" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileSearch2, { className: "size-4" }),
									busy ? "Analyzing files…" : analysis ? "Analyze again" : "Analyze files",
									!busy ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowRight, { className: "size-4" }) : null
								]
							})]
						}),
						error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							role: "alert",
							className: "mt-4 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger",
							children: error
						}) : null
					]
				}),
				analysis ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					"aria-labelledby": "review-heading",
					className: "mt-7 space-y-5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid grid-cols-2 gap-3 lg:grid-cols-4",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Metric, {
								label: "Project DIDs",
								value: analysis.plan.records.length,
								detail: "records inspected"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Metric, {
								label: "Will change",
								value: stats.change,
								detail: `${stats.nameChanges} names · ${stats.formatChanges} format fixes`,
								tone: "accent"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Metric, {
								label: "No A2L match",
								value: stats.unmatched,
								detail: "kept as they are"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Metric, {
								label: "Multiple choices",
								value: stats.multiple,
								detail: "one random pick per DID"
							})
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "overflow-hidden rounded-3xl border border-border bg-surface/85 shadow-panel",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-wrap items-start justify-between gap-4 border-b border-border px-5 py-5 sm:px-6",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "section-kicker",
										children: "02 / CHANGE REVIEW"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
										id: "review-heading",
										className: "mt-2 text-xl font-semibold",
										children: "Current and proposed values"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
										className: "mt-1 text-xs text-fg-subtle",
										children: [
											analysis.plan.measurementCount.toLocaleString(),
											" declared measurements found in ",
											analysis.a2lName
										]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "mt-1 text-xs text-fg-subtle",
										children: "Quotes reflect the ECU-TEST editor display; the downloaded PRJ stores bare variable names."
									})
								] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldCheck, { className: "size-3.5" }), " Integrity check passed"]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-col gap-4 border-b border-border px-5 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "flex max-w-full gap-1 overflow-x-auto pb-1",
									role: "tablist",
									"aria-label": "Filter records",
									children: filters.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										type: "button",
										role: "tab",
										"aria-selected": filter === item.key,
										onClick: () => setFilter(item.key),
										className: `min-h-9 shrink-0 rounded-lg px-3 text-xs font-medium transition ${filter === item.key ? "bg-surface-3 text-fg" : "text-fg-subtle hover:bg-surface-2 hover:text-fg"}`,
										children: [
											item.label,
											" ",
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "ml-1 font-mono opacity-65",
												children: item.count
											})
										]
									}, item.key))
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
									className: "flex min-h-10 w-full items-center gap-2 rounded-xl border border-border bg-bg/70 px-3 focus-within:border-accent lg:w-64",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "size-4 shrink-0 text-fg-subtle" }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "sr-only",
											children: "Search DID or variable"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											value: search,
											onChange: (event) => setSearch(event.target.value),
											placeholder: "Search DID or variable",
											className: "w-full bg-transparent text-sm text-fg outline-none placeholder:text-fg-subtle"
										})
									]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "max-h-[36rem] overflow-auto",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
									className: "w-full min-w-[58rem] border-collapse text-left text-xs",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
										className: "sticky top-0 z-10 bg-surface-2 text-fg-subtle",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
												className: "table-head",
												children: "DID"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
												className: "table-head",
												children: "Current INCAvar"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
												className: "table-head",
												children: "Proposed INCAvar"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
												className: "table-head",
												children: "A2L choice"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
												className: "table-head",
												children: "Result"
											})
										] })
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: visible.map((record) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RecordRow, { record }, record.id)) })]
								}), !visible.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "px-6 py-12 text-center text-sm text-fg-muted",
									children: "No records match this filter."
								}) : null]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-wrap items-center justify-between gap-4 border-t border-border px-5 py-4 sm:px-6",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "text-xs leading-5 text-fg-subtle",
									children: [
										"Showing ",
										visible.length,
										" of ",
										analysis.plan.records.length,
										" records. ",
										stats.noInca,
										" records have no editable INCAvar value and remain unchanged."
									]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									type: "button",
									onClick: download,
									className: "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-accent px-5 text-sm font-semibold text-accent-foreground transition hover:bg-accent-hover",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowDownToLine, { className: "size-4" }), " Download revised .prj"]
								})]
							})
						]
					})]
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "mt-7 rounded-3xl border border-dashed border-border bg-surface/35 px-6 py-12 text-center",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mx-auto flex size-12 items-center justify-center rounded-2xl border border-border bg-surface-2 text-fg-muted",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileSearch2, { className: "size-5" })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "mt-4 text-sm font-semibold",
							children: "The review will appear here"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mx-auto mt-2 max-w-md text-xs leading-5 text-fg-subtle",
							children: "Add a project and its A2L, then analyze to see every DID, every proposed INCAvar, and exactly which records stay untouched."
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("footer", {
					className: "mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-border py-6 text-xs text-fg-subtle",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "INCA Variable Studio" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Measured changes. Original project structure preserved." })]
				})
			]
		})]
	});
}
function FileDrop({ number, title, detail, accept, file, onFile, icon }) {
	const ref = (0, import_react.useRef)(null);
	const [over, setOver] = (0, import_react.useState)(false);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		onDragOver: (event) => {
			event.preventDefault();
			setOver(true);
		},
		onDragLeave: () => setOver(false),
		onDrop: (event) => {
			event.preventDefault();
			setOver(false);
			onFile(event.dataTransfer.files[0] ?? null);
		},
		className: `file-drop min-w-0 rounded-2xl border p-5 transition sm:p-6 ${over ? "border-accent bg-accent/5" : file ? "border-accent/30 bg-surface-2/70" : "border-border bg-bg/40 hover:border-fg-subtle"}`,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
				ref,
				type: "file",
				accept,
				className: "sr-only",
				onChange: (event) => {
					onFile(event.target.files?.[0] ?? null);
					event.target.value = "";
				},
				"aria-label": `Choose ${title} file`
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-start justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex size-11 items-center justify-center rounded-xl border border-border bg-surface-2 text-accent",
					children: icon === "project" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileCode2, { className: "size-5" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileSearch2, { className: "size-5" })
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "font-mono text-xs tracking-widest text-fg-subtle",
					children: number
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
				className: "mt-5 text-base font-semibold",
				children: title
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 min-h-10 text-xs leading-5 text-fg-muted",
				children: detail
			}),
			file ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-4 flex min-w-0 items-center gap-3 rounded-xl border border-accent/25 bg-accent/5 p-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "size-4 shrink-0 text-accent" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "min-w-0 flex-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "truncate font-mono text-xs text-fg",
							title: file.name,
							children: file.name
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-0.5 text-xs text-fg-subtle",
							children: formatBytes(file.size)
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => onFile(null),
						"aria-label": `Remove ${title}`,
						className: "flex size-8 items-center justify-center rounded-lg text-fg-subtle hover:bg-surface-3 hover:text-fg",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4" })
					})
				]
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-4 flex items-center justify-between gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "flex items-center gap-1.5 text-xs text-fg-subtle",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Upload, { className: "size-3.5" }),
						" Drop ",
						accept,
						" here"
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => ref.current?.click(),
					className: "min-h-9 rounded-lg border border-border bg-surface-2 px-3 text-xs font-medium text-fg hover:border-fg-subtle",
					children: "Browse file"
				})]
			}),
			file ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				onClick: () => ref.current?.click(),
				className: "mt-3 text-xs font-medium text-accent hover:text-accent-hover",
				children: ["Choose another file ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowRight, { className: "ml-1 inline size-3" })]
			}) : null
		]
	});
}
function Metric({ label, value, detail, tone }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-2xl border border-border bg-surface/85 p-4 shadow-panel sm:p-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs text-fg-subtle",
				children: label
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: `mt-2 font-mono text-3xl font-medium tracking-tight ${tone === "accent" ? "text-accent" : "text-fg"}`,
				children: value.toLocaleString()
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-xs text-fg-muted",
				children: detail
			})
		]
	});
}
function editorValue(raw) {
	if (!raw) return raw;
	return raw.startsWith("'") && raw.endsWith("'") ? raw : `'${raw}'`;
}
function RecordRow({ record }) {
	const proposed = editorValue(record.selectedName ?? record.currentRaw);
	const badge = record.status === "change" ? record.changeKind === "format" ? "Format fix" : "Name change" : record.status === "already" ? "Already ready" : record.status === "unmatched" ? "No A2L match" : "No value";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
		className: "border-t border-border/60 align-top transition-colors hover:bg-surface-2/60",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
				className: "table-cell font-mono font-semibold text-fg",
				children: record.did
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
				className: "table-cell max-w-xs break-all font-mono text-fg-muted",
				children: editorValue(record.currentRaw) || /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-fg-subtle",
					children: "—"
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
				className: `table-cell max-w-xs break-all font-mono ${record.status === "change" ? "text-fg" : "text-fg-muted"}`,
				children: proposed || /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-fg-subtle",
					children: "—"
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
				className: "table-cell min-w-40",
				children: record.candidates.length > 1 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", {
					className: "group",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("summary", {
						className: "flex cursor-pointer list-none items-center gap-1.5 text-accent",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shuffle, { className: "size-3.5" }),
							" 1 of ",
							record.candidates.length,
							" selected ",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronDown, { className: "size-3 transition group-open:rotate-180" })
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-2 space-y-1 rounded-lg border border-border bg-bg/70 p-2 font-mono text-xs",
						children: record.candidates.map((name) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: name === record.selectedName ? "text-accent" : "text-fg-subtle",
							children: [name === record.selectedName ? "✓ " : "· ", name]
						}, name))
					})]
				}) : record.candidates.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-fg-subtle",
					children: "1 declared name"
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-fg-subtle",
					children: "No candidate"
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
				className: "table-cell",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: `inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 font-medium ${record.status === "change" ? "border-accent/30 bg-accent/10 text-accent" : record.status === "already" ? "border-border bg-surface-2 text-fg-muted" : "border-warn/30 bg-warn/10 text-warn"}`,
					children: badge
				})
			})
		]
	});
}
//#endregion
export { Home as component };
