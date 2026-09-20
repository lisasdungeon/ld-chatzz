/**
 * LD Chatzz - UI Interaction Hooks
 */
import { UIManager } from '../UIManager.js';
import { MODULE_ID, UI_SOUNDS } from '../Constants.js';
import { ChatzzWindowUI } from '../windows/ChatzzWindowUI.js';
import { Utils } from '../Utils.js';

export class UIHooks {
    static register() {
        // Apply button images to all chatzz windows on render
        Hooks.on('renderApplication', (app, html) => {
            const el = html[0] || html;
            if (el?.classList?.contains('chatzz-window') || el?.querySelector?.('.chatzz-window') ||
                el?.classList?.contains('ld-chatzz') || el?.querySelector?.('.ld-chatzz')) {
                ChatzzWindowUI.setupButtonImages(el);
            }
        });
        Hooks.on('renderApplicationV2', (app, element) => {
            if (element?.classList?.contains('chatzz-window') || element?.querySelector?.('.chatzz-window') ||
                element?.classList?.contains('ld-chatzz') || element?.querySelector?.('.ld-chatzz')) {
                ChatzzWindowUI.setupButtonImages(element);
            }
        });

        // FilePicker Fix (only for Chatzz windows)
        Hooks.on('renderFilePicker', (app, html) => {
            const hasChatzz = Boolean(app?.element?.closest?.('.ld-chatzz') || app?.element?.closest?.('.chatzz-window'));
            if (!hasChatzz) return;

            const all = Array.from(document.querySelectorAll('body *'));
            let maxZ = 0;
            all.forEach(el => {
                const z = parseInt(window.getComputedStyle(el).zIndex, 10);
                if (!isNaN(z) && z > maxZ) maxZ = z;
            });

            const dlg = html.closest('.dialog');
            const target = dlg && dlg.length ? dlg[0] : html[0];
            if (!target) return;

            try { document.body.appendChild(target); } catch (e) {}
            const rect = target.getBoundingClientRect();
            const finalZ = Math.max(maxZ + 10, 9999999);
            try { $(target).css({ position: 'fixed', top: `${rect.top}px`, left: `${rect.left}px`, zIndex: finalZ }); } catch (e) { }
        });

        // Update Badge
        Hooks.on('updateSetting', (setting) => {
            if (setting.key === `${MODULE_ID}.unreadData`) UIHooks._updateHotbarBadge();
        });
    }

    static _showNewChatDialog() {
        const users = game.users.filter(u => u.id !== game.user.id);
        if (users.length === 0) {
            ui.notifications.warn(game.i18n.localize('CHATZZ.NoOtherUsers'));
            return;
        }
        
        new Dialog({
            title: game.i18n.localize('CHATZZ.NewPrivateChat'),
            content: `
                <div class="form-group">
                    <label>${game.i18n.localize('CHATZZ.SelectUser')}</label>
                    <select id="chatzz-user-select" style="width:100%; margin: 10px 0;">
                        ${users.map(u => `<option value="${u.id}">${Utils.sanitizeHTML(u.name)}${u.active ? game.i18n.localize('CHATZZ.OnlineSuffix') : ''}</option>`).join('')}
                    </select>
                </div>
            `,
            buttons: {
                start: {
                    icon: '<i class="fas fa-comments"></i>',
                    label: game.i18n.localize('CHATZZ.StartChat'),
                    callback: (html) => {
                        const userId = html.find('#chatzz-user-select').val();
                        if (userId) UIManager.openChatFor(userId);
                    }
                },
                cancel: {
                    icon: '<i class="fas fa-times"></i>',
                    label: game.i18n.localize('CHATZZ.Cancel')
                }
            },
            default: "start"
        }, {
            width: 300,
            classes: ["chatzz-dialog", "dark"]
        }).render(true);
    }

    static _updateHotbarBadge() {
        import('../DataManager.js').then(({ DataManager }) => {
            const total = DataManager.getTotalUnread();
            const badge = document.querySelector('.chatzz-hotbar-badge');
            if (badge) {
                badge.textContent = total > 99 ? '99+' : total;
                badge.style.display = total > 0 ? 'flex' : 'none';
            }
        });
    }
}
