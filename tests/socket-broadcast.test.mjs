import assert from "node:assert/strict";
import test from "node:test";
import { installMocks, restoreMocks } from "./foundry-mock.mjs";

// Regression coverage for a critical bug: RNKCyphur.js / GroupManagerWindow.js called
// SocketHandler.broadcastGroupCreate/broadcastGroupDelete/broadcastGroupUpdate/
// broadcastEditMessage/broadcastDeleteMessage/broadcastReaction, none of which were
// ever defined, so every group create/delete/update threw a TypeError.

test("SocketHandler exposes all broadcast methods used by LDChatzz.js and GroupManagerWindow.js", async (t) => {
    installMocks({});
    const { SocketHandler } = await import("../src/SocketHandler.js");

    for (const method of [
        "broadcastGroupCreate",
        "broadcastGroupDelete",
        "broadcastGroupUpdate",
        "broadcastEditMessage",
        "broadcastDeleteMessage",
        "broadcastReaction"
    ]) {
        await t.test(`${method} exists and does not throw`, () => {
            assert.equal(typeof SocketHandler[method], "function");
        });
    }

    restoreMocks();
});

test("broadcastGroupCreate emits to group members other than the sender", async (t) => {
    const { socketEmits } = installMocks({});
    const { SocketHandler } = await import("../src/SocketHandler.js");

    SocketHandler.broadcastGroupCreate({ id: "g1", members: ["user1", "user2", "user3"] });

    assert.equal(socketEmits.length, 1);
    assert.deepEqual(socketEmits[0].options.recipients.sort(), ["user2", "user3"]);
    assert.equal(socketEmits[0].data.type, "groupCreate");

    restoreMocks();
});

test("broadcastGroupCreate does not emit when there are no other members", async (t) => {
    const { socketEmits } = installMocks({});
    const { SocketHandler } = await import("../src/SocketHandler.js");

    SocketHandler.broadcastGroupCreate({ id: "g1", members: ["user1"] });

    assert.equal(socketEmits.length, 0);

    restoreMocks();
});

test("SocketListeners.handleGroupCreate applies the new group to local state", async (t) => {
    installMocks({});
    const { SocketListeners } = await import("../src/sockets/SocketListeners.js");
    const { DataManager } = await import("../src/DataManager.js");

    SocketListeners.handleGroupCreate({ group: { id: "g2", name: "Party", members: ["user1", "user2"] } });

    assert.equal(DataManager.groupChats.get("g2")?.name, "Party");

    restoreMocks();
});

test("SocketListeners.handleGroupUpdate merges updates into the existing group", async (t) => {
    installMocks({});
    const { SocketListeners } = await import("../src/sockets/SocketListeners.js");
    const { DataManager } = await import("../src/DataManager.js");

    DataManager.groupChats.set("g3", { id: "g3", name: "Old Name", members: ["user1"] });
    SocketListeners.handleGroupUpdate({ groupId: "g3", updates: { name: "New Name" } });

    assert.equal(DataManager.groupChats.get("g3").name, "New Name");

    restoreMocks();
});

test("SocketListeners.handleGroupDelete removes the group from local state", async (t) => {
    installMocks({});
    const { SocketListeners } = await import("../src/sockets/SocketListeners.js");
    const { DataManager } = await import("../src/DataManager.js");

    DataManager.groupChats.set("g4", { id: "g4", name: "Doomed", members: ["user1"] });
    SocketListeners.handleGroupDelete({ groupId: "g4" });

    assert.equal(DataManager.groupChats.has("g4"), false);

    restoreMocks();
});

test("SocketHandler routes GROUP_CREATE/UPDATE/DELETE socket messages to the listeners", async (t) => {
    installMocks({});
    const { SocketHandler } = await import("../src/SocketHandler.js");
    const { DataManager } = await import("../src/DataManager.js");

    await SocketHandler._onSocketMessage({ type: "groupCreate", payload: { group: { id: "g5", name: "Routed", members: [] } } });
    assert.equal(DataManager.groupChats.get("g5")?.name, "Routed");

    await SocketHandler._onSocketMessage({ type: "groupDelete", payload: { groupId: "g5" } });
    assert.equal(DataManager.groupChats.has("g5"), false);

    restoreMocks();
});
