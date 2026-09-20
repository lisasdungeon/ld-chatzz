/**
 * LD Chatzz - Data Utility
 * Group management, search, and export utilities.
 */

import { DataStore } from './DataStore.js';
import { DataUserUI } from './DataUserUI.js';
import { ActorContacts } from './ActorContacts.js';
import { Utils } from '../Utils.js';
import { ConversationUtils } from './ConversationUtils.js';

export class DataUtility {
    static createGroup(name, members) {
        const id = foundry.utils.randomID();
        const group = {
            id: id,
            name: name,
            members: [...new Set(members)],
            history: [],
            createdAt: Date.now(),
            createdBy: game.user.id
        };
        DataStore.groupChats.set(id, group);
        return group;
    }

    static updateGroup(id, updates) {
        const group = DataStore.groupChats.get(id);
        if (!group) return false;
        Object.assign(group, updates);
        return true;
    }

    static deleteGroup(id) {
        return DataStore.groupChats.delete(id);
    }

    static exportConversation(id, isGroup = false) {
        const chat = isGroup ? DataStore.groupChats.get(id) : ConversationUtils.getConversation(id);
        if (!chat || !chat.history) return '';

        const lines = [];
        let title = 'Private Chat';
        if (isGroup) {
            title = `Group: ${chat.name || 'Unknown'}`;
        } else if (chat.kind === 'actor' || String(id).startsWith('actor:')) {
            const actorId = chat.actorId || String(id).replace(/^actor:/, '');
            const actor = game.actors.get(actorId);
            title = `Character: ${chat.actorName || actor?.name || 'Unknown'}`;
        }

        lines.push('════════════════════════════════════════');
        lines.push(`Chatzz Chat Export - ${title}`);
        lines.push(`Exported: ${new Date().toLocaleString()}`);
        lines.push('════════════════════════════════════════');
        lines.push('');

        const sorted = [...chat.history].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        for (const msg of sorted) {
            const time = msg.timestamp ? new Date(msg.timestamp).toLocaleString() : 'Unknown';
            const sender = msg.senderName || 'Unknown';
            const content = (msg.messageContent || '').replace(/<[^>]*>/g, '');
            lines.push(`[${time}] ${sender}:`);
            lines.push(`  ${content}`);
            if (msg.imageUrl) lines.push(`  [Image: ${msg.imageUrl}]`);
            lines.push('');
        }

        lines.push('════════════════════════════════════════');
        return lines.join('\n');
    }

    static getUserConversations() {
        const userId = game.user.id;
        const convs = [];

        for (const [key, chat] of DataStore.actorChats.entries()) {
            const actorId = chat.actorId || String(key).replace(/^actor:/, '');
            const actor = game.actors.get(actorId);
            if (!actor || !ActorContacts.isVisibleToUser(actor, game.user)) continue;

            convs.push({
                id: key,
                type: 'actor',
                name: chat.actorName || actor.name || 'Unknown Actor',
                avatar: chat.actorImg || actor.img,
                color: Utils.getUserColor(actor.id),
                initials: Utils.getUserInitials(chat.actorName || actor.name || 'A'),
                isOnline: ActorContacts.getRecipientUserIds(actor).some(id => game.users.get(id)?.active),
                actorId,
                lastMessage: chat.history?.[chat.history.length - 1] || null,
                unread: DataStore.unreadCounts.get(key) || 0,
                isFavorite: DataStore.favorites.has(key),
                isMuted: DataStore.mutedConversations.has(key),
                lastActivity: DataStore.lastActivity.get(key) || 0
            });
        }

        for (const [key, chat] of DataStore.privateChats.entries()) {
            if (!chat.users?.includes(userId)) continue;
            const otherId = chat.users.find(id => id !== userId);
            const otherUser = game.users.get(otherId);
            convs.push({
                id: key,
                type: 'private',
                name: otherUser?.name || 'Unknown User',
                avatar: otherUser?.avatar,
                isOnline: otherUser?.active,
                otherUserId: otherId,
                lastMessage: chat.history?.[chat.history.length - 1] || null,
                unread: DataStore.unreadCounts.get(key) || 0,
                isFavorite: DataStore.favorites.has(key),
                isMuted: DataStore.mutedConversations.has(key),
                lastActivity: DataStore.lastActivity.get(key) || 0
            });
        }

        for (const [id, group] of DataStore.groupChats.entries()) {
            if (!group.members?.includes(userId)) continue;
            convs.push({
                id: id,
                type: 'group',
                name: group.name || 'Unnamed Group',
                members: group.members,
                lastMessage: group.history?.[group.history.length - 1] || null,
                unread: DataStore.unreadCounts.get(id) || 0,
                isFavorite: DataStore.favorites.has(id),
                isMuted: DataStore.mutedConversations.has(id),
                lastActivity: DataStore.lastActivity.get(id) || 0
            });
        }

        return convs.sort((a, b) => (b.isFavorite - a.isFavorite) || (b.lastActivity - a.lastActivity));
    }
}
