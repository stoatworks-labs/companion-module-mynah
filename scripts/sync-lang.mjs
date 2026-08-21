/**
 * Re-vendor the Mynah language core.
 *
 * The module bundles the compiler rather than reimplementing the grammar, so
 * that a command means the same thing here as it does in the web tool. Run
 * `npm run build:lang` in the mynah repo first; this copies the result in with
 * a provenance header.
 */
import { copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dest = join(here, "..", "src", "lang.js");
const src =
  process.argv[2] ??
  resolve(here, "../../../video/mynah/dist-lang/mynah-lang.mjs");

const HEADER = `// ---------------------------------------------------------------------------
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
`;

let body;
try {
  body = readFileSync(src, "utf8");
} catch {
  console.error(
    `Cannot read ${src}\nRun "npm run build:lang" in the mynah repo first, or pass the path as an argument.`,
  );
  process.exit(1);
}

writeFileSync(dest, HEADER + body);
console.log(`vendored ${body.length} bytes from ${src}`);
void copyFileSync;
