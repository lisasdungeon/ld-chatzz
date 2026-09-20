/**
 * LD Chatzz - GM Monitor Window (Turbo Proxy)
 */
import { DataManager } from "./DataManager.js";
import { MODULE_ID } from "./Constants.js";
import { Utils } from "./Utils.js";
import { GMMonitorData } from "./windows/GMMonitorData.js";
import { GMMonitorEvents } from "./windows/GMMonitorEvents.js";
import { GMMonitorActions } from "./windows/GMMonitorActions.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class GMMonitorWindow extends HandlebarsApplicationMixin(ApplicationV2) {
    constructor(options = {}) {
        super(options);
        this._filterType = "all";
        this._searchQuery = "";
        this._sortOrder = "newest";
        this._showImages = true;
        this._autoScroll = true;
        this._selectedUsers = new Set();
        this._flaggedMessages = new Set();
        this._stealthMode = true;
        this._boundUpdateHandler = () => GMMonitorEvents.handleNewMessage(this);
    }

    static DEFAULT_OPTIONS = {
        id: "chatzz-gm-monitor",
        classes: ["ld-chatzz", "chatzz-gm-monitor", "stealth-monitor", "chatzz-window"],
        window: { title: "CHATZZ.GMMonitorTitle", resizable: true, minimizable: true },
        tag: "div",
        position: { width: 850, height: 700 }
    };

    static PARTS = {
        content: { template: `modules/${MODULE_ID}/templates/gm-monitor.hbs` }
    };

    get title() {
        const base = game.i18n.localize("CHATZZ.GMMonitorTitle");
        const unread = GMMonitorData.getUnreadCount();
        return unread > 0 ? `${base} (${unread} new)` : base;
    }

    async _prepareContext(options) {
        return await GMMonitorData.prepareContext(this);
    }

    _onRender(context, options) {
        GMMonitorEvents.setup(this, this.element);
        this.bringToFront();
        DataManager.setGMSetting("lastMonitorView", Date.now());
    }

    _exportMonitorLog() {
        GMMonitorActions.exportLog(this);
    }

    async _exportToJournal() {
        await GMMonitorActions.exportToJournal(this);
    }

    bringToFront() {
        if (!this.element) return;
        const apps = Array.from(document.querySelectorAll(".window-app"));
        const maxZ = Math.max(100, ...apps.map(w => parseInt(w.style.zIndex) || 0));
        this.element.style.zIndex = maxZ + 1;
        this.element.classList.add("window-focus");
    }

    async close(options = {}) {
        const { UIManager } = await import('./UIManager.js');
        UIManager.gmMonitorWindow = null;
        return super.close(options);
    }
}
