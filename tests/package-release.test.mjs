import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const {
    buildZip,
    collectFiles,
    crc32,
    packageModule,
    verifyZip,
} = await import("../scripts/package-release.mjs");

function makeTempRoot() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "chatzz-pkg-"));
    fs.writeFileSync(path.join(root, "module.json"), JSON.stringify({ id: "ld-chatzz", version: "9.9.9" }));
    fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ version: "9.9.9" }));
    fs.writeFileSync(path.join(root, "main.js"), "export {};\n");
    fs.mkdirSync(path.join(root, "src"), { recursive: true });
    fs.writeFileSync(path.join(root, "src", "hooks.js"), "export {};\n");
    fs.mkdirSync(path.join(root, "lang"), { recursive: true });
    fs.writeFileSync(path.join(root, "lang", "en.json"), "{}\n");
    fs.mkdirSync(path.join(root, "styles"), { recursive: true });
    fs.writeFileSync(path.join(root, "styles", "chatzz-base.css"), "body{}\n");
    fs.mkdirSync(path.join(root, "templates"), { recursive: true });
    fs.writeFileSync(path.join(root, "templates", "chat-window.hbs"), "<div></div>\n");
    fs.mkdirSync(path.join(root, "fonts"), { recursive: true });
    fs.writeFileSync(path.join(root, "fonts", "SAOUI.ttf"), "font");
    fs.mkdirSync(path.join(root, "icons"), { recursive: true });
    for (let i = 0; i < 18; i++) fs.writeFileSync(path.join(root, "icons", `icon-${i}.png`), Buffer.from([0x89, 0x50]));
    fs.mkdirSync(path.join(root, "sounds"), {recursive: true});
    for (let i = 0; i < 4; i++) fs.writeFileSync(path.join(root, "sounds", `sfx-${i}.wav`), Buffer.from([0x52, 0x49]));
    fs.writeFileSync(path.join(root, "README.md"), "# readme\n");
    fs.writeFileSync(path.join(root, "CHANGELOG.md"), "# changelog\n");
    fs.writeFileSync(path.join(root, "LICENSE"), "license");
    fs.writeFileSync(path.join(root, "LICENSE-LD-PROPRIETARY.md"), "license");
    return root;
}

test("crc32 matches known values", () => {
    assert.equal(crc32(Buffer.alloc(0)), 0);
    assert.equal(crc32(Buffer.from("123456789")), 0xcbf43926);
    assert.equal(crc32(Buffer.from("The quick brown fox jumps over the lazy dog")), 0x414fa339);
});

test("buildZip + verifyZip roundtrip preserves data, order and counts", () => {
    const entries = [
        { name: "module.json", data: Buffer.from('{"id":"ld-chatzz"}\n'), mtime: new Date("2026-09-20T00:00:00Z") },
        { name: "src/hooks.js", data: Buffer.from("export {};\n"), mtime: new Date("2026-09-20T00:00:00Z") },
        { name: "empty.txt", data: Buffer.alloc(0), mtime: new Date("2026-09-20T00:00:00Z") },
    ];
    const zip = buildZip(entries);
    const listing = verifyZip(zip);
    assert.equal(listing.length, 3);
    assert.deepEqual(listing.map((e) => e.name), ["module.json", "src/hooks.js", "empty.txt"]);
    assert.equal(listing[0].size, entries[0].data.length);
    // incompressible data exercises the store path
    const random = Buffer.from(Array.from({ length: 512 }, (_, i) => (i * 7 + 13) % 256));
    const stored = buildZip([{ name: "bin.dat", data: random, mtime: new Date() }]);
    assert.equal(verifyZip(stored)[0].size, 512);
});

test("verifyZip rejects corrupted archives", () => {
    const zip = buildZip([{ name: "a.txt", data: Buffer.from("hello"), mtime: new Date() }]);
    // "hello" is stored raw (deflate would not shrink it): 30-byte local header + 5-byte name
    const corrupted = Buffer.from(zip);
    corrupted[36] ^= 0xff;
    assert.throws(() => verifyZip(corrupted), /CRC mismatch/i);
    assert.throws(() => verifyZip(Buffer.from("not a zip")), /no end-of-central-directory/i);
});

test("collectFiles walks include list, excludes dev files, orders module.json first", () => {
    const root = makeTempRoot();
    try {
        fs.mkdirSync(path.join(root, "assets", "icons"), { recursive: true });
        fs.writeFileSync(path.join(root, "assets", "icons", "master.png"), "x");
        fs.mkdirSync(path.join(root, "tests"), { recursive: true });
        fs.writeFileSync(path.join(root, "tests", "x.test.mjs"), "x");
        fs.writeFileSync(path.join(root, "styles", "_DIR_INDEX.md"), "x");
        fs.writeFileSync(path.join(root, "styles", ".DS_Store"), "x");

        const files = collectFiles(root);
        const rels = files.map((f) => f.rel);
        assert.equal(rels[0], "module.json");
        assert.ok(rels.includes("src/hooks.js"));
        assert.ok(!rels.some((r) => r.startsWith("assets/")), "assets/ must never ship");
        assert.ok(!rels.some((r) => r.startsWith("tests/")), "tests/ must never ship");
        assert.ok(!rels.some((r) => r.endsWith("_DIR_INDEX.md")), "dev inventories must never ship");
        assert.ok(!rels.some((r) => r === ".DS_Store"), "OS cruft must never ship");
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test("packageModule builds and verifies the full zip in a temp root", () => {
    const root = makeTempRoot();
    try {
        const outDir = path.join(root, "dist");
        const expected = collectFiles(root).length;
        const result = packageModule({ rootDir: root, outDir });
        assert.equal(result.version, "9.9.9");
        assert.equal(result.entryCount, expected);
        assert.ok(fs.existsSync(result.zipPath));
        assert.ok(result.zipPath.endsWith("ld-chatzz-v9.9.9.zip"));
        const listing = verifyZip(fs.readFileSync(result.zipPath));
        assert.equal(listing.length, expected);
        assert.ok(listing.some((e) => e.name === "module.json"));
        assert.ok(!listing.some((e) => e.name.startsWith("assets/")));
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test("packageModule throws on version mismatch and on missing include path", () => {
    const root = makeTempRoot();
    try {
        fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ version: "0.0.1" }));
        assert.throws(() => packageModule({ rootDir: root, outDir: path.join(root, "dist") }), /Version mismatch/);
        fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ version: "9.9.9" }));
        fs.rmSync(path.join(root, "fonts"), { recursive: true, force: true });
        assert.throws(() => packageModule({ rootDir: root, outDir: path.join(root, "dist") }), /missing: fonts/);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test("every asset the module references ships in the release zip", async () => {
    const { AssetChecker } = await import("../src/AssetChecker.js");
    const required = AssetChecker.getRequiredAssets();
    const shipped = new Set(collectFiles().map((f) => f.rel));
    const missingInZip = required.filter((p) => !shipped.has(p));
    assert.deepEqual(missingInZip, [], "module-referenced assets missing from the zip");
    // Tripwire: the release zip ships exactly the 96 runtime files. Update this
    // number deliberately when the runtime file set changes.
    assert.equal(shipped.size, 96);
});
