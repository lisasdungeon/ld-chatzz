/**
 * LD Chatzz - Player Hub Events
 * Engine for handling UI events in the Player Hub.
 */

import { MODULE_ID, UI_SOUNDS } from '../Constants.js';
import { ThemeManager } from '../ThemeManager.js';
import { UIManager } from '../UIManager.js';
import { DataManager } from '../DataManager.js';
import { PlayerHubUtils } from './PlayerHubUtils.js';
import { Utils } from '../Utils.js';

export class PlayerHubEvents {
    static activateListeners(app, element) {
        // Tab switching
        element.querySelectorAll('[data-tab]').forEach(tab => {
            tab.addEventListener('click', (e) => {
                app.activeTab = e.currentTarget.dataset.tab;
                this._updateTabs(element, app.activeTab);
            });
        });

        // Event Delegation for data-actions
        element.addEventListener('click', async (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;
            const action = btn.dataset.action;

            switch (action) {
                case 'createChat':
                    this._onCreateChat(element);
                    break;
                case 'openMonitor':
                    UIManager.openGMMonitor();
                    break;
                case 'openGroupManager':
                    UIManager.openGroupManager();
                    break;
                case 'openGMTools':
                    UIManager.openGMModWindow();
                    break;
                case 'openActorChat':
                    UIManager.openChatForActor(btn.dataset.actorId);
                    break;
                case 'exportToJournal':
                    PlayerHubUtils.exportToJournal();
                    break;
                case 'exportLocal':
                    PlayerHubUtils.exportLocal();
                    break;
                case 'setUserBackground':
                    this._onSetUserBackground(btn.dataset.userId);
                    break;
                case 'setPersonalBackground':
                    this._onSetPersonalBackground();
                    break;
                case 'clearPersonalBackground':
                    this._onClearPersonalBackground();
                    break;
                case 'selectTheme':
                    this._onSelectTheme(btn.dataset.theme, element);
                    break;
            }
        });

        // Conversation clicks (for Chats tab)
        element.querySelectorAll('.chatzz-conv-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.closest('.chatzz-conv-action')) return;

                const convId = item.dataset.conversationId;
                const type = item.dataset.type;

                if (e.target.closest('.chatzz-fav-icon')) {
                    const id = convId || DataManager.getPrivateChatKey(game.user.id, item.dataset.userId);
                    DataManager.toggleFavorite(id);
                    UIManager.updatePlayerHub();
                    Utils.playUISound('buttonPress');
                    return;
                }

                if (type === 'group') UIManager.openGroupChat(convId);
                else if (type === 'actor') UIManager.openChatForActor(item.dataset.actorId);
                else UIManager.openChatFor(item.dataset.userId);
            });
        });

        // User selection in New Chat tab
        element.querySelectorAll('.chatzz-user-card').forEach(card => {
            if (!card.dataset.userId) return;
            card.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                card.classList.toggle('selected');
                
                const startBtn = element.querySelector('[data-action="createChat"]');
                const selected = element.querySelectorAll('.chatzz-user-card.selected');
                const selectedCount = selected.length;
                
                if (startBtn) {
                    const iconClass = selectedCount > 1 ? 'fa-comments' : 'fa-comment';
                    const btnText = selectedCount > 1 ? `Start Group Chat (${selectedCount})` : 'Start Chat';
                    startBtn.innerHTML = `<i class="fas ${iconClass}"></i> ${btnText}`;
                    
                    // Visual feedback for disabled state
                    if (selectedCount === 0) {
                        startBtn.style.opacity = '0.5';
                        startBtn.style.cursor = 'not-allowed';
                    } else {
                        startBtn.style.opacity = '1';
                        startBtn.style.cursor = 'pointer';
                    }
                }
            });
        });

        element.querySelectorAll('.chatzz-actor-card').forEach(card => {
            card.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                UIManager.openChatForActor(card.dataset.actorId);
            });
        });

        // Volume & Settings
        element.querySelector('[data-action="setVolume"]')?.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value) || 0;
            game.settings.set(MODULE_ID, 'notificationVolume', value / 100);

            const volumeDisplay = element.querySelector('.chatzz-volume-value');
            if (volumeDisplay) volumeDisplay.textContent = `${value}%`;
        });

        // Background buttons give the same button-press feedback as other grey buttons
        for (const bgBtn of element.querySelectorAll('[data-action="setPersonalBackground"], [data-action="clearPersonalBackground"]')) {
            bgBtn.addEventListener('click', () => Utils.playUISound(UI_SOUNDS.buttonPress));
        }

        // Theme swatches respond to keyboard activation as well as clicks
        for (const swatch of element.querySelectorAll('.chatzz-theme-option[data-theme]')) {
            swatch.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    swatch.click();
                }
            });
        }

        element.querySelectorAll('input[type="checkbox"][data-action]').forEach(cb => {
            cb.addEventListener('change', async (e) => {
                const setting = cb.dataset.action === 'toggleSounds' ? 'enableSounds' : 'enableDesktopNotifications';
                await game.settings.set(MODULE_ID, setting, cb.checked);
            });
        });

        // Search
        element.querySelector('.chatzz-hub-search')?.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            // Filter conversations
            element.querySelectorAll('.chatzz-conv-item').forEach(item => {
                const name = item.querySelector('.chatzz-conv-name')?.textContent?.toLowerCase() || '';
                item.style.display = name.includes(query) ? '' : 'none';
            });
            // Filter user cards
            element.querySelectorAll('.chatzz-user-card').forEach(card => {
                const name = card.querySelector('.chatzz-user-name')?.textContent?.toLowerCase() || '';
                card.style.display = name.includes(query) ? '' : 'none';
            });
            element.querySelectorAll('.chatzz-actor-card').forEach(card => {
                const name = card.querySelector('.chatzz-user-name')?.textContent?.toLowerCase() || '';
                card.style.display = name.includes(query) ? '' : 'none';
            });
        });
    }

    static async _onCreateChat(element) {
        const selected = Array.from(element.querySelectorAll('.chatzz-user-card.selected'))
            .map(c => c.dataset.userId);
        
        if (selected.length === 0) {
            return ui.notifications.warn(game.i18n.localize('CHATZZ.SelectAtLeastOneUser'));
        }

        if (selected.length === 1) {
            UIManager.openChatFor(selected[0]);
        } else {
            new Dialog({
                title: game.i18n.localize('CHATZZ.CreateGroupChat'),
                content: `
                    <div class="form-group">
                        <label>${game.i18n.localize('CHATZZ.GroupName')}</label>
                        <input type="text" id="group-name" placeholder="${game.i18n.localize('CHATZZ.GroupNamePlaceholder')}" autofocus>
                    </div>
                `,
                buttons: {
                    create: {
                        icon: '<i class="fas fa-check"></i>',
                        label: game.i18n.localize('CHATZZ.Create'),
                        callback: async (html) => {
                            const name = html.find('#group-name').val() || game.i18n.localize('CHATZZ.NewGroup');
                            const { LDChatzz } = await import('../LDChatzz.js');
                            await LDChatzz.createGroup(name, [game.user.id, ...selected]);
                        }
                    },
                    cancel: { icon: '<i class="fas fa-times"></i>', label: game.i18n.localize('CHATZZ.Cancel') }
                },
                default: "create"
            }).render(true);
        }
    }

    static async _onSetUserBackground(userId) {
        if (!userId) return;
        new FilePicker({
            type: 'image',
            callback: async (path) => {
                const bgs = game.settings.get(MODULE_ID, 'gmBackgrounds') || { global: null, perUser: {}, perChat: {} };
                if (!bgs.perUser) bgs.perUser = {};
                bgs.perUser[userId] = path;
                await game.settings.set(MODULE_ID, 'gmBackgrounds', bgs);
                UIManager.updateBackgroundForUser(userId, path);
                ui.notifications.info(game.i18n.localize('CHATZZ.BackgroundSetForUser'));
            }
        }).render(true);
    }

    static _onSetPersonalBackground() {
        new FilePicker({
            type: 'image',
            current: game.settings.get(MODULE_ID, 'personalBackground') || '',
            callback: async (path) => {
                if (!path) return;
                await game.settings.set(MODULE_ID, 'personalBackground', path);
                this._applyPersonalBackgroundEverywhere(path);
                ui.notifications.info(game.i18n.localize('CHATZZ.BackgroundSet'));
                UIManager.updatePlayerHub();
            }
        }).render(true);
    }

    static async _onClearPersonalBackground() {
        await game.settings.set(MODULE_ID, 'personalBackground', '');
        this._applyPersonalBackgroundEverywhere('');
        ui.notifications.info(game.i18n.localize('CHATZZ.BackgroundCleared'));
        UIManager.updatePlayerHub();
    }

    static async _onSelectTheme(themeId, element) {
        const theme = await ThemeManager.setTheme(themeId);
        Utils.playUISound(UI_SOUNDS.buttonPress);
        ui.notifications.info(game.i18n.localize('CHATZZ.ThemeApplied'));
        // Mark the selected swatch without re-rendering the whole hub
        for (const swatch of (element || document).querySelectorAll('.chatzz-theme-option[data-theme]')) {
            swatch.classList.toggle('selected', swatch.dataset.theme === theme);
        }
    }

    /** Apply (or clear) the personal background on every open chat window and the hub itself. */
    static _applyPersonalBackgroundEverywhere(path) {
        const apply = (win) => {
            if (win?.rendered) UIManager.applyBackgroundToWindow(win, path);
        };
        for (const win of UIManager.openPrivateChatWindows.values()) apply(win);
        for (const win of UIManager.openActorChatWindows.values()) apply(win);
        for (const win of UIManager.openGroupChatWindows.values()) apply(win);

        // Preview on the hub itself
        const hub = Object.values(ui.windows).find(w => w.id === 'chatzz-player-hub');
        if (hub?.rendered) {
            const container = hub.element?.querySelector?.('.chatzz-hub-container');
            if (container) {
                if (path) {
                    container.style.setProperty('--chat-background', `url("${path}")`);
                    container.style.backgroundImage = `linear-gradient(rgba(0, 0, 0, 0.82), rgba(0, 0, 0, 0.82)), url("${path}")`;
                    container.style.backgroundSize = 'cover';
                    container.style.backgroundPosition = 'center';
                    container.style.backgroundRepeat = 'no-repeat';
                } else {
                    container.style.removeProperty('--chat-background');
                    container.style.backgroundImage = '';
                    container.style.removeProperty('background-size');
                    container.style.removeProperty('background-position');
                    container.style.removeProperty('background-repeat');
                }
            }
        }
    }

    static _updateTabs(element, activeTab) {
        element.querySelectorAll('[data-tab]').forEach(t => {
            const isActive = t.dataset.tab === activeTab;
            t.classList.toggle('active', isActive);
            const img = t.querySelector('img[data-default][data-active]');
            if (img) img.src = isActive ? img.dataset.active : img.dataset.default;
        });
        element.querySelectorAll('.chatzz-tab-content').forEach(c => c.classList.toggle('active', c.dataset.tabContent === activeTab));
    }
}
