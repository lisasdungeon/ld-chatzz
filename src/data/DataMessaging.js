/**
 * LD Chatzz - Data Messaging
 * Functional logic for managing chat messages.
 */

import { DEFAULTS } from '../Constants.js';
import { Utils } from '../Utils.js';
import { DataStore } from './DataStore.js';
import { DataPersistence } from './DataPersistence.js';

export class DataMessaging {
    static getPrivateChatKey(u1, u2) {
        return [u1, u2].sort().join('-');
    }

    static getActorChatKey(actorId) {
        return `actor:${actorId}`;
    }

    static addPrivateMessage(u1, u2, data) {
        const key = this.getPrivateChatKey(u1, u2);
        if (!DataStore.privateChats.has(key)) {
            DataStore.privateChats.set(key, { kind: 'user', users: [u1, u2], history: [] });
        }
        if (!data || Object.keys(data).length === 0) return;
        if (!data.id) data.id = foundry.utils.randomID();
        if (typeof data.messageContent === 'string') {
            data.messageContent = Utils.parseRichContent(data.messageContent);
        }
        const chat = DataStore.privateChats.get(key);
        if (!chat.history.some(m => m.id === data.id)) {
            chat.history.push(data);
            if (chat.history.length > DEFAULTS.maxMessageHistory) {
                chat.history = chat.history.slice(-DEFAULTS.maxMessageHistory);
            }
        }
        chat.history = DataPersistence.sanitizeHistory(chat.history);
        DataPersistence.savePrivateChats();
    }

    static addActorMessage(actorId, data) {
        const key = this.getActorChatKey(actorId);
        const actor = game.actors.get(actorId);
        if (!DataStore.actorChats.has(key)) {
            DataStore.actorChats.set(key, {
                kind: 'actor',
                actorId,
                actorName: actor?.name || data?.actorName || 'Unknown',
                actorImg: actor?.img || data?.actorImg || '',
                history: []
            });
        }
        if (!data || Object.keys(data).length === 0) return;
        if (!data.id) data.id = foundry.utils.randomID();
        if (typeof data.messageContent === 'string') {
            data.messageContent = Utils.parseRichContent(data.messageContent);
        }
        const chat = DataStore.actorChats.get(key);
        chat.kind = 'actor';
        chat.actorId = actorId;
        chat.actorName = chat.actorName || actor?.name || data.actorName || 'Unknown';
        chat.actorImg = chat.actorImg || actor?.img || data.actorImg || '';
        if (!chat.history.some(m => m.id === data.id)) {
            chat.history.push(data);
            if (chat.history.length > DEFAULTS.maxMessageHistory) {
                chat.history = chat.history.slice(-DEFAULTS.maxMessageHistory);
            }
        }
        chat.history = DataPersistence.sanitizeHistory(chat.history);
        DataPersistence.saveActorChats();
    }

    static addGroupMessage(groupId, data) {
        const group = DataStore.groupChats.get(groupId);
        if (!group) return;
        if (!group.history) group.history = [];
        if (!data || Object.keys(data).length === 0) return;
        if (!data.id) data.id = foundry.utils.randomID();
        if (typeof data.messageContent === 'string') {
            data.messageContent = Utils.parseRichContent(data.messageContent);
        }
        if (!group.history.some(m => m.id === data.id)) {
            group.history.push(data);
            if (group.history.length > DEFAULTS.maxMessageHistory) {
                group.history = group.history.slice(-DEFAULTS.maxMessageHistory);
            }
        }
        group.history = DataPersistence.sanitizeHistory(group.history);
        DataPersistence.saveGroupChats();
    }

    static editMessage(convId, msgId, content, isGroup = false) {
        const chat = isGroup ? DataStore.groupChats.get(convId) : this._getPrivateOrActorChat(convId);
        if (!chat) return false;
        const msg = (chat.history || []).find(m => m.id === msgId);
        if (!msg) return false;
        msg.messageContent = Utils.parseRichContent(content);
        msg.edited = true;
        msg.editedAt = Date.now();
        if (isGroup) DataPersistence.saveGroupChats();
        else if (chat.kind === 'actor') DataPersistence.saveActorChats();
        else DataPersistence.savePrivateChats();
        return true;
    }

    static deleteMessage(convId, msgId, isGroup = false) {
        const chat = isGroup ? DataStore.groupChats.get(convId) : this._getPrivateOrActorChat(convId);
        if (!chat) return false;
        const idx = (chat.history || []).findIndex(m => m.id === msgId);
        if (idx === -1) return false;
        chat.history.splice(idx, 1);
        if (isGroup) DataPersistence.saveGroupChats();
        else if (chat.kind === 'actor') DataPersistence.saveActorChats();
        else DataPersistence.savePrivateChats();
        return true;
    }

    static searchMessages(convId, query, isGroup = false) {
        const chat = isGroup ? DataStore.groupChats.get(convId) : this._getPrivateOrActorChat(convId);
        if (!chat || !query) return chat?.history || [];
        const q = query.toLowerCase();
        return (chat.history || []).filter(m => {
            const c = (m.messageContent || '').toLowerCase();
            const s = (m.senderName || '').toLowerCase();
            return c.includes(q) || s.includes(q);
        });
    }

    static clearConversation(convId, isGroup = false) {
        const chat = isGroup ? DataStore.groupChats.get(convId) : this._getPrivateOrActorChat(convId);
        if (!chat) return;
        chat.history = [];
        if (isGroup) DataPersistence.saveGroupChats();
        else if (chat.kind === 'actor') DataPersistence.saveActorChats();
        else DataPersistence.savePrivateChats();
    }

    static togglePin(convId, msgId) {
        if (!DataStore.pinnedMessages.has(convId)) {
            DataStore.pinnedMessages.set(convId, []);
        }
        const pinned = DataStore.pinnedMessages.get(convId);
        const idx = pinned.indexOf(msgId);
        if (idx > -1) pinned.splice(idx, 1);
        else pinned.push(msgId);
        DataPersistence.savePinnedMessages();
    }

    static isPinned(convId, msgId) {
        const pinned = DataStore.pinnedMessages.get(convId);
        return pinned ? pinned.includes(msgId) : false;
    }

    static _getPrivateOrActorChat(convId) {
        return DataStore.privateChats.get(convId) || DataStore.actorChats.get(convId);
    }
}
