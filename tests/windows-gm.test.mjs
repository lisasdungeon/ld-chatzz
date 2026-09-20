import assert from "node:assert/strict";
import test from "node:test";
import { installMocks, restoreMocks, makeMockActor, MockDialog } from "./foundry-mock.mjs";

function monitorHtml() {
    const root = document.createElement("div");
    root.className = "window-app ld-chatzz";
    root.innerHTML = `
        <span class="window-title">Monitor</span>
        <button class="chatzz-filter-btn" data-filter="private"></button>
        <select class="chatzz-sort-select"><option value="newest">n</option><option value="oldest">o</option></select>
        <input class="chatzz-user-filter" type="checkbox" data-user-id="u2" checked/>
        <input class="chatzz-user-filter" type="checkbox" data-user-id="u3"/>
        <button data-action="clearUserFilter"></button>
        <input class="chatzz-monitor-search" type="text"/>
        <button data-action="toggleImages"></button>
        <button data-action="toggleAutoScroll"></button>
        <button data-action="clearLog"></button>
        <button data-action="exportLog"></button>
        <button data-action="exportToJournal"></button>
        <button class="chatzz-flag-message" data-message-id="i1"></button>
        <div class="chatzz-monitor-message"></div>
        <button class="chatzz-open-chat" data-message-id="i1"></button>
        <button class="chatzz-open-chat" data-message-id="i2"></button>
        <button class="chatzz-impersonate"></button>
        <button class="chatzz-view-history" data-user-id="u2"></button>
        <div class="chatzz-monitor-messages"></div>
    `;
    document.body.appendChild(root);
    return root;
}

function modHtml() {
    const root = document.createElement("div");
    root.innerHTML = `
        <div data-conversation-id="user1-u2" data-type="private">
            <button data-action="clearConversation"></button>
            <button data-action="deleteConversation"></button>
            <button data-action="viewConversation"></button>
        </div>
        <div data-conversation-id="actor:a1" data-type="actor">
            <button data-action="clearConversation"></button>
            <button data-action="deleteConversation"></button>
            <button data-action="viewConversation"></button>
        </div>
        <div data-conversation-id="g1" data-type="group">
            <button data-action="clearConversation"></button>
            <button data-action="deleteConversation"></button>
            <button data-action="viewConversation"></button>
        </div>
        <div data-conversation-id="" data-type="private">
            <button data-action="clearConversation"></button>
            <button data-action="deleteConversation"></button>
            <button data-action="viewConversation"></button>
        </div>
        <button data-action="clearAllPrivate"></button>
        <button data-action="clearAllActors"></button>
        <button data-action="clearAllGroups"></button>
        <button data-action="openMonitor"></button>
        <button data-action="refresh"></button>
    `;
    document.body.appendChild(root);
    return root;
}

test("GMMonitor data/events/actions/window", async () => {
    installMocks({
        isGM: true,
        users: [
            { id: "user1", name: "Tester", active: true, isGM: true },
            { id: "u2", name: "Alice", active: true, isGM: false },
            { id: "u3", name: "Bob", active: true, isGM: false }
        ]
    });
    const { GMMonitorData } = await import("../src/windows/GMMonitorData.js");
    const { GMMonitorEvents } = await import("../src/windows/GMMonitorEvents.js");
    const { GMMonitorActions } = await import("../src/windows/GMMonitorActions.js");
    const { GMMonitorWindow } = await import("../src/GMMonitorWindow.js");
    const { DataManager } = await import("../src/DataManager.js");
    const { UIManager } = await import("../src/UIManager.js");
    const { DataStore } = await import("../src/data/DataStore.js");

    DataStore.interceptedMessages = [
        {
            id: "i1",
            senderId: "u2",
            recipientId: "u3",
            interceptedAt: Date.now(),
            messageData: { timestamp: Date.now(), senderName: "Alice", messageContent: "hello world", imageUrl: "x.png", senderImg: "a.svg" }
        },
        {
            id: "i2",
            senderId: "u2",
            groupId: "g1",
            groupName: "Party",
            participants: ["u2", "u3"],
            interceptedAt: Date.now() - 1000,
            messageData: { timestamp: Date.now() - 1000, senderName: "Alice", messageContent: "group" }
        },
        {
            id: "i3",
            senderId: "user1",
            recipientId: "u2",
            interceptedAt: Date.now() - 99999999,
            messageData: { messageContent: "old" }
        }
    ];
    DataManager.setGMSetting("lastMonitorView", Date.now() - 5000);

    assert.ok(GMMonitorData.getUnreadCount() >= 1);
    assert.ok(GMMonitorData.getInvolvedUsers().length >= 1);
    const stats = GMMonitorData.getStats(new Set(["i1"]));
    assert.equal(stats.flagged, 1);

    const inst = {
        _selectedUsers: new Set(),
        _filterType: "all",
        _searchQuery: "",
        _sortOrder: "newest",
        _showImages: true,
        _autoScroll: true,
        _stealthMode: true,
        _flaggedMessages: new Set(["i1"])
    };
    await GMMonitorData.prepareContext(inst);
    inst._selectedUsers = new Set(["u2"]);
    await GMMonitorData.prepareContext(inst);
    inst._filterType = "private";
    await GMMonitorData.prepareContext(inst);
    inst._filterType = "group";
    await GMMonitorData.prepareContext(inst);
    inst._filterType = "flagged";
    await GMMonitorData.prepareContext(inst);
    inst._filterType = "images";
    await GMMonitorData.prepareContext(inst);
    inst._filterType = "all";
    inst._searchQuery = "hello";
    await GMMonitorData.prepareContext(inst);
    for (const sort of ["oldest", "sender", "type", "newest", "other"]) {
        inst._sortOrder = sort;
        inst._searchQuery = "";
        await GMMonitorData.prepareContext(inst);
    }

    // Actions
    const actInst = {
        _selectedUsers: new Set(["u2"]),
        _filterType: "private",
        _flaggedMessages: new Set(["i1"])
    };
    GMMonitorActions.exportLog(actInst);
    actInst._filterType = "group";
    GMMonitorActions.exportLog(actInst);
    actInst._filterType = "flagged";
    GMMonitorActions.exportLog(actInst);
    actInst._selectedUsers = new Set();
    actInst._filterType = "all";
    GMMonitorActions.exportLog(actInst);

    await GMMonitorActions.exportToJournal({ _filterType: "all", _flaggedMessages: new Set() });
    await GMMonitorActions.exportToJournal({ _filterType: "flagged", _flaggedMessages: new Set(["i1"]) });
    DataStore.interceptedMessages = [];
    await GMMonitorActions.exportToJournal({ _filterType: "all", _flaggedMessages: new Set() });
    DataStore.interceptedMessages = [
        {
            id: "i1",
            senderId: "u2",
            recipientId: "u3",
            groupId: "g1",
            groupName: "Party",
            interceptedAt: Date.now(),
            messageData: { messageContent: "x", imageUrl: "i.png", senderName: "A", timestamp: Date.now() }
        }
    ];
    await GMMonitorActions.exportToJournal({ _filterType: "all", _flaggedMessages: new Set(["i1"]) });

    // Events
    UIManager.openGroupChat = () => {};
    UIManager.openChatFor = () => {};
    const mon = {
        _filterType: "all",
        _sortOrder: "newest",
        _searchQuery: "",
        _selectedUsers: new Set(),
        _showImages: true,
        _autoScroll: true,
        _flaggedMessages: new Set(),
        _listenerRegistered: false,
        _boundUpdateHandler: () => {},
        rendered: true,
        element: null,
        render() {
            this._r = true;
        },
        _exportMonitorLog() {
            this._exp = true;
        },
        _exportToJournal() {
            this._j = true;
        },
        get title() {
            return "T";
        }
    };
    GMMonitorEvents.setup(mon, null);
    mon.element = monitorHtml();
    DataStore.interceptedMessages = [
        { id: "i1", senderId: "u2", recipientId: "u3", messageData: {} },
        { id: "i2", senderId: "u2", groupId: "g1", messageData: {} }
    ];
    MockDialog._confirmResult = true;
    GMMonitorEvents.setup(mon, mon.element);
    mon.element.querySelector(".chatzz-filter-btn").click();
    mon.element.querySelector(".chatzz-sort-select").value = "oldest";
    mon.element.querySelector(".chatzz-sort-select").dispatchEvent(new Event("change"));
    const cbs = mon.element.querySelectorAll(".chatzz-user-filter");
    cbs[0].checked = false;
    cbs[0].dispatchEvent(new Event("change"));
    cbs[1].checked = true;
    cbs[1].dispatchEvent(new Event("change"));
    mon.element.querySelector('[data-action="clearUserFilter"]').click();
    mon.element.querySelector(".chatzz-monitor-search").value = "x";
    mon.element.querySelector(".chatzz-monitor-search").dispatchEvent(new Event("input"));
    await new Promise((r) => setTimeout(r, 350));
    mon.element.querySelector('[data-action="toggleImages"]').click();
    mon.element.querySelector('[data-action="toggleAutoScroll"]').click();
    mon._autoScroll = true;
    mon.element.querySelector('[data-action="clearLog"]').click();
    await new Promise((r) => setTimeout(r, 10));
    MockDialog._confirmResult = false;
    mon.element.querySelector('[data-action="clearLog"]').click();
    await new Promise((r) => setTimeout(r, 10));
    mon.element.querySelector('[data-action="exportLog"]').click();
    mon.element.querySelector('[data-action="exportToJournal"]').click();
    mon.element.querySelector(".chatzz-flag-message").click();
    mon.element.querySelector(".chatzz-flag-message").click();
    mon.element.querySelector(".chatzz-monitor-message").click();
    mon.element.querySelectorAll(".chatzz-open-chat")[0].click();
    mon.element.querySelectorAll(".chatzz-open-chat")[1].click();
    mon.element.querySelector(".chatzz-impersonate").click();
    mon.element.querySelector(".chatzz-view-history").click();
    GMMonitorEvents.registerUpdateListener(mon);
    GMMonitorEvents.handleNewMessage(mon);
    mon.element = monitorHtml();
    mon._autoScroll = false;
    GMMonitorEvents.handleNewMessage(mon);
    mon.element = null;
    GMMonitorEvents.handleNewMessage(mon);

    // Window
    const win = new GMMonitorWindow();
    win.element = monitorHtml();
    assert.ok(typeof win.title === "string");
    await win._prepareContext({});
    win._onRender({}, {});
    win._exportMonitorLog();
    await win._exportToJournal();
    win.bringToFront();
    win.element = null;
    win.bringToFront();
    UIManager.gmMonitorWindow = win;
    Object.getPrototypeOf(Object.getPrototypeOf(win)).close = async () => win;
    await win.close();
    assert.equal(UIManager.gmMonitorWindow, null);

    restoreMocks();
});

test("GMModWindow full coverage", async () => {
    const actor = makeMockActor({ id: "a1", name: "Hero", ownership: { user1: 3 } });
    installMocks({
        isGM: true,
        users: [
            { id: "user1", name: "Tester", active: true, isGM: true },
            { id: "u2", name: "Alice", active: true, isGM: false }
        ],
        actors: [actor]
    });
    const { GMModWindow } = await import("../src/GMModWindow.js");
    const { DataManager } = await import("../src/DataManager.js");
    const { UIManager } = await import("../src/UIManager.js");
    const { LDChatzz } = await import("../src/LDChatzz.js");

    DataManager.privateChats.set("user1-u2", { users: ["user1", "u2"], history: [{ id: "1" }] });
    DataManager.actorChats.set("actor:a1", { actorId: "a1", actorName: "Hero", history: [{ id: "2" }] });
    DataManager.groupChats.set("g1", { id: "g1", name: "Party", members: ["user1"], history: [{ id: "3" }] });

    UIManager.openGMMonitor = () => {};
    UIManager.openGroupChat = () => {};
    UIManager.openChatForActor = () => {};
    UIManager.openChatFor = () => {};
    LDChatzz.deleteGroup = async () => {};

    const win = new GMModWindow();
    // static defaultOptions path
    assert.ok(GMModWindow.defaultOptions);
    assert.equal(win.title, "CHATZZ.GMModTitle");
    const data = await win.getData();
    assert.ok(data.privateChats.length);
    const ctx = await win._prepareContext();
    assert.ok(ctx.totalGroups >= 1);

    win.element = modHtml();
    win.render = () => {};
    win._onRender({}, {});
    win.activateListeners([win.element]);
    win._setupEventListeners(null);

    MockDialog._confirmResult = true;
    win.element.querySelector('[data-type="private"] [data-action="clearConversation"]').click();
    await new Promise((r) => setTimeout(r, 10));
    win.element.querySelector('[data-type="actor"] [data-action="clearConversation"]').click();
    await new Promise((r) => setTimeout(r, 10));
    win.element.querySelector('[data-type="group"] [data-action="clearConversation"]').click();
    await new Promise((r) => setTimeout(r, 10));
    MockDialog._confirmResult = false;
    win.element.querySelector('[data-type="private"] [data-action="clearConversation"]').click();
    await new Promise((r) => setTimeout(r, 10));
    // empty id
    win.element.querySelector('[data-conversation-id=""] [data-action="clearConversation"]').click();
    await new Promise((r) => setTimeout(r, 10));

    MockDialog._confirmResult = true;
    win.element.querySelector('[data-type="private"] [data-action="deleteConversation"]').click();
    await new Promise((r) => setTimeout(r, 10));
    DataManager.actorChats.set("actor:a1", { actorId: "a1", history: [] });
    win.element.querySelector('[data-type="actor"] [data-action="deleteConversation"]').click();
    await new Promise((r) => setTimeout(r, 10));
    DataManager.groupChats.set("g1", { id: "g1", name: "Party", members: ["user1"], history: [] });
    win.element.querySelector('[data-type="group"] [data-action="deleteConversation"]').click();
    await new Promise((r) => setTimeout(r, 10));
    MockDialog._confirmResult = false;
    win.element.querySelector('[data-type="private"] [data-action="deleteConversation"]').click();
    await new Promise((r) => setTimeout(r, 10));
    win.element.querySelector('[data-conversation-id=""] [data-action="deleteConversation"]').click();
    await new Promise((r) => setTimeout(r, 10));

    DataManager.privateChats.set("user1-u2", { users: ["user1", "u2"], history: [] });
    DataManager.actorChats.set("actor:a1", { actorId: "a1", history: [] });
    DataManager.groupChats.set("g1", { id: "g1", members: [], history: [] });
    win.element.querySelector('[data-type="private"] [data-action="viewConversation"]').click();
    win.element.querySelector('[data-type="actor"] [data-action="viewConversation"]').click();
    win.element.querySelector('[data-type="group"] [data-action="viewConversation"]').click();
    win.element.querySelector('[data-conversation-id=""] [data-action="viewConversation"]').click();

    MockDialog._confirmResult = true;
    DataManager.privateChats.set("user1-u2", { users: ["user1", "u2"], history: [1] });
    DataManager.actorChats.set("actor:a1", { history: [1] });
    DataManager.groupChats.set("g1", { id: "g1", history: [1] });
    win.element.querySelector('[data-action="clearAllPrivate"]').click();
    await new Promise((r) => setTimeout(r, 10));
    win.element.querySelector('[data-action="clearAllActors"]').click();
    await new Promise((r) => setTimeout(r, 10));
    win.element.querySelector('[data-action="clearAllGroups"]').click();
    await new Promise((r) => setTimeout(r, 10));
    MockDialog._confirmResult = false;
    win.element.querySelector('[data-action="clearAllPrivate"]').click();
    await new Promise((r) => setTimeout(r, 10));
    win.element.querySelector('[data-action="clearAllActors"]').click();
    await new Promise((r) => setTimeout(r, 10));
    win.element.querySelector('[data-action="clearAllGroups"]').click();
    await new Promise((r) => setTimeout(r, 10));

    win.element.querySelector('[data-action="openMonitor"]').click();
    win.element.querySelector('[data-action="refresh"]').click();

    // direct methods
    await win._clearAllConversations("private");
    await win._clearAllConversations("actor");
    await win._clearAllConversations("group");
    await win._clearAllConversations("nope");
    await win._clearConversation("private", "user1-u2");
    await win._clearConversation("actor", "actor:a1");
    await win._clearConversation("group", "g1");
    await win._deleteConversation("private", "user1-u2");
    await win._deleteConversation("actor", "actor:a1");
    await win._deleteConversation("group", "g1");
    assert.deepEqual(win._getConversationEntries("nope"), []);
    win._getConversationStore("group");
    win._getConversationStore("actor");
    win._getConversationStore("private");

    win.element = modHtml();
    win.bringToFront();
    win.element = null;
    win.bringToFront();
    UIManager.gmModWindow = win;
    Object.getPrototypeOf(Object.getPrototypeOf(win)).close = async () => win;
    await win.close();
    assert.equal(UIManager.gmModWindow, null);

    restoreMocks();
});
