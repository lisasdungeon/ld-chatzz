/**
 * LD Chatzz - Data Imaging
 * Image processing, reactions, and effective backgrounds.
 */

import { DEFAULTS } from '../Constants.js';
import { DataStore } from './DataStore.js';
import { DataPersistence } from './DataPersistence.js';
import { ConversationUtils } from './ConversationUtils.js';

export class DataImaging {
    static async processImage(data) {
        try {
            if (typeof data === 'string') {
                if (data.startsWith('http') || data.startsWith('data:')) return data;
                return null;
            }
            if (data instanceof File) {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(data);
                });
            }
            return null;
        } catch (e) {
            console.error('Chatzz | Failed to process image:', e);
            return null;
        }
    }

    static validateImage(file) {
        const maxSize = 5 * 1024 * 1024;
        const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (!file) return { valid: false, error: 'No file provided' };
        if (file.size > maxSize) return { valid: false, error: 'Image too large (max 5MB)' };
        if (!allowed.includes(file.type)) return { valid: false, error: 'Invalid type' };
        return { valid: true };
    }

    static addReaction(convId, msgId, emoji, userId, isGroup = false) {
        const chat = isGroup ? DataStore.groupChats.get(convId) : ConversationUtils.getConversation(convId);
        if (!chat) return false;
        const msg = (chat.history || []).find(m => m.id === msgId);
        if (!msg) return false;
        if (!msg.reactions) msg.reactions = {};
        if (!msg.reactions[emoji]) msg.reactions[emoji] = [];
        const idx = msg.reactions[emoji].indexOf(userId);
        if (idx > -1) {
            msg.reactions[emoji].splice(idx, 1);
            if (msg.reactions[emoji].length === 0) delete msg.reactions[emoji];
        } else {
            msg.reactions[emoji].push(userId);
        }
        return true;
    }

    static getEffectiveBackground(chatKey, userId = null) {
        userId = userId || game.user.id;
        return DataStore.gmBackgrounds.perChat.get(chatKey) ||
               DataStore._chatBackgrounds.get(chatKey) ||
               DataStore.gmBackgrounds.perUser.get(userId) ||
               DataStore._personalBackground ||
               DataStore.gmBackgrounds.global || null;
    }

    static setSharedBackground(userId, path) {
        if (!game.user.isGM) return;
        if (path) DataStore.sharedBackgrounds.set(userId, path);
        else DataStore.sharedBackgrounds.delete(userId);
        DataPersistence.saveSharedBackgrounds();
    }
}
