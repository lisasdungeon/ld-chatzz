import assert from "node:assert/strict";
import test from "node:test";
import { installMocks, restoreMocks } from "./foundry-mock.mjs";

test("AppMode isChatzzOpen and sync reflect window state", async () => {
    installMocks({});
    const { AppMode } = await import("../src/AppMode.js");

    // No window open
    assert.equal(AppMode.isChatzzOpen(), false);

    // Open a window
    const win = document.createElement("div");
    win.className = "ld-chatzz window-app";
    document.body.appendChild(win);

    assert.equal(AppMode.isChatzzOpen(), true);
    assert.equal(AppMode.sync(), true);
    assert.ok(document.body.classList.contains("chatzz-app-mode"));

    // Close it
    win.remove();
    assert.equal(AppMode.isChatzzOpen(), false);
    assert.equal(AppMode.sync(), false);
    assert.ok(!document.body.classList.contains("chatzz-app-mode"));

    // Missing document / missing querySelector
    assert.equal(AppMode.isChatzzOpen({}), false);
    assert.equal(AppMode.isChatzzOpen({ document: {} }), false);
    assert.equal(AppMode.sync({}), false);

    // classList.toggle missing still reports open state without throwing
    assert.equal(
        AppMode.sync({ document: { body: { classList: {} }, querySelector: () => ({}) } }),
        true
    );

    restoreMocks();
});

test("AppMode register wires hooks and syncs when they fire", async () => {
    installMocks({});
    const { AppMode } = await import("../src/AppMode.js");

    // No Hooks available
    assert.equal(AppMode.register({}), false);

    // Hooks available
    assert.equal(AppMode.register(), true);
    const handlers = Hooks._handlers;
    assert.ok(handlers.renderApplicationV2?.length);
    assert.ok(handlers.renderApplication?.length);
    assert.ok(handlers.closeApplicationV2?.length);
    assert.ok(handlers.closeApplication?.length);

    // Open a window and fire the render hook; the deferred sync applies the class
    const win = document.createElement("div");
    win.className = "ld-chatzz";
    document.body.appendChild(win);
    handlers.renderApplicationV2[0]();
    await new Promise((r) => setTimeout(r, 5));
    assert.ok(document.body.classList.contains("chatzz-app-mode"));

    // Remove the window and fire the close hook; the class is removed
    win.remove();
    handlers.closeApplicationV2[0]();
    await new Promise((r) => setTimeout(r, 5));
    assert.ok(!document.body.classList.contains("chatzz-app-mode"));

    restoreMocks();
});
