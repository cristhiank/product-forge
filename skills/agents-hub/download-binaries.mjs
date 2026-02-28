/**
 * Downloads pre-built better-sqlite3 native binaries for all supported platforms.
 * Uses pure Node.js tar.gz extraction (no `tar` CLI) so it runs on Windows too.
 *
 * Naming: better_sqlite3-{platform}-{arch}-node-v{abi}.node
 * ABI versions: v115 (Node 20), v127 (Node 22)
 */
import { writeFileSync, mkdirSync, existsSync, rmSync, createReadStream, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { get } from 'node:https';
import { createGunzip } from 'node:zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BINARY_DIR = join(__dirname, 'scripts', 'binaries');
const VERSION = '11.10.0';
const ABIS = ['115', '127'];

const TARGETS = [
  { platform: 'darwin', arch: 'x64' },
  { platform: 'darwin', arch: 'arm64' },
  { platform: 'linux', arch: 'x64' },
  { platform: 'win32', arch: 'x64' },
];

mkdirSync(BINARY_DIR, { recursive: true });

/** Download a URL to a Buffer, following redirects. */
function downloadBuffer(url, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) return reject(new Error('Too many redirects'));
    get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return downloadBuffer(res.headers.location, maxRedirects - 1).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

/** Extract the first .node file from a tar.gz buffer (pure Node.js, no CLI). */
function extractNodeFileFromTarGz(gzBuffer) {
  return new Promise((resolve, reject) => {
    const gunzip = createGunzip();
    const chunks = [];
    gunzip.on('data', (c) => chunks.push(c));
    gunzip.on('error', reject);
    gunzip.on('end', () => {
      const tar = Buffer.concat(chunks);
      let offset = 0;
      while (offset + 512 <= tar.length) {
        const header = tar.subarray(offset, offset + 512);
        const name = header.subarray(0, 100).toString('utf8').replace(/\0.*$/, '');
        if (!name) break;
        const sizeOctal = header.subarray(124, 136).toString('utf8').replace(/\0.*$/, '').trim();
        const size = parseInt(sizeOctal, 8) || 0;
        offset += 512;
        if (name.endsWith('.node') && size > 0) {
          return resolve(tar.subarray(offset, offset + size));
        }
        offset += Math.ceil(size / 512) * 512;
      }
      reject(new Error('No .node file found in tarball'));
    });
    gunzip.end(gzBuffer);
  });
}

async function main() {
  console.log(`📦 Downloading better-sqlite3 v${VERSION} binaries...`);
  let downloaded = 0;
  let skipped = 0;

  for (const { platform, arch } of TARGETS) {
    for (const abi of ABIS) {
      const dest = join(BINARY_DIR, `better_sqlite3-${platform}-${arch}-node-v${abi}.node`);

      if (existsSync(dest) && statSync(dest).size > 0) {
        skipped++;
        continue;
      }

      const tarName = `better-sqlite3-v${VERSION}-node-v${abi}-${platform}-${arch}.tar.gz`;
      const url = `https://github.com/WiseLibs/better-sqlite3/releases/download/v${VERSION}/${tarName}`;

      try {
        const gzBuf = await downloadBuffer(url);
        const nodeBuf = await extractNodeFileFromTarGz(gzBuf);
        writeFileSync(dest, nodeBuf, { mode: 0o755 });
        downloaded++;
        console.log(`   ✅ ${platform}-${arch} (ABI ${abi}) → ${nodeBuf.length} bytes`);
      } catch (err) {
        console.error(`   ❌ ${platform}-${arch} (ABI ${abi}): ${err.message}`);
        if (existsSync(dest)) rmSync(dest, { force: true });
      }
    }
  }

  console.log(`Done: ${downloaded} downloaded, ${skipped} skipped (already present).`);
}

main().catch(console.error);
