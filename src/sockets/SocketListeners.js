/**
 * LD Chatzz - Socket Listeners
 * Engine for processing incoming socket messages.
 */

import { DataManager } from '../DataManager.js';
import { UIManager } from '../UIManager.js';
import { Utils } from '../Utils.js';
import { ActorContacts } from '../data/ActorContacts.js';
import { SOCKET_EVENTS, SOCKET_NAME } from '../Constants.js';

export class SocketListeners {
    static async handlePrivateMessage(payload) {
        const { recipientId, message, isRelay, originalSenderId, originalRecipientId, isMonitoring, targetType } = payload;
        if (targetType === 'actor' || String(recipientId).startsWith('actor:') || payload.conversationId?.startsWith('actor:')) {
            const actorId = payload.targetId
                || (typeof recipientId === 'string' ? recipientId.replace(/^actor:/, '') : '')
                || payload.conversationId?.replace(/^actor:/, '');
            if (!actorId) return;
            if (!isMonitoring && !isRelay) {
                const actor = game.actors.get(actorId);
                if (!actor) return;
                const allowed = ActorContacts.getRecipientUserIds(actor).includes(game.user.id) || ActorContacts.isVisibleToUser(actor, game.user);
                if (!allowed) return;
            }
            if (isMonitoring && game.user.isGM) {
                DataManager.addInterceptedMessage({
                    senderId: originalSenderId || message.senderId,
                    recipientId: actorId,
                    messageData: message
                });
                UIManager.updateGMMonitor();
                return;
            }

            const senderId = isRelay ? originalSenderId : message.senderId;
            DataManager.addActorMessage(actorId, message);
            DataManager.incrementUnread(DataManager.getActorChatKey(actorId));
            UIManager.openChatWindowForNewMessage(actorId, 'actor');
            UIManager.updatePlayerHub();
            return;
        }

        if (recipientId !== game.user.id && !isMonitoring && !isRelay) return;

        if (isMonitoring && game.user.isGM) {
            DataManager.addInterceptedMessage({
                senderId: originalSenderId || message.senderId,
                recipientId: originalRecipientId || recipientId,
                messageData: message
            });
            UIManager.updateGMMonitor();
            return;
        }

        const senderId = isRelay ? originalSenderId : message.senderId;

        DataManager.addPrivateMessage(senderId, recipientId, message);

        DataManager.incrementUnread(DataManager.getPrivateChatKey(senderId, recipientId));
        UIManager.openChatWindowForNewMessage(senderId, 'private');
        UIManager.updatePlayerHub();
    }

    static async handleGroupMessage(payload) {
        const { groupId, message, isMonitoring } = payload;
        const group = DataManager.groupChats.get(groupId);

        if (isMonitoring && game.user.isGM) {
            DataManager.addGroupMessage(groupId, message);
            DataManager.addInterceptedMessage({
                senderId: message.senderId,
                groupId: groupId,
                groupName: group?.name || 'Unknown',
                messageData: message
            });
            UIManager.updateGMMonitor();
            return;
        }

        if (group?.members.includes(game.user.id)) {
            DataManager.addGroupMessage(groupId, message);
            DataManager.incrementUnread(groupId);
            UIManager.openChatWindowForNewMessage(groupId, 'group');
            UIManager.updatePlayerHub();
        }
    }

    static handleTyping(payload) {
        const { conversationId, userId, isTyping, isGroup } = payload;
        if (DataManager.setTyping(conversationId, userId, isTyping)) {
            if (isGroup) UIManager.updateTypingIndicator(conversationId, 'group');
            else if (conversationId.startsWith('actor:')) {
                const actorId = conversationId.replace(/^actor:/, '');
                UIManager.updateTypingIndicator(actorId, 'actor');
            } else {
                const other = conversationId.split('-').find(id => id !== game.user.id);
                if (other) UIManager.updateTypingIndicator(other, 'private');
            }
        }
    }

    static async handleFriendRequest(payload) {
        const { targetActorId, targetActorName, requesterUserId, requesterUserName, requesterActorName, note } = payload;
        if (!targetActorId) return;

        const actor = game.actors.get(targetActorId);
        if (!actor) return;

        const canRespond = ActorContacts.getExplicitOwnerUserIds(actor).includes(game.user.id) || game.user.isGM;
        if (!canRespond) return;

        const requesterLabel = requesterActorName || requesterUserName || 'Someone';
        const safeRequester = Utils.sanitizeHTML(requesterLabel);
        const safeTarget = Utils.sanitizeHTML(targetActorName || actor.name);
        const body = `
            <div class="chatzz-friend-request">
                <p><strong>${safeRequester}</strong> wants to chat with <strong>${safeTarget}</strong>.</p>
                ${note ? `<p>${Utils.sanitizeHTML(note)}</p>` : ''}
            </div>
        `;

        new Dialog({
            title: game.i18n.localize('CHATZZ.FriendRequestTitle'),
            content: body,
            buttons: {
                accept: {
                    icon: '<i class="fas fa-check"></i>',
                    label: game.i18n.localize('CHATZZ.Accept'),
                    callback: async () => {
                        await DataManager.acceptActorFriendRequest(targetActorId, requesterUserId);
                        game.socket.emit(SOCKET_NAME, {
                            type: SOCKET_EVENTS.FRIEND_RESPONSE,
                            payload: {
                                targetActorId,
                                requesterUserId,
                                accepted: true
                            }
                        }, { recipients: [requesterUserId] });
                    }
                },
                decline: {
                    icon: '<i class="fas fa-times"></i>',
                    label: game.i18n.localize('CHATZZ.Decline'),
                    callback: async () => {
                        game.socket.emit(SOCKET_NAME, {
                            type: SOCKET_EVENTS.FRIEND_RESPONSE,
                            payload: {
                                targetActorId,
                                requesterUserId,
                                accepted: false
                            }
                        }, { recipients: [requesterUserId] });
                    }
                }
            },
            default: 'accept'
        }).render(true);
    }

    static async handleFriendResponse(payload) {
        const { targetActorId, requesterUserId, accepted } = payload;
        if (requesterUserId !== game.user.id) return;

        const actor = game.actors.get(targetActorId);
        const name = actor?.name || game.i18n.localize('CHATZZ.CharacterFallback');
        if (accepted) {
            ui.notifications.info(game.i18n.format('CHATZZ.FriendAccepted', { name }));
        } else {
            ui.notifications.warn(game.i18n.format('CHATZZ.FriendDeclined', { name }));
        }
    }

    static handleGroupCreate(payload) {
        const group = payload?.group;
        if (!group?.id) return;
        DataManager.groupChats.set(group.id, group);
        UIManager.updatePlayerHub();
        UIManager.updateGroupManager();
    }

    static handleGroupUpdate(payload) {
        const { groupId, updates } = payload || {};
        const group = DataManager.groupChats.get(groupId);
        if (!group || !updates) return;
        Object.assign(group, updates);
        UIManager.updateChatWindow(groupId, 'group');
        UIManager.updatePlayerHub();
        UIManager.updateGroupManager();
    }

    static handleGroupDelete(payload) {
        const groupId = payload?.groupId;
        if (!groupId) return;
        DataManager.groupChats.delete(groupId);
        UIManager.closeChatWindow(groupId, 'group');
        UIManager.updatePlayerHub();
        UIManager.updateGroupManager();
    }

    static handleEditMessage(payload) {
        const { conversationId, messageId, newContent, isGroup, userId } = payload || {};
        if (!conversationId || !messageId) return;
        const chat = isGroup ? DataManager.groupChats.get(conversationId) : DataManager.getConversation(conversationId);
        const msg = chat?.history?.find(m => m.id === messageId);
        if (userId && msg && msg.senderId !== userId && !game.user.isGM) return;
        DataManager.editMessage(conversationId, messageId, newContent, isGroup);
        if (isGroup) UIManager.updateChatWindow(conversationId, 'group');
        else UIManager.refreshConversationWindow(conversationId, 'private');
    }

    static handleDeleteMessage(payload) {
        const { conversationId, messageId, isGroup, userId } = payload || {};
        if (!conversationId || !messageId) return;
        const chat = isGroup ? DataManager.groupChats.get(conversationId) : DataManager.getConversation(conversationId);
        const msg = chat?.history?.find(m => m.id === messageId);
        if (userId && msg && msg.senderId !== userId && !game.user.isGM) return;
        DataManager.deleteMessage(conversationId, messageId, isGroup);
        if (isGroup) UIManager.updateChatWindow(conversationId, 'group');
        else UIManager.refreshConversationWindow(conversationId, 'private');
    }

    static handleAddReaction(payload) {
        const { conversationId, messageId, emoji, userId, isGroup } = payload || {};
        if (!conversationId || !messageId || !emoji) return;
        DataManager.addReaction(conversationId, messageId, emoji, userId, isGroup);
        if (isGroup) UIManager.updateChatWindow(conversationId, 'group');
        else UIManager.refreshConversationWindow(conversationId, 'private');
    }
}
