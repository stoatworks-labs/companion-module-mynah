// ---------------------------------------------------------------------------
// GENERATED — do not edit.
//
// The Mynah language core, bundled from its TypeScript source so this module
// compiles a command with exactly the same parser the web tool uses. A second
// transcription of the grammar would drift the first time a keyword moved and
// nothing would notice.
//
// Source: stoatworks-labs/mynah  src/lang/
// Rebuild: npm run build:lang in that repo, then npm run sync:lang here.
// ---------------------------------------------------------------------------
//#region src/lang/paths.ts
var Path = class Path {
	segs;
	constructor(segs) {
		this.segs = segs;
	}
	static root() {
		return new Path([]);
	}
	/** A plain object node: `control`, `status`, `system`. */
	node(name) {
		return new Path([...this.segs, {
			kind: "node",
			name
		}]);
	}
	/** A collection plus the key selected from it. They never appear apart. */
	item(collection, key) {
		return new Path([
			...this.segs,
			{
				kind: "collection",
				name: collection
			},
			{
				kind: "item",
				key: String(key)
			}
		]);
	}
	/** A leaf property. */
	prop(name) {
		return new Path([...this.segs, {
			kind: "prop",
			name
		}]);
	}
	/**
	* True if the path ends at a leaf.
	*
	* Worth checking before a read: AWJ answers a non-leaf GET with an empty
	* object rather than an error, so a container read looks like a successful
	* read of nothing.
	*/
	get isLeaf() {
		return this.segs[this.segs.length - 1]?.kind === "prop";
	}
	/** Render for AWJ over TCP 10606. */
	toAwj() {
		let s = "DeviceObject";
		for (const seg of this.segs) switch (seg.kind) {
			case "node":
				s += `/${seg.name}`;
				break;
			case "collection":
				s += `/$${seg.name}`;
				break;
			case "item":
				s += `/@items/${seg.key}`;
				break;
			case "prop": s += `/@props/${seg.name}`;
		}
		return s;
	}
	/**
	* Render for the Web RCS store — used by the `DEVICE` channel and by the
	* `GET /api/stores/device` snapshot alike.
	*/
	toWs() {
		const v = ["device"];
		for (const seg of this.segs) switch (seg.kind) {
			case "node":
				v.push(seg.name);
				break;
			case "collection":
				v.push(`${seg.name}List`);
				break;
			case "item":
				v.push("items", seg.key);
				break;
			case "prop": v.push("pp", seg.name);
		}
		return v;
	}
	/** Stable key for caches and comparisons. */
	get key() {
		return this.toWs().join("/");
	}
};
var DeviceObject = Path.root();
//#endregion
//#region src/lang/model.ts
/**
* The slice of the LivePremier object model the command line addresses.
*
* Every limit here was confirmed against firmware 6.2.73, leaf by leaf, on a
* running device. Do not infer a limit by probing AWJ for an `E12` error: that
* finds the *model's* maximum, not what a given chassis has configured, and the
* two disagree.
*/
/** Firmware this table was verified against. */
var VERIFIED_FIRMWARE = "6.2.73";
var DIMS = {
	screen: {
		min: 1,
		max: 24
	},
	aux: {
		min: 1,
		max: 96
	},
	/** `NATIVE` is a layer too, and is handled out of band from this range. */
	layer: {
		min: 1,
		max: 128
	},
	multiviewer: {
		min: 1,
		max: 8
	}
};
/** Memory slot ranges, which differ per bank. */
var SLOTS = {
	screen: {
		min: 1,
		max: 1e3
	},
	aux: {
		min: 1,
		max: 1e3
	},
	master: {
		min: 1,
		max: 500
	},
	layer: {
		min: 1,
		max: 50
	},
	multiviewer: {
		min: 1,
		max: 50
	}
};
/**
* The record-mask categories, in the device's own order.
*
* `categoryFilter` is a record mask in everything but name — the same idea as
* a lighting desk masking a store to position or colour only.
*/
var CATEGORIES = [
	"SOURCE",
	"POS",
	"SIZE",
	"OPACITY",
	"CROPPING",
	"BORDER",
	"TRANSITIONS",
	"EFFECTS",
	"FLYING_CURVE",
	"TIMING",
	"SPEED",
	"CUT_AND_FILL",
	"MASK",
	"KEYER"
];
var screenKey = (n) => `S${n}`;
var auxKey = (n) => `A${n}`;
/** `NATIVE` is the background layer; the rest are plain numbers. */
var layerKey = (n) => String(n);
var targetKey = (t) => t.kind === "screen" ? screenKey(t.n) : auxKey(t.n);
/** The collection a target lives in, which differs between load and save. */
var targetCollection = (t) => t.kind === "screen" ? "screen" : "auxiliary";
var presetBank = DeviceObject.node("presetBank");
var masterBank = DeviceObject.node("masterPresetBank");
var layerBank = DeviceObject.node("layerBank");
var monitoringBank = DeviceObject.node("monitoringBank");
/**
* Note the asymmetry, which is the device's and not ours: a load is addressed
* slot-first, a save target-first. Getting this backwards yields an E12 on
* AWJ and silence on the WebSocket.
*/
/** Recall a screen or aux memory into a preset. */
var screenMemoryLoad = (slot, t, mode) => presetBank.node("control").node("load").item("slot", slot).item(targetCollection(t), targetKey(t)).item("preset", mode).prop("xRequest");
/** Store a preset into a screen or aux memory. */
var screenMemorySave = (slot, t, mode) => presetBank.node("control").node("save").item(targetCollection(t), targetKey(t)).item("preset", mode).item("slot", slot).prop("xRequest");
/** Recall a master memory. Master has no target: it is the whole desk. */
var masterMemoryLoad = (slot, mode) => masterBank.node("control").node("load").item("slot", slot).item("preset", mode).prop("xRequest");
/** Fire a master store. The filters below must be written first. */
var masterMemorySave = (slot) => masterBank.node("control").node("save").item("slot", slot).prop("xRequest");
/** The master store's record mask. */
var masterSaveProp = (prop) => masterBank.node("control").node("save").prop(prop);
/** Recall a layer memory. */
var layerMemoryLoad = (slot, t, mode, layer) => layerBank.node("control").node("load").item("slot", slot).item(targetCollection(t), targetKey(t)).item("preset", mode).item("layer", layerKey(layer)).prop("xRequest");
/** Store a layer memory. */
var layerMemorySave = (slot, t, mode, layer) => layerBank.node("control").node("save").item(targetCollection(t), targetKey(t)).item("preset", mode).item("layer", layerKey(layer)).item("slot", slot).prop("xRequest");
/** Recall a multiviewer layout onto an output. */
var monitoringMemoryLoad = (slot, output) => monitoringBank.node("control").node("load").item("slot", slot).item("output", output).prop("xRequest");
/** Store a multiviewer layout. */
var monitoringMemorySave = (slot, output) => monitoringBank.node("control").node("save").item("output", output).item("slot", slot).prop("xRequest");
/** Take: transition preview to program on one screen or aux. */
var takePath = (t) => DeviceObject.item("screenAuxGroup", targetKey(t)).node("control").prop("xTake");
/** The bank root for a memory's own metadata — its label, and its eraser. */
var bankRoot = (bank) => {
	switch (bank) {
		case "screen":
		case "aux": return presetBank;
		case "master": return masterBank;
		case "layer": return layerBank;
		case "multiviewer": return monitoringBank;
	}
};
var memoryLabel = (bank, slot) => bankRoot(bank).item("bank", slot).node("control").prop("label");
var memoryDelete = (bank, slot) => bankRoot(bank).item("bank", slot).node("control").prop("xDelete");
//#endregion
//#region src/lang/keywords.ts
var kw = (word, kind) => ({
	word,
	kind
});
var KEYWORDS = [
	kw("Recall", "function"),
	kw("Store", "function"),
	kw("Take", "function"),
	kw("Delete", "function"),
	kw("Label", "function"),
	kw("Select", "function"),
	kw("Clear", "function"),
	kw("Screen", "object"),
	kw("Aux", "object"),
	kw("Layer", "object"),
	kw("Master", "object"),
	kw("Multiviewer", "object"),
	kw("Memory", "object"),
	kw("Native", "object"),
	kw("Preview", "mode"),
	kw("Program", "mode"),
	kw("If", "clause"),
	kw("Category", "clause"),
	kw("Thru", "operator"),
	kw("Source", "category"),
	kw("Position", "category"),
	kw("Size", "category"),
	kw("Opacity", "category"),
	kw("Cropping", "category"),
	kw("Border", "category"),
	kw("Transitions", "category"),
	kw("Effects", "category"),
	kw("FlyingCurve", "category"),
	kw("Timing", "category"),
	kw("Speed", "category"),
	kw("CutAndFill", "category"),
	kw("Mask", "category"),
	kw("Keyer", "category")
];
var BY_WORD = new Map(KEYWORDS.map((k) => [k.word.toLowerCase(), k]));
/**
* The shortest prefix that resolves to this keyword and nothing else.
*
* When one keyword is a prefix of another — `Mask` inside no other word, but
* `Mas` shared with `Master` — the shorter word has no abbreviation at all and
* must be typed in full. That is reported honestly as the whole word rather
* than as a prefix that would resolve to its neighbour.
*/
function shortestForm(word) {
	const lower = word.toLowerCase();
	for (let i = 1; i < lower.length; i++) {
		const prefix = lower.slice(0, i);
		const hits = KEYWORDS.filter((k) => k.word.toLowerCase().startsWith(prefix));
		if (hits.length === 1 && hits[0].word.toLowerCase() === lower) return word.slice(0, i);
	}
	return word;
}
/** Every keyword with its computed short form, for docs and the help panel. */
function keywordTable() {
	return KEYWORDS.map((keyword) => ({
		keyword,
		short: shortestForm(keyword.word)
	}));
}
/**
* Resolve a typed word to a keyword.
*
* An exact match always wins, even when the word is also a prefix of something
* longer — otherwise `Mask` could never be typed at all while `Master` exists.
* Failing that, a prefix matching exactly one keyword resolves to it. A prefix
* matching several is reported as ambiguous *with its candidates*, because
* "unknown keyword" would be a lie and the operator needs to know which extra
* letter to type.
*/
function resolveKeyword(word) {
	const lower = word.toLowerCase();
	const exact = BY_WORD.get(lower);
	if (exact) return {
		ok: true,
		keyword: exact
	};
	const hits = KEYWORDS.filter((k) => k.word.toLowerCase().startsWith(lower));
	if (hits.length === 1) return {
		ok: true,
		keyword: hits[0]
	};
	if (hits.length > 1) return {
		ok: false,
		reason: "ambiguous",
		candidates: hits
	};
	return {
		ok: false,
		reason: "unknown"
	};
}
/** Every keyword a partial word could still become, for live completion. */
function completions(partial) {
	if (partial === "") return KEYWORDS;
	const lower = partial.toLowerCase();
	return KEYWORDS.filter((k) => k.word.toLowerCase().startsWith(lower));
}
//#endregion
//#region src/lang/lexer.ts
/**
* Tokenizer for the command line.
*
* Every token carries its span so the UI can underline the offending word
* rather than colouring the whole line red.
*/
var isWordChar = (c) => /[A-Za-z]/.test(c);
var isDigit = (c) => /[0-9]/.test(c);
function lex(input) {
	const tokens = [];
	const errors = [];
	let i = 0;
	while (i < input.length) {
		const c = input[i];
		if (c === " " || c === "	") {
			i++;
			continue;
		}
		if (c === "+") {
			tokens.push({
				kind: "plus",
				text: "+",
				start: i,
				end: i + 1
			});
			i++;
			continue;
		}
		if (c === "-") {
			tokens.push({
				kind: "minus",
				text: "-",
				start: i,
				end: i + 1
			});
			i++;
			continue;
		}
		if (c === "\"") {
			const start = i;
			i++;
			let value = "";
			let closed = false;
			while (i < input.length) {
				if (input[i] === "\"") {
					closed = true;
					i++;
					break;
				}
				value += input[i];
				i++;
			}
			const text = input.slice(start, i);
			if (!closed) errors.push({
				message: "Unterminated string",
				start,
				end: i
			});
			tokens.push({
				kind: "string",
				value,
				text,
				start,
				end: i
			});
			continue;
		}
		if (isDigit(c)) {
			const start = i;
			while (i < input.length && isDigit(input[i])) i++;
			const text = input.slice(start, i);
			tokens.push({
				kind: "number",
				value: Number(text),
				text,
				start,
				end: i
			});
			continue;
		}
		if (isWordChar(c)) {
			const start = i;
			while (i < input.length && isWordChar(input[i])) i++;
			const text = input.slice(start, i);
			const res = resolveKeyword(text);
			if (res.ok) tokens.push({
				kind: "keyword",
				keyword: res.keyword,
				text,
				start,
				end: i
			});
			else if (res.reason === "ambiguous") errors.push({
				message: `"${text}" is ambiguous — ${res.candidates.map((k) => k.word).join(", ")}`,
				start,
				end: i
			});
			else errors.push({
				message: `Unknown keyword "${text}"`,
				start,
				end: i
			});
			continue;
		}
		errors.push({
			message: `Unexpected character "${c}"`,
			start: i,
			end: i + 1
		});
		i++;
	}
	return {
		tokens,
		errors
	};
}
//#endregion
//#region src/lang/parser.ts
var CATEGORY_BY_KEYWORD = {
	Source: "SOURCE",
	Position: "POS",
	Size: "SIZE",
	Opacity: "OPACITY",
	Cropping: "CROPPING",
	Border: "BORDER",
	Transitions: "TRANSITIONS",
	Effects: "EFFECTS",
	FlyingCurve: "FLYING_CURVE",
	Timing: "TIMING",
	Speed: "SPEED",
	CutAndFill: "CUT_AND_FILL",
	Mask: "MASK",
	Keyer: "KEYER"
};
var FUNCTIONS = [
	"Recall",
	"Store",
	"Take",
	"Delete",
	"Label",
	"Select",
	"Clear"
];
var Parser = class {
	tokens;
	inputLength;
	pos = 0;
	errors = [];
	constructor(tokens, inputLength) {
		this.tokens = tokens;
		this.inputLength = inputLength;
	}
	peek() {
		return this.tokens[this.pos];
	}
	next() {
		return this.tokens[this.pos++];
	}
	atEnd() {
		return this.pos >= this.tokens.length;
	}
	error(message, tok) {
		const start = tok?.start ?? this.inputLength;
		const end = tok?.end ?? this.inputLength;
		this.errors.push({
			message,
			start,
			end
		});
	}
	/** True if the next token is this keyword, without consuming it. */
	atKeyword(word) {
		const t = this.peek();
		return t?.kind === "keyword" && t.keyword.word === word;
	}
	eatKeyword(word) {
		if (this.atKeyword(word)) {
			this.pos++;
			return true;
		}
		return false;
	}
	/**
	* `range = term { ("+" | "-") term }`, where a term is a number, a closed
	* `a Thru b`, an open `a Thru`, or a leading `Thru b`.
	*
	* `+` unions and `-` subtracts, both binding left to right, so a `-` removes
	* from everything accumulated so far — which is what makes
	* `1 Thru 8 - 5 + 5` put S5 back rather than being a contradiction.
	*/
	parseRange(min, max, what) {
		let values = [];
		let openEnded = false;
		const term = () => {
			if (this.eatKeyword("Thru")) {
				const to = this.peek();
				if (to?.kind !== "number") {
					this.error(`Expected a ${what} number after Thru`, to);
					return;
				}
				this.pos++;
				openEnded = true;
				return span(min, to.value);
			}
			const from = this.peek();
			if (from?.kind !== "number") {
				this.error(`Expected a ${what} number`, from);
				return;
			}
			this.pos++;
			if (this.eatKeyword("Thru")) {
				const to = this.peek();
				if (to?.kind === "number") {
					this.pos++;
					return span(from.value, to.value);
				}
				openEnded = true;
				return span(from.value, max);
			}
			return [from.value];
		};
		const span = (a, b) => {
			const lo = Math.min(a, b);
			const hi = Math.max(a, b);
			const out = [];
			for (let n = lo; n <= hi; n++) out.push(n);
			return out;
		};
		const first = term();
		if (!first) return void 0;
		values = first;
		for (;;) {
			const t = this.peek();
			if (t?.kind === "plus") {
				this.pos++;
				const more = term();
				if (!more) return void 0;
				for (const n of more) if (!values.includes(n)) values.push(n);
				continue;
			}
			if (t?.kind === "minus") {
				this.pos++;
				const less = term();
				if (!less) return void 0;
				values = values.filter((n) => !less.includes(n));
				continue;
			}
			break;
		}
		const bad = values.filter((n) => n < min || n > max);
		if (bad.length > 0) {
			this.error(`${what} ${bad.join(", ")} out of range — valid range is ${min} to ${max}`, this.tokens[this.pos - 1]);
			return;
		}
		values.sort((a, b) => a - b);
		return {
			values,
			openEnded
		};
	}
	/** Layers are a range plus the out-of-band `Native` background layer. */
	parseLayerRange() {
		if (this.eatKeyword("Native")) return {
			native: true,
			numbers: {
				values: [],
				openEnded: false
			}
		};
		const numbers = this.parseRange(DIMS.layer.min, DIMS.layer.max, "Layer");
		if (!numbers) return void 0;
		return {
			native: false,
			numbers
		};
	}
	parseScopeInto(scope) {
		if (this.eatKeyword("Screen")) {
			const r = this.parseRange(DIMS.screen.min, DIMS.screen.max, "Screen");
			if (!r) return false;
			scope.screens = r;
			return true;
		}
		if (this.eatKeyword("Aux")) {
			const r = this.parseRange(DIMS.aux.min, DIMS.aux.max, "Aux");
			if (!r) return false;
			scope.auxes = r;
			return true;
		}
		if (this.eatKeyword("Layer")) {
			const r = this.parseLayerRange();
			if (!r) return false;
			scope.layers = r;
			return true;
		}
		if (this.eatKeyword("Multiviewer")) {
			const r = this.parseRange(DIMS.multiviewer.min, DIMS.multiviewer.max, "Multiviewer");
			if (!r) return false;
			scope.multiviewers = r;
			return true;
		}
		return false;
	}
	parseCategories() {
		const out = [];
		for (;;) {
			const t = this.peek();
			if (t?.kind !== "keyword" || t.keyword.kind !== "category") {
				if (out.length === 0) {
					this.error(`Expected a category — one of ${CATEGORIES.length} record-mask categories`, t);
					return;
				}
				break;
			}
			this.pos++;
			const cat = CATEGORY_BY_KEYWORD[t.keyword.word];
			if (cat && !out.includes(cat)) out.push(cat);
			if (this.peek()?.kind === "plus") {
				this.pos++;
				continue;
			}
			break;
		}
		return out;
	}
	parseFilter() {
		const filter = {};
		let any = false;
		for (;;) {
			if (this.eatKeyword("Screen")) {
				const r = this.parseRange(DIMS.screen.min, DIMS.screen.max, "Screen");
				if (!r) return void 0;
				filter.screens = r;
				any = true;
				continue;
			}
			if (this.eatKeyword("Aux")) {
				const r = this.parseRange(DIMS.aux.min, DIMS.aux.max, "Aux");
				if (!r) return void 0;
				filter.auxes = r;
				any = true;
				continue;
			}
			if (this.eatKeyword("Layer")) {
				const r = this.parseLayerRange();
				if (!r) return void 0;
				filter.layers = r;
				any = true;
				continue;
			}
			if (this.eatKeyword("Category")) {
				const c = this.parseCategories();
				if (!c) return void 0;
				filter.categories = c;
				any = true;
				continue;
			}
			break;
		}
		if (!any) {
			this.error("If needs at least one filter — Screen, Aux, Layer or Category", this.peek());
			return;
		}
		return filter;
	}
	parseCommand() {
		const head = this.next();
		if (!head) {
			this.error("Empty command");
			return;
		}
		if (head.kind !== "keyword" || !FUNCTIONS.includes(head.keyword.word)) {
			this.error(`A command starts with a function — ${FUNCTIONS.join(", ")}`, head);
			return;
		}
		const fn = head.keyword.word;
		const scope = {};
		let memory;
		let mode;
		let label;
		let filter;
		while (!this.atEnd()) {
			if (this.atKeyword("If")) {
				this.pos++;
				filter = this.parseFilter();
				if (!filter) return void 0;
				continue;
			}
			if (this.eatKeyword("Master")) {
				scope.master = true;
				const t = this.peek();
				if (t?.kind === "number") {
					this.pos++;
					memory = t.value;
				}
				continue;
			}
			if (this.eatKeyword("Memory")) {
				const t = this.peek();
				if (t?.kind !== "number") {
					this.error("Expected a memory number", t);
					return;
				}
				this.pos++;
				memory = t.value;
				continue;
			}
			if (this.eatKeyword("Preview")) {
				mode = "PREVIEW";
				continue;
			}
			if (this.eatKeyword("Program")) {
				mode = "PROGRAM";
				continue;
			}
			const t = this.peek();
			if (t?.kind === "string") {
				this.pos++;
				label = t.value;
				continue;
			}
			if (this.parseScopeInto(scope)) continue;
			this.error(`Unexpected ${describe(t)} here`, t);
			return;
		}
		return {
			fn,
			scope,
			memory,
			mode,
			label,
			filter
		};
	}
};
function describe(t) {
	if (!t) return "end of command";
	switch (t.kind) {
		case "keyword": return `keyword "${t.keyword.word}"`;
		case "number": return `number ${t.value}`;
		case "string": return "text";
		case "plus": return "\"+\"";
		case "minus": return "\"-\"";
	}
}
function parse(input) {
	const { tokens, errors: lexErrors } = lex(input);
	if (lexErrors.length > 0) return {
		ok: false,
		errors: lexErrors
	};
	const parser = new Parser(tokens, input.length);
	const command = parser.parseCommand();
	if (!command || parser.errors.length > 0) return {
		ok: false,
		errors: parser.errors.length > 0 ? parser.errors : [{
			message: "Invalid command",
			start: 0,
			end: input.length
		}]
	};
	return {
		ok: true,
		command
	};
}
//#endregion
//#region src/lang/compile.ts
/**
* Defaults, stated once.
*
* The asymmetry is deliberate. A recall that did not say where it was going
* goes to preview, so an under-specified command can never hit air. A store
* takes from program, because that is the look you just made live and it is
* also the device's own `SAVE_FROM_PGM` default. Reaching air always costs an
* explicit word.
*/
var DEFAULT_RECALL_MODE = "PREVIEW";
var DEFAULT_STORE_MODE = "PROGRAM";
function compile(cmd, ctx = {}) {
	const errors = [];
	const fail = (message) => ({
		ok: false,
		errors: [{ message }]
	});
	const targets = resolveTargets(cmd.scope, ctx.selection);
	const layers = resolveLayers(cmd.scope, ctx.selection);
	switch (cmd.fn) {
		case "Clear": return {
			ok: true,
			ops: [],
			summary: "Clear"
		};
		case "Select": {
			if (targets.length === 0 && !layers) return fail("Select needs a Screen, Aux or Layer");
			const parts = [];
			if (targets.length > 0) parts.push(targets.map(describeTarget).join(", "));
			if (layers) parts.push(`Layer ${layers.map(String).join(", ")}`);
			return {
				ok: true,
				ops: [],
				summary: `Select ${parts.join(" ")}`,
				selection: {
					targets,
					layers
				}
			};
		}
		case "Take": {
			if (targets.length === 0) return fail("Take needs a Screen or Aux, or a sticky scope to inherit");
			const ops = targets.map((t) => ({
				path: takePath(t),
				value: true,
				describe: `Take ${describeTarget(t)}`
			}));
			return {
				ok: true,
				ops,
				summary: summarise("Take", ops.length, targets)
			};
		}
		case "Recall": {
			if (cmd.memory === void 0) return fail("Recall needs a Memory number");
			if (cmd.filter) return fail("If filters a Store, not a Recall");
			const mode = cmd.mode ?? DEFAULT_RECALL_MODE;
			if (cmd.scope.master) {
				const err = checkSlot("master", cmd.memory);
				if (err) return fail(err);
				return {
					ok: true,
					ops: [{
						path: masterMemoryLoad(cmd.memory, mode),
						value: true,
						describe: `Recall Master memory ${cmd.memory} to ${describeMode(mode)}`
					}],
					summary: `Recall Master ${cmd.memory} → ${describeMode(mode)}`,
					bank: "master",
					slot: cmd.memory
				};
			}
			if (cmd.scope.multiviewers) {
				const err = checkSlot("multiviewer", cmd.memory);
				if (err) return fail(err);
				const ops = cmd.scope.multiviewers.values.map((n) => ({
					path: monitoringMemoryLoad(cmd.memory, n),
					value: true,
					describe: `Recall Multiviewer memory ${cmd.memory} to output ${n}`
				}));
				return {
					ok: true,
					ops,
					summary: `Recall Multiviewer ${cmd.memory} → ${ops.length} output(s)`,
					bank: "multiviewer",
					slot: cmd.memory
				};
			}
			if (targets.length === 0) return fail("Recall needs a Screen, Aux or Master, or a sticky scope to inherit");
			if (layers) {
				const err = checkSlot("layer", cmd.memory);
				if (err) return fail(err);
				const ops = [];
				for (const t of targets) for (const l of layers) ops.push({
					path: layerMemoryLoad(cmd.memory, t, mode, l),
					value: true,
					describe: `Recall Layer memory ${cmd.memory} to ${describeTarget(t)} layer ${l} ${describeMode(mode)}`
				});
				return {
					ok: true,
					ops,
					summary: `Recall Layer ${cmd.memory} → ${ops.length} op(s), ${describeMode(mode)}`,
					bank: "layer",
					slot: cmd.memory
				};
			}
			const err = checkSlot("screen", cmd.memory);
			if (err) return fail(err);
			return {
				ok: true,
				ops: targets.map((t) => ({
					path: screenMemoryLoad(cmd.memory, t, mode),
					value: true,
					describe: `Recall memory ${cmd.memory} to ${describeTarget(t)} ${describeMode(mode)}`
				})),
				summary: `Recall ${cmd.memory} → ${targets.map(describeTarget).join(", ")} ${describeMode(mode)}`,
				bank: targets[0].kind === "aux" ? "aux" : "screen",
				slot: cmd.memory
			};
		}
		case "Store": {
			if (cmd.memory === void 0) return fail("Store needs a Memory number");
			const mode = cmd.mode ?? DEFAULT_STORE_MODE;
			if (cmd.scope.master) {
				const err = checkSlot("master", cmd.memory);
				if (err) return fail(err);
				return compileMasterStore(cmd.memory, mode, cmd.filter);
			}
			if (cmd.filter) return fail("If is only supported on Store Master — the screen and layer banks have no record mask");
			if (cmd.scope.multiviewers) {
				const err = checkSlot("multiviewer", cmd.memory);
				if (err) return fail(err);
				const ops = cmd.scope.multiviewers.values.map((n) => ({
					path: monitoringMemorySave(cmd.memory, n),
					value: true,
					describe: `Store output ${n} to Multiviewer memory ${cmd.memory}`
				}));
				return {
					ok: true,
					ops,
					summary: `Store Multiviewer ${cmd.memory} ← ${ops.length} output(s)`
				};
			}
			if (targets.length === 0) return fail("Store needs a Screen, Aux or Master, or a sticky scope to inherit");
			if (layers) {
				const err = checkSlot("layer", cmd.memory);
				if (err) return fail(err);
				const ops = [];
				for (const t of targets) for (const l of layers) ops.push({
					path: layerMemorySave(cmd.memory, t, mode, l),
					value: true,
					describe: `Store ${describeTarget(t)} layer ${l} ${describeMode(mode)} to Layer memory ${cmd.memory}`
				});
				return {
					ok: true,
					ops,
					summary: `Store Layer ${cmd.memory} ← ${ops.length} op(s), from ${describeMode(mode)}`
				};
			}
			const err = checkSlot("screen", cmd.memory);
			if (err) return fail(err);
			return {
				ok: true,
				ops: targets.map((t) => ({
					path: screenMemorySave(cmd.memory, t, mode),
					value: true,
					describe: `Store ${describeTarget(t)} ${describeMode(mode)} to memory ${cmd.memory}`
				})),
				summary: `Store ${cmd.memory} ← ${targets.map(describeTarget).join(", ")} from ${describeMode(mode)}`
			};
		}
		case "Delete": {
			if (cmd.memory === void 0) return fail("Delete needs a Memory number");
			const bank = bankOf(cmd.scope, layers);
			const err = checkSlot(bank, cmd.memory);
			if (err) return fail(err);
			return {
				ok: true,
				ops: [{
					path: memoryDelete(bank, cmd.memory),
					value: true,
					describe: `Delete ${bank} memory ${cmd.memory}`
				}],
				summary: `Delete ${bank} memory ${cmd.memory}`
			};
		}
		case "Label": {
			if (cmd.memory === void 0) return fail("Label needs a Memory number");
			if (cmd.label === void 0) return fail("Label needs text in quotes, e.g. Label Memory 5 \"Wide Open\"");
			const bank = bankOf(cmd.scope, layers);
			const err = checkSlot(bank, cmd.memory);
			if (err) return fail(err);
			return {
				ok: true,
				ops: [{
					path: memoryLabel(bank, cmd.memory),
					value: cmd.label,
					describe: `Label ${bank} memory ${cmd.memory} "${cmd.label}"`
				}],
				summary: `Label ${bank} memory ${cmd.memory} "${cmd.label}"`
			};
		}
	}
	return {
		ok: false,
		errors
	};
}
/**
* A master store is the one compound command in the first pass: four filter
* writes and then the trigger, in that order.
*
* Order is load-bearing. The filters are ordinary properties that persist on
* the device, so the trigger uses whatever was last written — firing first
* would store against the previous command's mask. Both transports preserve
* ordering on a single connection, which is what makes this safe to send as
* one burst rather than waiting for each echo.
*/
function compileMasterStore(slot, mode, filter) {
	const ops = [];
	const saveMode = mode === "PROGRAM" ? "SAVE_FROM_PGM" : "SAVE_FROM_PVW";
	ops.push({
		path: masterSaveProp("mode"),
		value: saveMode,
		describe: `Store from ${describeMode(mode)}`
	});
	const screens = filter?.screens ? filter.screens.values.map(screenKey) : allKeys(DIMS.screen.min, DIMS.screen.max, screenKey);
	const auxes = filter?.auxes ? filter.auxes.values.map(auxKey) : allKeys(DIMS.aux.min, DIMS.aux.max, auxKey);
	const layerValues = filter?.layers ? layerFilterValues(filter.layers) : ["NATIVE", ...allKeys(DIMS.layer.min, DIMS.layer.max, String)];
	const categories = filter?.categories ?? CATEGORIES;
	ops.push({
		path: masterSaveProp("screenFilter"),
		value: screens,
		describe: filter?.screens ? `Only ${screens.join(", ")}` : "All screens"
	});
	ops.push({
		path: masterSaveProp("auxFilter"),
		value: auxes,
		describe: filter?.auxes ? `Only ${auxes.join(", ")}` : "All auxes"
	});
	ops.push({
		path: masterSaveProp("layerFilter"),
		value: layerValues,
		describe: filter?.layers ? `Only layer ${layerValues.join(", ")}` : "All layers"
	});
	ops.push({
		path: masterSaveProp("categoryFilter"),
		value: [...categories],
		describe: filter?.categories ? `Only ${categories.join(", ")}` : "All categories"
	});
	ops.push({
		path: masterMemorySave(slot),
		value: true,
		describe: `Store Master memory ${slot}`
	});
	const masked = filter ? " (masked)" : "";
	return {
		ok: true,
		ops,
		summary: `Store Master ${slot} ← ${describeMode(mode)}${masked}`
	};
}
function layerFilterValues(layers) {
	const out = [];
	if (layers.native) out.push("NATIVE");
	for (const n of layers.numbers.values) out.push(String(n));
	return out;
}
function allKeys(min, max, key) {
	const out = [];
	for (let n = min; n <= max; n++) out.push(key(n));
	return out;
}
/** The screens and auxes a command acts on: its own, or the sticky scope. */
function resolveTargets(scope, selection) {
	const own = [];
	if (scope.screens) for (const n of scope.screens.values) own.push({
		kind: "screen",
		n
	});
	if (scope.auxes) for (const n of scope.auxes.values) own.push({
		kind: "aux",
		n
	});
	if (own.length > 0) return own;
	return selection ? [...selection.targets] : [];
}
function resolveLayers(scope, selection) {
	if (scope.layers) {
		const out = [];
		if (scope.layers.native) out.push("NATIVE");
		for (const n of scope.layers.numbers.values) out.push(n);
		return out.length > 0 ? out : void 0;
	}
	if (scope.screens || scope.auxes || scope.master || scope.multiviewers) return void 0;
	return selection?.layers && selection.layers.length > 0 ? [...selection.layers] : void 0;
}
function bankOf(scope, layers) {
	if (scope.master) return "master";
	if (scope.multiviewers) return "multiviewer";
	if (layers && layers.length > 0) return "layer";
	if (scope.auxes && !scope.screens) return "aux";
	return "screen";
}
function checkSlot(bank, slot) {
	const { min, max } = SLOTS[bank];
	if (slot < min || slot > max) return `Memory ${slot} is out of range — ${bank} memories are ${min} to ${max}`;
}
var describeMode = (m) => m === "PREVIEW" ? "Preview" : "Program";
var describeTarget = (t) => t.kind === "screen" ? `Screen ${t.n}` : `Aux ${t.n}`;
function summarise(verb, count, targets) {
	if (count === 1) return `${verb} ${describeTarget(targets[0])}`;
	return `${verb} ${targets.map(describeTarget).join(", ")} — ${count} ops`;
}
//#endregion
export { CATEGORIES, DIMS, KEYWORDS, Path, SLOTS, VERIFIED_FIRMWARE, compile, completions, keywordTable, parse, resolveKeyword, shortestForm };
