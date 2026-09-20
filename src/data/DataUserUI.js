/**
 * LD Chatzz - Data User UI
 * Logic for user preferences, unread tracking, typing indicators, and backgrounds.
 */

import { MODULE_ID, DEFAULTS, UI_SOUNDS } from '../Constants.js';
import { Utils } from '../Utils.js';
import { DataStore } from './DataStore.js';
import { DataPersistence } from './DataPersistence.js';

export class DataUserUI {
    static markAsRead(id) {
        DataStore.lastRead.set(id, Date.now());
        DataStore.unreadCounts.set(id, 0);
        DataPersistence.saveUnreadData();
    }

    static incrementUnread(id) {
        if (DataStore.mutedConversations.has(id)) return;
        const current = DataStore.unreadCounts.get(id) || 0;
        DataStore.unreadCounts.set(id, current + 1);
        DataPersistence.saveUnreadData();

        // Play receive message sound
        if (game.settings.get(MODULE_ID, 'enableSounds')) {
            Utils.playUISound(UI_SOUNDS.getMessage);
        }
    }

    static setTyping(convId, userId, isTyping) {
        if (!DataStore.typingUsers.has(convId)) {
            DataStore.typingUsers.set(convId, new Map());
        }
        const typing = DataStore.typingUsers.get(convId);
        const exists = typing.has(userId);
        let changed = false;
        if (isTyping) {
            if (!exists) changed = true;
            typing.set(userId, Date.now());
        } else {
            if (exists) changed = true;
            typing.delete(userId);
        }
        return changed;
    }

    static getTypingUsers(convId) {
        const typing = DataStore.typingUsers.get(convId);
        if (!typing) return [];
        const now = Date.now();
        const names = [];
        for (const [uid, time] of typing.entries()) {
            if (now - time > DEFAULTS.typingTimeout) {
                typing.delete(uid);
            } else {
                const user = game.users.get(uid);
                if (user && user.id !== game.user.id) names.push(user.name);
            }
        }
        return names;
    }

    static toggleFavorite(id) {
        if (DataStore.favorites.has(id)) DataStore.favorites.delete(id);
        else DataStore.favorites.add(id);
        DataPersistence.saveFavorites();
    }

    static toggleMuted(id) {
        if (DataStore.mutedConversations.has(id)) DataStore.mutedConversations.delete(id);
        else DataStore.mutedConversations.add(id);
        DataPersistence.saveMutedConversations();
    }

    static async loadPlayerSettings() {
        try {
            const data = game.settings.get(MODULE_ID, 'playerSettings') || {};
            DataStore._playerSettings = new Map(Object.entries(data));
        } catch (e) {
            console.warn('Chatzz | Failed to load player settings:', e);
        }
    }

    static async savePlayerSettings() {
        try {
            await game.settings.set(MODULE_ID, 'playerSettings', Object.fromEntries(DataStore._playerSettings));
        } catch (e) {
            console.warn('Chatzz | Failed to save player settings:', e);
        }
    }

    static getPlayerSetting(k, d = null) {
        const v = DataStore._playerSettings.get(k);
        return v !== undefined ? v : d;
    }

    static setPlayerSetting(k, v) {
        DataStore._playerSettings.set(k, v);
        this.savePlayerSettings();
    }

    static getGMSetting(k, d = null) {
        const v = DataStore._gmSettings.get(k);
        return v !== undefined ? v : d;
    }

    static setGMSetting(k, v) {
        DataStore._gmSettings.set(k, v);
        DataPersistence.saveGMSettings();
    }

    static setReplyTo(msg) { DataStore._replyToMessage = msg; }
    static getReplyTo() { return DataStore._replyToMessage; }
    static clearReplyTo() { DataStore._replyToMessage = null; }

    static getTotalUnread() {
        let total = 0;
        for (const count of DataStore.unreadCounts.values()) {
            total += (count || 0);
        }
        return total;
    }

    static async loadBackgroundSettings() {
        try {
            DataStore._personalBackground = game.settings.get(MODULE_ID, 'personalBackground') || null;
            const chatBgs = game.settings.get(MODULE_ID, 'chatBackgrounds') || {};
            DataStore._chatBackgrounds = new Map(Object.entries(chatBgs));
            if (game.user.isGM) {
                const gmBgs = game.settings.get(MODULE_ID, 'gmBackgrounds') || {};
                DataStore.gmBackgrounds.global = gmBgs.global || null;
                DataStore.gmBackgrounds.perUser = new Map(Object.entries(gmBgs.perUser || {}));
                DataStore.gmBackgrounds.perChat = new Map(Object.entries(gmBgs.perChat || {}));
            }
        } catch (e) {
            console.warn('Chatzz | Failed to load background settings:', e);
        }
    }

    static async saveBackgroundSettings() {
        try {
            await game.settings.set(MODULE_ID, 'personalBackground', DataStore._personalBackground || '');
            await game.settings.set(MODULE_ID, 'chatBackgrounds', Object.fromEntries(DataStore._chatBackgrounds));
            if (game.user.isGM) {
                await game.settings.set(MODULE_ID, 'gmBackgrounds', {
                    global: DataStore.gmBackgrounds.global,
                    perUser: Object.fromEntries(DataStore.gmBackgrounds.perUser),
                    perChat: Object.fromEntries(DataStore.gmBackgrounds.perChat)
                });
            }
        } catch (e) {
            console.warn('Chatzz | Failed to save background settings:', e);
        }
    }
}
