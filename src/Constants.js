/**
 * LD Chatzz - Shared Constants
 * Central location for module configuration and constants
 */

export const MODULE_ID = 'ld-chatzz';
export const MODULE_NAME = 'LD Chatzz';
export const SOCKET_NAME = `module.${MODULE_ID}`;

// Socket event types
export const SOCKET_EVENTS = {
    PRIVATE_MESSAGE: 'privateMessage',
    GROUP_MESSAGE: 'groupMessage',
    CHANNEL_MESSAGE: 'channelMessage',
    TYPING: 'typing',
    FRIEND_REQUEST: 'friendRequest',
    FRIEND_RESPONSE: 'friendResponse',
    EDIT_MESSAGE: 'editMessage',
    DELETE_MESSAGE: 'deleteMessage',
    ADD_REACTION: 'addReaction',
    GROUP_CREATE: 'groupCreate',
    GROUP_UPDATE: 'groupUpdate',
    GROUP_DELETE: 'groupDelete',
    GROUP_SYNC: 'groupSync',
    PRIVATE_SYNC: 'privateSync',
    BACKGROUND_SHARE: 'backgroundShare',
    PRESENCE_UPDATE: 'presenceUpdate',
    MESSAGE_READ: 'messageRead',
    CHANNEL_INVITE: 'channelInvite',
    IMAGE_SHARE: 'imageShare',
    GM_INTERCEPT: 'gmIntercept'
};

// Message types for different content
export const MESSAGE_TYPES = {
    TEXT: 'text',
    SYSTEM: 'system',
    DICE: 'dice',
    ITEM_LINK: 'itemLink',
    ACTOR_LINK: 'actorLink',
    IMAGE: 'image',
    FILE: 'file'
};

// Default settings values
export const DEFAULTS = {
    theme: 'crimson',
    enableSounds: true,
    notificationVolume: 0.5,
    enableDesktopNotifications: true,
    enterToSend: true,
    shareBackground: false,
    showAvatars: true,
    compactMode: false,
    maxMessageHistory: 500,
    typingTimeout: 5000,
    maxIntercepted: 1000,

    sfxCloseWindow: 'modules/ld-chatzz/sounds/Closes a window.wav',
    sfxGetMessage: 'modules/ld-chatzz/sounds/gets a message.wav',
    sfxButtonPress: 'modules/ld-chatzz/sounds/presses a button.wav',
    sfxSendMessage: 'modules/ld-chatzz/sounds/sending or recieving a message.wav'
};

// UI Sound effect keys (for customization by settings)
export const UI_SOUNDS = {
    closeWindow: 'closeWindow',
    getMessage: 'getMessage',
    buttonPress: 'buttonPress',
    sendMessage: 'sendMessage'
};

// Runtime color themes (palette swaps via CSS custom properties)
export const THEME_OPTIONS = [
    { id: 'crimson', label: 'CHATZZ.ThemeCrimson' },
    { id: 'void', label: 'CHATZZ.ThemeVoid' },
    { id: 'neon', label: 'CHATZZ.ThemeNeon' }
];

// Built-in notification sound choices for the settings dropdown
export const NOTIFICATION_SOUND_OPTIONS = [
    { file: 'modules/ld-chatzz/sounds/gets a message.wav', name: 'CHATZZ.SoundOptionMessage' },
    { file: 'modules/ld-chatzz/sounds/sending or recieving a message.wav', name: 'CHATZZ.SoundOptionSend' },
    { file: 'modules/ld-chatzz/sounds/presses a button.wav', name: 'CHATZZ.SoundOptionButton' },
    { file: 'modules/ld-chatzz/sounds/Closes a window.wav', name: 'CHATZZ.SoundOptionClose' }
];

// Reaction emoji presets
export const REACTION_EMOJIS = [];

// Status indicators
export const STATUS = {
    ONLINE: 'online',
    AWAY: 'away',
    BUSY: 'busy',
    OFFLINE: 'offline'
};

// Supported image types for upload
export const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
export const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
