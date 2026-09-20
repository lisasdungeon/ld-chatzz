/**
 * Shared Foundry VTT mocks for ld-chatzz tests.
 */
import { JSDOM } from "jsdom";

const HTML_ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

class MockElement {
    constructor(tag = "div") {
        this.tagName = String(tag).toUpperCase();
        this._text = "";
        this.style = {};
        this.classList = {
            _set: new Set(),
            add: (...c) => c.forEach((x) => this.classList._set.add(x)),
            remove: (...c) => c.forEach((x) => this.classList._set.delete(x)),
            contains: (c) => this.classList._set.has(c),
            toggle: (c, force) => {
                if (force === true) this.classList._set.add(c);
                else if (force === false) this.classList._set.delete(c);
                else if (this.classList._set.has(c)) this.classList._set.delete(c);
                else this.classList._set.add(c);
            }
        };
        this.children = [];
        this._listeners = {};
        this.dataset = {};
        this.href = "";
        this.download = "";
        this.value = "";
        this.checked = false;
        this.disabled = false;
        this.src = "";
        this.type = tag === "input" ? "text" : "";
        this.name = "";
    }
    set textContent(value) {
        this._text = String(value ?? "");
    }
    get textContent() {
        return this._text;
    }
    set innerHTML(value) {
        this._text = String(value ?? "");
    }
    get innerHTML() {
        return this._text.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
    }
    querySelector() {
        return null;
    }
    querySelectorAll() {
        return [];
    }
    closest() {
        return null;
    }
    appendChild(child) {
        this.children.push(child);
        return child;
    }
    removeChild(child) {
        this.children = this.children.filter((c) => c !== child);
        return child;
    }
    addEventListener(type, fn) {
        (this._listeners[type] ||= []).push(fn);
    }
    removeEventListener() {}
    click() {
        for (const fn of this._listeners.click || []) fn({ preventDefault() {}, stopPropagation() {}, target: this, currentTarget: this });
    }
    focus() {}
    getBoundingClientRect() {
        return { top: 0, left: 0, width: 100, height: 100, bottom: 100, right: 100 };
    }
    scrollTo() {}
}

function hasProperty(obj, path) {
    const parts = path.split(".");
    let cur = obj;
    for (const part of parts) {
        if (cur == null || typeof cur !== "object" || !(part in cur)) return false;
        cur = cur[part];
    }
    return true;
}

function mergeObject(target, source = {}) {
    const out = { ...(target || {}) };
    for (const [k, v] of Object.entries(source || {})) {
        if (v && typeof v === "object" && !Array.isArray(v) && typeof out[k] === "object" && out[k] && !Array.isArray(out[k])) {
            out[k] = mergeObject(out[k], v);
        } else {
            out[k] = v;
        }
    }
    return out;
}

export class MockApplicationV2 {
    static DEFAULT_OPTIONS = {};
    static defaultOptions = {};
    constructor(options = {}) {
        this.options = { ...(this.constructor.DEFAULT_OPTIONS || {}), ...options };
        this.element = null;
        this._closed = false;
        this.rendered = false;
        this.closed = false;
    }
    async _prepareContext() {
        return {};
    }
    _onRender() {}
    render() {
        this.rendered = true;
        return this;
    }
    bringToTop() {
        this._broughtToTop = true;
        return this;
    }
    bringToFront() {
        this._broughtToFront = true;
        return this;
    }
    close() {
        this._closed = true;
        this.closed = true;
        this.rendered = false;
        return Promise.resolve(this);
    }
}

export function HandlebarsApplicationMixin(Base) {
    return class extends Base {
        static PARTS = {};
    };
}

export function makeMockActor({ id, name, ownership = {}, flags = {}, img = "icons/actor.svg", isOwner = false }) {
    const actor = {
        id,
        name,
        ownership,
        img,
        isOwner,
        _flags: flags,
        getFlag(scope, key) {
            return actor._flags[`${scope}.${key}`];
        },
        async setFlag(scope, key, value) {
            actor._flags[`${scope}.${key}`] = value;
            return value;
        }
    };
    return actor;
}

export class MockDialog {
    constructor(data = {}, options = {}) {
        this.data = data;
        this.options = options;
        MockDialog._last = this;
    }
    render() {
        MockDialog._rendered.push(this);
        return this;
    }
    static async confirm({ defaultYes = true } = {}) {
        if (typeof MockDialog._confirmResult === "function") return MockDialog._confirmResult();
        return MockDialog._confirmResult ?? defaultYes;
    }
    static async prompt({ callback, rejectClose = true } = {}) {
        if (MockDialog._promptResult === null && rejectClose) return null;
        const html = MockDialog._promptHtml || {
            find: () => ({
                val: () => MockDialog._promptResult ?? "edited",
                map: () => ({ get: () => [] })
            })
        };
        if (callback) return callback(html);
        return MockDialog._promptResult;
    }
}
MockDialog._rendered = [];
MockDialog._confirmResult = true;
MockDialog._promptResult = "edited text";
MockDialog._promptHtml = null;
MockDialog._last = null;

export class MockFilePicker {
    constructor(opts = {}) {
        this.opts = opts;
        this.element = {
            css: () => this.element,
            closest: () => ({ css: () => {} })
        };
        MockFilePicker._last = this;
    }
    render() {
        MockFilePicker._rendered.push(this);
        if (MockFilePicker._autoCallback && this.opts.callback) {
            this.opts.callback(MockFilePicker._autoPath || "img/bg.png");
        }
        return this;
    }
    browse(current) {
        this._browsed = current;
        if (this.opts.callback) this.opts.callback(MockFilePicker._autoPath || "img/bg.png");
        return this;
    }
}
MockFilePicker._rendered = [];
MockFilePicker._last = null;
MockFilePicker._autoCallback = false;
MockFilePicker._autoPath = "img/bg.png";

export function installMocks({ isGM = true, users = [], actors = [], settings = {}, character = null } = {}) {
    const settingsStore = new Map(Object.entries(settings));
    const hooksLog = [];
    const socketEmits = [];
    const socketHandlers = [];
    const userList = users.length
        ? users
        : [{ id: "user1", name: "Tester", active: true, isGM, avatar: "icons/svg/mystery-man.svg", color: "#0ff" }];
    if (!userList.find((u) => u.id === "user1")) {
        userList.unshift({ id: "user1", name: "Tester", active: true, isGM, avatar: "icons/svg/mystery-man.svg", color: "#0ff" });
    }
    const actorList = [...actors];

    const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", { url: "https://example.test/" });
    const { window } = dom;
    globalThis.window = window;
    globalThis.document = window.document;
    globalThis.HTMLElement = window.HTMLElement;
    globalThis.Node = window.Node;
    globalThis.Element = window.Element;
    globalThis.Event = window.Event;
    globalThis.CustomEvent = window.CustomEvent;
    globalThis.FileReader = window.FileReader;
    globalThis.File = window.File || class File extends Blob {
        constructor(parts, name, opts = {}) {
            super(parts, opts);
            this.name = name;
            this.lastModified = Date.now();
        }
    };
    globalThis.Blob = window.Blob || Blob;
    // Always mock blob URLs: Node URL.createObjectURL rejects jsdom Blob instances
    const BaseURL = globalThis.URL || window.URL;
    BaseURL.createObjectURL = () => `blob:mock-${Math.random().toString(36).slice(2)}`;
    BaseURL.revokeObjectURL = () => {};
    globalThis.URL = BaseURL;
    window.URL = BaseURL;
    globalThis.Image = window.Image;
    globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 0);
    globalThis.localStorage = window.localStorage;
    // jsdom elements often lack scrollTo
    if (!Element.prototype.scrollTo) {
        Element.prototype.scrollTo = function scrollTo() {};
    }
    if (!window.HTMLElement.prototype.scrollTo) {
        window.HTMLElement.prototype.scrollTo = function scrollTo() {};
    }

    // jQuery-lite for Foundry UI bits
    globalThis.$ = (sel) => {
        const el = typeof sel === "string" ? document.querySelector(sel) : sel?.[0] || sel;
        const api = {
            0: el,
            length: el ? 1 : 0,
            css: () => api,
            closest: () => api,
            find: (s) => {
                const found = el?.querySelector?.(s);
                return {
                    val: () => found?.value ?? MockDialog._promptResult ?? "u2",
                    0: found
                };
            },
            val: () => el?.value ?? ""
        };
        return api;
    };

    globalThis.CONST = { DOCUMENT_OWNERSHIP_LEVELS: { NONE: 0, LIMITED: 1, OBSERVER: 2, OWNER: 3 } };
    globalThis.foundry = {
        applications: {
            api: {
                ApplicationV2: MockApplicationV2,
                HandlebarsApplicationMixin
            },
            instances: new Map()
        },
        utils: {
            hasProperty,
            randomID: () => `id-${Math.random().toString(36).slice(2, 10)}`,
            duplicate: (obj) => JSON.parse(JSON.stringify(obj)),
            mergeObject
        },
        audio: {
            AudioHelper: {
                play: () => {}
            }
        }
    };
    globalThis.AudioHelper = { play: () => {} };
    globalThis.Application = MockApplicationV2;
    globalThis.Dialog = MockDialog;
    globalThis.FilePicker = MockFilePicker;
    globalThis.JournalEntry = {
        create: async (data) => ({
            name: data.name,
            sheet: { render: () => {} },
            ...data
        })
    };
    globalThis.Handlebars = { registerHelper: () => {}, helpers: {} };

    globalThis.game = {
        user: {
            id: "user1",
            isGM,
            name: "Tester",
            avatar: "icons/svg/mystery-man.svg",
            character: character || null
        },
        users: {
            get: (id) => userList.find((u) => u.id === id) ?? null,
            find: (fn) => userList.find(fn) ?? null,
            filter: (fn) => userList.filter(fn),
            map: (fn) => userList.map(fn),
            [Symbol.iterator]: function* () {
                yield* userList;
            }
        },
        actors: {
            get: (id) => actorList.find((a) => a.id === id) ?? null,
            filter: (fn) => actorList.filter(fn),
            map: (fn) => actorList.map(fn),
            [Symbol.iterator]: function* () {
                yield* actorList;
            }
        },
        settings: {
            get: (module, key) => settingsStore.get(`${module}.${key}`),
            set: async (module, key, value) => {
                settingsStore.set(`${module}.${key}`, value);
                return value;
            },
            register: (module, key, def) => {
                if (!settingsStore.has(`${module}.${key}`)) {
                    settingsStore.set(`${module}.${key}`, def?.default);
                }
            }
        },
        socket: {
            emit: (name, data, options) => socketEmits.push({ name, data, options }),
            on: (name, fn) => socketHandlers.push({ name, fn })
        },
        i18n: {
            localize: (key) => key,
            format: (key, data) => `${key} ${JSON.stringify(data || {})}`
        }
    };

    globalThis.Hooks = {
        callAll: (...args) => hooksLog.push(args),
        on: (name, fn) => {
            hooksLog.push(["on", name]);
            (Hooks._handlers ||= {})[name] = (Hooks._handlers[name] || []).concat(fn);
        },
        once: (name, fn) => {
            hooksLog.push(["once", name]);
            (Hooks._once ||= {})[name] = (Hooks._once[name] || []).concat(fn);
        },
        off: () => {},
        _handlers: {},
        _once: {}
    };

    globalThis.ui = {
        windows: {},
        notifications: {
            warn: (...a) => (ui.notifications._warn ||= []).push(a),
            error: (...a) => (ui.notifications._error ||= []).push(a),
            info: (...a) => (ui.notifications._info ||= []).push(a)
        },
        controls: { render: () => {} }
    };

    globalThis.Notification = class Notification {
        constructor(title, opts) {
            Notification._last = { title, opts };
        }
    };
    Notification.permission = "denied";
    Notification.requestPermission = async () => "denied";
    Notification._last = null;

    try {
        Object.defineProperty(globalThis, "navigator", {
            value: { clipboard: { writeText: async () => true } },
            configurable: true,
            writable: true
        });
    } catch {
        if (globalThis.navigator) {
            globalThis.navigator.clipboard = { writeText: async () => true };
        }
    }

    // Reset dialog/filepicker helpers
    MockDialog._rendered = [];
    MockDialog._confirmResult = true;
    MockDialog._promptResult = "edited text";
    MockFilePicker._rendered = [];
    MockFilePicker._autoCallback = false;

    return {
        settingsStore,
        hooksLog,
        socketEmits,
        socketHandlers,
        userList,
        actorList,
        window
    };
}

export function restoreMocks() {
    for (const key of [
        "document",
        "window",
        "CONST",
        "foundry",
        "game",
        "Hooks",
        "ui",
        "Dialog",
        "FilePicker",
        "JournalEntry",
        "Application",
        "AudioHelper",
        "Handlebars",
        "$",
        "Notification",
        "requestAnimationFrame"
    ]) {
        try {
            delete globalThis[key];
        } catch {
            /* ignore */
        }
    }
}

export function makeChatElement(extra = "") {
    const root = document.createElement("div");
    root.className = "ld-chatzz chatzz-window window-app";
    root.innerHTML = `
        <div class="window-header">
            <button class="header-control close" type="button"></button>
            <button class="header-button close" type="button"></button>
            <span class="window-title">Title</span>
        </div>
        <div class="chatzz-chat-container">
            <div class="chatzz-message-list"></div>
            <div class="chatzz-typing-indicator" style="display:none"></div>
            <div class="chatzz-image-preview" style="display:none"></div>
            <form class="chatzz-form">
                <textarea name="message"></textarea>
                <select name="speaker"><option value="user1">Me</option></select>
                <button type="button" class="chatzz-send-btn chatzz-btn"></button>
                <button type="button" class="chatzz-image-btn chatzz-btn-icon"></button>
                <input type="file" class="chatzz-image-input" style="display:none"/>
                <button type="button" class="chatzz-favorite-btn chatzz-toolbar-btn"></button>
                <button type="button" class="chatzz-mute-btn chatzz-toolbar-btn"></button>
                <button type="button" class="chatzz-export-btn chatzz-toolbar-btn"></button>
                <button type="button" class="chatzz-background-btn chatzz-toolbar-btn"></button>
                <button type="button" class="chatzz-btn-small" data-default="a.png" data-active="b.png">
                    <img data-default="a.png" data-active="b.png" src="a.png"/>
                </button>
            </form>
            <button type="button" class="chatzz-tab active">
                <img data-default="t.png" data-active="t_on.png" src="t.png"/>
            </button>
            <button type="button" class="chatzz-tab">
                <img data-default="t.png" data-active="t_on.png" src="t.png"/>
            </button>
        </div>
        ${extra}
    `;
    document.body.appendChild(root);
    return root;
}
