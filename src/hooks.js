/**
 * LD Chatzz - Hooks System (Registration Entry)
 * Thin registration only; heavy modules load inside each hook callback.
 */
import { SceneControlsHook } from "./hooks/SceneControlsHook.js";

export function registerHooks(env = globalThis) {
    if (!env.Hooks) return false;

    env.Hooks.once("init", async () => {
        SceneControlsHook.register(env);
        const { SettingsHook } = await import("./hooks/SettingsHook.js");
        SettingsHook.onInit();
    });

    env.Hooks.once("ready", async () => {
        const [{ LDChatzz }, { ReadyHook }, { UIHooks }, { AppMode }] = await Promise.all([
            import("./LDChatzz.js"),
            import("./hooks/ReadyHook.js"),
            import("./hooks/UIHooks.js"),
            import("./AppMode.js")
        ]);
        env.LDChatzz = LDChatzz;
        await ReadyHook.onReady();
        UIHooks.register();
        AppMode.register(env);
        AppMode.sync(env);
    });

    return true;
}
