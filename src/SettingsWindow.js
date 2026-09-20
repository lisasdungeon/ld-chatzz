/**
 * LD Chatzz - Settings Window
 * User settings and preferences
 * Supports Foundry VTT v11, v12, and v13
 */

import { MODULE_ID, DEFAULTS, UI_SOUNDS, NOTIFICATION_SOUND_OPTIONS, THEME_OPTIONS } from './Constants.js';
import { Utils } from './Utils.js';
import { ThemeManager } from './ThemeManager.js';

/** Resolve Application base class for Foundry v11-v13 compatibility. */
export function resolveSettingsAppClass(api = globalThis.foundry?.applications?.api, Fallback = globalThis.Application) {
    if (api?.ApplicationV2 && api?.HandlebarsApplicationMixin) {
        return api.HandlebarsApplicationMixin(api.ApplicationV2);
    }
    return Fallback;
}

const AppClass = resolveSettingsAppClass();

export class SettingsWindow extends AppClass {

    static DEFAULT_OPTIONS = {
        id: 'chatzz-settings-window',
        classes: ['ld-chatzz', 'chatzz-settings'],
        window: { title: 'CHATZZ.SettingsTitle', resizable: true },
        tag: 'form',
        position: { width: 500, height: 450 }
    };

    // v11/v12 compatibility - static defaultOptions getter
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions || {}, {
            id: 'chatzz-settings-window',
            classes: ['ld-chatzz', 'chatzz-settings'],
            template: 'modules/ld-chatzz/templates/settings-window.hbs',
            title: 'CHATZZ.SettingsTitle',
            width: 500,
            height: 450,
            resizable: true
        });
    }

    get title() {
        return game.i18n.localize(this.options?.window?.title || 'CHATZZ.SettingsTitle');
    }

    static PARTS = {
        form: { template: 'modules/ld-chatzz/templates/settings-window.hbs' }
    };

    // v11/v12 compatibility - getData method (alias for _prepareContext)
    async getData() {
        return this._prepareContext();
    }

    async _prepareContext() {
        const notificationSound = game.settings.get(MODULE_ID, 'notificationSound');
        const sounds = NOTIFICATION_SOUND_OPTIONS.map(opt => ({
            file: opt.file,
            name: game.i18n.localize(opt.name),
            selected: notificationSound === opt.file
        }));
        return {
            isGM: game.user.isGM,
            enableSounds: game.settings.get(MODULE_ID, 'enableSounds'),
            notificationVolume: game.settings.get(MODULE_ID, 'notificationVolume'),
            enableDesktopNotifications: game.settings.get(MODULE_ID, 'enableDesktopNotifications'),
            personalBackground: game.settings.get(MODULE_ID, 'personalBackground'),
            shareBackground: game.settings.get(MODULE_ID, 'shareBackground'),
            sounds,
            themes: THEME_OPTIONS.map(opt => ({
                id: opt.id,
                name: game.i18n.localize(opt.label),
                selected: opt.id === ThemeManager.getTheme()
            })),
            theme: ThemeManager.getTheme(),
            gmOverrideEnabled: game.user.isGM ? game.settings.get(MODULE_ID, 'gmOverrideEnabled') : false,
            gmOverrideSoundPath: game.user.isGM ? game.settings.get(MODULE_ID, 'gmOverrideSoundPath') : ''
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

        // Background file picker
        element.querySelector('[data-action="pickBackground"]')?.addEventListener('click', async () => {
            const fp = new FilePicker({
                type: 'image',
                current: element.querySelector('input[name="personalBackground"]')?.value || '',
                callback: (path) => {
                    const input = element.querySelector('input[name="personalBackground"]');
                    if (input) input.value = path;
                }
            });
            const _fp = fp.render(true);
            if (_fp && _fp.then) {
                _fp.then(() => { try { fp.element.css({ position: 'fixed', zIndex: 9999999 }); fp.element.closest('.dialog')?.css('z-index', 9999999); } catch (e) {} });
            } else {
                setTimeout(() => { try { fp.element.css({ position: 'fixed', zIndex: 9999999 }); fp.element.closest('.dialog')?.css('z-index', 9999999); } catch (e) {} }, 100);
            }
        });

        // Clear background button
        element.querySelector('[data-action="clearBackground"]')?.addEventListener('click', () => {
            const input = element.querySelector('input[name="personalBackground"]');
            if (input) input.value = '';
        });

        // GM override sound picker
        element.querySelector('[data-action="pickGMSound"]')?.addEventListener('click', async () => {
            const fp = new FilePicker({
                type: 'audio',
                current: element.querySelector('input[name="gmOverrideSoundPath"]')?.value || '',
                callback: (path) => {
                    const input = element.querySelector('input[name="gmOverrideSoundPath"]');
                    if (input) input.value = path;
                }
            });
            const _fp3 = fp.render(true);
            if (_fp3 && _fp3.then) {
                _fp3.then(() => { try { fp.element.css({ position: 'fixed', zIndex: 9999999 }); fp.element.closest('.dialog')?.css('z-index', 9999999); } catch (e) {} });
            } else {
                setTimeout(() => { try { fp.element.css({ position: 'fixed', zIndex: 9999999 }); fp.element.closest('.dialog')?.css('z-index', 9999999); } catch (e) {} }, 100);
            }
        });

        // Save button
        element.querySelector('[data-action="saveSettings"]')?.addEventListener('click', () => {
            this._saveSettings();
        });

        // Sound preview
        element.querySelector('[data-action="previewSound"]')?.addEventListener('click', () => {
            const select = element.querySelector('select[name="notificationSound"]');
            const path = select?.value || this._resolveNotificationSound();
            if (!path) {
                ui.notifications.warn(game.i18n.localize('CHATZZ.ErrorPlaySound'));
                return;
            }
            const volume = parseFloat(element.querySelector('input[name="notificationVolume"]')?.value ?? 0.5);
            Utils.playSound(path, volume);
        });

        // Request notification permission
        element.querySelector('[data-action="requestNotifications"]')?.addEventListener('click', async () => {
            if ('Notification' in window) {
                const permission = await Notification.requestPermission();
                if (permission === 'granted') {
                    ui.notifications.info(game.i18n.localize('CHATZZ.NotificationsEnabled'));
                }
            }
        });
    }

    /** Resolve the effective notification sound path, honoring custom/GM settings. */
    _resolveNotificationSound() {
        const gmOverrideEnabled = game.settings.get(MODULE_ID, 'gmOverrideEnabled');
        const gmOverridePath = game.settings.get(MODULE_ID, 'gmOverrideSoundPath');
        if (gmOverrideEnabled && gmOverridePath) return gmOverridePath;
        const custom = game.settings.get(MODULE_ID, 'sfxGetMessage');
        return custom || DEFAULTS.sfxGetMessage || null;
    }

    async _saveSettings() {
        try {
            // Client settings
            const enableSounds = this.element.querySelector('input[name="enableSounds"]')?.checked ?? true;
            const notificationVolume = parseFloat(this.element.querySelector('input[name="notificationVolume"]')?.value || 0.8);
            const enableDesktopNotifications = this.element.querySelector('input[name="enableDesktopNotifications"]')?.checked ?? false;
            const personalBackground = this.element.querySelector('input[name="personalBackground"]')?.value || '';
            const shareBackground = this.element.querySelector('input[name="shareBackground"]')?.checked ?? false;
            const notificationSound = this.element.querySelector('select[name="notificationSound"]')?.value || '';
            const theme = this.element.querySelector('select[name="theme"]')?.value || '';

            await game.settings.set(MODULE_ID, 'enableSounds', enableSounds);
            await game.settings.set(MODULE_ID, 'notificationVolume', notificationVolume);
            await game.settings.set(MODULE_ID, 'enableDesktopNotifications', enableDesktopNotifications);
            await game.settings.set(MODULE_ID, 'personalBackground', personalBackground);
            await game.settings.set(MODULE_ID, 'shareBackground', shareBackground);
            if (notificationSound) {
                await game.settings.set(MODULE_ID, 'notificationSound', notificationSound);
            }

            // Apply the theme immediately (also persisted by setTheme)
            if (theme) {
                await ThemeManager.setTheme(theme);
            }

            // Apply the personal background to any already-open windows immediately
            const { UIManager } = await import('./UIManager.js');
            for (const win of UIManager.openPrivateChatWindows.values()) {
                if (win?.rendered) UIManager.applyBackgroundToWindow(win, personalBackground);
            }
            for (const win of UIManager.openActorChatWindows.values()) {
                if (win?.rendered) UIManager.applyBackgroundToWindow(win, personalBackground);
            }
            for (const win of UIManager.openGroupChatWindows.values()) {
                if (win?.rendered) UIManager.applyBackgroundToWindow(win, personalBackground);
            }

            // GM-only settings
            if (game.user.isGM) {
                const gmOverrideEnabled = this.element.querySelector('input[name="gmOverrideEnabled"]')?.checked ?? false;
                const gmOverrideSoundPath = this.element.querySelector('input[name="gmOverrideSoundPath"]')?.value || '';

                await game.settings.set(MODULE_ID, 'gmOverrideEnabled', gmOverrideEnabled);
                await game.settings.set(MODULE_ID, 'gmOverrideSoundPath', gmOverrideSoundPath);
            }

            ui.notifications.info(game.i18n.localize('CHATZZ.SettingsSaved'));
            this.close();
            
        } catch (e) {
            console.error('Chatzz | Failed to save settings:', e);
            ui.notifications.error(game.i18n.localize('CHATZZ.SettingsError'));
        }
    }
}
