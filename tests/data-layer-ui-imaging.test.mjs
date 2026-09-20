import assert from "node:assert/strict";
import test from "node:test";
import { installMocks, restoreMocks, makeMockActor } from "./foundry-mock.mjs";

function resetStores(DataStore) {
    DataStore.privateChats.clear();
    DataStore.actorChats.clear();
    DataStore.groupChats.clear();
    DataStore.unreadCounts.clear();
    DataStore.lastRead.clear();
    DataStore.lastActivity.clear();
    DataStore.favorites.clear();
    DataStore.mutedConversations.clear();
    DataStore.pinnedMessages.clear();
    DataStore.sharedBackgrounds.clear();
    DataStore.typingUsers.clear();
    DataStore.interceptedMessages = [];
    DataStore._playerSettings = new Map();
    DataStore._gmSettings = new Map();
    DataStore._personalBackground = null;
    DataStore._chatBackgrounds = new Map();
    DataStore.gmBackgrounds = { global: null, perUser: new Map(), perChat: new Map() };
    DataStore._replyToMessage = null;
}

test("DataUserUI, DataUtility, DataImaging full coverage", async () => {
    const actor = makeMockActor({
        id: "a1",
        name: "Hero",
        ownership: { user1: 3 },
        img: "icons/hero.svg"
    });
    actor.getFlag = () => [];
    installMocks({
        isGM: true,
        users: [
            { id: "user1", name: "Tester", active: true, isGM: true, avatar: "icons/svg/mystery-man.svg" },
            { id: "u2", name: "Alice", active: true, isGM: false, avatar: "icons/a.svg" }
        ],
        actors: [actor],
        settings: {
            "ld-chatzz.enableSounds": true,
            "ld-chatzz.notificationVolume": 0.5,
            "ld-chatzz.gmOverrideEnabled": false,
            "ld-chatzz.playerSettings": { theme: "dark" },
            "ld-chatzz.personalBackground": "bg-personal.png",
            "ld-chatzz.chatBackgrounds": { c1: "bg-chat.png" },
            "ld-chatzz.gmBackgrounds": {
                global: "bg-global.png",
                perUser: { user1: "bg-user.png" },
                perChat: { g1: "bg-g1.png" }
            },
            "ld-chatzz.sfxGetMessage": ""
        }
    });
    const { DataStore } = await import("../src/data/DataStore.js");
    const { DataUserUI } = await import("../src/data/DataUserUI.js");
    const { DataUtility } = await import("../src/data/DataUtility.js");
    const { DataImaging } = await import("../src/data/DataImaging.js");
    const { DataPersistence } = await import("../src/data/DataPersistence.js");
    resetStores(DataStore);

    const settingsMap = new Map([
        ["ld-chatzz.enableSounds", true],
        ["ld-chatzz.notificationVolume", 0.5],
        ["ld-chatzz.gmOverrideEnabled", false],
        ["ld-chatzz.playerSettings", { theme: "dark" }],
        ["ld-chatzz.personalBackground", "bg-personal.png"],
        ["ld-chatzz.chatBackgrounds", { c1: "bg-chat.png" }],
        ["ld-chatzz.gmBackgrounds", {
            global: "bg-global.png",
            perUser: { user1: "bg-user.png" },
            perChat: { g1: "bg-g1.png" }
        }],
        ["ld-chatzz.sfxGetMessage", ""]
    ]);
    game.settings.get = (m, k) => settingsMap.get(`${m}.${k}`);
    game.settings.set = async (m, k, v) => {
        settingsMap.set(`${m}.${k}`, v);
        return v;
    };

    DataUserUI.markAsRead("c1");
    assert.equal(DataStore.unreadCounts.get("c1"), 0);

    DataStore.mutedConversations.add("muted");
    DataUserUI.incrementUnread("muted");
    assert.equal(DataStore.unreadCounts.has("muted"), false);
    DataUserUI.incrementUnread("c2");
    assert.equal(DataStore.unreadCounts.get("c2"), 1);
    settingsMap.set("ld-chatzz.enableSounds", false);
    DataUserUI.incrementUnread("c2");
    settingsMap.set("ld-chatzz.enableSounds", true);

    assert.equal(DataUserUI.setTyping("conv", "u2", true), true);
    assert.equal(DataUserUI.setTyping("conv", "u2", true), false);
    assert.equal(DataUserUI.setTyping("conv", "u2", false), true);
    assert.equal(DataUserUI.setTyping("conv", "u2", false), false);
    DataUserUI.setTyping("conv", "u2", true);
    DataUserUI.setTyping("conv", "user1", true);
    DataUserUI.setTyping("conv", "ghost", true);
    // expired typing
    DataStore.typingUsers.get("conv").set("old", Date.now() - 999999);
    const names = DataUserUI.getTypingUsers("conv");
    assert.ok(Array.isArray(names));
    assert.deepEqual(DataUserUI.getTypingUsers("none"), []);

    DataUserUI.toggleFavorite("fav1");
    assert.ok(DataStore.favorites.has("fav1"));
    DataUserUI.toggleFavorite("fav1");
    assert.ok(!DataStore.favorites.has("fav1"));
    DataUserUI.toggleMuted("mut1");
    DataUserUI.toggleMuted("mut1");

    await DataUserUI.loadPlayerSettings();
    assert.equal(DataUserUI.getPlayerSetting("theme"), "dark");
    assert.equal(DataUserUI.getPlayerSetting("missing", "d"), "d");
    DataUserUI.setPlayerSetting("x", 1);
    await DataUserUI.savePlayerSettings();
    DataUserUI.setGMSetting("g", 2);
    assert.equal(DataUserUI.getGMSetting("g"), 2);
    assert.equal(DataUserUI.getGMSetting("no", 9), 9);

    DataUserUI.setReplyTo("m1");
    assert.equal(DataUserUI.getReplyTo(), "m1");
    DataUserUI.clearReplyTo();
    assert.equal(DataUserUI.getReplyTo(), null);
    DataStore.unreadCounts.clear();
    DataStore.unreadCounts.set("a", 2);
    DataStore.unreadCounts.set("b", 3);
    assert.equal(DataUserUI.getTotalUnread(), 5);

    game.user.isGM = true;
    await DataUserUI.loadBackgroundSettings();
    await DataUserUI.saveBackgroundSettings();
    game.user.isGM = false;
    await DataUserUI.loadBackgroundSettings();
    await DataUserUI.saveBackgroundSettings();
    game.user.isGM = true;

    // error paths
    const goodGet = game.settings.get;
    const goodSet = game.settings.set;
    game.settings.get = () => {
        throw new Error("x");
    };
    game.settings.set = async () => {
        throw new Error("x");
    };
    await DataUserUI.loadPlayerSettings();
    await DataUserUI.savePlayerSettings();
    await DataUserUI.loadBackgroundSettings();
    await DataUserUI.saveBackgroundSettings();
    game.settings.get = goodGet;
    game.settings.set = goodSet;

    const group = DataUtility.createGroup("Party", ["user1", "u2", "u2"]);
    assert.equal(group.name, "Party");
    assert.equal(DataUtility.updateGroup(group.id, { name: "Party2" }), true);
    assert.equal(DataUtility.updateGroup("missing", {}), false);
    assert.equal(DataUtility.exportConversation("missing", true), "");
    DataStore.groupChats.get(group.id).history = [
        { timestamp: 2, senderName: "A", messageContent: "<b>hi</b>", imageUrl: "i.png" },
        { timestamp: 1, senderName: "B", messageContent: "earlier" },
        { messageContent: "notime" }
    ];
    assert.match(DataUtility.exportConversation(group.id, true), /Group: Party2/);
    assert.match(DataUtility.exportConversation(group.id, true), /\[Image:/);

    DataStore.privateChats.set("user1-u2", {
        users: ["user1", "u2"],
        history: [{ messageContent: "p", timestamp: 1, senderName: "A" }]
    });
    assert.match(DataUtility.exportConversation("user1-u2", false), /Private Chat/);

    DataStore.actorChats.set("actor:a1", {
        kind: "actor",
        actorId: "a1",
        actorName: "Hero",
        history: [{ messageContent: "a", timestamp: 1 }]
    });
    assert.match(DataUtility.exportConversation("actor:a1", false), /Character:/);
    // actor export without actorName, resolve from game.actors
    DataStore.actorChats.set("actor:a1", {
        kind: "actor",
        actorId: "a1",
        history: [
            { timestamp: 1, senderName: "A", messageContent: "x", imageUrl: "i.png" },
            { messageContent: "no-ts" }
        ]
    });
    assert.match(DataUtility.exportConversation("actor:a1", false), /Character:/);
    // actor key without actor record
    DataStore.actorChats.set("actor:gone", {
        kind: "actor",
        history: [{ messageContent: "z" }]
    });
    assert.match(DataUtility.exportConversation("actor:gone", false), /Character:/);

    DataStore.unreadCounts.set("user1-u2", 1);
    DataStore.favorites.add(group.id);
    DataStore.lastActivity.set(group.id, Date.now());
    const convs = DataUtility.getUserConversations();
    assert.ok(convs.some((c) => c.type === "group"));
    assert.ok(convs.some((c) => c.type === "private"));
    assert.ok(convs.some((c) => c.type === "actor"));
    assert.equal(DataUtility.deleteGroup(group.id), true);

    // imaging
    assert.equal(await DataImaging.processImage("http://x/y.png"), "http://x/y.png");
    assert.equal(await DataImaging.processImage("data:image/png;base64,xx"), "data:image/png;base64,xx");
    assert.equal(await DataImaging.processImage("relative.png"), null);
    assert.equal(await DataImaging.processImage(123), null);
    assert.equal(await DataImaging.processImage(null), null);

    // File path via FileReader (use real File for instanceof)
    const realFile = new File(["x"], "t.png", { type: "image/png" });
    const origFR = globalThis.FileReader;
    globalThis.FileReader = class {
        readAsDataURL() {
            this.result = "data:image/png;base64,fake";
            queueMicrotask(() => this.onload && this.onload());
        }
    };
    const processed = await DataImaging.processImage(realFile);
    assert.equal(processed, "data:image/png;base64,fake");
    // FileReader error path
    globalThis.FileReader = class {
        readAsDataURL() {
            queueMicrotask(() => this.onerror && this.onerror(new Error("read fail")));
        }
    };
    await assert.rejects(() => DataImaging.processImage(new File(["y"], "e.png", { type: "image/png" })));
    globalThis.FileReader = origFR;

    // catch path: string with throwing startsWith (typeof is not string for object)
    // force catch by making instanceof File throw via proxy
    const evil = new Proxy({}, {
        get(target, prop) {
            if (prop === Symbol.toStringTag) return "File";
            throw new Error("boom");
        },
        getPrototypeOf() {
            throw new Error("boom");
        }
    });
    // typeof evil is object; instanceof may throw -> catch
    assert.equal(await DataImaging.processImage(evil), null);

    assert.equal(await DataImaging.processImage({}), null);

    assert.equal(DataImaging.validateImage(null).valid, false);
    assert.equal(DataImaging.validateImage({ size: 9e9, type: "image/png" }).valid, false);
    assert.equal(DataImaging.validateImage({ size: 10, type: "text/plain" }).valid, false);
    assert.equal(DataImaging.validateImage({ size: 10, type: "image/png" }).valid, true);

    DataStore.groupChats.set("g1", {
        history: [{ id: "m1", reactions: {} }]
    });
    assert.equal(DataImaging.addReaction("g1", "m1", "👍", "user1", true), true);
    assert.equal(DataImaging.addReaction("g1", "m1", "👍", "user1", true), true); // toggle off
    assert.equal(DataImaging.addReaction("missing", "m1", "👍", "user1", true), false);
    assert.equal(DataImaging.addReaction("g1", "no", "👍", "user1", true), false);
    DataStore.privateChats.set("user1-u2", { history: [{ id: "pm1" }] });
    assert.equal(DataImaging.addReaction("user1-u2", "pm1", "❤️", "u2", false), true);
    assert.equal(DataImaging.addReaction("user1-u2", "pm1", "❤️", "user1", false), true);

    DataStore.gmBackgrounds.perChat.set("k1", "pc.png");
    assert.equal(DataImaging.getEffectiveBackground("k1"), "pc.png");
    DataStore.gmBackgrounds.perChat.clear();
    DataStore._chatBackgrounds.set("k1", "cb.png");
    assert.equal(DataImaging.getEffectiveBackground("k1"), "cb.png");
    DataStore._chatBackgrounds.clear();
    DataStore.gmBackgrounds.perUser.set("user1", "pu.png");
    assert.equal(DataImaging.getEffectiveBackground("k1"), "pu.png");
    DataStore.gmBackgrounds.perUser.clear();
    DataStore._personalBackground = "pers.png";
    assert.equal(DataImaging.getEffectiveBackground("k1"), "pers.png");
    DataStore._personalBackground = null;
    DataStore.gmBackgrounds.global = "glob.png";
    assert.equal(DataImaging.getEffectiveBackground("k1"), "glob.png");

    game.user.isGM = false;
    DataImaging.setSharedBackground("u2", "x.png");
    game.user.isGM = true;
    DataImaging.setSharedBackground("u2", "x.png");
    assert.equal(DataStore.sharedBackgrounds.get("u2"), "x.png");
    DataImaging.setSharedBackground("u2", null);
    assert.equal(DataStore.sharedBackgrounds.has("u2"), false);

    restoreMocks();
});
