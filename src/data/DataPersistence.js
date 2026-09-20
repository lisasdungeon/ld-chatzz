/**
 * LD Chatzz - Data Persistence
 * Handles loading and saving data to Foundry VTT settings.
 */

import { MODULE_ID } from '../Constants.js';
import { DataStore } from './DataStore.js';

export class DataPersistence {
    /**
     * Sanitize message history to remove duplicates and ensure IDs
     * @param {Array} history - Message history array
     * @returns {Array} Sanitized history
     */
    static sanitizeHistory(history) {
        if (!Array.isArray(history)) return [];
        
        const seenIds = new Set();
        const seenSignatures = new Set();
        const sanitized = [];
        
        for (const msg of history) {
            if (!msg || typeof msg !== 'object') continue;
            if (!msg.id) msg.id = foundry.utils.randomID();
            if (seenIds.has(msg.id)) continue;
            
            const hasSignature = Boolean(msg.senderId && msg.timestamp && typeof msg.messageContent === 'string');
            const signature = hasSignature ? `${msg.senderId}|${msg.timestamp}|${msg.messageContent}` : null;
            
            if (signature && seenSignatures.has(signature)) continue;
            
            seenIds.add(msg.id);
            if (signature) seenSignatures.add(signature);
            sanitized.push(msg);
        }
        
        return sanitized;
    }

    static async loadGroupChats() {
        try {
            const data = game.settings.get(MODULE_ID, 'groupChats') || {};
            DataStore.groupChats = new Map(Object.entries(data));
            for (const [id, group] of DataStore.groupChats.entries()) {
                group.history = this.sanitizeHistory(group.history ?? group.messages ?? []);
                if (group.messages) delete group.messages;
            }
        } catch (e) {
            console.error('Chatzz | Failed to load group chats:', e);
        }
    }

    static async saveGroupChats() {
        try {
            await game.settings.set(MODULE_ID, 'groupChats', Object.fromEntries(DataStore.groupChats));
        } catch (e) {
            console.error('Chatzz | Failed to save group chats:', e);
        }
    }

    static async loadPrivateChats() {
        try {
            const data = game.settings.get(MODULE_ID, 'privateChats') || {};
            DataStore.privateChats = new Map(Object.entries(data));
            let migratedActorChats = false;
            for (const [key, chat] of DataStore.privateChats.entries()) {
                chat.history = this.sanitizeHistory(chat.history ?? []);
                if (chat.kind === 'actor') {
                    DataStore.privateChats.delete(key);
                    DataStore.actorChats.set(key, chat);
                    migratedActorChats = true;
                }
            }
            if (migratedActorChats) {
                await this.savePrivateChats();
            }
        } catch (e) {
            console.error('Chatzz | Failed to load private chats:', e);
        }
    }

    static async savePrivateChats() {
        try {
            const userChats = Array.from(DataStore.privateChats.entries()).filter(([, chat]) => chat?.kind !== 'actor');
            await game.settings.set(MODULE_ID, 'privateChats', Object.fromEntries(userChats));
        } catch (e) {
            console.error('Chatzz | Failed to save private chats:', e);
        }
    }

    static async loadActorChats() {
        try {
            const migrated = DataStore.actorChats instanceof Map ? DataStore.actorChats : new Map();
            const data = game.settings.get(MODULE_ID, 'actorChats') || {};
            DataStore.actorChats = new Map([
                ...migrated.entries(),
                ...Object.entries(data)
            ]);
            for (const [key, chat] of DataStore.actorChats.entries()) {
                chat.kind = 'actor';
                chat.history = this.sanitizeHistory(chat.history ?? []);
                if (!chat.actorId && String(key).startsWith('actor:')) {
                    chat.actorId = String(key).replace(/^actor:/, '');
                }
            }
            if (migrated.size > 0 || Object.keys(data).length > 0) {
                await this.saveActorChats();
            }
        } catch (e) {
            console.error('Chatzz | Failed to load actor chats:', e);
        }
    }

    static async saveActorChats() {
        try {
            await game.settings.set(MODULE_ID, 'actorChats', Object.fromEntries(DataStore.actorChats));
        } catch (e) {
            console.error('Chatzz | Failed to save actor chats:', e);
        }
    }

    static async loadUnreadData() {
        try {
            const data = game.settings.get(MODULE_ID, 'unreadData') || { counts: {}, lastRead: {}, lastActivity: {} };
            DataStore.unreadCounts = new Map(Object.entries(data.counts || {}));
            DataStore.lastRead = new Map(Object.entries(data.lastRead || {}));
            DataStore.lastActivity = new Map(Object.entries(data.lastActivity || {}));
        } catch (e) {
            console.warn('Chatzz | Failed to load unread data:', e);
        }
    }

    static async saveUnreadData() {
        try {
            await game.settings.set(MODULE_ID, 'unreadData', {
                counts: Object.fromEntries(DataStore.unreadCounts),
                lastRead: Object.fromEntries(DataStore.lastRead),
                lastActivity: Object.fromEntries(DataStore.lastActivity)
            });
        } catch (e) {
            console.warn('Chatzz | Failed to save unread data:', e);
        }
    }

    static async loadFavorites() {
        try {
            DataStore.favorites = new Set(game.settings.get(MODULE_ID, 'favorites') || []);
        } catch (e) {
            console.warn('Chatzz | Failed to load favorites:', e);
        }
    }

    static async saveFavorites() {
        try {
            await game.settings.set(MODULE_ID, 'favorites', Array.from(DataStore.favorites));
        } catch (e) {
            console.warn('Chatzz | Failed to save favorites:', e);
        }
    }

    static async loadMutedConversations() {
        try {
            DataStore.mutedConversations = new Set(game.settings.get(MODULE_ID, 'mutedConversations') || []);
        } catch (e) {
            console.warn('Chatzz | Failed to load muted conversations:', e);
        }
    }

    static async saveMutedConversations() {
        try {
            await game.settings.set(MODULE_ID, 'mutedConversations', Array.from(DataStore.mutedConversations));
        } catch (e) {
            console.warn('Chatzz | Failed to save muted conversations:', e);
        }
    }

    static async loadPinnedMessages() {
        try {
            DataStore.pinnedMessages = new Map(Object.entries(game.settings.get(MODULE_ID, 'pinnedMessages') || {}));
        } catch (e) {
            console.warn('Chatzz | Failed to load pinned messages:', e);
        }
    }

    static async savePinnedMessages() {
        try {
            await game.settings.set(MODULE_ID, 'pinnedMessages', Object.fromEntries(DataStore.pinnedMessages));
        } catch (e) {
            console.warn('Chatzz | Failed to save pinned messages:', e);
        }
    }

    static async loadSharedBackgrounds() {
        try {
            const data = game.settings.get(MODULE_ID, 'sharedBackgrounds') || {};
            DataStore.sharedBackgrounds = new Map(Object.entries(data));
        } catch (e) {
            console.warn('Chatzz | Failed to load shared backgrounds:', e);
        }
    }

    static async saveSharedBackgrounds() {
        if (!game.user.isGM) return;
        try {
            await game.settings.set(MODULE_ID, 'sharedBackgrounds', Object.fromEntries(DataStore.sharedBackgrounds));
        } catch (e) {
            console.warn('Chatzz | Failed to save shared backgrounds:', e);
        }
    }

    static async loadGMSettings() {
        if (!game.user.isGM) return;
        try {
            const data = game.settings.get(MODULE_ID, 'gmSettings') || {};
            DataStore._gmSettings = new Map(Object.entries(data));
        } catch (e) {
            console.warn('Chatzz | Failed to load GM settings:', e);
        }
    }

    static async saveGMSettings() {
        if (!game.user.isGM) return;
        try {
            await game.settings.set(MODULE_ID, 'gmSettings', Object.fromEntries(DataStore._gmSettings));
        } catch (e) {
            console.warn('Chatzz | Failed to save GM settings:', e);
        }
    }
}
