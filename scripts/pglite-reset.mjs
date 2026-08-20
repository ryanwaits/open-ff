#!/usr/bin/env bun
/**
 * Wipe the local PGLite dir. Next `bun run dev` remigrates, reseeds
 * ryan@wiffl.local, and imports WIFFL (hands) if the dir is empty.
 *
 * Stop the dev server first — two PGLite writers corrupt the WAL.
 */
import { existsSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = process.env.PGLITE_DATA_DIR?.trim() || join(root, "data/pglite");

if (!existsSync(dataDir)) {
  console.log(`[reset] nothing at ${dataDir}`);
  process.exit(0);
}

rmSync(dataDir, { recursive: true, force: true });
console.log(`[reset] removed ${dataDir}`);
console.log("[reset] restart bun run dev to migrate + seed WIFFL");
