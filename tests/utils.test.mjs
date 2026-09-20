import assert from "node:assert/strict";
import test from "node:test";
import { installMocks, restoreMocks } from "./foundry-mock.mjs";

test("Utils.sanitizeHTML", async (t) => {
    installMocks({});
    const { Utils } = await import("../src/Utils.js");

    await t.test("escapes HTML special characters", () => {
        assert.equal(Utils.sanitizeHTML(`<img src=x onerror="alert(1)">`), "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    });

    await t.test("returns empty string for falsy input", () => {
        assert.equal(Utils.sanitizeHTML(""), "");
        assert.equal(Utils.sanitizeHTML(null), "");
    });

    restoreMocks();
});

test("Utils.parseRichContent", async (t) => {
    installMocks({});
    const { Utils } = await import("../src/Utils.js");

    await t.test("escapes malicious content before enriching", () => {
        const result = Utils.parseRichContent(`<script>alert(1)</script>`);
        assert.doesNotMatch(result, /<script>/);
    });

    await t.test("a malicious payload cannot break out of a generated href attribute", () => {
        const malicious = `http://evil.com/"onmouseover="alert(1)`;
        const result = Utils.parseRichContent(malicious);
        const hrefMatch = result.match(/href="([^"]*)"/);
        assert.ok(hrefMatch, "should produce a single well-formed href attribute");
        // the embedded quotes must be HTML-escaped entities, not raw quote characters,
        // so they can never terminate the attribute early and inject a real onmouseover=
        assert.doesNotMatch(result, /"\s*onmouseover=/);
        assert.match(result, /&quot;onmouseover=&quot;/);
    });

    await t.test("converts plain URLs into links", () => {
        const result = Utils.parseRichContent("Check http://example.com/page out");
        assert.match(result, /<a href="http:\/\/example\.com\/page"/);
        assert.match(result, /class="chatzz-link"/);
    });

    await t.test("converts newlines into line breaks", () => {
        const result = Utils.parseRichContent("line one\nline two");
        assert.match(result, /line one<br>line two/);
    });

    await t.test("converts dice notation into a dice-roll span", () => {
        const result = Utils.parseRichContent("Roll [[1d20]] for it");
        assert.match(result, /class="chatzz-dice-roll" data-formula="1d20"/);
    });

    restoreMocks();
});

test("Utils.getUserInitials", async (t) => {
    installMocks({});
    const { Utils } = await import("../src/Utils.js");

    await t.test("single word name uses first two letters", () => {
        assert.equal(Utils.getUserInitials("Gandalf"), "GA");
    });

    await t.test("multi word name uses first letter of first and last word", () => {
        assert.equal(Utils.getUserInitials("Frodo Baggins"), "FB");
    });

    await t.test("empty name falls back to a question mark", () => {
        assert.equal(Utils.getUserInitials(""), "?");
    });

    restoreMocks();
});

test("Utils.playUISound resolves sound paths under the current module id", async (t) => {
    const { settingsStore } = installMocks({
        settings: {
            "ld-chatzz.enableSounds": true,
            "ld-chatzz.notificationVolume": 0.5,
            "ld-chatzz.gmOverrideEnabled": false,
            "ld-chatzz.sfxButtonPress": "modules/ld-chatzz/sounds/presses a button.wav"
        }
    });
    const { Utils } = await import("../src/Utils.js");

    await t.test("resolves the custom sound path registered under MODULE_ID, not a hardcoded id", () => {
        const path = Utils._resolveSoundPath("buttonPress");
        assert.equal(path, "modules/ld-chatzz/sounds/presses a button.wav");
    });

    await t.test("GM override takes priority when enabled", () => {
        settingsStore.set("ld-chatzz.gmOverrideEnabled", true);
        settingsStore.set("ld-chatzz.gmOverrideSoundPath", "modules/ld-chatzz/sounds/override.wav");
        const path = Utils._resolveSoundPath("buttonPress");
        assert.equal(path, "modules/ld-chatzz/sounds/override.wav");
    });

    restoreMocks();
});

test("Utils.formatFileSize", async (t) => {
    installMocks({});
    const { Utils } = await import("../src/Utils.js");

    await t.test("formats bytes, KB, and MB correctly", () => {
        assert.equal(Utils.formatFileSize(0), "0 B");
        assert.equal(Utils.formatFileSize(1024), "1 KB");
        assert.equal(Utils.formatFileSize(1024 * 1024 * 2), "2 MB");
    });

    restoreMocks();
});
