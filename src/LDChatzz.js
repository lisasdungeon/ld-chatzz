/**
 * LD Chatzz - Main Module Class
 * Central coordinator for the module
 */

import { DataManager } from './DataManager.js';
import { SocketHandler } from './SocketHandler.js';
import { UIManager } from './UIManager.js';
import { MODULE_ID } from './Constants.js';
import { ActorContacts } from './data/ActorContacts.js';

export class LDChatzz {
    static ID = MODULE_ID;
    static NAME = 'LD Chatzz';

    /**
     * Initialize the module
     */
    static async initialize() {
        // Load all data from settings
        await DataManager.loadAll();
        
        // Apply shared backgrounds to any open windows
        for (const [uid, path] of DataManager.sharedBackgrounds.entries()) {
            if (path) UIManager.updateBackgroundForUser(uid, path);
        }
        
        // Initialize socket communications
        SocketHandler.initialize();
    }

    /**
     * Send a private message
     * @param {string} recipientId - Recipient user ID
     * @param {string} messageContent - Message content
     * @param {object} speakerData - Optional speaker override data
     * @param {string} imageUrl - Optional image URL/data
     */
    static async sendMessage(recipientId, messageContent, speakerData = null, imageUrl = null) {
        const senderId = game.user.id;
        
        const messageData = {
            senderId: senderId,
            senderName: speakerData ? speakerData.name : game.user.name,
            senderImg: speakerData ? speakerData.img : game.user.avatar,
            messageContent: messageContent,
            timestamp: Date.now(),
            id: foundry.utils.randomID()
        };

        // Add image if provided
        if (imageUrl) {
            messageData.imageUrl = imageUrl;
        }
        
        // Check for reply
        const replyToId = DataManager.getReplyTo();
        if (replyToId) {
            messageData.replyToId = replyToId;
            DataManager.clearReplyTo();
        }
        
        // Add message to local storage
        DataManager.addPrivateMessage(senderId, recipientId, messageData);
        
        // Send via socket
        SocketHandler.sendPrivateMessage(recipientId, messageData);

        // Update local UI
        UIManager.updateChatWindow(recipientId, 'private');
        UIManager.updatePlayerHub();
    }

    /**
     * Send a message to an actor conversation
     * @param {string} actorId - Actor ID
     * @param {string} messageContent - Message content
     * @param {object} speakerData - Optional speaker override data
     * @param {string} imageUrl - Optional image URL/data
     */
    static async sendActorMessage(actorId, messageContent, speakerData = null, imageUrl = null) {
        const actor = game.actors.get(actorId);
        if (!actor) {
            console.warn(`Chatzz | Cannot send to missing actor: ${actorId}`);
            return;
        }

        const senderId = game.user.id;
        const messageData = {
            senderId,
            senderName: speakerData ? speakerData.name : game.user.name,
            senderImg: speakerData ? speakerData.img : game.user.avatar,
            messageContent,
            timestamp: Date.now(),
            id: foundry.utils.randomID(),
            targetType: 'actor',
            targetId: actorId
        };

        if (imageUrl) {
            messageData.imageUrl = imageUrl;
        }

        const replyToId = DataManager.getReplyTo();
        if (replyToId) {
            messageData.replyToId = replyToId;
            DataManager.clearReplyTo();
        }

        DataManager.addActorMessage(actorId, messageData);
        SocketHandler.sendActorMessage(actorId, messageData);

        UIManager.updateChatWindow(actorId, 'actor');
        UIManager.updatePlayerHub();
    }

    /**
     * Send a group message
     * @param {string} groupId - Group ID
     * @param {string} messageContent - Message content
     * @param {object} speakerData - Optional speaker override data
     * @param {string} imageUrl - Optional image URL/data
     */
    static async sendGroupMessage(groupId, messageContent, speakerData = null, imageUrl = null) {
        const group = DataManager.groupChats.get(groupId);
        if (!group) {
            console.warn(`Chatzz | Cannot send to non-existent group: ${groupId}`);
            return;
        }
        
        const senderId = game.user.id;
        
        const messageData = {
            senderId: senderId,
            senderName: speakerData ? speakerData.name : game.user.name,
            senderImg: speakerData ? speakerData.img : game.user.avatar,
            messageContent: messageContent,
            timestamp: Date.now(),
            id: foundry.utils.randomID()
        };

        // Add image if provided
        if (imageUrl) {
            messageData.imageUrl = imageUrl;
        }
        
        // Check for reply
        const replyToId = DataManager.getReplyTo();
        if (replyToId) {
            messageData.replyToId = replyToId;
            DataManager.clearReplyTo();
        }
        
        // Add message to local storage
        DataManager.addGroupMessage(groupId, messageData);
        
        // Send via socket
        SocketHandler.sendGroupMessage(groupId, messageData);
        
        // Update local UI
        UIManager.updateChatWindow(groupId, 'group');
        UIManager.updatePlayerHub();
    }

    /**
     * Create a new group chat
     * @param {string} name - Group name
     * @param {Array<string>} members - Array of member user IDs
     * @returns {object} The created group
     */
    static async createGroup(name, members) {
        // Ensure creator is included
        const allMembers = [...new Set([game.user.id, ...members])];
        
        const group = DataManager.createGroup(name, allMembers);
        
        // Save if GM
        if (game.user.isGM) {
            await DataManager.saveGroupChats();
        }
        
        // Broadcast to other members
        SocketHandler.broadcastGroupCreate(group);
        
        // Update UI
        UIManager.updatePlayerHub();
        UIManager.updateGroupManager();
        
        ui.notifications.info(game.i18n.format('CHATZZ.GroupCreated', { name: group.name }));
        
        return group;
    }

    /**
     * Delete a group chat (GM only)
     * @param {string} groupId - Group ID
     */
    static async deleteGroup(groupId) {
        if (!game.user.isGM) {
            ui.notifications.error(game.i18n.localize('CHATZZ.DeletePermissionError'));
            return;
        }
        
        const group = DataManager.groupChats.get(groupId);
        if (!group) return;
        
        const members = [...group.members];
        const name = group.name;
        
        // Delete locally
        DataManager.deleteGroup(groupId);
        
        // Save
        await DataManager.saveGroupChats();
        
        // Broadcast deletion
        SocketHandler.broadcastGroupDelete(groupId, members);
        
        // Close any open windows
        UIManager.closeChatWindow(groupId, 'group');
        
        // Update UI
        UIManager.updatePlayerHub();
        UIManager.updateGroupManager();
        
        ui.notifications.info(game.i18n.format('CHATZZ.DeleteSuccess', { name }));
    }

    /**
     * Edit a message
     * @param {string} conversationId - Conversation ID
     * @param {string} messageId - Message ID
     * @param {string} newContent - New content
     * @param {boolean} isGroup - Is group chat
     */
    static async editMessage(conversationId, messageId, newContent, isGroup = false) {
        // Edit locally
        DataManager.editMessage(conversationId, messageId, newContent, isGroup);
        
        // Save if GM
        if (game.user.isGM) {
            await (isGroup ? DataManager.saveGroupChats() : DataManager.savePrivateChats());
        }
        
        // Broadcast edit
        SocketHandler.broadcastEditMessage(conversationId, messageId, newContent, isGroup);
        
        // Update UI
        if (isGroup) {
            UIManager.updateChatWindow(conversationId, 'group');
        } else {
            UIManager.refreshConversationWindow(conversationId, 'private');
        }
    }

    /**
     * Delete a message
     * @param {string} conversationId - Conversation ID
     * @param {string} messageId - Message ID
     * @param {boolean} isGroup - Is group chat
     */
    static async deleteMessage(conversationId, messageId, isGroup = false) {
        // Delete locally
        DataManager.deleteMessage(conversationId, messageId, isGroup);
        
        // Save if GM
        if (game.user.isGM) {
            await (isGroup ? DataManager.saveGroupChats() : DataManager.savePrivateChats());
        }
        
        // Broadcast deletion
        SocketHandler.broadcastDeleteMessage(conversationId, messageId, isGroup);
        
        // Update UI
        if (isGroup) {
            UIManager.updateChatWindow(conversationId, 'group');
        } else {
            UIManager.refreshConversationWindow(conversationId, 'private');
        }
        
        ui.notifications.info(game.i18n.localize('CHATZZ.MessageDeleted'));
    }

    /**
     * Toggle reaction on a message
     * @param {string} conversationId - Conversation ID
     * @param {string} messageId - Message ID
     * @param {string} emoji - Emoji
     * @param {boolean} isGroup - Is group chat
     */
    static async toggleReaction(conversationId, messageId, emoji, isGroup = false) {
        // Toggle locally
        DataManager.addReaction(conversationId, messageId, emoji, game.user.id, isGroup);
        
        // Save if GM
        if (game.user.isGM) {
            await (isGroup ? DataManager.saveGroupChats() : DataManager.savePrivateChats());
        }
        
        // Broadcast reaction
        SocketHandler.broadcastReaction(conversationId, messageId, emoji, isGroup);
        
        // Update UI
        if (isGroup) {
            UIManager.updateChatWindow(conversationId, 'group');
        } else {
            UIManager.refreshConversationWindow(conversationId, 'private');
        }
    }

    /**
     * Send a friend request to the owners of an actor
     * @param {string} actorId
     * @param {object} options
     */
    static async requestActorFriendship(actorId, options = {}) {
        const actor = game.actors.get(actorId);
        if (!actor) {
            ui.notifications.warn(game.i18n.localize('CHATZZ.ActorNotFound'));
            return false;
        }

        const recipients = ActorContacts.getRecipientUserIds(actor);
        if (!recipients.length) {
            ui.notifications.warn(game.i18n.localize('CHATZZ.NoOwnerOrGM'));
            return false;
        }

        SocketHandler.sendFriendRequest({
            requestId: foundry.utils.randomID(),
            targetActorId: actorId,
            targetActorName: actor.name,
            targetActorImg: actor.img,
            requesterUserId: game.user.id,
            requesterUserName: game.user.name,
            requesterActorId: options.requesterActorId || game.user.character?.id || null,
            requesterActorName: options.requesterActorName || game.user.character?.name || game.user.name,
            note: options.note || ''
        }, recipients);

        return true;
    }

    static async acceptActorFriendRequest(actorId, requesterUserId) {
        return DataManager.acceptActorFriendRequest(actorId, requesterUserId);
    }
}
