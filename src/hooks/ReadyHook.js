/**
 * LD Chatzz - Ready Hook Logic
 */
import { LDChatzz } from "../LDChatzz.js";
import { MODULE_ID } from "../Constants.js";
import { ThemeManager } from "../ThemeManager.js";
import { AssetChecker } from "../AssetChecker.js";

export class ReadyHook {
    static async onReady() {
        try {
            await LDChatzz.initialize();
        } catch (error) {
            console.error("Chatzz | Error initializing:", error);
        }

        try {
            const bg = game.settings.get(MODULE_ID, "personalBackground");
            if (bg) window.LDChatzzPersonalBackground = bg;
        } catch (error) {
            console.error("Chatzz | Error loading background:", error);
        }

        try {
            ThemeManager.refresh();
        } catch (error) {
            console.error("Chatzz | Error applying theme:", error);
        }

        // Startup asset sanity check (icons + sounds); failures are console warnings only.
        // Fire-and-forget, but attach a catch so an async failure can never become an
        // unhandled rejection that breaks module startup.
        try {
            Promise.resolve(AssetChecker.report()).catch((error) => {
                console.error("Chatzz | Asset check failed:", error);
            });
        } catch (error) {
            console.error("Chatzz | Asset check failed to run:", error);
        }

        setTimeout(() => {
            if (ui.controls) ui.controls.render({ reset: true, force: true });
        }, 1000);
    }

    static register() {
        Hooks.once("ready", () => ReadyHook.onReady());
    }
}
