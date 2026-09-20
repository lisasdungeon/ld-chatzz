import assert from "node:assert/strict";
import test from "node:test";
import { installMocks, restoreMocks, MockDialog, MockFilePicker } from "./foundry-mock.mjs";

function settingsHtml() {
    const root = document.createElement("div");
    root.innerHTML = `
        <input name="personalBackground" value="old.png"/>
        <input name="gmOverrideSoundPath" value="old.wav"/>
        <input name="enableSounds" type="checkbox" checked/>
        <input name="notificationVolume" type="number" value="0.7"/>
        <input name="enableDesktopNotifications" type="checkbox"/>
        <input name="shareBackground" type="checkbox"/>
        <input name="gmOverrideEnabled" type="checkbox"/>
        <button data-action="pickBackground"></button>
        <button data-action="pickGMSound"></button>
        <button data-action="saveSettings"></button>
        <button data-action="requestNotifications"></button>
    `;
    document.body.appendChild(root);
    return root;
}

function groupHtml() {
    const root = document.createElement("div");
    root.innerHTML = `
        <div class="chatzz-group-item" data-group-id="g1">
            <input type="checkbox" checked/>
            <button class="chatzz-edit-group"></button>
        </div>
        <div class="chatzz-group-item" data-group-id="g2">
            <input type="checkbox"/>
        </div>
        <div class="chatzz-selection-actions">
            <button data-action="openSelected"></button>
            <button data-action="exportSelected"></button>
            <button data-action="deleteSelected"></button>
        </div>
        <button data-action="createGroup"></button>
        <input name="newGroupName" value=""/>
        <div class="chatzz-member-select">
            <input type="checkbox" value="u2" checked/>
            <input type="checkbox" value="u3"/>
        </div>
    `;
    document.body.appendChild(root);
    return root;
}

test("SettingsWindow full coverage", async () => {
    installMocks({
        isGM: true,
        settings: {
            "ld-chatzz.enableSounds": true,
            "ld-chatzz.notificationVolume": 0.5,
            "ld-chatzz.enableDesktopNotifications": false,
            "ld-chatzz.personalBackground": "bg.png",
            "ld-chatzz.shareBackground": false,
            "ld-chatzz.gmOverrideEnabled": false,
            "ld-chatzz.gmOverrideSoundPath": ""
        }
    });
    const { SettingsWindow } = await import("../src/SettingsWindow.js");

    const win = new SettingsWindow();
    assert.ok(SettingsWindow.defaultOptions);
    assert.equal(win.title, "CHATZZ.SettingsTitle");
    await win.getData();
    await win._prepareContext();

    win.element = settingsHtml();
    win.close = async () => {
        win._closed = true;
    };
    win._onRender({}, {});
    win.activateListeners([win.element]);
    win._setupEventListeners(null);

    // FilePicker promise path (both pickers)
    MockFilePicker.prototype.render = function () {
        MockFilePicker._rendered.push(this);
        this.element = {
            css: () => this.element,
            closest: () => ({ css: () => {} })
        };
        return Promise.resolve(this);
    };
    win.element.querySelector('[data-action="pickBackground"]').click();
    await new Promise((r) => setTimeout(r, 20));
    MockFilePicker._last?.opts?.callback?.("newbg.png");
    win.element.querySelector('[data-action="pickGMSound"]').click();
    await new Promise((r) => setTimeout(r, 20));
    MockFilePicker._last?.opts?.callback?.("newsound.wav");

    // non-promise render path (both pickers hit setTimeout z-index branch)
    MockFilePicker.prototype.render = function () {
        MockFilePicker._rendered.push(this);
        this.element = {
            css: () => this.element,
            closest: () => ({ css: () => {} })
        };
        return this;
    };
    win.element.querySelector('[data-action="pickBackground"]').click();
    await new Promise((r) => setTimeout(r, 150));
    win.element.querySelector('[data-action="pickGMSound"]').click();
    await new Promise((r) => setTimeout(r, 150));

    // save
    await win._saveSettings();
    assert.equal(win._closed, true);

    // save error
    win.element = settingsHtml();
    win._closed = false;
    game.settings.set = async () => {
        throw new Error("fail");
    };
    await win._saveSettings();

    // request notifications
    Notification.requestPermission = async () => "granted";
    win.element.querySelector('[data-action="requestNotifications"]').click();
    await new Promise((r) => setTimeout(r, 10));
    // no Notification
    const N = globalThis.Notification;
    delete globalThis.Notification;
    // recreate button path when Notification not in window - need window.Notification check
    // code uses 'Notification' in window
    delete window.Notification;
    win.element.querySelector('[data-action="requestNotifications"]').click();
    await new Promise((r) => setTimeout(r, 10));
    globalThis.Notification = N;
    window.Notification = N;

    // non-GM prepare
    game.user.isGM = false;
    game.settings.get = (m, k) => {
        if (k === "enableSounds") return true;
        if (k === "notificationVolume") return 0.5;
        if (k === "enableDesktopNotifications") return false;
        if (k === "personalBackground") return "";
        if (k === "shareBackground") return false;
        return undefined;
    };
    game.settings.set = async () => {};
    win.element = settingsHtml();
    await win._prepareContext();
    await win._saveSettings();

    restoreMocks();
});

test("GroupManagerWindow full coverage", async () => {
    installMocks({
        isGM: true,
        users: [
            { id: "user1", name: "Tester", active: true, isGM: true },
            { id: "u2", name: "Alice", active: true, isGM: false },
            { id: "u3", name: "Bob", active: false, isGM: false }
        ]
    });
    const { GroupManagerWindow } = await import("../src/GroupManagerWindow.js");
    const { DataManager } = await import("../src/DataManager.js");
    const { UIManager } = await import("../src/UIManager.js");
    const { LDChatzz } = await import("../src/LDChatzz.js");
    const { SocketHandler } = await import("../src/SocketHandler.js");

    DataManager.groupChats.set("g1", {
        id: "g1",
        name: "Party",
        members: ["user1", "u2", "gone"],
        history: [{ id: "m1", messageContent: "hi", timestamp: Date.now(), senderName: "A" }],
        createdAt: Date.now()
    });
    DataManager.groupChats.set("g2", {
        id: "g2",
        name: "Other",
        members: ["user1"],
        history: [],
        createdAt: null
    });

    UIManager.openGroupChat = () => {};
    LDChatzz.createGroup = async (name, members) => ({ id: "new", name, members });
    LDChatzz.deleteGroup = async () => {};
    SocketHandler.broadcastGroupUpdate = () => {};
    DataManager.updateGroup = (id, u) => {
        Object.assign(DataManager.groupChats.get(id), u);
        return true;
    };
    DataManager.saveGroupChats = async () => {};

    const win = new GroupManagerWindow();
    assert.ok(GroupManagerWindow.defaultOptions);
    assert.equal(win.title, "CHATZZ.GroupManagerTitle");
    await win.getData();
    const ctx = await win._prepareContext();
    assert.ok(ctx.groups.length >= 1);

    win.element = groupHtml();
    win.render = () => {};
    win._onRender({}, {});
    win.activateListeners([win.element]);
    win._setupEventListeners(null);

    win._updateSelectionState();
    win.element.querySelector('.chatzz-group-item input[type="checkbox"]').dispatchEvent(new Event("change"));

    // open selected
    await win._onOpenSelected();
    // none selected
    win.element.querySelectorAll('.chatzz-group-item input[type="checkbox"]').forEach((cb) => {
        cb.checked = false;
    });
    await win._onOpenSelected();

    // export
    win.element.querySelector('.chatzz-group-item input[type="checkbox"]').checked = true;
    await win._onExportSelected();
    await new Promise((r) => setTimeout(r, 20));
    win.element.querySelectorAll('.chatzz-group-item input[type="checkbox"]').forEach((cb) => {
        cb.checked = false;
    });
    await win._onExportSelected();

    // delete
    win.element.querySelector('.chatzz-group-item input[type="checkbox"]').checked = true;
    MockDialog._confirmResult = true;
    await win._onDeleteSelected();
    MockDialog._confirmResult = false;
    win.element.querySelector('.chatzz-group-item input[type="checkbox"]').checked = true;
    await win._onDeleteSelected();
    win.element.querySelectorAll('.chatzz-group-item input[type="checkbox"]').forEach((cb) => {
        cb.checked = false;
    });
    await win._onDeleteSelected();

    // create group
    await win._onCreateGroup(); // empty name
    win.element.querySelector('input[name="newGroupName"]').value = "New Party";
    win.element.querySelectorAll('.chatzz-member-select input').forEach((cb) => {
        cb.checked = false;
    });
    await win._onCreateGroup(); // no members
    win.element.querySelector('.chatzz-member-select input').checked = true;
    await win._onCreateGroup();

    // edit group
    MockDialog._promptResult = { name: "Renamed", members: ["user1", "u2"] };
    MockDialog._promptHtml = {
        find: (sel) => {
            if (sel === '[name="name"]') return { val: () => "Renamed" };
            if (sel === '[name="members"]:checked') {
                return {
                    [Symbol.iterator]: function* () {
                        yield { value: "user1" };
                        yield { value: "u2" };
                    }
                };
            }
            return { val: () => "" };
        }
    };
    // Dialog.prompt uses callback - our mock calls callback with _promptHtml
    // Fix mock usage: edit uses Dialog.prompt with callback returning object
    MockDialog.prompt = async ({ callback }) => {
        const html = {
            find: (sel) => {
                if (String(sel).includes("name")) return { val: () => "Renamed" };
                if (String(sel).includes("members")) {
                    const arr = [{ value: "user1" }, { value: "u2" }];
                    arr.map = Array.prototype.map;
                    return arr;
                }
                return { val: () => "" };
            }
        };
        // fix Array.from(html.find(...))
        html.find = (sel) => {
            if (String(sel).includes("name") && !String(sel).includes("members")) return { val: () => "Renamed" };
            if (String(sel).includes("members")) {
                return [{ value: "user1" }, { value: "u2" }];
            }
            return { val: () => "" };
        };
        return callback(html);
    };
    const editBtn = win.element.querySelector(".chatzz-edit-group");
    await win._onEditGroup({ currentTarget: editBtn });

    // missing group
    DataManager.groupChats.delete("g1");
    await win._onEditGroup({ currentTarget: editBtn });
    DataManager.groupChats.set("g1", { id: "g1", name: "Party", members: ["user1"], history: [] });

    // prompt returns null/empty name
    MockDialog.prompt = async () => null;
    await win._onEditGroup({ currentTarget: editBtn });
    MockDialog.prompt = async () => ({ name: "", members: [] });
    await win._onEditGroup({ currentTarget: editBtn });

    // non-GM save skip
    game.user.isGM = false;
    MockDialog.prompt = async ({ callback }) =>
        callback({
            find: (sel) => {
                if (String(sel).includes("name") && !String(sel).includes("members")) return { val: () => "X" };
                if (String(sel).includes("members")) return [{ value: "user1" }];
                return { val: () => "" };
            }
        });
    await win._onEditGroup({ currentTarget: editBtn });
    game.user.isGM = true;

    win.bringToFront();
    win.element = null;
    win.bringToFront();

    // event button hooks
    win.element = groupHtml();
    win._setupEventListeners(win.element);
    win.element.querySelector('[data-action="openSelected"]').click();
    win.element.querySelector('[data-action="exportSelected"]').click();
    win.element.querySelector('[data-action="deleteSelected"]').click();
    win.element.querySelector('[data-action="createGroup"]').click();
    win.element.querySelector(".chatzz-edit-group").click();
    await new Promise((r) => setTimeout(r, 20));

    restoreMocks();
});
