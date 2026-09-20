import assert from "node:assert/strict";
import test from "node:test";
import { installMocks, restoreMocks, makeMockActor } from "./foundry-mock.mjs";

test("ActorContacts ownership and friendship visibility", async (t) => {
    const actor = makeMockActor({
        id: "a1",
        name: "Hero",
        ownership: { user2: 3, gm1: 0 }
    });
    const noOwnerActor = makeMockActor({ id: "a2", name: "Nobody's", ownership: {} });

    installMocks({
        users: [{ id: "gm1", isGM: true, active: true }, { id: "user2", isGM: false, active: true }],
        actors: [actor, noOwnerActor]
    });
    const { ActorContacts } = await import("../src/data/ActorContacts.js");

    await t.test("getExplicitOwnerUserIds returns only OWNER-level users", () => {
        assert.deepEqual(ActorContacts.getExplicitOwnerUserIds(actor), ["user2"]);
    });

    await t.test("isVisibleToUser is true for an owner", () => {
        assert.equal(ActorContacts.isVisibleToUser(actor, { id: "user2" }), true);
    });

    await t.test("isVisibleToUser is false for a non-owner, non-friend", () => {
        assert.equal(ActorContacts.isVisibleToUser(actor, { id: "user3" }), false);
    });

    await t.test("accepting a friend request makes the actor visible to that user", async () => {
        await ActorContacts.acceptFriendRequest("a1", "user3");
        assert.equal(ActorContacts.isVisibleToUser(actor, { id: "user3" }), true);
    });

    await t.test("getRecipientUserIds excludes the current user and falls back to active GMs", () => {
        const recipients = ActorContacts.getRecipientUserIds(noOwnerActor);
        assert.deepEqual(recipients, ["gm1"]);
    });

    restoreMocks();
});
