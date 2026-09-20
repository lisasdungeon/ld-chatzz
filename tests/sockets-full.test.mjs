import assert from "node:assert/strict";
import test from "node:test";
import { installMocks, restoreMocks, makeMockActor, MockDialog } from "./foundry-mock.mjs";

test("SocketEmitters all methods", async () => {
    const actor = makeMockActor({
        id: "a1",
        name: "Hero",
        ownership: { u2: 3 },
        img: "h.svg"
    });
    actor.getFlag = () => ["u3"];
    const { socketEmits } = installMocks({
        isGM: false,
        users: [
            { id: "user1", name: "Tester", active: true, isGM: false },
            { id: "u2", name: "Owner", active: true, isGM: false },
            { id: "u3", name: "Friend", active: true, isGM: false },
            { id: "gm1", name: "GM", active: true, isGM: true }
        ],
        actors: [actor]
    });
    const { DataManager } = await import("../src/DataManager.js");
    const { SocketEmitters } = await import("../src/sockets/SocketEmitters.js");
    const { SocketHandler } = await import("../src/SocketHandler.js");

    DataManager.groupChats.set("g1", { id: "g1", members: ["user1", "u2", "u3"], history: [] });

    SocketEmitters.emit("custom", { x: 1 }, { recipients: ["u2"] });
    SocketEmitters.sendPrivateMessage("u2", { id: "m1", messageContent: "hi" });
    SocketEmitters.sendActorMessage("a1", { id: "m2", messageContent: "hi" });
    SocketEmitters.sendActorMessage("missing", { id: "m3" });
    // actor with no recipients
    const bare = makeMockActor({ id: "a2", name: "Bare", ownership: {} });
    bare.getFlag = () => [];
    game.actors.get = (id) => (id === "a1" ? actor : id === "a2" ? bare : null);
    // getRecipientUserIds falls back to GMs - still has recipients
    SocketEmitters.sendActorMessage("a2", { id: "m4" });

    SocketEmitters.sendGroupMessage("g1", { id: "gm1", messageContent: "g" });
    SocketEmitters.sendGroupMessage("missing", { id: "x" });

    SocketEmitters.sendTypingIndicator("g1", true, true);
    SocketEmitters.sendTypingIndicator("actor:a1", true, false);
    SocketEmitters.sendTypingIndicator("user1-u2", true, false);
    SocketEmitters.sendTypingIndicator("user1-only", true, false); // no recipients

    SocketEmitters.sendFriendRequest({ a: 1 }, ["u2"]);
    SocketEmitters.sendFriendResponse({ a: 1 }, ["u2"]);

    SocketEmitters.broadcastGroupCreate({ id: "g2", members: ["user1", "u2"] });
    SocketEmitters.broadcastGroupCreate({ id: "g3", members: ["user1"] });
    SocketEmitters.broadcastGroupUpdate("g1", { name: "N" });
    SocketEmitters.broadcastGroupUpdate("missing", { members: ["u2"] });
    SocketEmitters.broadcastGroupDelete("g1", ["user1", "u2"]);
    SocketEmitters.broadcastGroupDelete("g1", ["user1"]);
    SocketEmitters.broadcastEditMessage("user1-u2", "m1", "x", false);
    SocketEmitters.broadcastEditMessage("g1", "m1", "x", true);
    SocketEmitters.broadcastEditMessage("actor:a1", "m1", "x", false);
    SocketEmitters.broadcastDeleteMessage("user1-u2", "m1", false);
    SocketEmitters.broadcastReaction("user1-u2", "m1", "👍", false);

    // SocketHandler proxies + initialize + all routes
    SocketHandler.initialize();
    SocketHandler.emit("t", {});
    SocketHandler.sendPrivateMessage("u2", { id: "x" });
    SocketHandler.sendActorMessage("a1", { id: "x" });
    SocketHandler.sendGroupMessage("g1", { id: "x" });
    SocketHandler.sendTypingIndicator("g1", true, true);
    SocketHandler.sendFriendRequest({}, ["u2"]);
    SocketHandler.sendFriendResponse({}, ["u2"]);
    SocketHandler.broadcastGroupCreate({ members: ["user1", "u2"] });
    SocketHandler.broadcastGroupUpdate("g1", { name: "X" });
    SocketHandler.broadcastGroupDelete("g1", ["u2"]);
    SocketHandler.broadcastEditMessage("g1", "m", "c", true);
    SocketHandler.broadcastDeleteMessage("g1", "m", true);
    SocketHandler.broadcastReaction("g1", "m", "👍", true);

    await SocketHandler._onSocketMessage({ type: "privateMessage", payload: { recipientId: "user1", message: { id: "pm", senderId: "u2", messageContent: "hi" } } });
    await SocketHandler._onSocketMessage({ type: "groupMessage", payload: { groupId: "g1", message: { id: "gm", senderId: "u2", messageContent: "hi" } } });
    await SocketHandler._onSocketMessage({ type: "typing", payload: { conversationId: "user1-u2", userId: "u2", isTyping: true, isGroup: false } });
    await SocketHandler._onSocketMessage({ type: "friendRequest", payload: { targetActorId: "a1" } });
    await SocketHandler._onSocketMessage({ type: "friendResponse", payload: { requesterUserId: "user1", accepted: true } });
    await SocketHandler._onSocketMessage({ type: "editMessage", payload: { conversationId: "g1", messageId: "gm", newContent: "n", isGroup: true } });
    await SocketHandler._onSocketMessage({ type: "deleteMessage", payload: { conversationId: "g1", messageId: "gm", isGroup: true } });
    await SocketHandler._onSocketMessage({ type: "addReaction", payload: { conversationId: "g1", messageId: "gm", emoji: "👍", userId: "u2", isGroup: true } });
    await SocketHandler._onSocketMessage({ type: "groupCreate", payload: { group: { id: "gx", members: [] } } });
    await SocketHandler._onSocketMessage({ type: "groupUpdate", payload: { groupId: "gx", updates: { name: "X" } } });
    await SocketHandler._onSocketMessage({ type: "groupDelete", payload: { groupId: "gx" } });
    await SocketHandler._onSocketMessage({ type: "unknown", payload: {} });
    await SocketHandler._onSocketMessage(null);
    await SocketHandler._onSocketMessage({});

    assert.ok(socketEmits.length > 0);
    await new Promise((resolve) => setTimeout(resolve, 0));
    restoreMocks();
});

test("SocketListeners private/group/friend/edit paths", async () => {
    const actor = makeMockActor({
        id: "a1",
        name: "Hero",
        ownership: { user1: 3 },
        img: "h.svg"
    });
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
    const { DataManager } = await import("../src/DataManager.js");
    const { SocketListeners } = await import("../src/sockets/SocketListeners.js");
    const { UIManager } = await import("../src/UIManager.js");

    // stub UIManager heavy methods
    UIManager.openChatWindowForNewMessage = () => {};
    UIManager.updatePlayerHub = () => {};
    UIManager.updateGMMonitor = () => {};
    UIManager.updateTypingIndicator = () => {};
    UIManager.updateChatWindow = () => {};
    UIManager.refreshConversationWindow = () => {};
    UIManager.closeChatWindow = () => {};
    UIManager.updateGroupManager = () => {};

    // actor message normal
    await SocketListeners.handlePrivateMessage({
        recipientId: "actor:a1",
        targetType: "actor",
        targetId: "a1",
        message: { id: "m1", senderId: "u2", messageContent: "hi" }
    });

    // actor missing id
    await SocketListeners.handlePrivateMessage({
        targetType: "actor",
        recipientId: "",
        message: { id: "m0", senderId: "u2" }
    });

    // actor not found
    await SocketListeners.handlePrivateMessage({
        targetType: "actor",
        targetId: "gone",
        message: { id: "m0", senderId: "u2" }
    });

    // actor not allowed
    game.user.isGM = false;
    game.user.id = "stranger";
    const locked = makeMockActor({ id: "a2", name: "Lock", ownership: { other: 3 } });
    locked.getFlag = () => [];
    game.actors.get = (id) => (id === "a1" ? actor : id === "a2" ? locked : null);
    await SocketListeners.handlePrivateMessage({
        targetType: "actor",
        targetId: "a2",
        message: { id: "m2", senderId: "u2" }
    });

    // actor monitoring as GM
    game.user.isGM = true;
    game.user.id = "user1";
    await SocketListeners.handlePrivateMessage({
        targetType: "actor",
        targetId: "a1",
        isMonitoring: true,
        originalSenderId: "u2",
        message: { id: "m3", senderId: "u2", messageContent: "mon" }
    });

    // private wrong recipient
    await SocketListeners.handlePrivateMessage({
        recipientId: "other",
        message: { id: "m4", senderId: "u2" }
    });

    // private monitoring
    await SocketListeners.handlePrivateMessage({
        recipientId: "u2",
        isMonitoring: true,
        originalSenderId: "u2",
        originalRecipientId: "user1",
        message: { id: "m5", senderId: "u2", messageContent: "x" }
    });

    // private normal
    await SocketListeners.handlePrivateMessage({
        recipientId: "user1",
        message: { id: "m6", senderId: "u2", messageContent: "hello" }
    });

    // relay path
    await SocketListeners.handlePrivateMessage({
        recipientId: "user1",
        isRelay: true,
        originalSenderId: "u2",
        message: { id: "m7", senderId: "relay", messageContent: "r" }
    });

    // group monitoring
    DataManager.groupChats.set("g1", { id: "g1", name: "Party", members: ["user1", "u2"], history: [] });
    await SocketListeners.handleGroupMessage({
        groupId: "g1",
        isMonitoring: true,
        message: { id: "g1m", senderId: "u2", messageContent: "g" }
    });

    // group member
    await SocketListeners.handleGroupMessage({
        groupId: "g1",
        message: { id: "g2m", senderId: "u2", messageContent: "g" }
    });

    // group non-member
    await SocketListeners.handleGroupMessage({
        groupId: "gmissing",
        message: { id: "g3m", senderId: "u2", messageContent: "g" }
    });

    // typing group / actor / private
    DataManager.setTyping = (c, u, t) => true;
    SocketListeners.handleTyping({ conversationId: "g1", userId: "u2", isTyping: true, isGroup: true });
    SocketListeners.handleTyping({ conversationId: "actor:a1", userId: "u2", isTyping: true, isGroup: false });
    SocketListeners.handleTyping({ conversationId: "user1-u2", userId: "u2", isTyping: true, isGroup: false });
    DataManager.setTyping = (c, u, t) => false;
    SocketListeners.handleTyping({ conversationId: "user1-u2", userId: "u2", isTyping: false, isGroup: false });

    // friend request
    MockDialog._rendered = [];
    await SocketListeners.handleFriendRequest({ targetActorId: null });
    await SocketListeners.handleFriendRequest({ targetActorId: "gone" });
    await SocketListeners.handleFriendRequest({
        targetActorId: "a1",
        targetActorName: "Hero",
        requesterUserId: "u2",
        requesterUserName: "Alice",
        note: "hi"
    });
    assert.ok(MockDialog._last);
    // run accept and decline callbacks
    const dlg = MockDialog._last;
    await dlg.data.buttons.accept.callback();
    await dlg.data.buttons.decline.callback();

    // non-owner cannot respond
    game.user.isGM = false;
    game.user.id = "stranger";
    await SocketListeners.handleFriendRequest({
        targetActorId: "a1",
        requesterUserId: "u2"
    });
    game.user.isGM = true;
    game.user.id = "user1";

    // friend response
    await SocketListeners.handleFriendResponse({ requesterUserId: "other", accepted: true });
    await SocketListeners.handleFriendResponse({ requesterUserId: "user1", targetActorId: "a1", accepted: true });
    await SocketListeners.handleFriendResponse({ requesterUserId: "user1", targetActorId: "gone", accepted: false });

    // edit/delete/reaction edge cases
    SocketListeners.handleEditMessage({});
    DataManager.groupChats.set("g1", {
        id: "g1",
        members: ["user1", "u2"],
        history: [{ id: "own", senderId: "user1", messageContent: "mine" }]
    });
    game.user.isGM = false;
    SocketListeners.handleEditMessage({
        conversationId: "g1",
        messageId: "own",
        newContent: "hacked",
        isGroup: true,
        userId: "stranger"
    });
    assert.equal(DataManager.groupChats.get("g1").history[0].messageContent, "mine");
    SocketListeners.handleDeleteMessage({
        conversationId: "g1",
        messageId: "own",
        isGroup: true,
        userId: "stranger"
    });
    assert.equal(DataManager.groupChats.get("g1").history.length, 1);
    game.user.isGM = true;
    SocketListeners.handleEditMessage({ conversationId: "g1", messageId: "x", newContent: "n", isGroup: true });
    SocketListeners.handleEditMessage({ conversationId: "user1-u2", messageId: "x", newContent: "n", isGroup: false });
    SocketListeners.handleDeleteMessage({});
    SocketListeners.handleDeleteMessage({ conversationId: "g1", messageId: "x", isGroup: true });
    SocketListeners.handleDeleteMessage({ conversationId: "user1-u2", messageId: "x", isGroup: false });
    SocketListeners.handleAddReaction({});
    SocketListeners.handleAddReaction({ conversationId: "g1", messageId: "x", emoji: "👍", userId: "u2", isGroup: true });
    SocketListeners.handleAddReaction({ conversationId: "user1-u2", messageId: "x", emoji: "👍", userId: "u2", isGroup: false });

    SocketListeners.handleGroupCreate({});
    SocketListeners.handleGroupUpdate({});
    SocketListeners.handleGroupUpdate({ groupId: "g1", updates: { name: "Z" } });
    SocketListeners.handleGroupDelete({});
    SocketListeners.handleGroupDelete({ groupId: "g1" });

    restoreMocks();
});
