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

test("DataPersistence load/save happy paths and error paths", async () => {
    const { settingsStore } = installMocks({
        isGM: true,
        settings: {
            "ld-chatzz.groupChats": {
                g1: { id: "g1", name: "G", history: [{ id: "m1", senderId: "u", timestamp: 1, messageContent: "hi" }], messages: [{ id: "old" }] }
            },
            "ld-chatzz.privateChats": {
                "a-b": { kind: "user", users: ["a", "b"], history: [{ id: "p1" }] },
                "actor:x": { kind: "actor", actorId: "x", history: [{ id: "a1" }] }
            },
            "ld-chatzz.actorChats": {
                "actor:y": { history: [{ id: "y1" }] }
            },
            "ld-chatzz.unreadData": { counts: { c: 1 }, lastRead: { c: 2 }, lastActivity: { c: 3 } },
            "ld-chatzz.favorites": ["f1"],
            "ld-chatzz.mutedConversations": ["m1"],
            "ld-chatzz.pinnedMessages": { c1: ["m1"] },
            "ld-chatzz.sharedBackgrounds": { u1: "bg.png" },
            "ld-chatzz.gmSettings": { k: "v" }
        }
    });
    const { DataPersistence } = await import("../src/data/DataPersistence.js");
    const { DataStore } = await import("../src/data/DataStore.js");
    resetStores(DataStore);

    assert.deepEqual(DataPersistence.sanitizeHistory(null), []);

    await DataPersistence.loadGroupChats();
    assert.equal(DataStore.groupChats.get("g1").history[0].id, "m1");
    assert.equal(DataStore.groupChats.get("g1").messages, undefined);
    await DataPersistence.saveGroupChats();

    await DataPersistence.loadPrivateChats();
    assert.equal(DataStore.privateChats.has("actor:x"), false);
    assert.ok(DataStore.actorChats.has("actor:x"));
    await DataPersistence.savePrivateChats();

    await DataPersistence.loadActorChats();
    assert.equal(DataStore.actorChats.get("actor:y").kind, "actor");
    assert.equal(DataStore.actorChats.get("actor:y").actorId, "y");
    await DataPersistence.saveActorChats();

    await DataPersistence.loadUnreadData();
    await DataPersistence.saveUnreadData();
    await DataPersistence.loadFavorites();
    await DataPersistence.saveFavorites();
    await DataPersistence.loadMutedConversations();
    await DataPersistence.saveMutedConversations();
    await DataPersistence.loadPinnedMessages();
    await DataPersistence.savePinnedMessages();
    await DataPersistence.loadSharedBackgrounds();
    await DataPersistence.saveSharedBackgrounds();
    await DataPersistence.loadGMSettings();
    await DataPersistence.saveGMSettings();

    // non-GM skips
    game.user.isGM = false;
    await DataPersistence.saveSharedBackgrounds();
    await DataPersistence.loadGMSettings();
    await DataPersistence.saveGMSettings();
    game.user.isGM = true;

    // error paths: make settings throw
    const boom = () => {
        throw new Error("boom");
    };
    game.settings.get = boom;
    game.settings.set = async () => {
        throw new Error("boom");
    };
    await DataPersistence.loadGroupChats();
    await DataPersistence.saveGroupChats();
    await DataPersistence.loadPrivateChats();
    await DataPersistence.savePrivateChats();
    await DataPersistence.loadActorChats();
    await DataPersistence.saveActorChats();
    await DataPersistence.loadUnreadData();
    await DataPersistence.saveUnreadData();
    await DataPersistence.loadFavorites();
    await DataPersistence.saveFavorites();
    await DataPersistence.loadMutedConversations();
    await DataPersistence.saveMutedConversations();
    await DataPersistence.loadPinnedMessages();
    await DataPersistence.savePinnedMessages();
    await DataPersistence.loadSharedBackgrounds();
    await DataPersistence.saveSharedBackgrounds();
    await DataPersistence.loadGMSettings();
    await DataPersistence.saveGMSettings();

    restoreMocks();
});

