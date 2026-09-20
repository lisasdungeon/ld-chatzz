/**
 * LD Chatzz - Chat Window Events
 * Engine for Chat Window DOM event listeners.
 */

import { ChatzzWindowActions } from './ChatzzWindowActions.js';
import { ChatzzWindowUI } from './ChatzzWindowUI.js';
import { DataManager } from '../DataManager.js';
import { SocketHandler } from '../SocketHandler.js';
import { Utils } from '../Utils.js';
import { MODULE_ID } from '../Constants.js';

export class ChatzzWindowEvents {
    static activateListeners(app, element) {
        // Form Submit listener
        element.addEventListener('submit', (e) => {
            e.preventDefault();
            app._handleFormSubmit();
        });

        const textarea = element.querySelector('textarea[name="message"]');
        if (textarea) {
            textarea.value = app._preservedInputValue || '';
            textarea.focus();
            
            textarea.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    app._handleFormSubmit();
                }
            });
            textarea.addEventListener('input', () => {
                app._preservedInputValue = textarea.value;
                this._onTyping(app);
            });
        }

        // Send Button click listener
        element.querySelector('.chatzz-send-btn')?.addEventListener('click', (e) => {
            e.preventDefault();
            app._handleFormSubmit();
        });

        element.querySelector('.chatzz-image-btn')?.addEventListener('click', () => element.querySelector('.chatzz-image-input')?.click());
        element.querySelector('.chatzz-image-input')?.addEventListener('change', (e) => app._onImageSelected(e));

        // Toolbar Button listeners
        element.querySelector('.chatzz-favorite-btn')?.addEventListener('click', (e) => {
            const convId = app.options.groupId || app.options.actorId ? (app.options.groupId || DataManager.getActorChatKey(app.options.actorId)) : DataManager.getPrivateChatKey(game.user.id, app.options.otherUserId);
            DataManager.toggleFavorite(convId);
            app.render({force: true});
        });

        element.querySelector('.chatzz-mute-btn')?.addEventListener('click', (e) => {
            const convId = app.options.groupId || app.options.actorId ? (app.options.groupId || DataManager.getActorChatKey(app.options.actorId)) : DataManager.getPrivateChatKey(game.user.id, app.options.otherUserId);
            DataManager.toggleMuted(convId);
            app.render({force: true});
        });

        element.querySelector('.chatzz-export-btn')?.addEventListener('click', async (e) => {
            const convId = app.options.groupId || app.options.actorId ? (app.options.groupId || DataManager.getActorChatKey(app.options.actorId)) : DataManager.getPrivateChatKey(game.user.id, app.options.otherUserId);
            const content = DataManager.exportConversation(convId, !!app.options.groupId);
            const filename = `chatzz-chat-${convId}.txt`;
            const blob = new Blob([content], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = filename;
            document.body.appendChild(anchor);
            anchor.click();
            document.body.removeChild(anchor);
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        });

        element.querySelector('.chatzz-background-btn')?.addEventListener('click', () => {
            const convId = app.options.groupId || app.options.actorId ? (app.options.groupId || DataManager.getActorChatKey(app.options.actorId)) : DataManager.getPrivateChatKey(game.user.id, app.options.otherUserId);
            const current = (game.settings.get(MODULE_ID, 'chatBackgrounds') || {})[convId] || '';
            new FilePicker({
                type: 'image',
                current: current,
                callback: async (path) => {
                    const bgs = game.settings.get(MODULE_ID, 'chatBackgrounds') || {};
                    if (path) {
                        bgs[convId] = path;
                    } else {
                        delete bgs[convId];
                    }
                    await game.settings.set(MODULE_ID, 'chatBackgrounds', bgs);
                    ChatzzWindowUI.applyBackground(element, path);
                }
            }).browse(current);
        });
        
        // Message action buttons are removed from UI (reply/react/pin/edit/delete not available)
        // Event listeners for those actions are intentionally no-op.
    }

    static _onTyping(app) {
        const now = Date.now();
        const convId = app.options.groupId || app.options.actorId ? (app.options.groupId || DataManager.getActorChatKey(app.options.actorId)) : DataManager.getPrivateChatKey(game.user.id, app.options.otherUserId);
        if (now - app._lastTypingEmit > 2000) {
            app._lastTypingEmit = now;
            SocketHandler.sendTypingIndicator(convId, true, !!app.options.groupId);
        }
        clearTimeout(app._typingTimeout);
        app._typingTimeout = setTimeout(() => {
            SocketHandler.sendTypingIndicator(convId, false, !!app.options.groupId);
        }, 3000);
    }
}
