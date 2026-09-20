/**
 * LD Chatzz - Asset Checker
 * Startup sanity check: verifies every icon and sound the module ships is
 * actually reachable, and warns in the console when one is missing. A missing
 * asset previously surfaced only as a silently broken button image or a sound
 * that never plays - this turns that into an actionable console warning.
 *
 * Uses fetch() against the module's own base path so it works wherever the
 * module is installed (data or s3), and tolerates being called outside a
 * browser/document context (unit tests).
 */

import { MODULE_ID, DEFAULTS, NOTIFICATION_SOUND_OPTIONS } from './Constants.js';

export class AssetChecker {
    /** Icon file names shipped in icons/ (paired <name>.png / <name>_on.png states). */
    static ICON_NAMES = [
        'AddImage', 'Chats', 'Favorite', 'No', 'Notification',
        'Option', 'Plus', 'Stealth', 'Yes'
    ];

    /**
     * All asset paths the module references, relative to the module root.
     * @returns {string[]}
     */
    static getRequiredAssets() {
        const icons = [];
        for (const name of this.ICON_NAMES) {
            icons.push(`icons/${name}.png`, `icons/${name}_on.png`);
        }

        const sounds = [...new Set([
            DEFAULTS.sfxCloseWindow,
            DEFAULTS.sfxGetMessage,
            DEFAULTS.sfxButtonPress,
            DEFAULTS.sfxSendMessage,
            ...NOTIFICATION_SOUND_OPTIONS.map(o => o.file)
        ])].map(p => p.replace(`modules/${MODULE_ID}/`, ''));

        return [...icons, ...sounds];
    }

    /**
     * Check every required asset. Never throws: transport errors are treated
     * as "missing" (the console report explains why), and the whole check is a
     * no-op returning [] when there is no document/fetch context.
     * @returns {Promise<string[]>} Paths that could not be loaded.
     */
    static async check() {
        const doc = globalThis.document;
        const fetchFn = globalThis.fetch;
        if (!doc || typeof fetchFn !== 'function') return [];

        const base = `modules/${MODULE_ID}/`;
        const missing = [];

        await Promise.all(this.getRequiredAssets().map(async (rel) => {
            try {
                const res = await fetchFn(`${base}${rel}`, { method: 'GET', cache: 'no-cache' });
                if (!res.ok) missing.push(rel);
            } catch (e) {
                missing.push(rel);
            }
        }));

        return missing.sort();
    }

    /**
     * Run the check and emit one consolidated console warning per category.
     * @returns {Promise<string[]>} Missing asset paths (empty when all good).
     */
    static async report() {
        const missing = await this.check();
        if (!missing.length) return missing;

        const icons = missing.filter(p => p.startsWith('icons/'));
        const sounds = missing.filter(p => p.startsWith('sounds/'));

        console.warn(`Chatzz | Asset check: ${missing.length} referenced asset(s) missing from disk.`);
        if (icons.length) console.warn(`Chatzz | Missing icons:\n  - ${icons.join('\n  - ')}`);
        if (sounds.length) console.warn(`Chatzz | Missing sounds:\n  - ${sounds.join('\n  - ')}`);
        console.warn('Chatzz | Reinstall the module or restore the files above; affected buttons/sounds will not render or play.');

        return missing;
    }
}
