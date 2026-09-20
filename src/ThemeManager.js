/**
 * LD Chatzz - Theme Manager
 * Runtime palette switching. Themes are CSS custom-property overrides scoped
 * to `:root[data-chatzz-theme='<id>']` (styles/chatzz-themes.css); switching is
 * therefore instant for every open window and needs no re-render.
 */

import { MODULE_ID, DEFAULTS, THEME_OPTIONS } from './Constants.js';

export class ThemeManager {
    static BODY_ATTRIBUTE = 'data-chatzz-theme';

    /**
     * All registered themes, with the current one flagged.
     * @returns {{id: string, label: string, selected: boolean}[]}
     */
    static getThemes() {
        const current = this.getTheme();
        return THEME_OPTIONS.map(t => ({ ...t, selected: t.id === current }));
    }

    /**
     * The active theme id, falling back to the default when unset or unknown.
     * @returns {string}
     */
    static getTheme() {
        const stored = this._readSetting();
        return this.isValidTheme(stored) ? stored : DEFAULTS.theme;
    }

    /**
     * Whether the id names a registered theme ('' counts as unset).
     * @param {string} id
     * @returns {boolean}
     */
    static isValidTheme(id) {
        return THEME_OPTIONS.some(t => t.id === id);
    }

    /**
     * Apply a theme immediately and persist it as a client setting.
     * @param {string} id - Theme id (crimson | void | neon)
     * @returns {Promise<string>} The applied theme id
     */
    static async setTheme(id) {
        const theme = this.isValidTheme(id) ? id : DEFAULTS.theme;
        this.applyTheme(theme);
        try {
            await game.settings.set(MODULE_ID, 'theme', theme);
        } catch (e) {
            console.warn('Chatzz | Could not persist theme setting:', e);
        }
        return theme;
    }

    /**
     * Apply a theme to the DOM without persisting it (used for previews).
     * Safe no-op when the document is unavailable (e.g. tests).
     * @param {string} id
     */
    static applyTheme(id) {
        const theme = this.isValidTheme(id) ? id : DEFAULTS.theme;
        const root = globalThis.document?.documentElement;
        if (root?.setAttribute) {
            root.setAttribute(this.BODY_ATTRIBUTE, theme);
        }
        return theme;
    }

    /**
     * Re-apply the persisted theme (call at ready / after window reloads).
     * @returns {string} The applied theme id
     */
    static refresh() {
        return this.applyTheme(this.getTheme());
    }

    static _readSetting() {
        try {
            return game.settings.get(MODULE_ID, 'theme') || '';
        } catch (e) {
            return '';
        }
    }
}
