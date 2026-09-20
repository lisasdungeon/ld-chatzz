import assert from "node:assert/strict";
import test from "node:test";
import { installMocks, restoreMocks, makeMockActor } from "./foundry-mock.mjs";

function expandMocks({ users = [], actors = [], settings = {} } = {}) {
    const base = installMocks({ users, actors, settings });
    const actorList = [...actors];
    const userList = [...users];
    game.actors = {
        get: (id) => actorList.find((a) => a.id === id) ?? null,
        filter: (fn) => actorList.filter(fn),
        map: (fn) => actorList.map(fn)
    };
    game.users = {
        get: (id) => userList.find((u) => u.id === id) ?? null,
        find: (fn) => userList.find(fn) ?? null,
        filter: (fn) => userList.filter(fn)
    };
    game.user.avatar = "icons/me.svg";
    game.settings.register = (module, key, def) => {
        if (!base.settingsStore.has(`${module}.${key}`)) {
            base.settingsStore.set(`${module}.${key}`, def.default);
        }
    };
    globalThis.Handlebars = { registerHelper: () => {}, helpers: {} };
    globalThis.foundry.audio = { AudioHelper: { play: () => {} } };
    globalThis.AudioHelper = { play: () => {} };
    try {
        Object.defineProperty(globalThis, "navigator", {
            value: { clipboard: { writeText: async () => true } },
            configurable: true,
            writable: true
        });
    } catch {
        if (globalThis.navigator?.clipboard) {
            globalThis.navigator.clipboard.writeText = async () => true;
        }
    }
    globalThis.Notification = { permission: "denied", requestPermission: async () => "denied" };
    globalThis.Blob = class { constructor(parts) { this.parts = parts; } };
    if (!globalThis.URL) globalThis.URL = {};
    globalThis.URL.createObjectURL = () => "blob:x";
    globalThis.URL.revokeObjectURL = () => {};
    // enhance document.createElement for export link
    const origCreate = document.createElement.bind(document);
    document.createElement = (tag) => {
        if (tag === "a") {
            return { href: "", download: "", click: () => {}, style: {} };
        }
        return origCreate(tag);
    };
    return base;
}

test("ConversationUtils and DataStore", async () => {
    expandMocks({});
    const { DataStore } = await import("../src/data/DataStore.js");
    const { ConversationUtils } = await import("../src/data/ConversationUtils.js");
    DataStore.groupChats.clear();
    DataStore.privateChats.clear();
    DataStore.actorChats.clear();
    DataStore.groupChats.set("g1", { id: "g1" });
    DataStore.privateChats.set("a-b", { users: ["a", "b"] });
    DataStore.actorChats.set("actor:a1", { actorId: "a1" });
    assert.equal(ConversationUtils.getConversation("g1").id, "g1");
    assert.equal(ConversationUtils.getConversation("missing"), null);
    assert.equal(ConversationUtils.getConversationType("g1"), "group");
    assert.equal(ConversationUtils.getConversationType("actor:a1"), "actor");
    assert.equal(ConversationUtils.getConversationType("a-b"), "private");
    assert.equal(ConversationUtils.getConversationType("x"), null);
    DataStore.mutedConversations.add("m1");
    assert.equal(DataStore.isMuted("m1"), true);
    assert.equal(DataStore.isMuted("no"), false);
    restoreMocks();
});

test("ActorContacts remaining paths", async () => {
    const owner = { id: "owner1", active: true, isGM: false };
    const gm = { id: "gm1", active: true, isGM: true };
    const actor = makeMockActor({
        id: "a1",
        name: "Hero",
        ownership: { owner1: 3, default: 0 },
        flags: { "ld-chatzz.acceptedFriendUserIds": ["friend1"] }
    });
    actor.img = "icons/hero.svg";
    actor.getFlag = (scope, key) => (key === "acceptedFriendUserIds" ? ["friend1"] : undefined);
    expandMocks({
        users: [owner, gm, { id: "user1", active: true, isGM: false }],
        actors: [actor]
    });
    game.user.id = "user1";
    const { ActorContacts } = await import("../src/data/ActorContacts.js");
    assert.deepEqual(ActorContacts.getExplicitOwnerUserIds(actor), ["owner1"]);
    assert.equal(ActorContacts.isVisibleToUser(actor, { id: "owner1" }), true);
    assert.equal(ActorContacts.isVisibleToUser(actor, { id: "friend1" }), true);
    assert.equal(ActorContacts.isVisibleToUser(actor, { id: "stranger" }), false);
    assert.equal(ActorContacts.isVisibleToUser(null, game.user), false);

    const cards = ActorContacts.getVisibleActors({ id: "friend1" });
    assert.ok(Array.isArray(cards));
    const card = ActorContacts.getActorCard(actor);
    assert.equal(card.id, "a1");
    assert.equal(typeof card.color, "string");

    const recipients = ActorContacts.getRecipientUserIds(actor);
    assert.ok(recipients.includes("owner1") || recipients.includes("friend1") || recipients.includes("gm1"));

    // no owners/friends -> GMs
    const bare = makeMockActor({ id: "a2", name: "Bare", ownership: {} });
    bare.getFlag = () => [];
    game.actors.get = (id) => {
        if (id === "a2") return bare;
        if (id === "a1") return actor;
        return null;
    };
    const r2 = ActorContacts.getRecipientUserIds(bare);
    assert.ok(r2.includes("gm1"));

    assert.equal(await ActorContacts.acceptFriendRequest("missing", "u"), false);
    assert.equal(await ActorContacts.acceptFriendRequest("a1", "newfriend"), true);
    restoreMocks();
});

test("Utils time/avatar/mention/export helpers", async () => {
    const users = [
        { id: "user1", name: "Tester", active: true, avatar: "icons/svg/mystery-man.svg" },
        { id: "u2", name: "Alice Bob", active: false, avatar: "icons/alice.svg" }
    ];
    expandMocks({
        users,
        settings: {
            "ld-chatzz.enableDesktopNotifications": true,
            "ld-chatzz.enableSounds": true,
            "ld-chatzz.notificationVolume": 0.5,
            "ld-chatzz.gmOverrideEnabled": false,
            "ld-chatzz.gmOverrideSoundPath": "",
            "ld-chatzz.sfxGetMessage": "",
            "ld-chatzz.sfxCloseWindow": "",
            "ld-chatzz.sfxButtonPress": "",
            "ld-chatzz.sfxSendMessage": ""
        }
    });
    const { Utils } = await import("../src/Utils.js");

    assert.equal(Utils.formatRelativeTime(0), "");
    assert.equal(Utils.formatRelativeTime(Date.now() - 1000), "CHATZZ.TimeJustNow");
    assert.match(Utils.formatRelativeTime(Date.now() - 5 * 60 * 1000), /TimeMinutesAgo/);
    assert.match(Utils.formatRelativeTime(Date.now() - 3 * 60 * 60 * 1000), /TimeHoursAgo/);
    assert.equal(Utils.formatRelativeTime(Date.now() - 25 * 60 * 60 * 1000), "CHATZZ.TimeYesterday");
    assert.match(Utils.formatRelativeTime(Date.now() - 3 * 24 * 60 * 60 * 1000), /TimeDaysAgo/);
    assert.ok(Utils.formatRelativeTime(Date.now() - 30 * 24 * 60 * 60 * 1000));

    assert.equal(Utils.formatFullTimestamp(0), "");
    assert.ok(Utils.formatFullTimestamp(Date.now()));

    assert.equal(Utils.getUserInitials(""), "?");
    assert.equal(Utils.getUserInitials("Ada"), "AD");
    assert.equal(Utils.getUserInitials("Ada Lovelace"), "AL");

    assert.deepEqual(Utils.parseMentions(""), []);
    assert.deepEqual(Utils.parseMentions("@Tester hello"), ["user1"]);
    assert.match(Utils.highlightMentions("@Tester x"), /chatzz-mention/);
    assert.equal(Utils.highlightMentions(""), "");
    assert.equal(Utils.highlightMentions("@Nobody"), "@Nobody");

    assert.equal(Utils.isOwnMessage("user1"), true);
    assert.deepEqual(Utils.getUserAvatar("missing"), { type: "initials", value: "?" });
    assert.equal(Utils.getUserAvatar("u2").type, "image");
    assert.equal(Utils.getUserAvatar("user1").type, "initials");
    assert.equal(Utils.isUserOnline("user1"), true);
    assert.equal(Utils.isUserOnline("missing"), false);

    assert.equal(Utils.parseRichContent(""), "");
    assert.match(Utils.parseRichContent("see https://x.test/a\n[[1d20]] @Item[Sword] @Actor[Bob]"), /chatzz-link/);

    assert.equal(Utils.formatReplyQuote(null), null);
    assert.equal(Utils.formatReplyQuote({ senderId: "u2", messageContent: "hi", id: "m1" }).senderName, "Alice Bob");
    assert.ok(Utils.formatReplyQuote({ messageContent: "x".repeat(100), id: "m2" }).preview.endsWith("..."));

    document.hasFocus = () => true;
    Utils.showDesktopNotification("t", "b", "i");
    document.hasFocus = () => false;
    Notification.permission = "granted";
    globalThis.Notification = function (title, opts) { Notification._last = { title, opts }; };
    Notification.permission = "granted";
    Utils.showDesktopNotification("t", "b", "i");
    Notification.permission = "default";
    Notification.requestPermission = async () => "granted";
    Utils.showDesktopNotification("t2", "b2", "i");

    let debounced = 0;
    const d = Utils.debounce(() => { debounced += 1; }, 10);
    d();
    d();
    await new Promise((r) => setTimeout(r, 30));
    assert.equal(debounced, 1);

    let throttled = 0;
    const t = Utils.throttle(() => { throttled += 1; }, 50);
    t();
    t();
    assert.equal(throttled, 1);

    assert.match(Utils.getUserColor("abc"), /hsl/);
    assert.match(Utils.getUserColor(""), /hsl/);

    Utils.playSound("modules/x/s.wav", 0.2);
    Utils.playUISound("getMessage");
    game.settings.get = (m, k) => {
        if (k === "enableSounds") return false;
        return null;
    };
    Utils.playUISound("getMessage");

    assert.equal(await Utils.copyToClipboard("hi"), true);
    navigator.clipboard.writeText = async () => { throw new Error("no"); };
    assert.equal(await Utils.copyToClipboard("hi"), false);

    Utils.exportMessages([], "x.txt");
    Utils.exportMessages([{ timestamp: Date.now(), senderName: "A", messageContent: "hi" }], "out.txt");

    assert.equal(Utils.formatFileSize(0), "0 B");
    assert.match(Utils.formatFileSize(2048), /KB/);
    restoreMocks();
});

test("hooks and main thin entry", async () => {
    const hooksOnce = [];
    const hooksOn = [];
    expandMocks({});
    Hooks.once = (name, fn) => hooksOnce.push({ name, fn });
    Hooks.on = (name, fn) => hooksOn.push({ name, fn });

    const { registerHooks } = await import("../src/hooks.js");
    assert.equal(registerHooks(globalThis), true);
    assert.ok(hooksOnce.some((h) => h.name === "init"));
    assert.ok(hooksOnce.some((h) => h.name === "ready"));
    assert.equal(registerHooks({}), false);

    // Scene controls must register synchronously before the lazy settings import settles.
    const initResult = hooksOnce.find((h) => h.name === "init").fn();
    assert.ok(hooksOn.some((h) => h.name === "getSceneControlButtons"));
    await initResult;
    // run ready path
    const ready = hooksOnce.find((h) => h.name === "ready");
    // Ready needs more complete settings/UIManager mocks - stub initialize
    const { LDChatzz } = await import("../src/LDChatzz.js");
    const origInit = LDChatzz.initialize;
    LDChatzz.initialize = async () => true;
    globalThis.ui = globalThis.ui || {};
    globalThis.ui.controls = { render: () => {} };
    // ReadyHook schedules a setTimeout; keep ui alive until it fires
    await ready.fn();
    await new Promise((r) => setTimeout(r, 1100));
    LDChatzz.initialize = origInit;

    const main = await import("../main.js");
    assert.equal(typeof main.registerHooks, "function");
    const Cls = await main.getLDChatzz();
    assert.equal(Cls.ID, "ld-chatzz");
    restoreMocks();
});

test("SettingsHook.onInit registers settings", async () => {
    const registered = [];
    expandMocks({});
    game.settings.register = (m, k, d) => registered.push({ key: k, config: d });
    const { SettingsHook } = await import("../src/hooks/SettingsHook.js");
    SettingsHook.onInit();
    assert.ok(registered.some((r) => r.key === "groupChats"));
    assert.ok(registered.some((r) => r.key === "enableSounds"));
    const volume = registered.find((r) => r.key === "notificationVolume");
    assert.equal(volume.config.default, 0.5);
    restoreMocks();
});

test("DataMessaging keys and private message add", async () => {
    expandMocks({
        settings: {
            "ld-chatzz.privateChats": {},
            "ld-chatzz.actorChats": {},
            "ld-chatzz.groupChats": {}
        }
    });
    game.settings.set = async (m, k, v) => v;
    const { DataStore } = await import("../src/data/DataStore.js");
    DataStore.privateChats.clear();
    DataStore.groupChats.clear();
    DataStore.actorChats.clear();
    const { DataMessaging } = await import("../src/data/DataMessaging.js");
    assert.equal(DataMessaging.getPrivateChatKey("b", "a"), "a-b");
    assert.equal(DataMessaging.getActorChatKey("x"), "actor:x");
    DataMessaging.addPrivateMessage("a", "b", { messageContent: "hello" });
    assert.equal(DataStore.privateChats.get("a-b").history.length, 1);
    DataMessaging.addPrivateMessage("a", "b", {});
    DataStore.groupChats.set("g1", { history: [] });
    DataMessaging.addGroupMessage("g1", { messageContent: "ghi" });
    assert.equal(DataStore.groupChats.get("g1").history.length, 1);
    DataMessaging.addGroupMessage("missing", { messageContent: "x" });
    restoreMocks();
});
