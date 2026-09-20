import assert from "node:assert/strict";
import test from "node:test";
import { installMocks, restoreMocks, makeMockActor, MockDialog, MockFilePicker } from "./foundry-mock.mjs";

function hubHtml() {
    const root = document.createElement("div");
    root.className = "ld-chatzz chatzz-window window-app";
    root.innerHTML = `
        <button data-tab="conversations" class="chatzz-tab active">
            <img data-default="a.png" data-active="b.png" src="a.png"/>
        </button>
        <button data-tab="users" class="chatzz-tab">
            <img data-default="a.png" data-active="b.png" src="a.png"/>
        </button>
        <div class="chatzz-tab-content active" data-tab-content="conversations"></div>
        <div class="chatzz-tab-content" data-tab-content="users"></div>
        <button data-action="createChat" style="opacity:0.5"></button>
        <button data-action="openMonitor"></button>
        <button data-action="openGroupManager"></button>
        <button data-action="openGMTools"></button>
        <button data-action="openActorChat" data-actor-id="a1"></button>
        <button data-action="exportToJournal"></button>
        <button data-action="exportLocal"></button>
        <button data-action="setUserBackground" data-user-id="u2"></button>
        <div class="chatzz-conv-item" data-conversation-id="g1" data-type="group" data-user-id="u2">
            <span class="chatzz-conv-name">Party</span>
            <i class="chatzz-fav-icon"></i>
            <button class="chatzz-conv-action"></button>
        </div>
        <div class="chatzz-conv-item" data-type="actor" data-actor-id="a1">
            <span class="chatzz-conv-name">Hero</span>
        </div>
        <div class="chatzz-conv-item" data-type="private" data-user-id="u2">
            <span class="chatzz-conv-name">Alice</span>
        </div>
        <div class="chatzz-user-card" data-user-id="u2">
            <span class="chatzz-user-name">Alice</span>
        </div>
        <div class="chatzz-user-card" data-user-id="u3">
            <span class="chatzz-user-name">Bob</span>
        </div>
        <div class="chatzz-user-card">
            <span class="chatzz-user-name">NoId</span>
        </div>
        <div class="chatzz-actor-card" data-actor-id="a1">
            <span class="chatzz-user-name">Hero</span>
        </div>
        <input data-action="setVolume" type="range" value="50"/>
        <span class="chatzz-volume-value">50%</span>
        <input type="checkbox" data-action="toggleSounds" checked/>
        <input type="checkbox" data-action="toggleNotifications"/>
        <input class="chatzz-hub-search" type="text"/>
        <div class="window-header"><button class="header-control close"></button></div>
    `;
    document.body.appendChild(root);
    return root;
}

test("PlayerHubData, Utils, Events, Window", async () => {
    const actor = makeMockActor({ id: "a1", name: "Hero", ownership: { user1: 3 }, img: "h.svg" });
    actor.getFlag = () => [];
    installMocks({
        isGM: true,
        users: [
            { id: "user1", name: "Tester", active: true, isGM: true, avatar: "icons/me.svg", color: "#111" },
            { id: "u2", name: "Alice", active: true, isGM: false, avatar: "icons/a.svg", color: "#222" },
            { id: "u3", name: "Bob", active: false, isGM: false, avatar: "icons/b.svg" },
            { id: "gm2", name: "GM2", active: true, isGM: true }
        ],
        actors: [actor],
        settings: {
            "ld-chatzz.enableSounds": true,
            "ld-chatzz.notificationVolume": 0.4,
            "ld-chatzz.enableDesktopNotifications": false,
            "ld-chatzz.gmBackgrounds": { global: null, perUser: {}, perChat: {} }
        }
    });
    const { PlayerHubData } = await import("../src/windows/PlayerHubData.js");
    const { PlayerHubUtils } = await import("../src/windows/PlayerHubUtils.js");
    const { PlayerHubEvents } = await import("../src/windows/PlayerHubEvents.js");
    const { PlayerHubWindow } = await import("../src/PlayerHubWindow.js");
    const { DataManager } = await import("../src/DataManager.js");
    const { UIManager } = await import("../src/UIManager.js");

    DataManager.groupChats.set("g1", {
        id: "g1",
        name: "Party",
        members: ["user1", "u2"],
        history: [{ messageContent: "<b>hi</b> there friends of long text message", timestamp: Date.now() - 1000, senderName: "A" }]
    });
    DataManager.privateChats.set("user1-u2", {
        users: ["user1", "u2"],
        history: [{ messageContent: "short", timestamp: Date.now() - 3600000, senderName: "A" }]
    });
    DataManager.actorChats.set("actor:a1", {
        kind: "actor",
        actorId: "a1",
        actorName: "Hero",
        actorImg: "h.svg",
        history: [{ messageContent: "a", timestamp: Date.now() - 90000000, senderName: "A" }]
    });
    DataManager.unreadCounts.set("g1", 2);
    DataManager.favorites.add("g1");
    DataManager.lastActivity.set("g1", Date.now());

    const ctx = await PlayerHubData.getHubContext("conversations");
    assert.equal(ctx.soundVolume, 40);
    assert.ok(ctx.conversations.length >= 1);
    assert.ok(ctx.users.length >= 1);
    assert.equal(PlayerHubData._getMessagePreview(null), "");
    assert.equal(PlayerHubData._getMessagePreview({ messageContent: "x".repeat(60) }).endsWith("..."), true);
    assert.equal(PlayerHubData._formatRelativeTime(0), "");
    assert.equal(PlayerHubData._formatRelativeTime(Date.now()), "Just now");
    assert.match(PlayerHubData._formatRelativeTime(Date.now() - 5 * 60000), /m/);
    assert.match(PlayerHubData._formatRelativeTime(Date.now() - 2 * 3600000), /h/);
    assert.match(PlayerHubData._formatRelativeTime(Date.now() - 3 * 86400000), /d/);

    // Utils export
    await PlayerHubUtils.exportToJournal();
    await PlayerHubUtils.exportLocal();
    assert.match(PlayerHubUtils._formatExport([]), /No messages/);
    assert.match(PlayerHubUtils._formatExport([{ timestamp: Date.now(), senderName: "A", messageContent: "hi" }]), /ul/);
    MockFilePicker._autoCallback = true;
    await PlayerHubUtils.setGlobalBackground();

    // empty visible actors path for export sections
    DataManager.actorChats.set("actor:gone", { actorId: "gone", history: [] });
    PlayerHubUtils._getActorExportSections();
    PlayerHubUtils._getPrivateExportSections();

    // Events
    UIManager.openGMMonitor = () => {};
    UIManager.openGroupManager = () => {};
    UIManager.openGMModWindow = () => {};
    UIManager.openChatForActor = () => {};
    UIManager.openChatFor = () => {};
    UIManager.openGroupChat = () => {};
    UIManager.updatePlayerHub = () => {};
    UIManager.updateBackgroundForUser = () => {};

    const el = hubHtml();
    const app = { activeTab: "conversations" };
    PlayerHubEvents.activateListeners(app, el);

    el.querySelector('[data-tab="users"]').click();
    assert.equal(app.activeTab, "users");

    // action delegation
    el.querySelector('[data-action="openMonitor"]').click();
    el.querySelector('[data-action="openGroupManager"]').click();
    el.querySelector('[data-action="openGMTools"]').click();
    el.querySelector('[data-action="openActorChat"]').click();
    el.querySelector('[data-action="exportToJournal"]').click();
    el.querySelector('[data-action="exportLocal"]').click();
    MockFilePicker._autoCallback = true;
    el.querySelector('[data-action="setUserBackground"]').click();

    // create chat none selected
    el.querySelector('[data-action="createChat"]').click();
    // select one user
    el.querySelectorAll(".chatzz-user-card")[0].click();
    el.querySelector('[data-action="createChat"]').click();
    // select second for group dialog
    el.querySelectorAll(".chatzz-user-card")[1].click();
    el.querySelector('[data-action="createChat"]').click();
    const dlg = MockDialog._last;
    if (dlg?.data?.buttons?.create) {
        await dlg.data.buttons.create.callback({
            find: () => ({ val: () => "My Group" })
        });
        await dlg.data.buttons.create.callback({
            find: () => ({ val: () => "" })
        });
    }

    // conversation clicks
    const groupItem = el.querySelector('[data-type="group"]');
    groupItem.querySelector(".chatzz-fav-icon").dispatchEvent(new Event("click", { bubbles: true }));
    groupItem.click();
    el.querySelector('[data-type="actor"]').click();
    el.querySelector('[data-type="private"]').click();
    // action button short-circuit
    groupItem.querySelector(".chatzz-conv-action").dispatchEvent(
        new Event("click", { bubbles: true })
    );

    el.querySelector(".chatzz-actor-card").click();
    const vol = el.querySelector('[data-action="setVolume"]');
    vol.value = "75";
    vol.dispatchEvent(new Event("input"));
    el.querySelector('[data-action="toggleSounds"]').dispatchEvent(new Event("change"));
    el.querySelector('[data-action="toggleNotifications"]').checked = true;
    el.querySelector('[data-action="toggleNotifications"]').dispatchEvent(new Event("change"));
    const search = el.querySelector(".chatzz-hub-search");
    search.value = "alice";
    search.dispatchEvent(new Event("input"));
    search.value = "zzz";
    search.dispatchEvent(new Event("input"));

    PlayerHubEvents._onSetUserBackground(null);
    PlayerHubEvents._onSetUserBackground("u2");

    // Window class
    const hub = new PlayerHubWindow();
    hub.element = hubHtml();
    Object.getPrototypeOf(Object.getPrototypeOf(hub))._onRender = () => {};
    await hub._prepareContext();
    hub._onRender({}, {});
    hub.bringToFront();
    hub.element = null;
    hub.bringToFront();
    await hub._onExportLocal();
    await hub._onSetGlobalBackground();
    UIManager.playerHubWindow = hub;
    await hub.close();
    assert.equal(UIManager.playerHubWindow, null);

    restoreMocks();
});
