/**
 * LD Chatzz - Socket Handler
 * Turbo-level component for managing module-wide WebSocket communications.
 */

import { SOCKET_NAME, SOCKET_EVENTS } from './Constants.js';
import { SocketListeners } from './sockets/SocketListeners.js';
import { SocketEmitters } from './sockets/SocketEmitters.js';

export class SocketHandler {
    static initialize() {
        game.socket.on(SOCKET_NAME, (data) => this._onSocketMessage(data));
    }

    static async _onSocketMessage(data) {
        if (!data || !data.type) return;
        switch (data.type) {
            case SOCKET_EVENTS.PRIVATE_MESSAGE:
                await SocketListeners.handlePrivateMessage(data.payload);
                break;
            case SOCKET_EVENTS.GROUP_MESSAGE:
                await SocketListeners.handleGroupMessage(data.payload);
                break;
            case SOCKET_EVENTS.TYPING:
                SocketListeners.handleTyping(data.payload);
                break;
            case SOCKET_EVENTS.FRIEND_REQUEST:
                await SocketListeners.handleFriendRequest?.(data.payload);
                break;
            case SOCKET_EVENTS.FRIEND_RESPONSE:
                await SocketListeners.handleFriendResponse?.(data.payload);
                break;
            case SOCKET_EVENTS.EDIT_MESSAGE:
                await SocketListeners.handleEditMessage?.(data.payload);
                break;
            case SOCKET_EVENTS.DELETE_MESSAGE:
                await SocketListeners.handleDeleteMessage?.(data.payload);
                break;
            case SOCKET_EVENTS.ADD_REACTION:
                await SocketListeners.handleAddReaction?.(data.payload);
                break;
            case SOCKET_EVENTS.GROUP_CREATE:
                SocketListeners.handleGroupCreate?.(data.payload);
                break;
            case SOCKET_EVENTS.GROUP_UPDATE:
                SocketListeners.handleGroupUpdate?.(data.payload);
                break;
            case SOCKET_EVENTS.GROUP_DELETE:
                SocketListeners.handleGroupDelete?.(data.payload);
                break;
            default:
                break;
        }
    }

    // Proxy emitters for backwards compatibility
    static emit(type, payload, options) { SocketEmitters.emit(type, payload, options); }
    static sendPrivateMessage(id, msg) { SocketEmitters.sendPrivateMessage(id, msg); }
    static sendActorMessage(id, msg) { SocketEmitters.sendActorMessage(id, msg); }
    static sendGroupMessage(id, msg) { SocketEmitters.sendGroupMessage(id, msg); }
    static sendTypingIndicator(id, typ, grp) { SocketEmitters.sendTypingIndicator(id, typ, grp); }
    static sendFriendRequest(payload, recipients) { SocketEmitters.sendFriendRequest(payload, recipients); }
    static sendFriendResponse(payload, recipients) { SocketEmitters.sendFriendResponse(payload, recipients); }
    static broadcastGroupCreate(group) { SocketEmitters.broadcastGroupCreate(group); }
    static broadcastGroupUpdate(groupId, updates) { SocketEmitters.broadcastGroupUpdate(groupId, updates); }
    static broadcastGroupDelete(groupId, members) { SocketEmitters.broadcastGroupDelete(groupId, members); }
    static broadcastEditMessage(convId, msgId, content, isGroup) { SocketEmitters.broadcastEditMessage(convId, msgId, content, isGroup); }
    static broadcastDeleteMessage(convId, msgId, isGroup) { SocketEmitters.broadcastDeleteMessage(convId, msgId, isGroup); }
    static broadcastReaction(convId, msgId, emoji, isGroup) { SocketEmitters.broadcastReaction(convId, msgId, emoji, isGroup); }
}
