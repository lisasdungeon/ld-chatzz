/**
 * LD Chatzz - Data Store
 * Core state management for the Chatzz module.
 */

export class DataStore {
    static privateChats = new Map();
    static actorChats = new Map();
    static groupChats = new Map();
    static interceptedMessages = [];
    static unreadCounts = new Map();
    static lastRead = new Map();
    static typingUsers = new Map();
    static favorites = new Set();
    static lastActivity = new Map();
    static mutedConversations = new Set();
    static pinnedMessages = new Map();
    static sharedBackgrounds = new Map();
    static userPresence = new Map();
    
    // Internal state
    static _replyToMessage = null;
    static _personalBackground = null;
    static _chatBackgrounds = new Map();
    static _gmSettings = new Map();
    static _playerSettings = new Map();
    
    static gmBackgrounds = {
        global: null,
        perUser: new Map(),
        perChat: new Map()
    };

    static isMuted(id) {
        return this.mutedConversations.has(id);
    }
}
