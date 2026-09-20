/**
 * LD Chatzz - Group Manager Window
 * GM tool for managing group chats/channels
 * Supports Foundry VTT v11, v12, and v13
 */

import { DataManager } from './DataManager.js';
import { UIManager } from './UIManager.js';
import { SocketHandler } from './SocketHandler.js';
import { LDChatzz } from './LDChatzz.js';
import { Utils } from './Utils.js';

/** Resolve Application base class for Foundry v11-v13 compatibility. */
export function resolveGroupAppClass(api = globalThis.foundry?.applications?.api, Fallback = globalThis.Application) {
    if (api?.ApplicationV2 && api?.HandlebarsApplicationMixin) {
        return api.HandlebarsApplicationMixin(api.ApplicationV2);
    }
    return Fallback;
}

const AppClass = resolveGroupAppClass();

export class GroupManagerWindow extends AppClass {

    static DEFAULT_OPTIONS = {
        id: 'chatzz-group-manager',
        classes: ['ld-chatzz', 'chatzz-group-manager', 'chatzz-window'],
        window: { title: 'CHATZZ.GroupManagerTitle', resizable: true },
        tag: 'form',
        position: { width: 600, height: 550 }
    };

    // v11/v12 compatibility - static defaultOptions getter
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions || {}, {
            id: 'chatzz-group-manager',
            classes: ['ld-chatzz', 'chatzz-group-manager', 'chatzz-window'],
            template: 'modules/ld-chatzz/templates/group-manager.hbs',
            title: 'CHATZZ.GroupManagerTitle',
            width: 600,
            height: 550,
            resizable: true
        });
    }

    get title() {
        return game.i18n.localize(this.options?.window?.title || 'CHATZZ.GroupManagerTitle');
    }

    static PARTS = {
        form: { template: 'modules/ld-chatzz/templates/group-manager.hbs' }
    };

    // v11/v12 compatibility - getData method (alias for _prepareContext)
    async getData() {
        return this._prepareContext();
    }

    async _prepareContext() {
        const groups = Array.from(DataManager.groupChats.values()).map(group => ({
            id: group.id,
            name: group.name,
            memberCount: group.members.length,
            messageCount: group.history?.length || 0,
            members: group.members.map(id => {
                const user = game.users.get(id);
                return user ? { id: user.id, name: user.name, isOnline: user.active } : null;
            }).filter(Boolean),
            createdAt: group.createdAt ? new Date(group.createdAt).toLocaleDateString() : 'Unknown'
        }));

        const users = game.users.map(u => ({
            id: u.id,
            name: u.name,
            isOnline: u.active,
            isGM: u.isGM
        }));

        return {
            groups,
            users,
            isGM: game.user.isGM
        };
    }

    _onRender(context, options) {
        if (super._onRender) super._onRender(context, options);
        this._setupEventListeners(this.element);
    }

    // v11/v12 compatibility - activateListeners method
    activateListeners(html) {
        if (super.activateListeners) super.activateListeners(html);
        const element = html[0] || html;
        this._setupEventListeners(element);
    }

    /**
     * Set up event listeners - shared by _onRender (v13) and activateListeners (v11/v12)
     * @param {HTMLElement} element - The root element to bind listeners to
     */
    _setupEventListeners(element) {
        if (!element) return;

        this.bringToFront();

        // Group selection
        element.querySelectorAll('.chatzz-group-item input[type="checkbox"]').forEach(cb => {
            cb.addEventListener('change', () => this._updateSelectionState());
        });

        // Action buttons
        element.querySelector('[data-action="openSelected"]')?.addEventListener('click', () => this._onOpenSelected());
        element.querySelector('[data-action="exportSelected"]')?.addEventListener('click', () => this._onExportSelected());
        element.querySelector('[data-action="deleteSelected"]')?.addEventListener('click', () => this._onDeleteSelected());
        element.querySelector('[data-action="createGroup"]')?.addEventListener('click', () => this._onCreateGroup());

        // Edit buttons
        element.querySelectorAll('.chatzz-edit-group').forEach(btn => {
            btn.addEventListener('click', (e) => this._onEditGroup(e));
        });
    }

    _updateSelectionState() {
        const selected = this.element.querySelectorAll('.chatzz-group-item input[type="checkbox"]:checked');
        const actionBtns = this.element.querySelectorAll('.chatzz-selection-actions button');
        actionBtns.forEach(btn => btn.disabled = selected.length === 0);
    }

    async _onOpenSelected() {
        const selected = this.element.querySelectorAll('.chatzz-group-item input[type="checkbox"]:checked');
        if (selected.length === 0) {
            return ui.notifications.warn(game.i18n.localize('CHATZZ.SelectGroupOpen'));
        }

        selected.forEach(cb => {
            const groupId = cb.closest('.chatzz-group-item').dataset.groupId;
            UIManager.openGroupChat(groupId);
        });
    }

    async _onExportSelected() {
        const selected = this.element.querySelectorAll('.chatzz-group-item input[type="checkbox"]:checked');
        if (selected.length === 0) {
            return ui.notifications.warn(game.i18n.localize('CHATZZ.SelectGroupExport'));
        }

        selected.forEach(cb => {
            const groupId = cb.closest('.chatzz-group-item').dataset.groupId;
            const group = DataManager.groupChats.get(groupId);
            if (group) {
                const filename = `chatzz-${group.name.replace(/[^a-z0-9]/gi, '-')}-${Date.now()}.txt`;
                import('./Utils.js').then(({ Utils }) => {
                    Utils.exportMessages(group.history || [], filename);
                });
            }
        });
    }

    async _onDeleteSelected() {
        const selected = this.element.querySelectorAll('.chatzz-group-item input[type="checkbox"]:checked');
        if (selected.length === 0) {
            return ui.notifications.warn(game.i18n.localize('CHATZZ.SelectGroupDelete'));
        }

        const confirmed = await Dialog.confirm({
            title: game.i18n.localize('CHATZZ.DeleteConfirmTitle'),
            content: game.i18n.format('CHATZZ.DeleteConfirmContent', { count: selected.length })
        });

        if (confirmed) {
            for (const cb of selected) {
                const groupId = cb.closest('.chatzz-group-item').dataset.groupId;
                await LDChatzz.deleteGroup(groupId);
            }
            this.render(true);
        }
    }

    async _onCreateGroup() {
        const nameInput = this.element.querySelector('input[name="newGroupName"]');
        const name = nameInput?.value?.trim();

        if (!name) {
            return ui.notifications.warn(game.i18n.localize('CHATZZ.GroupNameEmpty'));
        }

        const selectedMembers = Array.from(
            this.element.querySelectorAll('.chatzz-member-select input[type="checkbox"]:checked')
        ).map(cb => cb.value);

        if (selectedMembers.length === 0) {
            return ui.notifications.warn(game.i18n.localize('CHATZZ.SelectAtLeastOneMember'));
        }

        await LDChatzz.createGroup(name, selectedMembers);
        
        // Clear form
        if (nameInput) nameInput.value = '';
        this.element.querySelectorAll('.chatzz-member-select input[type="checkbox"]').forEach(cb => cb.checked = false);
        
        this.render(true);
    }

    async _onEditGroup(event) {
        const groupId = event.currentTarget.closest('.chatzz-group-item')?.dataset.groupId;
        const group = DataManager.groupChats.get(groupId);
        if (!group) return;

        // Build member checkboxes
        const memberCheckboxes = game.users.map(u => {
            const checked = group.members.includes(u.id) ? 'checked' : '';
            return `<label><input type="checkbox" name="members" value="${u.id}" ${checked}> ${Utils.sanitizeHTML(u.name)}</label>`;
        }).join('<br>');

        const result = await Dialog.prompt({
            title: game.i18n.format('CHATZZ.EditGroup', { name: group.name }),
            content: `
                <div class="form-group">
                    <label>${game.i18n.localize('CHATZZ.GroupName')}</label>
                    <input type="text" name="name" value="${Utils.sanitizeHTML(group.name)}" style="width:100%">
                </div>
                <div class="form-group">
                    <label>${game.i18n.localize('CHATZZ.SelectMembers')}</label>
                    <div style="max-height:150px;overflow-y:auto;padding:5px;border:1px solid #666;">
                        ${memberCheckboxes}
                    </div>
                </div>
            `,
            callback: (html) => ({
                name: html.find('[name="name"]').val(),
                members: Array.from(html.find('[name="members"]:checked')).map(el => el.value)
            }),
            rejectClose: false
        });

        if (result && result.name) {
            // Update group
            DataManager.updateGroup(groupId, {
                name: result.name.trim(),
                members: result.members
            });

            if (game.user.isGM) {
                await DataManager.saveGroupChats();
            }

            // Broadcast update
            SocketHandler.broadcastGroupUpdate(groupId, {
                name: result.name.trim(),
                members: result.members
            });

            ui.notifications.info(game.i18n.localize('CHATZZ.GroupUpdated'));
            this.render(true);
        }
    }

    /**
     * Bring window to front when opened
     */
    bringToFront() {
        if (this.element) {
            this.element.style.zIndex = Math.max(100, ...Array.from(document.querySelectorAll('.window-app')).map(w => parseInt(w.style.zIndex) || 0)) + 1;
            this.element.classList.add('window-focus');
        }
    }

}
