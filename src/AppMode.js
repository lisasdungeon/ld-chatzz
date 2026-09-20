/**
 * LD Chatzz - App Mode
 * Toggles a body class while any LD Chatzz window is open so mobile CSS can
 * hide Foundry's scene controls and hotbar for a dedicated-app feel.
 */

export class AppMode {
    static BODY_CLASS = 'chatzz-app-mode';
    static WINDOW_SELECTOR = '.ld-chatzz';

    /**
     * Whether at least one LD Chatzz window is currently in the DOM.
     * @param {object} [env] - Global-like scope (defaults to globalThis).
     * @returns {boolean}
     */
    static isChatzzOpen(env = globalThis) {
        return Boolean(env.document?.querySelector?.(AppMode.WINDOW_SELECTOR));
    }

    /**
     * Reflect the current open state onto the document body class.
     * @param {object} [env] - Global-like scope (defaults to globalThis).
     * @returns {boolean} Whether app mode is active.
     */
    static sync(env = globalThis) {
        const body = env.document?.body;
        if (!body) return false;
        const open = AppMode.isChatzzOpen(env);
        if (typeof body.classList?.toggle === 'function') {
            body.classList.toggle(AppMode.BODY_CLASS, open);
        }
        return open;
    }

    /**
     * Subscribe to render/close hooks so the class stays accurate as windows open and close.
     * @param {object} [env] - Global-like scope (defaults to globalThis).
     * @returns {boolean} Whether hooks were registered.
     */
    static register(env = globalThis) {
        const hooks = env.Hooks;
        if (!hooks?.on) return false;

        const schedule = () => {
            setTimeout(() => AppMode.sync(env), 0);
        };

        hooks.on('renderApplicationV2', schedule);
        hooks.on('renderApplication', schedule);
        hooks.on('closeApplicationV2', schedule);
        hooks.on('closeApplication', schedule);
        return true;
    }
}
