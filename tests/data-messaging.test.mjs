import assert from "node:assert/strict";
import test from "node:test";
import { installMocks, restoreMocks } from "./foundry-mock.mjs";

test("DataMessaging enriches content exactly once on add", async (t) => {
    installMocks({});
    const { DataMessaging } = await import("../src/data/DataMessaging.js");

    await t.test("addPrivateMessage enriches raw text into HTML", () => {
        DataMessaging.addPrivateMessage("user1", "user2", {
            id: "m1",
            senderId: "user1",
            messageContent: "line one\nline two"
        });
        const chat = DataMessaging._getPrivateOrActorChat(DataMessaging.getPrivateChatKey("user1", "user2"));
        assert.equal(chat.history[0].messageContent, "line one<br>line two");
    });

    await t.test("addPrivateMessage does not add duplicate ids", () => {
        const key = DataMessaging.getPrivateChatKey("user1", "user3");
        DataMessaging.addPrivateMessage("user1", "user3", { id: "dup", senderId: "user1", messageContent: "a" });
        DataMessaging.addPrivateMessage("user1", "user3", { id: "dup", senderId: "user1", messageContent: "b" });
        const chat = DataMessaging._getPrivateOrActorChat(key);
        assert.equal(chat.history.length, 1);
    });

    restoreMocks();
});

test("DataMessaging edit/delete/search/pin", async (t) => {
    installMocks({});
    const { DataMessaging } = await import("../src/data/DataMessaging.js");

    const key = DataMessaging.getPrivateChatKey("userA", "userB");
    DataMessaging.addPrivateMessage("userA", "userB", { id: "edit-msg-1", senderId: "userA", senderName: "Alice", messageContent: "hello world" });

    await t.test("editMessage updates content and marks edited", () => {
        const ok = DataMessaging.editMessage(key, "edit-msg-1", "goodbye", false);
        assert.equal(ok, true);
        const chat = DataMessaging._getPrivateOrActorChat(key);
        assert.equal(chat.history[0].messageContent, "goodbye");
        assert.equal(chat.history[0].edited, true);
    });

    await t.test("editMessage returns false for a missing message", () => {
        assert.equal(DataMessaging.editMessage(key, "nope", "x", false), false);
    });

    await t.test("searchMessages matches content and sender name", () => {
        const results = DataMessaging.searchMessages(key, "alice", false);
        assert.equal(results.length, 1);
    });

    await t.test("togglePin adds then removes a pin", () => {
        DataMessaging.togglePin(key, "edit-msg-1");
        assert.equal(DataMessaging.isPinned(key, "edit-msg-1"), true);
        DataMessaging.togglePin(key, "edit-msg-1");
        assert.equal(DataMessaging.isPinned(key, "edit-msg-1"), false);
    });

    await t.test("deleteMessage removes the message", () => {
        const ok = DataMessaging.deleteMessage(key, "edit-msg-1", false);
        assert.equal(ok, true);
        const chat = DataMessaging._getPrivateOrActorChat(key);
        assert.equal(chat.history.length, 0);
    });

    restoreMocks();
});

test("DataPersistence.sanitizeHistory", async (t) => {
    installMocks({});
    const { DataPersistence } = await import("../src/data/DataPersistence.js");

    await t.test("drops duplicate ids", () => {
        const result = DataPersistence.sanitizeHistory([
            { id: "a", senderId: "u1", timestamp: 1, messageContent: "hi" },
            { id: "a", senderId: "u1", timestamp: 1, messageContent: "hi" }
        ]);
        assert.equal(result.length, 1);
    });

    await t.test("drops duplicate signatures even with different ids", () => {
        const result = DataPersistence.sanitizeHistory([
            { id: "a", senderId: "u1", timestamp: 100, messageContent: "hi" },
            { id: "b", senderId: "u1", timestamp: 100, messageContent: "hi" }
        ]);
        assert.equal(result.length, 1);
    });

    await t.test("assigns an id to entries missing one", () => {
        const result = DataPersistence.sanitizeHistory([{ senderId: "u1", timestamp: 1, messageContent: "hi" }]);
        assert.ok(result[0].id);
    });

    await t.test("ignores non-object entries", () => {
        const result = DataPersistence.sanitizeHistory([null, "junk", { id: "ok" }]);
        assert.equal(result.length, 1);
    });

    restoreMocks();
});

test("ChatzzWindowData._enrichMessages does not double-process message content", async (t) => {
    installMocks({});
    const { ChatzzWindowData } = await import("../src/windows/ChatzzWindowData.js");

    await t.test("displayContent matches the already-enriched messageContent exactly", () => {
        const alreadyEnriched = 'Hello<br><a href="http://example.com" target="_blank" rel="noopener" class="chatzz-link">http://example.com</a>';
        const [msg] = ChatzzWindowData._enrichMessages(
            [{ id: "m1", senderId: "user1", messageContent: alreadyEnriched }],
            "conv1",
            null
        );
        assert.equal(msg.displayContent, alreadyEnriched);
        assert.doesNotMatch(msg.displayContent, /&lt;br&gt;/);
        assert.doesNotMatch(msg.displayContent, /&lt;a href/);
    });

    restoreMocks();
});
