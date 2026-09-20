/**
 * LD Chatzz - Actor Contacts
 * Helper methods for actor-based conversations and friendship gating.
 */

import { MODULE_ID } from '../Constants.js';
import { Utils } from '../Utils.js';

export class ActorContacts {
    static getExplicitOwnerUserIds(actor) {
        const ids = [];
        const ownership = actor?.ownership;

        if (ownership && typeof ownership === 'object') {
            for (const [userId, level] of Object.entries(ownership)) {
                if (Number(level) >= Number(CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER)) {
                    ids.push(userId);
                }
            }
        }

        return [...new Set(ids)];
    }

    static getAcceptedFriendUserIds(actor) {
        return [...new Set(actor?.getFlag?.(MODULE_ID, 'acceptedFriendUserIds') || [])];
    }

    static isVisibleToUser(actor, user = game.user) {
        if (!actor || !user) return false;

        const ownerIds = this.getExplicitOwnerUserIds(actor);
        if (ownerIds.includes(user.id)) return true;

        return this.getAcceptedFriendUserIds(actor).includes(user.id);
    }

    static getVisibleActors(user = game.user) {
        return game.actors
            .filter(actor => this.isVisibleToUser(actor, user))
            .map(actor => this.getActorCard(actor))
            .sort((a, b) => b.isOnline - a.isOnline || a.name.localeCompare(b.name));
    }

    static getActorCard(actor) {
        const ownerIds = this.getExplicitOwnerUserIds(actor);
        const isOnline = ownerIds.some(id => game.users.get(id)?.active);
        return {
            id: actor.id,
            name: actor.name,
            avatar: actor.img,
            color: Utils.getUserColor(actor.id),
            initials: Utils.getUserInitials(actor.name),
            isOnline,
            isOwner: ownerIds.includes(game.user.id),
            acceptedFriendUserIds: this.getAcceptedFriendUserIds(actor)
        };
    }

    static getRecipientUserIds(actor) {
        const recipients = new Set([
            ...this.getExplicitOwnerUserIds(actor),
            ...this.getAcceptedFriendUserIds(actor)
        ]);

        recipients.delete(game.user.id);

        if (recipients.size > 0) return Array.from(recipients);

        return game.users
            .filter(u => u.isGM && u.active && u.id !== game.user.id)
            .map(u => u.id);
    }

    static async acceptFriendRequest(actorId, requesterUserId) {
        const actor = game.actors.get(actorId);
        if (!actor) return false;

        const ids = new Set(this.getAcceptedFriendUserIds(actor));
        ids.add(requesterUserId);
        await actor.setFlag(MODULE_ID, 'acceptedFriendUserIds', Array.from(ids));
        return true;
    }
}
