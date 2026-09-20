import assert from "node:assert/strict";
import test from "node:test";
import { installMocks, restoreMocks } from "./foundry-mock.mjs";

test("AssetChecker inventories every referenced icon and sound", async () => {
    installMocks();
    const { AssetChecker } = await import("../src/AssetChecker.js");
    const { DEFAULTS, NOTIFICATION_SOUND_OPTIONS } = await import("../src/Constants.js");

    const assets = AssetChecker.getRequiredAssets();
    const icons = assets.filter((p) => p.startsWith("icons/"));
    const sounds = assets.filter((p) => !p.startsWith("icons/"));

    // 9 icon names x (base + _on)
    assert.equal(icons.length, 18);
    for (const n of ["AddImage", "Chats", "Favorite", "No", "Notification", "Option", "Plus", "Stealth", "Yes"]) {
        assert.ok(icons.includes(`icons/${n}.png`), `base icon ${n}.png`);
        assert.ok(icons.includes(`icons/${n}_on.png`), `_on icon ${n}_on.png`);
    }

    // All four DEFAULTS sounds plus dropdown options, deduped, module prefix stripped
    for (const p of [DEFAULTS.sfxGetMessage, DEFAULTS.sfxSendMessage, DEFAULTS.sfxButtonPress, DEFAULTS.sfxCloseWindow]) {
        const rel = p.replace("modules/ld-chatzz/", "");
        assert.ok(sounds.includes(rel), rel);
    }
    for (const o of NOTIFICATION_SOUND_OPTIONS) {
        assert.ok(sounds.includes(o.file.replace("modules/ld-chatzz/", "")), o.file);
    }
    assert.equal(sounds.length, new Set(sounds).size, "sounds are deduped");

    restoreMocks();
});

test("AssetChecker.check returns only missing paths", async () => {
    installMocks();
    const { AssetChecker } = await import("../src/AssetChecker.js");

    // Everything fetches fine -> nothing missing
    globalThis.fetch = async () => ({ ok: true });
    assert.deepEqual(await AssetChecker.check(), []);

    // One icon and one sound fail -> only those are reported, sorted
    globalThis.fetch = async (url) => {
        if (String(url).includes("icons/No.png") || String(url).includes("sounds/gets")) {
            return { ok: false };
        }
        return { ok: true };
    };
    const missing = await AssetChecker.check();
    assert.deepEqual(missing, ["icons/No.png", "sounds/gets a message.wav"]);

    // Transport errors count as missing too
    globalThis.fetch = async (url) => {
        if (String(url).includes("sounds/presses")) throw new Error("net down");
        return { ok: true };
    };
    assert.deepEqual(await AssetChecker.check(), ["sounds/presses a button.wav"]);

    restoreMocks();
});

test("AssetChecker.check is a no-op without a document", async () => {
    installMocks();
    const { AssetChecker } = await import("../src/AssetChecker.js");

    const doc = globalThis.document;
    delete globalThis.document;
    globalThis.fetch = async () => ({ ok: true });
    assert.deepEqual(await AssetChecker.check(), []);

    globalThis.document = doc;
    // fetch missing entirely (jsdom always has one, but be safe)
    const f = globalThis.fetch;
    delete globalThis.fetch;
    assert.deepEqual(await AssetChecker.check(), []);
    globalThis.fetch = f;

    restoreMocks();
});

test("AssetChecker.report groups warnings by category", async () => {
    installMocks();
    const { AssetChecker } = await import("../src/AssetChecker.js");

    const warnings = [];
    const origWarn = console.warn;
    console.warn = (...args) => warnings.push(args.join(" "));

    try {
        // All good: silent
        globalThis.fetch = async () => ({ ok: true });
        assert.deepEqual(await AssetChecker.report(), []);
        assert.equal(warnings.length, 0);

        // Two categories missing: grouped and counted
        globalThis.fetch = async (url) => {
            const u = String(url);
            if (u.includes("icons/Yes.png") || u.includes("sounds/gets")) return { ok: false };
            return { ok: true };
        };
        const missing = await AssetChecker.report();
        assert.equal(missing.length, 2);
        const text = warnings.join("\n");
        assert.match(text, /2 referenced asset/);
        assert.match(text, /Missing icons:/);
        assert.match(text, /icons\/Yes\.png/);
        assert.match(text, /Missing sounds:/);
        assert.match(text, /sounds\/gets a message\.wav/);
    } finally {
        console.warn = origWarn;
    }

    restoreMocks();
});

test("ReadyHook triggers the asset check without breaking startup", async () => {
    installMocks();
    const { ReadyHook } = await import("../src/hooks/ReadyHook.js");
    const { LDChatzz } = await import("../src/LDChatzz.js");

    const checks = [];
    LDChatzz.initialize = async () => true;
    const { AssetChecker } = await import("../src/AssetChecker.js");
    const origReport = AssetChecker.report.bind(AssetChecker);
    AssetChecker.report = async () => {
        checks.push(1);
        return [];
    };
    globalThis.fetch = async () => ({ ok: true });

    try {
        await ReadyHook.onReady();
        assert.equal(checks.length, 1, "report() called once during ready");

        // report() throwing must not break the rest of ready
        AssetChecker.report = async () => {
            throw new Error("boom");
        };
        await ReadyHook.onReady();

        // Wait out onReady's 1s ui.controls timer while mocks are still installed
        await new Promise((r) => setTimeout(r, 1100));
    } finally {
        AssetChecker.report = origReport;
    }

    restoreMocks();
});
