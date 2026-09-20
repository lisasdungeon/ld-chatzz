import assert from "node:assert/strict";
import test from "node:test";
import { installMocks, restoreMocks, makeMockActor, MockApplicationV2 } from "./foundry-mock.mjs";

test("LDChatzz messaging and group APIs", async () => {
    const actor = makeMockActor({ id: "a1", name: "Hero", ownership: { user1: 3 }, img: "h.svg" });
    actor.getFlag = () => [];
    installMocks({
        isGM: true,
        users: [
            { id: "user1", name: "Tester", active: true, isGM: true, avatar: "icons/me.svg" },
            { id: "u2", name: "Alice", active: true, isGM: false, avatar: "icons/a.svg" },
            { id: "gm2", name: "GM2", active: true, isGM: true }
        ],
        actors: [actor],
        character: { id: "a1", name: "Hero" },
        settings: {
            "ld-chatzz.groupChats": {},
            "ld-chatzz.privateChats": {},
            "ld-chatzz.actorChats": {},
            "ld-chatzz.unreadData": { counts: {}, lastRead: {}, lastActivity: {} },
            "ld-chatzz.favorites": [],
            "ld-chatzz.mutedConversations": [],
            "ld-chatzz.pinnedMessages": {},
            "ld-chatzz.sharedBackgrounds": { u2: "bg.png" },
            "ld-chatzz.gmSettings": {},
            "ld-chatzz.playerSettings": {},
            "ld-chatzz.personalBackground": "",
            "ld-chatzz.chatBackgrounds": {},
            "ld-chatzz.gmBackgrounds": { global: null, perUser: {}, perChat: {} },
            "ld-chatzz.enableSounds": false
        }
    });
    const { LDChatzz } = await import("../src/LDChatzz.js");
    const { DataManager } = await import("../src/DataManager.js");
    const { UIManager } = await import("../src/UIManager.js");

    UIManager.updateBackgroundForUser = () => {};
    UIManager.updateChatWindow = () => {};
    UIManager.updatePlayerHub = () => {};
    UIManager.updateGroupManager = () => {};
    UIManager.closeChatWindow = () => {};
    UIManager.refreshConversationWindow = () => {};

    await LDChatzz.initialize();

    DataManager.setReplyTo("reply1");
    await LDChatzz.sendMessage("u2", "hello", null, "img.png");
    DataManager.setReplyTo("reply2");
    await LDChatzz.sendMessage("u2", "with speaker", { name: "NPC", img: "n.svg" });

    await LDChatzz.sendActorMessage("missing", "x");
    DataManager.setReplyTo("r3");
    await LDChatzz.sendActorMessage("a1", "actor hi", { name: "S", img: "s.svg" }, "i.png");
    await LDChatzz.sendActorMessage("a1", "plain");

    DataManager.groupChats.set("g1", { id: "g1", name: "Party", members: ["user1", "u2"], history: [] });
    await LDChatzz.sendGroupMessage("missing", "x");
    DataManager.setReplyTo("r4");
    await LDChatzz.sendGroupMessage("g1", "group hi", { name: "S", img: "s.svg" }, "i.png");
    await LDChatzz.sendGroupMessage("g1", "plain");

    const group = await LDChatzz.createGroup("New", ["u2"]);
    assert.ok(group.id);

    game.user.isGM = false;
    await LDChatzz.deleteGroup(group.id);
    game.user.isGM = true;
    await LDChatzz.deleteGroup("missing");
    const g2 = await LDChatzz.createGroup("Del", ["u2"]);
    await LDChatzz.deleteGroup(g2.id);

    DataManager.groupChats.set("g3", {
        id: "g3",
        name: "E",
        members: ["user1", "u2"],
        history: [{ id: "m1", messageContent: "old" }]
    });
    DataManager.privateChats.set("user1-u2", {
        users: ["user1", "u2"],
        history: [{ id: "pm1", messageContent: "old" }]
    });
    await LDChatzz.editMessage("g3", "m1", "new", true);
    await LDChatzz.editMessage("user1-u2", "pm1", "new", false);
    game.user.isGM = false;
    await LDChatzz.editMessage("g3", "m1", "n2", true);
    game.user.isGM = true;

    await LDChatzz.deleteMessage("g3", "m1", true);
    DataManager.privateChats.get("user1-u2").history.push({ id: "pm2", messageContent: "x" });
    await LDChatzz.deleteMessage("user1-u2", "pm2", false);
    game.user.isGM = false;
    await LDChatzz.deleteMessage("user1-u2", "nope", false);
    game.user.isGM = true;

    DataManager.groupChats.set("g3", {
        id: "g3",
        members: ["user1"],
        history: [{ id: "m2", messageContent: "x" }]
    });
    await LDChatzz.toggleReaction("g3", "m2", "👍", true);
    await LDChatzz.toggleReaction("user1-u2", "pm1", "❤️", false);
    game.user.isGM = false;
    await LDChatzz.toggleReaction("g3", "m2", "👍", true);
    game.user.isGM = true;

    assert.equal(await LDChatzz.requestActorFriendship("missing"), false);
    const noRecipients = makeMockActor({ id: "a3", name: "Solo", ownership: { user1: 3 } });
    noRecipients.getFlag = () => [];
    // only self as owner, recipients empty after delete self; GMs other than self
    game.users.filter = (fn) =>
        [
            { id: "user1", name: "Tester", active: true, isGM: true },
            { id: "u2", name: "Alice", active: false, isGM: false }
        ].filter(fn);
    game.actors.get = (id) => (id === "a1" ? actor : id === "a3" ? noRecipients : null);
    // getRecipientUserIds for a3: owners = [user1], deleted self -> empty -> active GMs except self
    // filter returns only inactive u2 and no other GM active... user1 is self GM
    // Actually game.users.filter in getRecipientUserIds uses game.users.filter - our mock filters userList
    // With only user1 as owner, recipients delete self, size 0, then GMs active not self - if isGM true and only user1 is GM active, empty
    assert.equal(await LDChatzz.requestActorFriendship("a3"), false);

    game.users.filter = (fn) =>
        [
            { id: "user1", name: "Tester", active: true, isGM: true },
            { id: "u2", name: "Alice", active: true, isGM: false },
            { id: "gm2", name: "GM2", active: true, isGM: true }
        ].filter(fn);
    game.actors.get = (id) => (id === "a1" ? actor : null);
    assert.equal(await LDChatzz.requestActorFriendship("a1", { note: "hi", requesterActorId: "a1", requesterActorName: "Hero" }), true);

    await LDChatzz.acceptActorFriendRequest("a1", "u2");

    restoreMocks();
});

test("UIManager open/update/background paths", async () => {
    const actor = makeMockActor({ id: "a1", name: "Hero", ownership: { user1: 3 }, img: "h.svg", isOwner: true });
    actor.getFlag = () => [];
    installMocks({
        isGM: true,
        users: [
            { id: "user1", name: "Tester", active: true, isGM: true },
            { id: "u2", name: "Alice", active: true, isGM: false }
        ],
        actors: [actor],
        settings: { "ld-chatzz.enableSounds": false }
    });

    // stub window classes via dynamic import interception - mock after first load of UIManager
    const { UIManager } = await import("../src/UIManager.js");
    const { DataManager } = await import("../src/DataManager.js");

    class FakeWin {
        constructor(opts) {
            this.options = opts;
            this.rendered = false;
            this.closed = false;
            this.element = document.createElement("div");
            this.element.innerHTML = `<div class="chatzz-chat-container"></div><div class="chatzz-hub-container"></div>`;
            this._shouldScrollToBottom = false;
        }
        render() {
            this.rendered = true;
            return this;
        }
        bringToTop() {
            this._top = true;
        }
        close() {
            this.closed = true;
            this.rendered = false;
        }
        updateTypingIndicator() {
            this._typed = true;
        }
    }

    // Monkey-patch dynamic imports by pre-setting maps and methods that create windows
    const origOpenPlayerHub = UIManager.openPlayerHub;
    UIManager.openPlayerHub = async function () {
        const existing = foundry.applications?.instances?.get("chatzz-player-hub");
        if (existing) {
            if (typeof existing.bringToTop === "function") existing.bringToTop();
            return;
        }
        if (this.playerHubWindow && !this.playerHubWindow.closed) {
            if (typeof this.playerHubWindow.bringToTop === "function") this.playerHubWindow.bringToTop();
            return;
        }
        this.playerHubWindow = new FakeWin();
        return this.playerHubWindow.render(true);
    };

    await UIManager.openPlayerHub();
    assert.ok(UIManager.playerHubWindow);
    await UIManager.openPlayerHub(); // bring to top stored
    UIManager.playerHubWindow = null;
    foundry.applications.instances.set("chatzz-player-hub", new FakeWin());
    await UIManager.openPlayerHub(); // existing instance
    foundry.applications.instances.delete("chatzz-player-hub");

    // openChatFor
    UIManager.openChatFor = async function (userId) {
        const existingWindow = this.openPrivateChatWindows.get(userId);
        if (existingWindow?.rendered) return existingWindow.render(true);
        const chatKey = DataManager.getPrivateChatKey(game.user.id, userId);
        if (!DataManager.privateChats.has(chatKey)) {
            DataManager.privateChats.set(chatKey, { users: [game.user.id, userId], history: [] });
        }
        const window = new FakeWin({ otherUserId: userId });
        this.openPrivateChatWindows.set(userId, window);
        return window.render(true);
    };
    // Actually test the real methods - re-import won't rebind. Call real ones by restoring.

    // Use real openChatFor - needs ChatzzWindow which needs ApplicationV2 mock - should work
    // Reset our override
    UIManager.openPlayerHub = origOpenPlayerHub;

    // Real openChatFor uses ChatzzWindow import
    const w1 = await UIManager.openChatFor("u2");
    assert.ok(w1);
    UIManager.openPrivateChatWindows.get("u2").rendered = true;
    await UIManager.openChatFor("u2");

    // openChatForActor
    const aw = await UIManager.openChatForActor("a1");
    assert.ok(aw);
    UIManager.openActorChatWindows.get("a1").rendered = true;
    await UIManager.openChatForActor("a1");
    await UIManager.openChatForActor("missing");
    game.user.isGM = false;
    const locked = makeMockActor({ id: "a2", name: "L", ownership: { other: 3 } });
    locked.getFlag = () => [];
    game.actors.get = (id) => (id === "a1" ? actor : id === "a2" ? locked : null);
    await UIManager.openChatForActor("a2");
    game.user.isGM = true;
    game.actors.get = (id) => (id === "a1" ? actor : null);

    // openGroupChat
    DataManager.groupChats.set("g1", { id: "g1", members: ["user1", "u2"], history: [] });
    DataManager.groupChats.set("g2", { id: "g2", members: ["u2"], history: [] });
    await UIManager.openGroupChat("missing");
    game.user.isGM = false;
    await UIManager.openGroupChat("g2"); // not member
    game.user.isGM = true;
    await UIManager.openGroupChat("g2"); // GM can
    UIManager.openGroupChatWindows.get("g2").rendered = true;
    await UIManager.openGroupChat("g2");
    await UIManager.openGroupChat("g1");

    // openGroupManager
    game.user.isGM = false;
    await UIManager.openGroupManager();
    game.user.isGM = true;
    ui.windows = {};
    await UIManager.openGroupManager();
    ui.windows = { x: { id: "chatzz-group-manager" } };
    await UIManager.openGroupManager();

    // openGMMonitor
    game.user.isGM = false;
    await UIManager.openGMMonitor();
    game.user.isGM = true;
    await UIManager.openGMMonitor();
    UIManager.gmMonitorWindow.closed = false;
    UIManager.gmMonitorWindow.bringToTop = function () {
        this._top = true;
    };
    await UIManager.openGMMonitor();
    UIManager.gmMonitorWindow = null;
    foundry.applications.instances.set("chatzz-gm-monitor", { bringToTop() { this.t = 1; } });
    await UIManager.openGMMonitor();
    foundry.applications.instances.delete("chatzz-gm-monitor");

    // openSettingsWindow
    ui.windows = {};
    await UIManager.openSettingsWindow();
    ui.windows = { s: { id: "chatzz-settings-window", bringToTop() { this.t = 1; } } };
    await UIManager.openSettingsWindow();

    // openGMModWindow
    game.user.isGM = false;
    await UIManager.openGMModWindow();
    game.user.isGM = true;
    UIManager.gmModWindow = null;
    await UIManager.openGMModWindow();
    UIManager.gmModWindow.closed = false;
    UIManager.gmModWindow.bringToTop = function () {
        this._top = true;
    };
    await UIManager.openGMModWindow();
    UIManager.gmModWindow = null;
    foundry.applications.instances.set("chatzz-gm-mod-window", { bringToTop() {} });
    await UIManager.openGMModWindow();
    foundry.applications.instances.delete("chatzz-gm-mod-window");

    await UIManager.openGMPanel();

    // update windows
    const priv = new FakeWin();
    priv.rendered = true;
    UIManager.openPrivateChatWindows.set("u2", priv);
    const act = new FakeWin();
    act.rendered = true;
    UIManager.openActorChatWindows.set("a1", act);
    const grp = new FakeWin();
    grp.rendered = true;
    UIManager.openGroupChatWindows.set("g1", grp);
    UIManager.updateChatWindow("u2", "private");
    UIManager.updateChatWindow("a1", "actor");
    UIManager.updateChatWindow("g1", "group");
    UIManager.updateChatWindow("none", "private");

    UIManager.updateTypingIndicator("u2", "private");
    UIManager.updateTypingIndicator("a1", "actor");
    UIManager.updateTypingIndicator("g1", "group");

    // openChatWindowForNewMessage - real methods already open
    UIManager.openChatFor = async () => {};
    UIManager.openChatForActor = async () => {};
    UIManager.openGroupChat = async () => {};
    UIManager.openChatWindowForNewMessage("u2", "private");
    UIManager.openChatWindowForNewMessage("a1", "actor");
    UIManager.openChatWindowForNewMessage("g1", "group");

    UIManager.closeChatWindow("u2", "private");
    UIManager.closeChatWindow("a1", "actor");
    UIManager.closeChatWindow("g1", "group");
    UIManager.closeChatWindow("none", "private");

    DataManager.privateChats.set("user1-u2", { users: ["user1", "u2"], history: [] });
    DataManager.actorChats.set("actor:a1", { kind: "actor", actorId: "a1", history: [] });
    UIManager.refreshConversationWindow("g1", "group");
    UIManager.refreshConversationWindow("actor:a1", "private");
    UIManager.refreshConversationWindow("user1-u2", "private");
    UIManager.refreshConversationWindow("solo-id", "private");

    ui.windows = {
        hub: { id: "chatzz-player-hub", rendered: true, render() { this.r = 1; }, element: document.createElement("div") },
        gm: { id: "chatzz-group-manager", rendered: true, render() { this.r = 1; } }
    };
    ui.windows.hub.element.innerHTML = `<div class="chatzz-hub-container"></div>`;
    UIManager.updatePlayerHub();
    UIManager.updateGroupManager();
    UIManager.gmMonitorWindow = { rendered: true, render() { this.r = 1; } };
    UIManager.updateGMMonitor();
    UIManager.gmMonitorWindow = null;
    UIManager.updateGMMonitor();

    DataManager.setSharedBackground = () => {};
    UIManager.openPrivateChatWindows.set("u2", priv);
    priv.rendered = true;
    priv.element = document.createElement("div");
    priv.element.innerHTML = `<div class="chatzz-chat-container"></div>`;
    UIManager.openGroupChatWindows.set("g1", grp);
    grp.element = document.createElement("div");
    grp.element.innerHTML = `<div class="chatzz-chat-container"></div>`;
    DataManager.groupChats.set("g1", { members: ["u2"] });
    UIManager.gmMonitorWindow = { rendered: true, render() { throw new Error("x"); } };
    UIManager.updateBackgroundForUser(null, "p");
    UIManager.updateBackgroundForUser("u2", "path.png");
    UIManager.updateBackgroundForUser("u2", null);
    // hub applyBackground throws path covered via try/catch when container missing
    ui.windows.hub.element = document.createElement("div");
    UIManager.updateBackgroundForUser("u2", "p");

    UIManager.applyBackgroundToWindow(null, "p");
    UIManager.applyBackgroundToWindow({ element: null }, "p");
    const el = document.createElement("div");
    el.innerHTML = `<div class="chatzz-chat-container"></div>`;
    UIManager.applyBackgroundToWindow({ element: el }, "bg.png");
    UIManager.applyBackgroundToWindow({ element: el }, null);
    UIManager.applyBackgroundToWindow({ element: document.createElement("div") }, "x");

    // hotbar badge
    const badge = document.createElement("div");
    badge.className = "chatzz-hotbar-badge";
    document.body.appendChild(badge);
    DataManager.unreadCounts.set("c", 5);
    UIManager.updateHotbarBadge();
    DataManager.unreadCounts.set("c", 150);
    UIManager.updateHotbarBadge();
    DataManager.unreadCounts.clear();
    UIManager.updateHotbarBadge();
    UIManager.showToast("hi", "info");
    UIManager.showToast("w", "warn");

    restoreMocks();
});
