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

test("DataMessaging remaining branches and DataManager facade", async () => {
    const actor = makeMockActor({ id: "a1", name: "Hero", ownership: { user1: 3 }, img: "h.svg" });
    installMocks({
        isGM: true,
        actors: [actor],
        users: [
            { id: "user1", name: "Tester", active: true, isGM: true },
            { id: "u2", name: "Alice", active: true, isGM: false }
        ],
        settings: {
            "ld-chatzz.privateChats": {},
            "ld-chatzz.actorChats": {},
            "ld-chatzz.groupChats": {},
            "ld-chatzz.enableSounds": false
        }
    });
    const { DataStore } = await import("../src/data/DataStore.js");
    const { DataMessaging } = await import("../src/data/DataMessaging.js");
    const { DataManager } = await import("../src/DataManager.js");
    const { DEFAULTS } = await import("../src/Constants.js");
    resetStores(DataStore);

    // max history truncation for private
    const max = DEFAULTS.maxMessageHistory;
    for (let i = 0; i < max + 2; i++) {
        DataMessaging.addPrivateMessage("user1", "u2", { id: `p${i}`, messageContent: `m${i}` });
    }
    const pkey = DataMessaging.getPrivateChatKey("user1", "u2");
    assert.ok(DataStore.privateChats.get(pkey).history.length <= max);

    DataMessaging.addActorMessage("a1", {});
    DataMessaging.addActorMessage("a1", { id: "am1", messageContent: "hello" });
    // no actor object
    game.actors.get = () => null;
    DataMessaging.addActorMessage("missing", { id: "am2", messageContent: "x", actorName: "N", actorImg: "i" });
    // history truncate actor
    game.actors.get = (id) => (id === "a1" ? actor : null);
    for (let i = 0; i < max + 1; i++) {
        DataMessaging.addActorMessage("a1", { id: `ax${i}`, messageContent: "x" });
    }

    DataStore.groupChats.set("g1", { id: "g1", history: [] });
    for (let i = 0; i < max + 1; i++) {
        DataMessaging.addGroupMessage("g1", { id: `g${i}`, messageContent: "g" });
    }

    // edit/delete group and actor
    DataMessaging.addGroupMessage("g1", { id: "editg", messageContent: "old" });
    assert.equal(DataMessaging.editMessage("g1", "editg", "new", true), true);
    assert.equal(DataMessaging.editMessage("nope", "x", "y", false), false);
    const akey = DataMessaging.getActorChatKey("a1");
    DataMessaging.addActorMessage("a1", { id: "edita", messageContent: "a" });
    assert.equal(DataMessaging.editMessage(akey, "edita", "b", false), true);
    assert.equal(DataMessaging.deleteMessage(akey, "edita", false), true);
    assert.equal(DataMessaging.deleteMessage("g1", "editg", true), true);
    assert.equal(DataMessaging.deleteMessage("g1", "missing", true), false);
    assert.equal(DataMessaging.deleteMessage("no", "x", false), false);

    assert.deepEqual(DataMessaging.searchMessages("no", "q", false), []);
    assert.ok(Array.isArray(DataMessaging.searchMessages(pkey, "", false)));
    DataMessaging.clearConversation("nope", false);
    DataMessaging.clearConversation(pkey, false);
    DataStore.groupChats.set("g2", { history: [1] });
    DataMessaging.clearConversation("g2", true);
    DataMessaging.clearConversation(akey, false);

    // DataManager facade
    assert.ok(DataManager.privateChats);
    assert.ok(DataManager.actorChats);
    assert.ok(DataManager.groupChats);
    assert.ok(DataManager.unreadCounts);
    assert.ok(DataManager.lastActivity);
    assert.ok(DataManager.favorites);
    assert.ok(DataManager.mutedConversations);
    assert.ok(DataManager.pinnedMessages);
    assert.ok(DataManager.sharedBackgrounds);
    assert.ok(Array.isArray(DataManager.interceptedMessages));

    // loadAll
    game.settings.get = (m, k) => {
        const defaults = {
            groupChats: {},
            privateChats: {},
            actorChats: {},
            unreadData: { counts: {}, lastRead: {}, lastActivity: {} },
            favorites: [],
            mutedConversations: [],
            pinnedMessages: {},
            sharedBackgrounds: {},
            gmSettings: {},
            playerSettings: {},
            personalBackground: "",
            chatBackgrounds: {},
            gmBackgrounds: { global: null, perUser: {}, perChat: {} }
        };
        return defaults[k];
    };
    game.settings.set = async () => {};
    await DataManager.loadAll();
    await DataManager.saveGroupChats();
    await DataManager.savePrivateChats();
    await DataManager.saveActorChats();
    await DataManager.saveUnreadData();
    await DataManager.saveFavorites();

    assert.equal(DataManager.getPrivateChatKey("b", "a"), "a-b");
    assert.equal(DataManager.getActorChatKey("z"), "actor:z");
    DataManager.addPrivateMessage("user1", "u2", { id: "dm1", messageContent: "hi" });
    DataManager.addActorMessage("a1", { id: "dm2", messageContent: "hi" });
    DataStore.groupChats.set("g3", { id: "g3", members: ["user1"], history: [] });
    DataManager.addGroupMessage("g3", { id: "dm3", messageContent: "hi" });
    DataManager.editMessage("g3", "dm3", "x", true);
    DataManager.deleteMessage("g3", "dm3", true);
    DataManager.clearConversation("g3", true);
    DataManager.searchMessages("g3", "x", true);
    DataManager.togglePin("g3", "m");
    DataManager.isPinned("g3", "m");
    DataManager.markAsRead("g3");
    DataManager.incrementUnread("g3");
    DataManager.getUnreadCount("g3");
    DataManager.getTotalUnread();
    DataManager.setTyping("g3", "u2", true);
    DataManager.getTypingUsers("g3");
    DataManager.setReplyTo("r");
    DataManager.getReplyTo();
    DataManager.clearReplyTo();
    DataManager.updateActivity("g3");
    DataManager.toggleFavorite("g3");
    DataManager.isFavorite("g3");
    DataManager.toggleMuted("g3");
    DataManager.isMuted("g3");
    DataManager.getPlayerSetting("k", 1);
    DataManager.setPlayerSetting("k", 2);
    DataManager.getGMSetting("k", 1);
    DataManager.setGMSetting("k", 2);
    const g = DataManager.createGroup("N", ["user1"]);
    DataManager.updateGroup(g.id, { name: "N2" });
    DataManager.getUserConversations();
    DataManager.getVisibleActors();
    DataManager.getActorRecipients(actor);
    await DataManager.acceptActorFriendRequest("a1", "u2");
    DataManager.exportConversation(g.id, true);
    await DataManager.processImage("http://x");
    DataManager.validateImage({ size: 1, type: "image/png" });
    DataManager.addReaction(g.id, "m", "x", "user1", true);
    DataManager.getEffectiveBackground(g.id);
    DataManager.setSharedBackground("u2", "p");
    DataManager.addInterceptedMessage({ senderId: "u2", messageData: { messageContent: "x" } });
    // overflow intercepted
    for (let i = 0; i < 101; i++) {
        DataManager.addInterceptedMessage({ senderId: "u2", messageData: { messageContent: String(i) } });
    }
    assert.ok(DataManager.interceptedMessages.length <= 100);
    DataManager.interceptedMessages = [];
    assert.equal(DataManager.interceptedMessages.length, 0);
    DataManager.deleteGroup(g.id);

    restoreMocks();
});
