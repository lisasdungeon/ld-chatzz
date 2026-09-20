import assert from "node:assert/strict";
import test from "node:test";
import { installMocks, restoreMocks } from "./foundry-mock.mjs";

test("Utils remaining catch and edge paths", async () => {
    installMocks({
        settings: {
            "ld-chatzz.enableDesktopNotifications": true,
            "ld-chatzz.enableSounds": true,
            "ld-chatzz.notificationVolume": 0.5,
            "ld-chatzz.gmOverrideEnabled": false,
            "ld-chatzz.gmOverrideSoundPath": "",
            "ld-chatzz.sfxCloseWindow": "",
            "ld-chatzz.sfxGetMessage": "",
            "ld-chatzz.sfxButtonPress": "",
            "ld-chatzz.sfxSendMessage": ""
        }
    });
    const { Utils } = await import("../src/Utils.js");

    // catch in showDesktopNotification
    const origGet = game.settings.get;
    game.settings.get = () => {
        throw new Error("no settings");
    };
    Utils.showDesktopNotification("t", "b", "i");
    game.settings.get = origGet;

    // catch in playSound
    foundry.audio.AudioHelper.play = () => {
        throw new Error("audio fail");
    };
    Utils.playSound("x.wav", 0.1);

    // unknown sound key -> null path + early return
    Utils.playUISound("unknownKey");
    // empty custom + DEFAULTS fallback then play
    Utils.playUISound("closeWindow");

    // catch in playUISound
    game.settings.get = () => {
        throw new Error("sfx fail");
    };
    Utils.playUISound("getMessage");
    game.settings.get = origGet;

    // permission denied path (no request)
    document.hasFocus = () => false;
    Notification.permission = "denied";
    Utils.showDesktopNotification("t", "b", "i");

    // permission default then not granted
    Notification.permission = "default";
    Notification.requestPermission = async () => "denied";
    Utils.showDesktopNotification("t", "b", "i");
    await new Promise((r) => setTimeout(r, 10));

    restoreMocks();
});
