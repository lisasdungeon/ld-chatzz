#!/usr/bin/env node
/**
 * LD Chatzz release packager.
 *
 * Builds the Foundry VTT release zip (module.json at the archive root) with a
 * dependency-free zip writer, then verifies every entry by inflating it back
 * and checking its CRC32 before the archive is written to disk.
 *
 * Usage:
 *   node scripts/package-release.mjs            # -> dist/ld-chatzz-v<version>.zip
 *   node scripts/package-release.mjs --out DIR  # custom output directory
 *
 * Only runtime files are shipped: the manifest, entry module and src/ tree,
 * plus lang/, styles/, templates/, fonts/, icons/ and sounds/ and the user
 * docs. Dev-only material (34MB of source masters in assets/, tests, tooling,
 * docs, _DIR_INDEX.md inventories) is excluded automatically.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { deflateRawSync, inflateRawSync } from "node:zlib";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Runtime paths shipped in the release zip (relative to the repo root). */
export const INCLUDE = [
    "module.json",
    "main.js",
    "src",
    "lang",
    "styles",
    "templates",
    "fonts",
    "icons",
    "sounds",
    "README.md",
    "CHANGELOG.md",
    "LICENSE",
    "LICENSE-LD-PROPRIETARY.md",
];

/** Files never shipped, wherever they appear (dev inventories, OS cruft). */
const EXCLUDED_NAMES = new Set([".DS_Store", "Thumbs.db"]);
const EXCLUDED_PATTERN = /(^|\/)_DIR_INDEX\.md$/;

/** Minimum expected asset counts (mirrors the src/AssetChecker.js inventory). */
const EXPECTED_ICONS = 18;
const EXPECTED_SOUNDS = 4;

/* ------------------------------------------------------------------ *
 * File collection
 * ------------------------------------------------------------------ */

/**
 * Walk the INCLUDE list under rootDir and return deterministic file entries
 * { rel, abs } with POSIX-style relative paths, module.json first.
 */
export function collectFiles(rootDir = ROOT, include = INCLUDE) {
    const files = [];
    const walk = (absDir, relDir) => {
        for (const entry of fs.readdirSync(absDir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
            if (entry.name.startsWith(".") || EXCLUDED_NAMES.has(entry.name)) continue;
            const childAbs = path.join(absDir, entry.name);
            const childRel = relDir ? `${relDir}/${entry.name}` : entry.name;
            if (entry.isDirectory()) walk(childAbs, childRel);
            else if (entry.isFile()) {
                if (EXCLUDED_PATTERN.test(childRel)) continue;
                files.push({ rel: childRel, abs: childAbs });
            }
        }
    };
    for (const item of include) {
        const abs = path.join(rootDir, item);
        if (!fs.existsSync(abs)) throw new Error(`Packaging aborted: included path is missing: ${item}`);
        if (fs.statSync(abs).isDirectory()) walk(abs, item);
        else files.push({ rel: item, abs });
    }
    const seen = new Set();
    const unique = files.filter((f) => (seen.has(f.rel) ? false : (seen.add(f.rel), true)));
    unique.sort((a, b) => (a.rel === "module.json" ? -1 : b.rel === "module.json" ? 1 : a.rel.localeCompare(b.rel)));
    return unique;
}

/* ------------------------------------------------------------------ *
 * Minimal zip writer (store / deflate, no external dependencies)
 * ------------------------------------------------------------------ */

const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        table[n] = c >>> 0;
    }
    return table;
})();

export function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
}

function dosDateTime(date) {
    const time = ((date.getHours() & 0x1f) << 11) | ((date.getMinutes() & 0x3f) << 5) | (Math.floor(date.getSeconds() / 2) & 0x1f);
    const day = (((date.getFullYear() - 1980) & 0x7f) << 9) | (((date.getMonth() + 1) & 0x0f) << 5) | (date.getDate() & 0x1f);
    return { time, day };
}

/**
 * Build a zip archive Buffer from entries: { name, data: Buffer, mtime: Date }.
 * Deflates when it actually helps; empty files are stored raw.
 */
export function buildZip(entries) {
    const localParts = [];
    const centralParts = [];
    let offset = 0;
    for (const entry of entries) {
        const nameBuf = Buffer.from(entry.name, "utf8");
        const deflated = deflateRawSync(entry.data, { level: 9 });
        const useDeflate = deflated.length < entry.data.length;
        const payload = useDeflate ? deflated : entry.data;
        const method = useDeflate ? 8 : 0;
        const crc = crc32(entry.data);
        const { time, day } = dosDateTime(entry.mtime ?? new Date());

        const lfh = Buffer.alloc(30);
        lfh.writeUInt32LE(0x04034b50, 0); // local file header signature
        lfh.writeUInt16LE(20, 4); // version needed
        lfh.writeUInt16LE(0x0800, 6); // flags: UTF-8 names
        lfh.writeUInt16LE(method, 8);
        lfh.writeUInt16LE(time, 10);
        lfh.writeUInt16LE(day, 12);
        lfh.writeUInt32LE(crc, 14);
        lfh.writeUInt32LE(payload.length, 18);
        lfh.writeUInt32LE(entry.data.length, 22);
        lfh.writeUInt16LE(nameBuf.length, 26);
        lfh.writeUInt16LE(0, 28);
        localParts.push(lfh, nameBuf, payload);

        const cdh = Buffer.alloc(46);
        cdh.writeUInt32LE(0x02014b50, 0); // central directory signature
        cdh.writeUInt16LE(20, 4); // version made by
        cdh.writeUInt16LE(20, 6); // version needed
        cdh.writeUInt16LE(0x0800, 8);
        cdh.writeUInt16LE(method, 10);
        cdh.writeUInt16LE(time, 12);
        cdh.writeUInt16LE(day, 14);
        cdh.writeUInt32LE(crc, 16);
        cdh.writeUInt32LE(payload.length, 20);
        cdh.writeUInt32LE(entry.data.length, 24);
        cdh.writeUInt16LE(nameBuf.length, 28);
        cdh.writeUInt32LE(offset, 42); // local header offset
        centralParts.push(cdh, nameBuf);

        offset += 30 + nameBuf.length + payload.length;
    }
    const central = Buffer.concat(centralParts);
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0); // end of central directory
    eocd.writeUInt16LE(entries.length, 8);
    eocd.writeUInt16LE(entries.length, 10);
    eocd.writeUInt32LE(central.length, 12);
    eocd.writeUInt32LE(offset, 16);
    return Buffer.concat([...localParts, central, eocd]);
}

/**
 * Independent read-back verification: walks the central directory, inflates
 * every entry and checks size + CRC32. Returns the entry listing
 * [{ name, size }] and throws on any mismatch.
 */
export function verifyZip(buf) {
    let eocd = -1;
    const min = Math.max(0, buf.length - 22 - 0xffff);
    for (let i = buf.length - 22; i >= min; i--) {
        if (buf.readUInt32LE(i) === 0x06054b50) {
            eocd = i;
            break;
        }
    }
    if (eocd === -1) throw new Error("Zip verification failed: no end-of-central-directory record");
    const count = buf.readUInt16LE(eocd + 10);
    let ptr = buf.readUInt32LE(eocd + 16);
    const listing = [];
    for (let n = 0; n < count; n++) {
        if (buf.readUInt32LE(ptr) !== 0x02014b50) throw new Error("Zip verification failed: bad central directory signature");
        const method = buf.readUInt16LE(ptr + 10);
        const crc = buf.readUInt32LE(ptr + 16);
        const compSize = buf.readUInt32LE(ptr + 20);
        const size = buf.readUInt32LE(ptr + 24);
        const nameLen = buf.readUInt16LE(ptr + 28);
        const extraLen = buf.readUInt16LE(ptr + 30);
        const commentLen = buf.readUInt16LE(ptr + 32);
        const localOff = buf.readUInt32LE(ptr + 42);
        const name = buf.toString("utf8", ptr + 46, ptr + 46 + nameLen);
        if (buf.readUInt32LE(localOff) !== 0x04034b50) throw new Error(`Zip verification failed: bad local header for ${name}`);
        const lNameLen = buf.readUInt16LE(localOff + 26);
        const lExtraLen = buf.readUInt16LE(localOff + 28);
        const dataStart = localOff + 30 + lNameLen + lExtraLen;
        const payload = buf.subarray(dataStart, dataStart + compSize);
        const data = method === 8 ? inflateRawSync(payload) : payload;
        if (data.length !== size) throw new Error(`Zip verification failed: size mismatch for ${name}`);
        if (crc32(data) !== crc) throw new Error(`Zip verification failed: CRC mismatch for ${name}`);
        listing.push({ name, size });
        ptr += 46 + nameLen + extraLen + commentLen;
    }
    return listing;
}

/* ------------------------------------------------------------------ *
 * Packaging
 * ------------------------------------------------------------------ */

/**
 * Build and verify the release zip. Returns { zipPath, entryCount, bytes,
 * uncompressedBytes, version, warnings }.
 */
export function packageModule({ rootDir = ROOT, outDir = path.join(ROOT, "dist") } = {}) {
    const manifest = JSON.parse(fs.readFileSync(path.join(rootDir, "module.json"), "utf8"));
    const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf8"));
    if (manifest.version !== pkg.version) {
        throw new Error(`Version mismatch: module.json ${manifest.version} vs package.json ${pkg.version}`);
    }
    const moduleId = manifest.id ?? manifest.name ?? "module";

    const files = collectFiles(rootDir);
    const warnings = [];
    const icons = files.filter((f) => /^icons\/.*\.png$/.test(f.rel)).length;
    const sounds = files.filter((f) => /^sounds\/.*\.wav$/.test(f.rel)).length;
    if (icons < EXPECTED_ICONS) warnings.push(`only ${icons}/${EXPECTED_ICONS} icons included`);
    if (sounds < EXPECTED_SOUNDS) warnings.push(`only ${sounds}/${EXPECTED_SOUNDS} sounds included`);

    const entries = files.map((f) => ({
        name: f.rel,
        data: fs.readFileSync(f.abs),
        mtime: fs.statSync(f.abs).mtime,
    }));
    const zip = buildZip(entries);
    const listing = verifyZip(zip); // throws on any corruption
    if (listing.length !== entries.length) throw new Error(`Zip verification failed: expected ${entries.length} entries, read back ${listing.length}`);

    fs.mkdirSync(outDir, { recursive: true });
    const zipPath = path.join(outDir, `${moduleId}-v${manifest.version}.zip`);
    fs.writeFileSync(zipPath, zip);
    return {
        zipPath,
        entryCount: entries.length,
        bytes: zip.length,
        uncompressedBytes: entries.reduce((sum, e) => sum + e.data.length, 0),
        version: manifest.version,
        warnings,
    };
}

/* ------------------------------------------------------------------ *
 * CLI entry point
 * ------------------------------------------------------------------ */

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
    const outIdx = process.argv.indexOf("--out");
    const outDir = outIdx !== -1 ? process.argv[outIdx + 1] : undefined;
    try {
        const result = packageModule(outDir ? { outDir } : {});
        for (const warning of result.warnings) console.warn(`WARNING: ${warning}`);
        console.log(
            `Packaged ${result.entryCount} files (${(result.uncompressedBytes / 1024 / 1024).toFixed(2)} MB) -> ${result.zipPath} (${(result.bytes / 1024).toFixed(0)} KB)`
        );
    } catch (err) {
        console.error(`Packaging failed: ${err.message}`);
        process.exitCode = 1;
    }
}
