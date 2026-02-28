/**
 * SQLite database connection factory with WAL mode configuration.
 * Dynamically loads the correct platform/arch native binary from scripts/binaries/.
 */

import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

/** Compute script directory — works in both CJS (__dirname) and ESM (import.meta.url). */
const SCRIPT_DIR = typeof __dirname !== 'undefined'
  ? __dirname
  : dirname(fileURLToPath(import.meta.url));

/**
 * Pre-load the platform-specific native addon as an object.
 * Passes an addon object (not a string path) to Database constructor,
 * bypassing better-sqlite3's internal require() which breaks in ESM bundles.
 */
function loadNativeAddon(): object | undefined {
  const abi = process.versions.modules;
  const plat = process.platform;
  const arc = process.arch;

  const candidates = [
    join(SCRIPT_DIR, 'binaries', `better_sqlite3-${plat}-${arc}-node-v${abi}.node`),
  ];
  // Fallback: try other ABIs for forward-compat
  for (const fallbackAbi of ['115', '127', '131']) {
    if (fallbackAbi === abi) continue;
    candidates.push(join(SCRIPT_DIR, 'binaries', `better_sqlite3-${plat}-${arc}-node-v${fallbackAbi}.node`));
  }

  // Use createRequire to load .node files — works in both CJS and ESM (ncc) contexts
  const nativeRequire = createRequire(typeof __filename !== 'undefined' ? __filename : import.meta.url);
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      try {
        return nativeRequire(candidate);
      } catch { /* try next candidate */ }
    }
  }
  return undefined;
}

/**
 * Opens a SQLite database with optimized settings for concurrent access
 *
 * @param dbPath - Path to the SQLite database file
 * @returns Configured Database instance
 */
export function openDatabase(dbPath: string): Database.Database {
  let db: Database.Database;

  const nativeBinding = loadNativeAddon();
  try {
    db = nativeBinding
      ? new Database(dbPath, { nativeBinding: nativeBinding as unknown as string })
      : new Database(dbPath);
  } catch (err) {
    if (nativeBinding) {
      console.warn(`Failed to load native binding, falling back to default: ${err}`);
      db = new Database(dbPath);
    } else {
      throw err;
    }
  }

  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');
  db.pragma('cache_size = -64000');
  db.pragma('wal_autocheckpoint = 1000');

  return db;
}
