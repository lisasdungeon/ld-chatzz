/**
 * LD Chatzz - Data Manager
 * Turbo-level aggregator for the data layer.
 * Provides a unified interface for data operations while delegating logic to Engine modules.
 */

import { DataStore } from './data/DataStore.js';
import { DataPersistence } from './data/DataPersistence.js';
import { DataMessaging } from './data/DataMessaging.js';
import { DataUserUI } from './data/DataUserUI.js';
import { DataUtility } from './data/DataUtility.js';
import { DataImaging } from './data/DataImaging.js';
import { ActorContacts } from './data/ActorContacts.js';
import { ConversationUtils } from './data/ConversationUtils.js';

export class DataManager {
    static get privateChats() { return DataStore.privateChats; }
    static get actorChats() { return DataStore.actorChats; }
    static get groupChats() { return DataStore.groupChats; }
    static get unreadCounts() { return DataStore.unreadCounts; }
    static get lastActivity() { return DataStore.lastActivity; }
    static get favorites() { return DataStore.favorites; }
    static get mutedConversations() { return DataStore.mutedConversations; }
    static get pinnedMessages() { return DataStore.pinnedMessages; }
    static get sharedBackgrounds() { return DataStore.sharedBackgrounds; }
    static get interceptedMessages() { return DataStore.interceptedMessages; }
    static set interceptedMessages(value) { DataStore.interceptedMessages = value; }

    static async loadAll() {
        await DataPersistence.loadGroupChats();
        await DataPersistence.loadPrivateChats();
        await DataPersistence.loadActorChats();
        await Promise.all([
            DataPersistence.loadUnreadData(),
            DataPersistence.loadFavorites(),
            DataPersistence.loadMutedConversations(),
            DataPersistence.loadPinnedMessages(),
            DataPersistence.loadSharedBackgrounds(),
            DataPersistence.loadGMSettings(),
            DataUserUI.loadPlayerSettings(),
            DataUserUI.loadBackgroundSettings()
        ]);
    }

    static async saveGroupChats() { return DataPersistence.saveGroupChats(); }
    static async savePrivateChats() { return DataPersistence.savePrivateChats(); }
    static async saveActorChats() { return DataPersistence.saveActorChats(); }
    static async saveUnreadData() { return DataPersistence.saveUnreadData(); }
    static async saveFavorites() { return DataPersistence.saveFavorites(); }

    static getPrivateChatKey(u1, u2) { return DataMessaging.getPrivateChatKey(u1, u2); }
    static getActorChatKey(actorId) { return DataMessaging.getActorChatKey(actorId); }
    static getConversation(id) { return ConversationUtils.getConversation(id); }
    static getConversationType(id) { return ConversationUtils.getConversationType(id); }
    static addPrivateMessage(u1, u2, d) { 
        DataMessaging.addPrivateMessage(u1, u2, d);
        DataManager.updateActivity(DataMessaging.getPrivateChatKey(u1, u2));
    }
    static addActorMessage(actorId, d) {
        DataMessaging.addActorMessage(actorId, d);
        DataManager.updateActivity(DataMessaging.getActorChatKey(actorId));
    }
    static addGroupMessage(id, d) { 
        DataMessaging.addGroupMessage(id, d);
        DataManager.updateActivity(id);
    }
    static editMessage(c, m, n, g) { return DataMessaging.editMessage(c, m, n, g); }
    static deleteMessage(c, m, g) { return DataMessaging.deleteMessage(c, m, g); }
    static clearConversation(c, g) { return DataMessaging.clearConversation(c, g); }
    static searchMessages(c, q, g) { return DataMessaging.searchMessages(c, q, g); }
    static togglePin(c, m) { return DataMessaging.togglePin(c, m); }
    static isPinned(c, m) { return DataMessaging.isPinned(c, m); }

    static markAsRead(id) { DataUserUI.markAsRead(id); }
    static incrementUnread(id) { DataUserUI.incrementUnread(id); }
    static getUnreadCount(id) { return DataStore.unreadCounts.get(id) || 0; }
    static getTotalUnread() { return DataUserUI.getTotalUnread(); }
    static setTyping(c, u, t) { return DataUserUI.setTyping(c, u, t); }
    static getTypingUsers(c) { return DataUserUI.getTypingUsers(c); }
    static setReplyTo(m) { DataUserUI.setReplyTo(m); }
    static getReplyTo() { return DataUserUI.getReplyTo(); }
    static clearReplyTo() { DataUserUI.clearReplyTo(); }
    static updateActivity(id) {
        DataStore.lastActivity.set(id, Date.now());
        DataPersistence.saveUnreadData();
    }
    
    static toggleFavorite(id) { DataUserUI.toggleFavorite(id); }
    static isFavorite(id) { return DataStore.favorites.has(id); }
    static toggleMuted(id) { DataUserUI.toggleMuted(id); }
    static isMuted(id) { return DataStore.isMuted(id); }

    static getPlayerSetting(k, d) { return DataUserUI.getPlayerSetting(k, d); }
    static setPlayerSetting(k, v) { DataUserUI.setPlayerSetting(k, v); }
    static getGMSetting(k, d) { return DataUserUI.getGMSetting(k, d); }
    static setGMSetting(k, v) { DataUserUI.setGMSetting(k, v); }

    static createGroup(n, m) { return DataUtility.createGroup(n, m); }
    static updateGroup(id, u) { return DataUtility.updateGroup(id, u); }
    static deleteGroup(id) { return DataUtility.deleteGroup(id); }
    static getUserConversations() { return DataUtility.getUserConversations(); }
    static getVisibleActors() { return ActorContacts.getVisibleActors(); }
    static getActorRecipients(actor) { return ActorContacts.getRecipientUserIds(actor); }
    static acceptActorFriendRequest(actorId, requesterUserId) { return ActorContacts.acceptFriendRequest(actorId, requesterUserId); }
    static exportConversation(id, g) { return DataUtility.exportConversation(id, g); }
    
    static async processImage(d) { return DataImaging.processImage(d); }
    static validateImage(f) { return DataImaging.validateImage(f); }
    static addReaction(c, m, e, u, g) { return DataImaging.addReaction(c, m, e, u, g); }
    static getEffectiveBackground(c, u) { return DataImaging.getEffectiveBackground(c, u); }
    static setSharedBackground(u, p) { return DataImaging.setSharedBackground(u, p); }

    static addInterceptedMessage(p) {
        p.id = foundry.utils.randomID();
        p.interceptedAt = Date.now();
        DataStore.interceptedMessages.push(p);
        if (DataStore.interceptedMessages.length > 100) DataStore.interceptedMessages.shift();
        Hooks.callAll('chatzzMessageIntercepted', p);
    }
}
