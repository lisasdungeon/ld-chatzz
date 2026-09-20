/**
 * LD Chatzz - Settings Registration Hook
 */
import { MODULE_ID, DEFAULTS } from "../Constants.js";

export class SettingsHook {
    static onInit() {
        if (globalThis.Handlebars?.registerHelper) {
            Handlebars.registerHelper("includes", (arr, val) => Array.isArray(arr) && arr.includes(val));
        }

        const settings = [
            { key: "groupChats", scope: "world", type: Object, default: {} },
            { key: "privateChats", scope: "world", type: Object, default: {} },
            { key: "actorChats", scope: "world", type: Object, default: {} },
            { key: "unreadData", scope: "client", type: Object, default: { counts: {}, lastRead: {} } },
            { key: "favorites", scope: "client", type: Array, default: [] },
            { key: "mutedConversations", scope: "client", type: Array, default: [] },
            { key: "pinnedMessages", scope: "client", type: Object, default: {} },
            { key: "sharedBackgrounds", scope: "world", type: Object, default: {} },
            { key: "gmSettings", scope: "world", type: Object, default: {} },
            { key: "playerSettings", scope: "client", type: Object, default: {} },
            { key: "chatBackgrounds", scope: "client", type: Object, default: {} },
            { key: "gmBackgrounds", scope: "world", type: Object, default: { global: null, perUser: {}, perChat: {} } }
        ];

        settings.forEach(s => {
            game.settings.register(MODULE_ID, s.key, {
                name: s.key, scope: s.scope, config: false, type: s.type, default: s.default
            });
        });

        game.settings.register(MODULE_ID, "gmOverrideEnabled", {
            name: "CHATZZ.EnableGMOverride", hint: "CHATZZ.GMOverrideHint",
            scope: "world", config: true, type: Boolean, default: false
        });

        game.settings.register(MODULE_ID, "gmOverrideSoundPath", {
            name: "CHATZZ.GMOverrideSound", hint: "CHATZZ.GMOverrideSoundHint",
            scope: "world", config: true, type: String, default: ""
        });

        game.settings.register(MODULE_ID, "personalBackground", {
            name: "CHATZZ.PersonalBackground", hint: "CHATZZ.PersonalBackgroundHint",
            scope: "client", config: true, type: String, default: ""
        });

        game.settings.register(MODULE_ID, "shareBackground", {
            name: "CHATZZ.ShareBackground", hint: "CHATZZ.ShareBackgroundHint",
            scope: "client", config: true, type: Boolean, default: false
        });

        game.settings.register(MODULE_ID, "enableSounds", {
            name: "CHATZZ.EnableSound", scope: "client", config: true, type: Boolean, default: DEFAULTS.enableSounds
        });

        game.settings.register(MODULE_ID, "notificationVolume", {
            name: "CHATZZ.NotificationVolume", scope: "client", config: true, type: Number,
            range: { min: 0, max: 1, step: 0.01 }, default: DEFAULTS.notificationVolume
        });

        game.settings.register(MODULE_ID, "enableDesktopNotifications", {
            name: "CHATZZ.EnableDesktopNotifications", scope: "client", config: true, type: Boolean, default: DEFAULTS.enableDesktopNotifications
        });

        game.settings.register(MODULE_ID, "sfxCloseWindow", {
            name: "CHATZZ.CloseWindowSound", scope: "client", config: true, type: String, default: DEFAULTS.sfxCloseWindow
        });

        game.settings.register(MODULE_ID, "sfxGetMessage", {
            name: "CHATZZ.IncomingMessageSound", scope: "client", config: true, type: String, default: DEFAULTS.sfxGetMessage
        });

        game.settings.register(MODULE_ID, "sfxButtonPress", {
            name: "CHATZZ.ButtonPressSound", scope: "client", config: true, type: String, default: DEFAULTS.sfxButtonPress
        });

        game.settings.register(MODULE_ID, "sfxSendMessage", {
            name: "CHATZZ.SendMessageSound", scope: "client", config: true, type: String, default: DEFAULTS.sfxSendMessage
        });

        game.settings.register(MODULE_ID, "enterToSend", {
            name: "CHATZZ.EnterToSend", scope: "client", config: true, type: Boolean, default: DEFAULTS.enterToSend
        });

        game.settings.register(MODULE_ID, "notificationSound", {
            name: "CHATZZ.NotificationSound", scope: "client", config: false, type: String, default: ""
        });

        game.settings.register(MODULE_ID, "theme", {
            name: "CHATZZ.Theme", scope: "client", config: false, type: String, default: DEFAULTS.theme
        });

        // v11/v12 worlds created before the notificationSound dropdown existed:
        // fold any saved custom incoming-message sound into the new setting.
        try {
            if (!game.settings.get(MODULE_ID, "notificationSound")) {
                const legacy = game.settings.get(MODULE_ID, "sfxGetMessage");
                if (legacy && legacy !== DEFAULTS.sfxGetMessage) {
                    game.settings.set(MODULE_ID, "notificationSound", legacy);
                }
            }
        } catch (e) {
            console.warn("Chatzz | notificationSound migration skipped:", e);
        }
    }

    static register() {
        Hooks.once("init", () => SettingsHook.onInit());
    }
}
