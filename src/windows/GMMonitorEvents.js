/**
 * LD Chatzz - GM Monitor Events Engine
 */
import { DataManager } from '../DataManager.js';
import { UIManager } from '../UIManager.js';
import { Utils } from '../Utils.js';

export class GMMonitorEvents {
    static setup(instance, element) {
        if (!element) return;

        // Filter buttons
        element.querySelectorAll('.chatzz-filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                instance._filterType = btn.dataset.filter;
                instance.render(true);
            });
        });

        // Sort selector
        const sortSelect = element.querySelector('.chatzz-sort-select');
        if (sortSelect) {
            sortSelect.value = instance._sortOrder;
            sortSelect.addEventListener('change', (e) => {
                instance._sortOrder = e.target.value;
                instance.render(true);
            });
        }

        // User filter checkboxes
        element.querySelectorAll('.chatzz-user-filter').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const userId = e.target.dataset.userId;
                if (e.target.checked) {
                    instance._selectedUsers.add(userId);
                } else {
                    instance._selectedUsers.delete(userId);
                }
                instance.render(true);
            });
        });

        // Clear user filter
        element.querySelector('[data-action="clearUserFilter"]')?.addEventListener('click', () => {
            instance._selectedUsers.clear();
            instance.render(true);
        });

        // Search
        const searchInput = element.querySelector('.chatzz-monitor-search');
        if (searchInput) {
            searchInput.value = instance._searchQuery;
            searchInput.addEventListener('input', Utils.debounce((e) => {
                instance._searchQuery = e.target.value.trim();
                instance.render(true);
            }, 300));
        }

        // Toggle options
        element.querySelector('[data-action="toggleImages"]')?.addEventListener('click', () => {
            instance._showImages = !instance._showImages;
            instance.render(true);
        });

        element.querySelector('[data-action="toggleAutoScroll"]')?.addEventListener('click', () => {
            instance._autoScroll = !instance._autoScroll;
            instance.render(true);
        });

        // Clear button
        element.querySelector('[data-action="clearLog"]')?.addEventListener('click', async () => {
            const confirmed = await Dialog.confirm({
                title: game.i18n.localize('CHATZZ.ClearMonitorTitle'),
                content: game.i18n.localize('CHATZZ.ClearMonitorConfirm')
            });
            
            if (confirmed) {
                DataManager.interceptedMessages = [];
                instance._flaggedMessages.clear();
                instance.render(true);
            }
        });

        // Export/Actions
        element.querySelector('[data-action="exportLog"]')?.addEventListener('click', () => {
            instance._exportMonitorLog();
        });

        element.querySelector('[data-action="exportToJournal"]')?.addEventListener('click', () => {
            instance._exportToJournal();
        });

        // Flagging
        element.querySelectorAll('.chatzz-flag-message').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const msgId = btn.dataset.messageId;
                if (instance._flaggedMessages.has(msgId)) {
                    instance._flaggedMessages.delete(msgId);
                } else {
                    instance._flaggedMessages.add(msgId);
                }
                instance.render(true);
            });
        });

        // Interaction
        element.querySelectorAll('.chatzz-monitor-message').forEach(msg => {
            msg.addEventListener('click', () => msg.classList.toggle('expanded'));
        });

        element.querySelectorAll('.chatzz-open-chat').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const msgId = btn.dataset.messageId;
                const intercepted = DataManager.interceptedMessages.find(m => m.id === msgId);
                if (intercepted) {
                    if (intercepted.groupId) UIManager.openGroupChat(intercepted.groupId);
                    else {
                        const other = intercepted.senderId === game.user.id ? intercepted.recipientId : intercepted.senderId;
                        UIManager.openChatFor(other);
                    }
                }
            });
        });

        element.querySelectorAll('.chatzz-impersonate').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                ui.notifications.info(game.i18n.localize('CHATZZ.ImpersonationNotImplemented'));
            });
        });

        element.querySelectorAll('.chatzz-view-history').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                instance._selectedUsers.clear();
                instance._selectedUsers.add(btn.dataset.userId);
                instance._filterType = 'all';
                instance.render(true);
            });
        });

        // Auto-scroll
        if (instance._autoScroll) {
            const list = element.querySelector('.chatzz-monitor-messages');
            if (list) list.scrollTop = list.scrollHeight;
        }

        this.registerUpdateListener(instance);
    }

    static registerUpdateListener(instance) {
        if (!instance._listenerRegistered) {
            Hooks.on('chatzzMessageIntercepted', instance._boundUpdateHandler);
            instance._listenerRegistered = true;
        }
    }

    static handleNewMessage(instance) {
        if (instance.element) {
            const titleEl = instance.element.querySelector('.window-title');
            if (titleEl) titleEl.textContent = instance.title;
        }
        if (instance._autoScroll && instance.rendered) instance.render(true);
    }
}
