import assert from "node:assert/strict";
import test from "node:test";
import { installMocks, restoreMocks, makeChatElement, MockDialog } from "./foundry-mock.mjs";

test("ReadyHook and SettingsHook register + error paths", async () => {
    installMocks({
        settings: {
            "ld-chatzz.personalBackground": "bg.png"
        }
    });
    const { ReadyHook } = await import("../src/hooks/ReadyHook.js");
    const { SettingsHook } = await import("../src/hooks/SettingsHook.js");
    const { LDChatzz } = await import("../src/LDChatzz.js");

    SettingsHook.register();
    assert.ok(Hooks._once.init?.length);

    ReadyHook.register();
    assert.ok(Hooks._once.ready?.length);

    LDChatzz.initialize = async () => {
        throw new Error("init fail");
    };
    await Hooks._once.ready[0]();
    await new Promise((r) => setTimeout(r, 20));

    // background error
    game.settings.get = () => {
        throw new Error("bg fail");
    };
    LDChatzz.initialize = async () => true;
    await ReadyHook.onReady();
    await new Promise((r) => setTimeout(r, 1100));

    // no ui.controls
    ui.controls = null;
    LDChatzz.initialize = async () => true;
    game.settings.get = () => "";
    await ReadyHook.onReady();
    await new Promise((r) => setTimeout(r, 1100));

    restoreMocks();
});

test("ReadyHook rebuilds the Foundry scene-control cache", async () => {
    installMocks();
    const { ReadyHook } = await import("../src/hooks/ReadyHook.js");
    const { LDChatzz } = await import("../src/LDChatzz.js");
    const renders = [];
    LDChatzz.initialize = async () => true;
    ui.controls.render = (options) => renders.push(options);

    await ReadyHook.onReady();
    await new Promise((resolve) => setTimeout(resolve, 1100));

    assert.deepEqual(renders, [{ reset: true, force: true }]);
    restoreMocks();
});

test("UIHooks register, scene controls, dialog, badge", async () => {
    installMocks({
        isGM: true,
        users: [
            { id: "user1", name: "Tester", active: true, isGM: true },
            { id: "u2", name: "Alice", active: true, isGM: false }
        ]
    });
    const { UIHooks } = await import("../src/hooks/UIHooks.js");
    const { SceneControlsHook } = await import("../src/hooks/SceneControlsHook.js");
    const { UIManager } = await import("../src/UIManager.js");
    const { ChatzzWindowUI } = await import("../src/windows/ChatzzWindowUI.js");

    ChatzzWindowUI.setupButtonImages = () => {};
    const opens = { hub: 0, monitor: 0, mod: 0 };
    UIManager.openPlayerHub = () => { opens.hub += 1; };
    UIManager.openGMMonitor = () => { opens.monitor += 1; };
    UIManager.openGMModWindow = () => { opens.mod += 1; };
    UIManager.openChatFor = () => {};

    assert.equal(SceneControlsHook.register({}), false);
    SceneControlsHook.register();
    UIHooks.register();

    // fire renderApplication handlers
    const handlers = Hooks._handlers;
    const el = makeChatElement();
    for (const fn of handlers.renderApplication || []) {
        fn({}, [el]);
        fn({}, el);
        fn({}, document.createElement("div"));
    }
    for (const fn of handlers.renderApplicationV2 || []) {
        fn({}, el);
        fn({}, document.createElement("div"));
    }

    // FilePicker hook
    const fpEl = document.createElement("div");
    fpEl.className = "dialog";
    document.body.appendChild(fpEl);
    const nested = document.createElement("div");
    nested.style.zIndex = "50";
    document.body.appendChild(nested);
    for (const fn of handlers.renderFilePicker || []) {
        fn({ element: el }, $(fpEl));
        fn({ element: document.createElement("div") }, $([document.createElement("div")]));
        // no chatzz
        fn({ element: document.createElement("span") }, {
            closest: () => ({ length: 0 }),
            0: null,
            length: 0
        });
    }

    // scene controls array form + object form
    for (const fn of handlers.getSceneControlButtons || []) {
        const arr = [];
        fn(arr);
        assert.ok(arr.some((c) => c.name === "chatzz"));
        // click tools
        const tools = arr[0].tools;
        await tools.find((t) => t.name === "openHub").onClick();
        await tools.find((t) => t.name === "gmMonitor").onClick();
        await tools.find((t) => t.name === "gmMod").onClick();
        await tools.find((t) => t.name === "newChat").onClick();

        const obj = {};
        fn(obj);
        assert.ok(obj.chatzz);
        assert.equal(obj.chatzz.activeTool, "openHub");
        assert.equal(obj.chatzz.order, 100);
        assert.equal(obj.chatzz.layer, "tokens");
        assert.ok(!Array.isArray(obj.chatzz.tools));
        for (const [name, tool] of Object.entries(obj.chatzz.tools)) {
            assert.equal(tool.name, name);
            assert.equal(typeof tool.order, "number");
            assert.equal(tool.toggle, false);
            assert.equal(tool.visible, true);
            assert.equal(typeof tool.onChange, "function");
            assert.equal(tool.onClick, undefined);
        }
        obj.chatzz.tools.openHub.onChange(false);
        assert.equal(opens.hub, 1);
        await obj.chatzz.tools.openHub.onChange(true);
        await obj.chatzz.tools.gmMonitor.onChange({}, true);
        await obj.chatzz.tools.gmMod.onChange({}, true);
        await obj.chatzz.tools.newChat.onChange(true);
    }
    assert.deepEqual(opens, { hub: 2, monitor: 2, mod: 2 });

    // non-GM tools
    game.user.isGM = false;
    for (const fn of handlers.getSceneControlButtons || []) {
        const arr = [];
        fn(arr);
        assert.ok(!arr[0].tools.some((t) => t.name === "gmMonitor"));
    }
    game.user.isGM = true;

    // updateSetting
    for (const fn of handlers.updateSetting || []) {
        fn({ key: "ld-chatzz.unreadData" });
        fn({ key: "other" });
    }

    // _showNewChatDialog no users
    game.users.filter = () => [];
    UIHooks._showNewChatDialog();
    game.users.filter = (fn) =>
        [
            { id: "user1", name: "Tester", active: true, isGM: true },
            { id: "u2", name: "Alice", active: true, isGM: false }
        ].filter(fn);
    UIHooks._showNewChatDialog();
    const dlg = MockDialog._last;
    assert.ok(dlg);
    dlg.data.buttons.start.callback({
        find: () => ({ val: () => "u2" })
    });
    dlg.data.buttons.start.callback({
        find: () => ({ val: () => "" })
    });

    // badge
    const badge = document.createElement("div");
    badge.className = "chatzz-hotbar-badge";
    badge.style.display = "none";
    document.body.appendChild(badge);
    const { DataManager } = await import("../src/DataManager.js");
    DataManager.unreadCounts.set("c", 5);
    UIHooks._updateHotbarBadge();
    await new Promise((r) => setTimeout(r, 20));
    DataManager.unreadCounts.set("c", 200);
    UIHooks._updateHotbarBadge();
    await new Promise((r) => setTimeout(r, 20));
    DataManager.unreadCounts.clear();
    UIHooks._updateHotbarBadge();
    await new Promise((r) => setTimeout(r, 20));

    restoreMocks();
});
