/**
 * LD Chatzz - Early Scene Control Registration
 * Registers toolbar definitions during init and lazy-loads actions on demand.
 */

export class SceneControlsHook {
    static register(env = globalThis) {
        if (!env.Hooks?.on) return false;
        env.Hooks.on('getSceneControlButtons', (controls) => {
            SceneControlsHook.addControls(controls, env);
        });
        return true;
    }

    static addControls(controls, env = globalThis) {
        const isLegacy = Array.isArray(controls);
        const makeTool = (name, title, icon, order, action) => {
            const activate = (...args) => {
                const active = isLegacy || (args.length > 1 ? args[1] : args[0]);
                if (!active) return;
                return action();
            };
            return {
                name,
                title,
                icon,
                order,
                button: true,
                toggle: false,
                visible: true,
                ...(isLegacy ? { onClick: activate } : { onChange: activate })
            };
        };

        const tools = [
            makeTool('openHub', 'CHATZZ.OpenHub', 'fas fa-comments', 0, () =>
                import('../UIManager.js').then(({ UIManager }) => UIManager.openPlayerHub())),
            makeTool('newChat', 'CHATZZ.NewPrivateChat', 'fas fa-plus', 1, () =>
                import('./UIHooks.js').then(({ UIHooks }) => UIHooks._showNewChatDialog()))
        ];

        if (env.game.user.isGM) {
            tools.push(
                makeTool('gmMonitor', 'CHATZZ.GMMonitorTitle', 'fas fa-eye', 2, () =>
                    import('../UIManager.js').then(({ UIManager }) => UIManager.openGMMonitor())),
                makeTool('gmMod', 'CHATZZ.GMModTitle', 'fas fa-shield-alt', 3, () =>
                    import('../UIManager.js').then(({ UIManager }) => UIManager.openGMModWindow()))
            );
        }

        const chatzzControl = {
            name: 'chatzz',
            title: 'CHATZZ.Communications',
            icon: 'fas fa-satellite-dish',
            order: 100,
            layer: 'tokens',
            visible: true,
            activeTool: 'openHub',
            tools: isLegacy ? tools : Object.fromEntries(tools.map(tool => [tool.name, tool]))
        };

        if (isLegacy) controls.push(chatzzControl);
        else controls.chatzz = chatzzControl;
        return chatzzControl;
    }
}
