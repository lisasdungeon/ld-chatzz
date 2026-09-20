import assert from "node:assert/strict";
import test from "node:test";
import { installMocks, restoreMocks } from "./foundry-mock.mjs";

test("ThemeManager get/apply/set/persist", async () => {
    installMocks();
    const { ThemeManager } = await import("../src/ThemeManager.js");
    const { DEFAULTS } = await import("../src/Constants.js");

    // default + registry
    assert.equal(ThemeManager.getTheme(), DEFAULTS.theme);
    const themes = ThemeManager.getThemes();
    assert.deepEqual(themes.map((t) => t.id), ["crimson", "void", "neon"]);
    assert.ok(themes.find((t) => t.id === DEFAULTS.theme).selected);

    // unknown stored value falls back to default
    game.settings.get = () => "not-a-theme";
    assert.equal(ThemeManager.getTheme(), DEFAULTS.theme);
    game.settings.get = () => "";
    assert.equal(ThemeManager.getTheme(), DEFAULTS.theme);

    // applyTheme writes the attribute on <html> and falls back on bad ids
    const applied = ThemeManager.applyTheme("void");
    assert.equal(applied, "void");
    assert.equal(document.documentElement.getAttribute("data-chatzz-theme"), "void");
    assert.equal(ThemeManager.applyTheme("bogus"), DEFAULTS.theme);
    assert.equal(document.documentElement.getAttribute("data-chatzz-theme"), DEFAULTS.theme);

    // no document -> harmless no-op
    const doc = globalThis.document;
    delete globalThis.document;
    assert.equal(ThemeManager.applyTheme("neon"), "neon");
    globalThis.document = doc;

    // setTheme persists and applies
    game.settings.get = () => "crimson";
    const saved = [];
    game.settings.set = async (m, k, v) => {
        saved.push([m, k, v]);
        return v;
    };
    assert.equal(await ThemeManager.setTheme("neon"), "neon");
    assert.equal(document.documentElement.getAttribute("data-chatzz-theme"), "neon");
    assert.deepEqual(saved, [["ld-chatzz", "theme", "neon"]]);

    // setTheme with a bad id falls back but still persists
    assert.equal(await ThemeManager.setTheme("nope"), DEFAULTS.theme);
    assert.deepEqual(saved[1], ["ld-chatzz", "theme", DEFAULTS.theme]);

    // persist failure is non-fatal
    game.settings.set = async () => {
        throw new Error("readonly");
    };
    assert.equal(await ThemeManager.setTheme("void"), "void");
    assert.equal(document.documentElement.getAttribute("data-chatzz-theme"), "void");

    // refresh re-applies the stored value
    game.settings.get = () => "void";
    game.settings.set = async (m, k, v) => v;
    assert.equal(ThemeManager.refresh(), "void");
    assert.equal(document.documentElement.getAttribute("data-chatzz-theme"), "void");

    // settings.get throwing is tolerated
    game.settings.get = () => {
        throw new Error("boom");
    };
    assert.equal(ThemeManager.getTheme(), "crimson");
    assert.equal(ThemeManager.refresh(), "crimson");

    restoreMocks();
});

test("Hub theme swatches select and persist a theme", async () => {
    installMocks();
    const { PlayerHubData } = await import("../src/windows/PlayerHubData.js");
    const { PlayerHubEvents } = await import("../src/windows/PlayerHubEvents.js");
    const { ThemeManager } = await import("../src/ThemeManager.js");

    const ctx = await PlayerHubData.getHubContext("settings");
    assert.deepEqual(ctx.themes.map((t) => t.id), ["crimson", "void", "neon"]);
    assert.equal(ctx.themes.find((t) => t.selected).id, "crimson");

    const root = document.createElement("div");
    root.innerHTML = `
        <div class="chatzz-theme-option selected" data-action="selectTheme" data-theme="crimson"></div>
        <div class="chatzz-theme-option" data-action="selectTheme" data-theme="void"></div>
        <div class="chatzz-theme-option" data-action="selectTheme" data-theme="neon"></div>
    `;
    document.body.appendChild(root);

    PlayerHubEvents.activateListeners({ activeTab: "settings" }, root);
    root.querySelector('[data-theme="void"]').click();
    await new Promise((r) => setTimeout(r, 10));

    assert.equal(game.settings.get("ld-chatzz", "theme"), "void");
    assert.ok(root.querySelector('[data-theme="void"]').classList.contains("selected"));
    assert.ok(!root.querySelector('[data-theme="crimson"]').classList.contains("selected"));

    // keyboard activation mirrors a click
    game.settings.get = () => "void";
    const neon = root.querySelector('[data-theme="neon"]');
    neon.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(document.documentElement.getAttribute("data-chatzz-theme"), "neon");

    ThemeManager.refresh();
    restoreMocks();
});

test("SettingsWindow theme dropdown saves through ThemeManager", async () => {
    installMocks({
        settings: {
            "ld-chatzz.enableSounds": true,
            "ld-chatzz.notificationVolume": 0.5,
            "ld-chatzz.enableDesktopNotifications": false,
            "ld-chatzz.personalBackground": "",
            "ld-chatzz.shareBackground": false
        }
    });
    const { SettingsWindow } = await import("../src/SettingsWindow.js");

    const win = new SettingsWindow();
    const ctx = await win._prepareContext();
    assert.deepEqual(ctx.themes.map((t) => t.id), ["crimson", "void", "neon"]);
    assert.equal(ctx.themes.find((t) => t.selected).id, "crimson");

    win.element = document.createElement("div");
    win.element.innerHTML = `
        <input name="enableSounds" checked/>
        <input name="notificationVolume" value="0.5"/>
        <input name="enableDesktopNotifications"/>
        <input name="personalBackground" value=""/>
        <input name="shareBackground"/>
        <select name="notificationSound"></select>
        <select name="theme">
            <option value="crimson"></option>
            <option value="void" selected></option>
            <option value="neon"></option>
        </select>
    `;
    document.body.appendChild(win.element);
    win.close = async () => {};
    await win._saveSettings();

    assert.equal(game.settings.get("ld-chatzz", "theme"), "void");
    assert.equal(document.documentElement.getAttribute("data-chatzz-theme"), "void");

    restoreMocks();
});
