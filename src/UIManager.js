/**
 * LD Chatzz - UI Manager
 * Manages all UI windows and visual state
 */

import { DataManager } from './DataManager.js';

export class UIManager {
    // Window tracking
    static openPrivateChatWindows = new Map();
    static openActorChatWindows = new Map();
    static openGroupChatWindows = new Map();
    static gmMonitorWindow = null;
    static settingsWindow = null;
    static groupManagerWindow = null;
    static playerHubWindow = null;

    // ════════════════════════════════════════════════════════════════════════════
    // WINDOW OPENERS
    // ════════════════════════════════════════════════════════════════════════════

    /**
     * Open the Player Hub window
     */
    static async openPlayerHub() {
        const { PlayerHubWindow } = await import('./PlayerHubWindow.js');

        // Use v13's live instance registry
        const existing = foundry.applications?.instances?.get('chatzz-player-hub');
        if (existing) {
            if (typeof existing.bringToTop === 'function') existing.bringToTop();
            return;
        }

        // Fallback: check stored reference
        if (this.playerHubWindow && !this.playerHubWindow.closed) {
            if (typeof this.playerHubWindow.bringToTop === 'function') this.playerHubWindow.bringToTop();
            return;
        }

        this.playerHubWindow = new PlayerHubWindow();
        return this.playerHubWindow.render(true);
    }

    /**
     * Open a private chat window
     * @param {string} userId - Other user's ID
     */
    static async openChatFor(userId) {
        const existingWindow = this.openPrivateChatWindows.get(userId);
        if (existingWindow?.rendered) return existingWindow.render(true);

        const chatKey = DataManager.getPrivateChatKey(game.user.id, userId);
        if (!DataManager.privateChats.has(chatKey)) {
            DataManager.privateChats.set(chatKey, {
                users: [game.user.id, userId],
                history: []
            });
        }

        const { ChatzzWindow } = await import('./ChatzzWindow.js');
        const window = new ChatzzWindow({ otherUserId: userId });
        this.openPrivateChatWindows.set(userId, window);
        return window.render(true);
    }

    /**
     * Open an actor chat window
     * @param {string} actorId - Actor ID
     */
    static async openChatForActor(actorId) {
        const existingWindow = this.openActorChatWindows.get(actorId);
        if (existingWindow?.rendered) return existingWindow.render(true);

        const actor = game.actors.get(actorId);
        if (!actor) return ui.notifications.warn(game.i18n.localize('CHATZZ.ActorNotFound'));

        const allowed = DataManager.getVisibleActors().some(a => a.id === actorId);
        if (!allowed && !game.user.isGM) {
            return ui.notifications.warn(game.i18n.localize('CHATZZ.FriendNotAccepted'));
        }

        const chatKey = DataManager.getActorChatKey(actorId);
        if (!DataManager.actorChats.has(chatKey)) {
            DataManager.actorChats.set(chatKey, {
                kind: 'actor',
                actorId,
                actorName: actor.name,
                actorImg: actor.img,
                history: []
            });
        }

        const { ChatzzWindow } = await import('./ChatzzWindow.js');
        const window = new ChatzzWindow({ actorId });
        this.openActorChatWindows.set(actorId, window);
        return window.render(true);
    }

    /**
     * Open a group chat window
     * @param {string} groupId - Group ID
     */
    static async openGroupChat(groupId) {
        const group = DataManager.groupChats.get(groupId);
        if (!group) return;
        
        // Allow GMs to view any group
        const isMember = group.members.includes(game.user.id);
        if (!isMember && !game.user.isGM) {
            return ui.notifications.warn(game.i18n.localize('CHATZZ.NotMember'));
        }
        
        const existingWindow = this.openGroupChatWindows.get(groupId);
        if (existingWindow?.rendered) return existingWindow.render(true);

        const { ChatzzWindow } = await import('./ChatzzWindow.js');
        const window = new ChatzzWindow({ groupId: groupId });
        this.openGroupChatWindows.set(groupId, window);
        return window.render(true);
    }

    /**
     * Open the Group Manager window (GM only)
     */
    static async openGroupManager() {
        if (!game.user.isGM) {
            return ui.notifications.error(game.i18n.localize('CHATZZ.GMOnlyTool'));
        }
        
        const { GroupManagerWindow } = await import('./GroupManagerWindow.js');
        const id = 'chatzz-group-manager';
        
        if (Object.values(ui.windows).find(w => w.id === id)) return;
        
        this.groupManagerWindow = new GroupManagerWindow();
        return this.groupManagerWindow.render(true);
    }

    /**
     * Open the GM Monitor window
     */
    static async openGMMonitor() {
        if (!game.user.isGM) {
            return ui.notifications.warn(game.i18n.localize('CHATZZ.NoPermission'));
        }

        const existing = foundry.applications?.instances?.get('chatzz-gm-monitor');
        if (existing) {
            if (typeof existing.bringToTop === 'function') existing.bringToTop();
            return;
        }

        if (this.gmMonitorWindow && !this.gmMonitorWindow.closed) {
            if (typeof this.gmMonitorWindow.bringToTop === 'function') this.gmMonitorWindow.bringToTop();
            return;
        }

        const { GMMonitorWindow } = await import('./GMMonitorWindow.js');
        this.gmMonitorWindow = new GMMonitorWindow();
        return this.gmMonitorWindow.render(true);
    }

    /**
     * Open the Settings window
     */
    static async openSettingsWindow() {
        const { SettingsWindow } = await import('./SettingsWindow.js');
        const id = 'chatzz-settings-window';
        
        const existing = Object.values(ui.windows).find(w => w.id === id);
        if (existing) return existing.bringToTop();
        
        this.settingsWindow = new SettingsWindow();
        return this.settingsWindow.render(true);
    }

    /**
     * Open the GM Moderation window
     */
    static async openGMModWindow() {
        if (!game.user.isGM) {
            return ui.notifications.warn(game.i18n.localize('CHATZZ.OnlyGMsAccessModeration'));
        }

        const existing = foundry.applications?.instances?.get('chatzz-gm-mod-window');
        if (existing) {
            if (typeof existing.bringToTop === 'function') existing.bringToTop();
            return;
        }

        if (this.gmModWindow && !this.gmModWindow.closed) {
            if (typeof this.gmModWindow.bringToTop === 'function') this.gmModWindow.bringToTop();
            return;
        }

        const { GMModWindow } = await import('./GMModWindow.js');
        this.gmModWindow = new GMModWindow();
        this.gmModWindow.render(true);
    }

    /**
     * Open GM Panel (alias for openGMMonitor for API compatibility)
     */
    static async openGMPanel() {
        return this.openGMMonitor();
    }

    // ════════════════════════════════════════════════════════════════════════════
    // WINDOW UPDATES
    // ════════════════════════════════════════════════════════════════════════════

    /**
     * Update a chat window (only if already open)
     * @param {string} id - User ID or Group ID
     * @param {string} type - 'private' or 'group'
     */
    static updateChatWindow(id, type) {
        if (type === 'private') {
            const existingWindow = this.openPrivateChatWindows.get(id);
            if (existingWindow?.rendered) {
                // Ensure new messages scroll to bottom
                existingWindow._shouldScrollToBottom = true;
                existingWindow.render(false);
            }
        } else if (type === 'actor') {
            const existingWindow = this.openActorChatWindows.get(id);
            if (existingWindow?.rendered) {
                existingWindow._shouldScrollToBottom = true;
                existingWindow.render(false);
            }
        } else {
            const existingWindow = this.openGroupChatWindows.get(id);
            if (existingWindow?.rendered) {
                // Ensure new messages scroll to bottom
                existingWindow._shouldScrollToBottom = true;
                existingWindow.render(false);
            }
        }
    }

    /**
     * Update typing indicator in a window
     * @param {string} id - User ID or Group ID
     * @param {string} type - 'private' or 'group'
     */
    static updateTypingIndicator(id, type) {
        const window = type === 'private'
            ? this.openPrivateChatWindows.get(id)
            : type === 'actor'
                ? this.openActorChatWindows.get(id)
            : this.openGroupChatWindows.get(id);
            
        if (window?.rendered && typeof window.updateTypingIndicator === 'function') {
            window.updateTypingIndicator();
        }
    }

    /**
     * Open chat window for new message (auto-open on incoming)
     * @param {string} id - User ID or Group ID
     * @param {string} type - 'private' or 'group'
     */
    static openChatWindowForNewMessage(id, type) {
        if (type === 'private') {
            this.openChatFor(id);
        } else if (type === 'actor') {
            this.openChatForActor(id);
        } else {
            this.openGroupChat(id);
        }
    }

    /**
     * Close a chat window
     * @param {string} id - User ID or Group ID
     * @param {string} type - 'private' or 'group'
     */
    static closeChatWindow(id, type) {
        const window = type === 'private'
            ? this.openPrivateChatWindows.get(id)
            : type === 'actor'
                ? this.openActorChatWindows.get(id)
            : this.openGroupChatWindows.get(id);
            
        if (window) {
            window.close();
            if (type === 'private') {
                this.openPrivateChatWindows.delete(id);
            } else if (type === 'actor') {
                this.openActorChatWindows.delete(id);
            } else {
                this.openGroupChatWindows.delete(id);
            }
        }
    }

    static refreshConversationWindow(conversationId, type = 'private') {
        if (type === 'group') {
            return this.updateChatWindow(conversationId, 'group');
        }

        const chat = DataManager.getConversation(conversationId);
        if (DataManager.getConversationType(conversationId) === 'actor') {
            return this.updateChatWindow(chat?.actorId || conversationId.replace(/^actor:/, ''), 'actor');
        }

        const otherUserId = chat?.users?.find(id => id !== game.user.id) || conversationId.split('-').find(id => id !== game.user.id);
        if (otherUserId) this.updateChatWindow(otherUserId, 'private');
    }

    /**
     * Update the Player Hub window
     */
    static updatePlayerHub() {
        const playerHub = Object.values(ui.windows).find(w => w.id === 'chatzz-player-hub');
        if (playerHub?.rendered) playerHub.render(true);
    }

    /**
     * Update the Group Manager window
     */
    static updateGroupManager() {
        const groupManager = Object.values(ui.windows).find(w => w.id === 'chatzz-group-manager');
        if (groupManager?.rendered) groupManager.render(true);
    }

    /**
     * Update the GM Monitor window
     */
    static updateGMMonitor() {
        if (this.gmMonitorWindow?.rendered) {
            this.gmMonitorWindow.render(true);
        }
    }

    // ════════════════════════════════════════════════════════════════════════════
    // BACKGROUNDS
    // ════════════════════════════════════════════════════════════════════════════

    /**
     * Update background for a user across all relevant windows
     * @param {string} userId - User ID
     * @param {string} path - Background image path
     */
    static updateBackgroundForUser(userId, path) {
        if (!userId) return;
        
        if (path) {
            DataManager.setSharedBackground(userId, path);
        } else {
            DataManager.setSharedBackground(userId, null);
        }

        // Apply to private chat windows with this user
        for (const [user, win] of this.openPrivateChatWindows.entries()) {
            if (win?.rendered && user === userId) {
                this.applyBackgroundToWindow(win, path);
            }
        }

        // Apply to group windows where this user is a member
        for (const [groupId, win] of this.openGroupChatWindows.entries()) {
            const group = DataManager.groupChats.get(groupId);
            if (group?.members?.includes(userId)) {
                this.applyBackgroundToWindow(win, path);
            }
        }

        // Apply to player hub
        const playerHub = Object.values(ui.windows).find(w => w.id === 'chatzz-player-hub');
        if (playerHub?.rendered) {
            try { this.applyBackgroundToWindow(playerHub, path); } catch (e) { /* ignore */ }
        }

        // Refresh GM Monitor
        if (this.gmMonitorWindow?.rendered) {
            try { this.gmMonitorWindow.render(false); } catch (e) { /* ignore */ }
        }
    }

    /**
     * Apply a background image to a window
     * @param {object} win - Window instance
     * @param {string} path - Background image path
     */
    static applyBackgroundToWindow(win, path) {
        if (!win?.element) return;
        
        const container = win.element.querySelector('.chatzz-chat-container, .chatzz-hub-container');
        if (!container) return;
        
        if (path) {
            container.style.setProperty('--chat-background', `url("${path}")`);
            container.style.backgroundImage = `var(--chatzz-bg-scrim), url("${path}")`;
            container.style.backgroundSize = 'cover';
            container.style.backgroundRepeat = 'no-repeat';
            container.style.backgroundPosition = 'center';
        } else {
            container.style.removeProperty('--chat-background');
            container.style.backgroundImage = '';
            container.style.removeProperty('background-size');
            container.style.removeProperty('background-repeat');
            container.style.removeProperty('background-position');
        }
    }

    // ════════════════════════════════════════════════════════════════════════════
    // NOTIFICATIONS UI
    // ════════════════════════════════════════════════════════════════════════════

    /**
     * Update the hotbar notification badge
     */
    static updateHotbarBadge() {
        const total = DataManager.getTotalUnread();
        const badge = document.querySelector('.chatzz-hotbar-badge');
        
        if (badge) {
            if (total > 0) {
                badge.textContent = total > 99 ? '99+' : total;
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }
        }
    }

    /**
     * Show a toast notification
     * @param {string} message - Message to display
     * @param {string} type - 'info', 'warn', 'error'
     */
    static showToast(message, type = 'info') {
        ui.notifications[type](message);
    }
}
