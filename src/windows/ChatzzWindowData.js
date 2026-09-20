/**
 * LD Chatzz - Chat Window Data
 * Engine for Chat Window context preparation and message enrichment.
 */

import { REACTION_EMOJIS } from '../Constants.js';
import { DataManager } from '../DataManager.js';
import { Utils } from '../Utils.js';
import { ActorContacts } from '../data/ActorContacts.js';

export class ChatzzWindowData {
    static async getChatContext(app) {
        const { groupId, otherUserId, actorId } = app.options;
        const convId = groupId
            ? groupId
            : actorId
                ? DataManager.getActorChatKey(actorId)
                : DataManager.getPrivateChatKey(game.user.id, otherUserId);
        
        const context = {
            currentUser: game.user,
            isGM: game.user.isGM,
            reactionEmojis: REACTION_EMOJIS,
            isGroup: !!groupId,
            isActorChat: !!actorId,
            conversationId: convId,
            isFavorite: DataManager.isFavorite(convId),
            isMuted: DataManager.isMuted(convId)
        };

        if (context.isGM) {
            context.speakers = [
                { id: game.user.id, name: game.user.name, isActor: false },
                ...game.actors.filter(a => a.isOwner).map(a => ({ id: a.id, name: a.name, isActor: true }))
            ];
        }

        let rawMessages = [];
        if (actorId) {
            rawMessages = DataManager.getConversation(convId)?.history || [];
            DataManager.markAsRead(convId);
            const actor = game.actors.get(actorId);
            context.otherActor = actor;
            context.isOnline = actor ? ActorContacts.getRecipientUserIds(actor).some(id => game.users.get(id)?.active) : false;
        } else if (otherUserId) {
            rawMessages = DataManager.getConversation(convId)?.history || [];
            DataManager.markAsRead(convId);
            context.otherUser = game.users.get(otherUserId);
            context.isOnline = game.users.get(otherUserId)?.active;
        } else {
            const group = DataManager.groupChats.get(groupId);
            rawMessages = group?.history || [];
            DataManager.markAsRead(groupId);
            context.group = group;
            context.memberCount = group?.members?.length || 0;
        }

        context.messages = this._enrichMessages(rawMessages, convId, app._searchQuery);
        context.typingText = this._getTypingText(convId);
        
        const replyToId = DataManager.getReplyTo();
        if (replyToId) {
            const replyMsg = rawMessages.find(m => m.id === replyToId);
            if (replyMsg) context.replyingTo = Utils.formatReplyQuote(replyMsg);
        }

        return context;
    }

    static _enrichMessages(messages, convId, query) {
        let filtered = [...messages];
        if (query) {
            const q = query.toLowerCase();
            filtered = filtered.filter(m => (m.messageContent || '').toLowerCase().includes(q) || (m.senderName || '').toLowerCase().includes(q));
        }

        return filtered.map(msg => ({
            ...msg,
            relativeTime: Utils.formatRelativeTime(msg.timestamp),
            isOwn: msg.senderId === game.user.id,
            displayContent: msg.messageContent || '',
            isPinned: DataManager.isPinned(convId, msg.id),
            reactions: this._formatReactions(msg.reactions),
            formattedReactions: this._formatReactions(msg.reactions || {}), // Ensure default object
            avatar: Utils.getUserAvatar(msg.senderId),
            senderImg: msg.senderImg || Utils.getUserAvatar(msg.senderId), // Fallback for image field
            userColor: Utils.getUserColor(msg.senderId)
        }));
    }

    static _formatReactions(reactions) {
        if (!reactions) return [];
        return Object.entries(reactions).map(([emoji, users]) => ({
            emoji,
            count: users.length,
            users: users.map(id => game.users.get(id)?.name).filter(Boolean).join(', '),
            isOwnReaction: users.includes(game.user.id)
        }));
    }

    static _getTypingText(convId) {
        const names = DataManager.getTypingUsers(convId);
        if (!names.length) return '';
        return names.length === 1 
            ? game.i18n.format('CHATZZ.TypingSingle', { name: names[0] })
            : game.i18n.format('CHATZZ.TypingMultiple', { names: names.join(', ') });
    }
}
