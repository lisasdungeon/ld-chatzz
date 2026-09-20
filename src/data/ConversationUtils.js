/**
 * LD Chatzz - Conversation Utilities
 * Shared lookup helpers for conversation resolution.
 */

import { DataStore } from './DataStore.js';

export class ConversationUtils {
    static getConversation(id) {
        return DataStore.groupChats.get(id) || DataStore.actorChats.get(id) || DataStore.privateChats.get(id) || null;
    }

    static getConversationType(id) {
        if (DataStore.groupChats.has(id)) return 'group';
        if (DataStore.actorChats.has(id) || String(id).startsWith('actor:')) return 'actor';
        if (DataStore.privateChats.has(id)) return 'private';
        return null;
    }
}
