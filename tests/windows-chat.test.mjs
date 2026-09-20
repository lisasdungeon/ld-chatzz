import assert from "node:assert/strict";
import test from "node:test";
import {
    installMocks,
    restoreMocks,
    makeMockActor,
    makeChatElement,
    MockFilePicker,
    MockDialog
} from "./foundry-mock.mjs";

test("ChatzzWindowData enrichment and context", async () => {
    const actor = makeMockActor({ id: "a1", name: "Hero", ownership: { user1: 3 }, img: "h.svg", isOwner: true });
    actor.getFlag = () => [];
    installMocks({
        isGM: true,
        users: [
            { id: "user1", name: "Tester", active: true, isGM: true, avatar: "icons/svg/mystery-man.svg" },
            { id: "u2", name: "Alice", active: true, isGM: false, avatar: "icons/a.svg" }
        ],
        actors: [actor]
    });
    const { ChatzzWindowData } = await import("../src/windows/ChatzzWindowData.js");
    const { DataManager } = await import("../src/DataManager.js");

    const privateKey = DataManager.getPrivateChatKey("user1", "u2");
    DataManager.privateChats.set(privateKey, {
        users: ["user1", "u2"],
        history: [
            {
                id: "m1",
                senderId: "user1",
                senderName: "Tester",
                messageContent: "hello",
                timestamp: Date.now(),
                reactions: { "👍": ["user1", "u2"] }
            }
        ]
    });
    DataManager.setReplyTo("m1");
    const privateCtx = await ChatzzWindowData.getChatContext({
        options: { otherUserId: "u2" },
        _searchQuery: "hello"
    });
    assert.equal(privateCtx.isGroup, false);
    assert.equal(privateCtx.conversationId, privateKey);
    assert.ok(privateCtx.messages.length >= 1);
    assert.ok(privateCtx.speakers);

    DataManager.actorChats.set("actor:a1", {
        kind: "actor",
        actorId: "a1",
        history: [{ id: "am1", senderId: "user1", messageContent: "a", timestamp: Date.now() }]
    });
    const actorCtx = await ChatzzWindowData.getChatContext({ options: { actorId: "a1" }, _searchQuery: "" });
    assert.equal(actorCtx.isActorChat, true);

    DataManager.groupChats.set("g1", {
        id: "g1",
        members: ["user1", "u2"],
        history: [{ id: "gm1", senderId: "u2", messageContent: "g", timestamp: Date.now() }]
    });
    const groupCtx = await ChatzzWindowData.getChatContext({ options: { groupId: "g1" }, _searchQuery: "nope" });
    assert.equal(groupCtx.isGroup, true);
    assert.equal(groupCtx.messages.length, 0);

    assert.deepEqual(ChatzzWindowData._formatReactions(null), []);
    assert.ok(ChatzzWindowData._formatReactions({ "😀": ["user1"] })[0].isOwnReaction);

    DataManager.setTyping("c1", "u2", true);
    assert.match(ChatzzWindowData._getTypingText("c1"), /TypingSingle/);
    DataManager.setTyping("c1", "gmX", true);
    // force two names
    const { DataStore } = await import("../src/data/DataStore.js");
    DataStore.typingUsers.set(
        "c2",
        new Map([
            ["u2", Date.now()],
            [
                "u3",
                Date.now()
            ]
        ])
    );
    game.users.get = (id) => {
        if (id === "u2") return { id: "u2", name: "Alice" };
        if (id === "u3") return { id: "u3", name: "Bob" };
        if (id === "user1") return { id: "user1", name: "Tester" };
        return null;
    };
    assert.match(ChatzzWindowData._getTypingText("c2"), /TypingMultiple/);
    assert.equal(ChatzzWindowData._getTypingText("empty"), "");

    // non-GM context skips speakers
    game.user.isGM = false;
    await ChatzzWindowData.getChatContext({ options: { otherUserId: "u2" }, _searchQuery: "" });

    // reply missing
    DataManager.setReplyTo("gone");
    await ChatzzWindowData.getChatContext({ options: { otherUserId: "u2" }, _searchQuery: "" });

    // actor offline/missing
    game.actors.get = () => null;
    await ChatzzWindowData.getChatContext({ options: { actorId: "a1" }, _searchQuery: "" });

    restoreMocks();
});

test("ChatzzWindowUI, Actions, Events, ChatzzWindow class", async () => {
    installMocks({
        isGM: true,
        users: [
            { id: "user1", name: "Tester", active: true, isGM: true },
            { id: "u2", name: "Alice", active: true, isGM: false }
        ],
        actors: [makeMockActor({ id: "a1", name: "Hero", ownership: { user1: 3 }, img: "h.svg" })],
        settings: {
            "ld-chatzz.chatBackgrounds": { "user1-u2": "old.png" },
            "ld-chatzz.enableSounds": false,
            "ld-chatzz.notificationVolume": 0.5
        }
    });
    game.actors.get = (id) => (id === "a1" ? { id: "a1", name: "Hero", img: "h.svg" } : null);

    const { ChatzzWindowUI } = await import("../src/windows/ChatzzWindowUI.js");
    const { ChatzzWindowActions } = await import("../src/windows/ChatzzWindowActions.js");
    const { ChatzzWindowEvents } = await import("../src/windows/ChatzzWindowEvents.js");
    const { ChatzzWindow } = await import("../src/ChatzzWindow.js");
    const { DataManager } = await import("../src/DataManager.js");
    const { LDChatzz } = await import("../src/LDChatzz.js");

    ChatzzWindowUI.applyBackground(null, "x");
    ChatzzWindowUI.applyBackground(document.createElement("div"), "x");
    const el = makeChatElement();
    ChatzzWindowUI.applyBackground(el, "bg.png");
    ChatzzWindowUI.applyBackground(el, null);
    ChatzzWindowUI.scrollToBottom(null);
    ChatzzWindowUI.scrollToBottom(el, true);
    ChatzzWindowUI.scrollToBottom(el, false);
    await new Promise((r) => setTimeout(r, 10));
    ChatzzWindowUI.updateImagePreview(null, "x");
    ChatzzWindowUI.updateImagePreview(el, "data:image/png;base64,xx");
    ChatzzWindowUI.updateImagePreview(el, null);
    ChatzzWindowUI.updateTyping(null, "x");
    ChatzzWindowUI.updateTyping(el, "Alice is typing");
    ChatzzWindowUI.updateTyping(el, "");
    ChatzzWindowUI.setupButtonImages(null);
    ChatzzWindowUI.setupButtonImages(el);
    // fire grey button click and image swaps
    const grey = el.querySelector(".chatzz-btn-small");
    grey.dispatchEvent(new Event("mousedown"));
    grey.dispatchEvent(new Event("mouseup"));
    grey.dispatchEvent(new Event("mouseleave"));
    grey.dispatchEvent(new Event("click"));
    const send = el.querySelector(".chatzz-send-btn");
    send.dispatchEvent(new Event("click"));
    const close = el.querySelector(".chatzz-close-btn");
    if (close) {
        close.dispatchEvent(new Event("mousedown"));
        close.dispatchEvent(new Event("mouseup"));
        close.dispatchEvent(new Event("mouseleave"));
    }

    // Actions
    LDChatzz.sendMessage = async () => {};
    LDChatzz.sendActorMessage = async () => {};
    LDChatzz.sendGroupMessage = async () => {};
    LDChatzz.editMessage = async () => {};
    LDChatzz.toggleReaction = async () => {};

    await ChatzzWindowActions.handleMessageSubmit({ options: {}, _pendingImage: null }, "", null, null);
    await ChatzzWindowActions.handleMessageSubmit({ options: { otherUserId: "u2" } }, "hi", "user1", null);
    await ChatzzWindowActions.handleMessageSubmit({ options: { otherUserId: "u2" } }, "hi", "a1", "img");
    await ChatzzWindowActions.handleMessageSubmit({ options: { actorId: "a1" } }, "hi", null, null);
    await ChatzzWindowActions.handleMessageSubmit({ options: { groupId: "g1" } }, "hi", "missing", null);

    DataManager.groupChats.set("g1", { history: [{ id: "m1", messageContent: "old" }] });
    MockDialog._promptResult = "new content";
    await ChatzzWindowActions.editMessage("g1", "m1", true);
    await ChatzzWindowActions.editMessage("g1", "missing", true);
    MockDialog._promptResult = "";
    await ChatzzWindowActions.editMessage("g1", "m1", true);
    await ChatzzWindowActions.toggleReaction("g1", "m1", "👍", true);

    // Events
    const app = {
        options: { otherUserId: "u2" },
        _preservedInputValue: "draft",
        _lastTypingEmit: 0,
        _typingTimeout: null,
        _handleFormSubmit: async () => {
            app._submitted = true;
        },
        _onImageSelected: async () => {
            app._imaged = true;
        },
        render: () => {}
    };
    const el2 = makeChatElement();
    DataManager.privateChats.set(DataManager.getPrivateChatKey("user1", "u2"), { users: ["user1", "u2"], history: [] });
    ChatzzWindowEvents.activateListeners(app, el2);
    el2.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    const ta = el2.querySelector("textarea[name='message']");
    ta.dispatchEvent(Object.assign(new Event("keydown"), { key: "Enter", shiftKey: false, preventDefault() {} }));
    ta.dispatchEvent(Object.assign(new Event("keydown"), { key: "Enter", shiftKey: true, preventDefault() {} }));
    ta.value = "typing";
    ta.dispatchEvent(new Event("input"));
    el2.querySelector(".chatzz-send-btn").click();
    el2.querySelector(".chatzz-image-btn").click();
    el2.querySelector(".chatzz-image-input").dispatchEvent(new Event("change"));
    el2.querySelector(".chatzz-favorite-btn").click();
    el2.querySelector(".chatzz-mute-btn").click();
    el2.querySelector(".chatzz-export-btn").click();
    await new Promise((r) => setTimeout(r, 20));
    MockFilePicker._autoPath = "newbg.png";
    el2.querySelector(".chatzz-background-btn").click();
    // empty path branch
    MockFilePicker._autoPath = "";
    // force callback with empty
    const bgBtn = el2.querySelector(".chatzz-background-btn");
    // re-bind via activateListeners for actor/group apps
    const appActor = { ...app, options: { actorId: "a1" }, render: () => {} };
    ChatzzWindowEvents.activateListeners(appActor, makeChatElement());
    const appGroup = { ...app, options: { groupId: "g1" }, render: () => {} };
    ChatzzWindowEvents.activateListeners(appGroup, makeChatElement());
    ChatzzWindowEvents._onTyping(app);
    app._lastTypingEmit = 0;
    ChatzzWindowEvents._onTyping(app);
    await new Promise((r) => setTimeout(r, 3100));

    // ChatzzWindow class
    const win = new ChatzzWindow({ otherUserId: "u2" });
    win.element = makeChatElement();
    DataManager.privateChats.set(DataManager.getPrivateChatKey("user1", "u2"), {
        users: ["user1", "u2"],
        history: [{ id: "m1", senderId: "user1", messageContent: "x", timestamp: Date.now() }]
    });
    await win._prepareContext();
    // stub super._onRender
    Object.getPrototypeOf(Object.getPrototypeOf(win))._onRender = () => {};
    win._onRender({}, {});
    win.element.querySelector("textarea[name='message']").value = "  hi  ";
    win._pendingImage = null;
    await win._handleFormSubmit();
    win.element.querySelector("textarea[name='message']").value = "";
    win._pendingImage = null;
    await win._handleFormSubmit(); // empty
    win._pendingImage = "img";
    await win._handleFormSubmit();

    // image selected
    DataManager.processImage = async () => "data:image/png;base64,abc";
    await win._onImageSelected({ target: { files: [new File(["x"], "t.png", { type: "image/png" })] } });
    await win._onImageSelected({ target: { files: [] } });
    DataManager.processImage = async () => null;
    await win._onImageSelected({ target: { files: [new File(["x"], "t.png", { type: "image/png" })] } });

    // group/actor convId paths on render
    const winG = new ChatzzWindow({ groupId: "g1" });
    winG.element = makeChatElement();
    winG._onRender({}, {});
    const winA = new ChatzzWindow({ actorId: "a1" });
    winA.element = makeChatElement();
    winA._onRender({}, {});

    restoreMocks();
});
