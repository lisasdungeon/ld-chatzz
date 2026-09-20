/**
 * LD Chatzz - Player Hub Data
 * Engine for preparation and formatting of Player Hub data.
 */

import { MODULE_ID } from '../Constants.js';
import { ThemeManager } from '../ThemeManager.js';
import { DataManager } from '../DataManager.js';

export class PlayerHubData {
    static async getHubContext(activeTab) {
        const conversations = this._getConversations();
        const users = this._getUsers(game.user);
        const actors = DataManager.getVisibleActors();
        const settings = this._getSettings();

        return {
            conversations,
            users: users.all,
            gmUsers: users.gms,
            playerUsers: users.players,
            actorFriends: actors,
            isGM: game.user.isGM,
            totalUnread: DataManager.getTotalUnread() || 0,
            activeTab: activeTab,
            enableSounds: settings.enableSounds,
            soundVolume: (Number(settings.soundVolume) || 0.5) * 100,
            enableNotifications: settings.enableNotifications,
            personalBackground: settings.personalBackground,
            themes: ThemeManager.getThemes(),
            moduleId: MODULE_ID
        };
    }

    static _getConversations() {
        const convs = [];
        const all = DataManager.getUserConversations();

        for (const conv of all) {
            convs.push({
                id: conv.id,
                name: conv.name,
                type: conv.type,
                icon: conv.type === 'group'
                    ? 'fa-users'
                    : conv.type === 'actor'
                        ? 'fa-dragon'
                        : 'fa-user-secret',
                unreadCount: conv.unread || 0,
                hasUnread: (conv.unread || 0) > 0,
                isFavorite: conv.isFavorite,
                lastActivity: conv.lastActivity || 0,
                lastMessage: conv.lastMessage ? {
                    preview: this._getMessagePreview(conv.lastMessage),
                    time: this._formatRelativeTime(conv.lastMessage.timestamp)
                } : null,
                isOnline: conv.isOnline,
                avatar: conv.avatar,
                color: conv.color,
                initials: conv.initials,
                otherUserId: conv.otherUserId,
                otherActorId: conv.actorId
            });
        }

        return convs.sort((a, b) => (b.isFavorite - a.isFavorite) || (b.lastActivity - a.lastActivity));
    }

    static _getUsers(currentUser) {
        const all = game.users
            .filter(u => u.id !== currentUser.id)
            .map(u => ({
                id: u.id,
                name: u.name,
                isOnline: u.active,
                isGM: u.isGM,
                avatar: u.avatar,
                color: u.color || '#cccccc',
                initials: u.name ? u.name.substring(0, 2).toUpperCase() : '?'
            }))
            .sort((a, b) => b.isOnline - a.isOnline || a.name.localeCompare(b.name));
            
        return {
            all,
            gms: all.filter(u => u.isGM),
            players: all.filter(u => !u.isGM)
        };
    }

    static _getSettings() {
        return {
            enableSounds: game.settings.get(MODULE_ID, 'enableSounds'),
            soundVolume: game.settings.get(MODULE_ID, 'notificationVolume'),
            enableNotifications: game.settings.get(MODULE_ID, 'enableDesktopNotifications'),
            personalBackground: game.settings.get(MODULE_ID, 'personalBackground')
        };
    }

    static _getMessagePreview(msg) {
        if (!msg) return '';
        let content = (msg.messageContent || '').replace(/<[^>]*>/g, '').trim();
        return content.length > 50 ? content.substring(0, 50) + '...' : content;
    }

    static _formatRelativeTime(time) {
        if (!time) return '';
        const diff = Date.now() - time;
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'Just now';
        if (mins < 60) return `${mins}m`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h`;
        return `${Math.floor(hrs / 24)}d`;
    }
}
