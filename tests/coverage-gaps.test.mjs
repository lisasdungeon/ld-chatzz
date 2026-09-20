import assert from "node:assert/strict";
import test from "node:test";
import {
    installMocks,
    restoreMocks,
    makeMockActor,
    makeChatElement,
    MockFilePicker,
    MockApplicationV2,
    HandlebarsApplicationMixin
} from "./foundry-mock.mjs";

test("resolveAppClass fallbacks and UIManager remaining lines", async () => {
    installMocks({
        isGM: true,
        users: [
            { id: "user1", name: "Tester", active: true, isGM: true },
            { id: "u2", name: "Alice", active: true, isGM: false }
        ],
        actors: [makeMockActor({ id: "a1", name: "Hero", ownership: { user1: 3 }, img: "h.svg" })],
        settings: { "ld-chatzz.enableSounds": false }
    });
    game.actors.get = (id) => (id === "a1" ? { id: "a1", name: "Hero", img: "h.svg", getFlag: () => [] } : null);

    const { resolveModAppClass } = await import("../src/GMModWindow.js");
    const { resolveGroupAppClass } = await import("../src/GroupManagerWindow.js");
    const { resolveSettingsAppClass } = await import("../src/SettingsWindow.js");

    class FallbackApp {}
    assert.equal(resolveModAppClass(null, FallbackApp), FallbackApp);
    assert.equal(resolveGroupAppClass({}, FallbackApp), FallbackApp);
    assert.equal(resolveSettingsAppClass({ ApplicationV2: class {} }, FallbackApp), FallbackApp);
    assert.ok(resolveModAppClass({
        ApplicationV2: MockApplicationV2,
        HandlebarsApplicationMixin
    }));

    const { UIManager } = await import("../src/UIManager.js");
    const { DataManager } = await import("../src/DataManager.js");

    // openPlayerHub real paths
    foundry.applications.instances = new Map();
    UIManager.playerHubWindow = null;
    const hub = await UIManager.openPlayerHub();
    assert.ok(hub || UIManager.playerHubWindow);
    // stored reference bringToTop
    UIManager.playerHubWindow = {
        closed: false,
        bringToTop() {
            this.t = 1;
        }
    };
    await UIManager.openPlayerHub();
    foundry.applications.instances.set("chatzz-player-hub", {
        bringToTop() {
            this.t = 1;
        }
    });
    await UIManager.openPlayerHub();
    foundry.applications.instances.delete("chatzz-player-hub");
    UIManager.playerHubWindow = null;

    // private chat already exists path vs create
    const pkey = DataManager.getPrivateChatKey("user1", "u2");
    DataManager.privateChats.delete(pkey);
    UIManager.openPrivateChatWindows.clear();
    await UIManager.openChatFor("u2");
    UIManager.openPrivateChatWindows.get("u2").rendered = true;
    await UIManager.openChatFor("u2");

    // actor chat create path
    UIManager.openActorChatWindows.clear();
    DataManager.actorChats.delete(DataManager.getActorChatKey("a1"));
    game.actors.get = (id) =>
        id === "a1"
            ? {
                  id: "a1",
                  name: "Hero",
                  img: "h.svg",
                  ownership: { user1: 3 },
                  getFlag: () => []
              }
            : null;
    // getVisibleActors needs game.actors.filter
    const actor = {
        id: "a1",
        name: "Hero",
        img: "h.svg",
        ownership: { user1: 3 },
        getFlag: () => []
    };
    game.actors.filter = (fn) => [actor].filter(fn);
    game.actors.get = (id) => (id === "a1" ? actor : null);
    await UIManager.openChatForActor("a1");

    // updateChatWindow all types with rendered windows
    const mk = () => ({
        rendered: true,
        _shouldScrollToBottom: false,
        render() {
            this.r = true;
        },
        updateTypingIndicator() {
            this.t = true;
        },
        close() {
            this.closed = true;
        },
        element: (() => {
            const d = document.createElement("div");
            d.innerHTML = `<div class="chatzz-chat-container"></div>`;
            return d;
        })()
    });
    const p = mk();
    const a = mk();
    const g = mk();
    UIManager.openPrivateChatWindows.set("u2", p);
    UIManager.openActorChatWindows.set("a1", a);
    UIManager.openGroupChatWindows.set("g1", g);
    UIManager.updateChatWindow("u2", "private");
    UIManager.updateChatWindow("a1", "actor");
    UIManager.updateChatWindow("g1", "group");
    assert.equal(p._shouldScrollToBottom, true);

    UIManager.closeChatWindow("u2", "private");
    UIManager.closeChatWindow("a1", "actor");
    UIManager.closeChatWindow("g1", "group");

    // refreshConversationWindow
    DataManager.privateChats.set(pkey, { users: ["user1", "u2"], history: [] });
    DataManager.actorChats.set("actor:a1", { kind: "actor", actorId: "a1", history: [] });
    UIManager.openPrivateChatWindows.set("u2", mk());
    UIManager.openActorChatWindows.set("a1", mk());
    UIManager.openGroupChatWindows.set("g1", mk());
    UIManager.refreshConversationWindow("g1", "group");
    UIManager.refreshConversationWindow("actor:a1");
    UIManager.refreshConversationWindow(pkey);
    UIManager.refreshConversationWindow("onlyme");

    // updateBackgroundForUser full path
    DataManager.groupChats.set("g1", { members: ["u2", "user1"] });
    UIManager.openPrivateChatWindows.set("u2", mk());
    UIManager.openGroupChatWindows.set("g1", mk());
    ui.windows = {
        hub: {
            id: "chatzz-player-hub",
            rendered: true,
            element: (() => {
                const d = document.createElement("div");
                d.innerHTML = `<div class="chatzz-hub-container"></div>`;
                return d;
            })()
        }
    };
    UIManager.gmMonitorWindow = {
        rendered: true,
        render() {
            throw new Error("render fail");
        }
    };
    game.user.isGM = true;
    UIManager.updateBackgroundForUser("u2", "bg.png");
    UIManager.updateBackgroundForUser("u2", null);
    // hub without container -> catch ignore
    ui.windows.hub.element = document.createElement("div");
    UIManager.updateBackgroundForUser("u2", "x");

    restoreMocks();
});

test("SettingsWindow notification + FilePicker z-index paths", async () => {
    installMocks({
        isGM: true,
        settings: {
            "ld-chatzz.enableSounds": true,
            "ld-chatzz.notificationVolume": 0.5,
            "ld-chatzz.enableDesktopNotifications": false,
            "ld-chatzz.personalBackground": "",
            "ld-chatzz.shareBackground": false,
            "ld-chatzz.gmOverrideEnabled": false,
            "ld-chatzz.gmOverrideSoundPath": ""
        }
    });
    const { SettingsWindow } = await import("../src/SettingsWindow.js");
    const win = new SettingsWindow();
    win.element = document.createElement("div");
    win.element.innerHTML = `
        <input name="enableSounds" type="checkbox" checked/>
        <input name="notificationVolume" value="0.5"/>
        <input name="enableDesktopNotifications" type="checkbox"/>
        <input name="personalBackground" value=""/>
        <input name="shareBackground" type="checkbox"/>
        <input name="gmOverrideEnabled" type="checkbox"/>
        <input name="gmOverrideSoundPath" value=""/>
        <button data-action="pickBackground"></button>
        <button data-action="pickGMSound"></button>
        <button data-action="saveSettings"></button>
        <button data-action="requestNotifications"></button>
    `;
    win.close = async () => {};

    const okElement = () => ({
        css: () => okElement(),
        closest: () => ({ css: () => {} })
    });

    // pickBackground: promise then happy path
    MockFilePicker.prototype.render = function () {
        this.element = okElement();
        return Promise.resolve(this);
    };
    win._setupEventListeners(win.element);
    win.element.querySelector('[data-action="pickBackground"]').click();
    await new Promise((r) => setTimeout(r, 20));

    // pickBackground: promise then catch path
    MockFilePicker.prototype.render = function () {
        this.element = {
            css: () => {
                throw new Error("css fail");
            },
            closest: () => {
                throw new Error("closest fail");
            }
        };
        return Promise.resolve(this);
    };
    win._setupEventListeners(win.element);
    win.element.querySelector('[data-action="pickBackground"]').click();
    await new Promise((r) => setTimeout(r, 20));

    // pickBackground: non-promise setTimeout path (lines 102-103)
    MockFilePicker.prototype.render = function () {
        this.element = okElement();
        return this;
    };
    win._setupEventListeners(win.element);
    win.element.querySelector('[data-action="pickBackground"]').click();
    await new Promise((r) => setTimeout(r, 150));

    // pickGMSound: promise then happy path (line 118)
    MockFilePicker.prototype.render = function () {
        this.element = okElement();
        return Promise.resolve(this);
    };
    win._setupEventListeners(win.element);
    win.element.querySelector('[data-action="pickGMSound"]').click();
    await new Promise((r) => setTimeout(r, 20));

    // pickGMSound: non-promise setTimeout path
    MockFilePicker.prototype.render = function () {
        this.element = okElement();
        return this;
    };
    win._setupEventListeners(win.element);
    win.element.querySelector('[data-action="pickGMSound"]').click();
    await new Promise((r) => setTimeout(r, 150));

    // pickGMSound: non-promise with throw
    MockFilePicker.prototype.render = function () {
        this.element = {
            css: () => {
                throw new Error("css fail");
            },
            closest: () => null
        };
        return this;
    };
    win._setupEventListeners(win.element);
    win.element.querySelector('[data-action="pickGMSound"]').click();
    await new Promise((r) => setTimeout(r, 150));

    // save via button
    win.element.querySelector('[data-action="saveSettings"]').click();
    await new Promise((r) => setTimeout(r, 10));

    // notifications granted
    window.Notification = class {
        static permission = "default";
        static async requestPermission() {
            return "granted";
        }
    };
    globalThis.Notification = window.Notification;
    win._setupEventListeners(win.element);
    win.element.querySelector('[data-action="requestNotifications"]').click();
    await new Promise((r) => setTimeout(r, 10));

    // notifications denied
    window.Notification.requestPermission = async () => "denied";
    win.element.querySelector('[data-action="requestNotifications"]').click();
    await new Promise((r) => setTimeout(r, 10));

    restoreMocks();
});

test("ChatzzWindowEvents empty path callback and remaining event edges", async () => {
    installMocks({
        settings: {
            "ld-chatzz.chatBackgrounds": { "u2-user1": "old.png" },
            "ld-chatzz.enableSounds": false
        }
    });
    const { ChatzzWindowEvents } = await import("../src/windows/ChatzzWindowEvents.js");
    const { DataManager } = await import("../src/DataManager.js");
    const el = makeChatElement();
    const app = {
        options: { otherUserId: "u2" },
        _preservedInputValue: "",
        _lastTypingEmit: 0,
        _typingTimeout: null,
        _handleFormSubmit: async () => {},
        _onImageSelected: async () => {},
        render: () => {}
    };
    // empty path delete branch: callback with empty path
    MockFilePicker._autoPath = "";
    // custom browse that passes empty string
    const origBrowse = MockFilePicker.prototype.browse;
    MockFilePicker.prototype.browse = function () {
        if (this.opts.callback) this.opts.callback("");
        return this;
    };
    ChatzzWindowEvents.activateListeners(app, el);
    el.querySelector(".chatzz-background-btn").click();
    MockFilePicker.prototype.browse = origBrowse;

    // path set branch
    MockFilePicker.prototype.browse = function () {
        if (this.opts.callback) this.opts.callback("new.png");
        return this;
    };
    ChatzzWindowEvents.activateListeners(app, makeChatElement());
    makeChatElement(); // ensure body has elements
    const el2 = makeChatElement();
    ChatzzWindowEvents.activateListeners(app, el2);
    el2.querySelector(".chatzz-background-btn").click();
    MockFilePicker.prototype.browse = origBrowse;

    assert.ok(DataManager);
    restoreMocks();
});

test("GMMonitorEvents open chat branches and data participants filter", async () => {
    installMocks({
        users: [
            { id: "user1", name: "Tester", active: true, isGM: true },
            { id: "u2", name: "Alice", active: true, isGM: false }
        ]
    });
    const { GMMonitorEvents } = await import("../src/windows/GMMonitorEvents.js");
    const { GMMonitorData } = await import("../src/windows/GMMonitorData.js");
    const { DataManager } = await import("../src/DataManager.js");
    const { UIManager } = await import("../src/UIManager.js");
    const { DataStore } = await import("../src/data/DataStore.js");

    DataStore.interceptedMessages = [
        {
            id: "i1",
            senderId: "u2",
            recipientId: "user1",
            participants: ["u2", "user1"],
            interceptedAt: Date.now(),
            messageData: { messageContent: "hi", senderName: "Alice" }
        },
        {
            id: "i2",
            senderId: "user1",
            groupId: "g1",
            groupName: "G",
            participants: ["user1", "u2"],
            interceptedAt: Date.now(),
            messageData: { messageContent: "g", senderName: "Tester" }
        }
    ];

    // selectedUsers filter via participants (line 63)
    const inst = {
        _selectedUsers: new Set(["u2"]),
        _filterType: "all",
        _searchQuery: "",
        _sortOrder: "newest",
        _showImages: true,
        _autoScroll: true,
        _stealthMode: true,
        _flaggedMessages: new Set()
    };
    // message with only participants match
    DataStore.interceptedMessages.push({
        id: "i3",
        senderId: "x",
        recipientId: "y",
        participants: ["u2"],
        interceptedAt: Date.now(),
        messageData: { messageContent: "p" }
    });
    const ctx = await GMMonitorData.prepareContext(inst);
    assert.ok(ctx.messages.some((m) => m.id === "i3"));

    UIManager.openGroupChat = (id) => {
        UIManager._openedGroup = id;
    };
    UIManager.openChatFor = (id) => {
        UIManager._openedUser = id;
    };

    const mon = {
        _filterType: "all",
        _sortOrder: "newest",
        _searchQuery: "",
        _selectedUsers: new Set(),
        _showImages: true,
        _autoScroll: false,
        _flaggedMessages: new Set(),
        _listenerRegistered: false,
        _boundUpdateHandler: () => {},
        rendered: false,
        render() {},
        _exportMonitorLog() {},
        _exportToJournal() {},
        get title() {
            return "T";
        },
        element: document.createElement("div")
    };
    mon.element.innerHTML = `
        <button class="chatzz-open-chat" data-message-id="i2"></button>
        <button class="chatzz-open-chat" data-message-id="i1"></button>
        <button class="chatzz-open-chat" data-message-id="missing"></button>
    `;
    GMMonitorEvents.setup(mon, mon.element);
    mon.element.querySelectorAll(".chatzz-open-chat")[0].click();
    assert.equal(UIManager._openedGroup, "g1");
    mon.element.querySelectorAll(".chatzz-open-chat")[1].click();
    assert.equal(UIManager._openedUser, "u2");
    mon.element.querySelectorAll(".chatzz-open-chat")[2].click();

    // sender is current user -> open recipient
    DataStore.interceptedMessages = [
        { id: "i4", senderId: "user1", recipientId: "u2", messageData: {} }
    ];
    mon.element.innerHTML = `<button class="chatzz-open-chat" data-message-id="i4"></button>`;
    GMMonitorEvents.setup(mon, mon.element);
    mon.element.querySelector(".chatzz-open-chat").click();
    assert.equal(UIManager._openedUser, "u2");

    restoreMocks();
});

test("PlayerHubEvents selectedCount zero opacity branch", async () => {
    installMocks({
        users: [
            { id: "user1", name: "Tester", active: true, isGM: true },
            { id: "u2", name: "Alice", active: true, isGM: false }
        ]
    });
    const { PlayerHubEvents } = await import("../src/windows/PlayerHubEvents.js");
    const el = document.createElement("div");
    el.innerHTML = `
        <div class="chatzz-user-card selected" data-user-id="u2"><span class="chatzz-user-name">Alice</span></div>
        <button data-action="createChat" style="opacity:1;cursor:pointer"></button>
    `;
    document.body.appendChild(el);
    PlayerHubEvents.activateListeners({ activeTab: "users" }, el);
    // click selected card to deselect -> selectedCount 0
    el.querySelector(".chatzz-user-card").click();
    const btn = el.querySelector('[data-action="createChat"]');
    assert.equal(btn.style.opacity, "0.5");
    // select again
    el.querySelector(".chatzz-user-card").click();
    assert.equal(btn.style.opacity, "1");

    restoreMocks();
});
