# LD Chatzz

Next-generation encrypted communications module for Foundry VTT. Features private messaging, actor and NPC conversations, group channels, image sharing, GM stealth monitoring, and a sleek cyberpunk interface. System agnostic.

- Version: `1.5.0`
- Compatibility: Foundry VTT `11+` (verified `13`)
- License: Lisa's Dungeon Proprietary License

## Features

- **Private Messaging** - Direct player-to-player chat with real-time delivery
- **Actor Conversations** - Chat with NPCs and other characters through a friend-request flow
- **Group Channels** - Create and manage multi-user group chats
- **Image Sharing** - Send images directly in conversations
- **GM Stealth Monitor** - Live, filterable view of all communications for GMs
- **GM Moderation Tools** - Clear or delete conversations, per-type or in bulk
- **Custom Backgrounds** - Set a personal background image from the hub Settings tab or the settings window, with instant live preview on every open window
- **Sound Effects** - Configurable notification and UI sounds, with a GM-wide override option
- **Selectable Themes** - Crimson, Void, and Neon palettes, swappable at runtime from the hub Settings tab or the settings window and persisted per client

## Installation

Install v1.5.0 by pasting its manifest URL into Foundry VTT:

**Manifest URL (v1.5.0)**:
```
https://github.com/RNK-Enterprise/ld-chatzz/releases/download/v1.5.0/module.json
```

For automatic updates, use the always-latest manifest instead:
```
https://github.com/RNK-Enterprise/ld-chatzz/releases/latest/download/module.json
```

Direct download: [ld-chatzz-v1.5.0.zip](https://github.com/RNK-Enterprise/ld-chatzz/releases/download/v1.5.0/ld-chatzz-v1.5.0.zip) - full notes in the [v1.5.0 release](https://github.com/RNK-Enterprise/ld-chatzz/releases/tag/v1.5.0).

### How to Install
1. Open Foundry VTT
2. Go to **Add-on Modules**
3. Click **Install Module**
4. Paste one of the manifest URLs above (the pinned URL installs exactly v1.5.0; the latest URL tracks new releases)
5. Click **Install**

## Usage

Open the hub from the scene controls toolbar (the satellite-dish icon). From there you can start private chats, message actors you've befriended, create group channels, and (as GM) access the monitor and moderation tools.

### Using LD Chatzz from a phone

LD Chatzz includes a responsive layout, so players can message from their phone's browser. The chat hub, chat windows, and GM tools go full-screen and enlarge their touch targets automatically on phone-sized viewports (768px and below, or on touch devices).

1. Make sure your Foundry world is reachable from the phone (port forwarding or a hosting provider).
2. Open your Foundry world's URL in the phone's browser and log in as the player.
3. In the browser menu, choose **Add to Home Screen** (or **Install app**) so LD Chatzz launches full-screen like a native app.
4. Tap the satellite-dish scene control to open the hub and start messaging.

While a chat window is open on a phone, Foundry's scene controls, hotbar, navigation bar, and sidebar automatically hide so LD Chatzz fills the screen like a dedicated app. Closing the chat window restores them.

## Compatibility

- **Foundry VTT**: v11+ (verified through v13)

## License

Proprietary - see [LICENSE](LICENSE)

## Support

- Issues: https://github.com/RNK-Enterprise/ld-chatzz/issues
- Patreon: https://patreon.com/LisasDungeon
- Discord: MystryssLysa
- Email: Lisasdungeon@gmail.com
