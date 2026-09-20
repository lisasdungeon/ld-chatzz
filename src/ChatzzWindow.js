/**
 * LD Chatzz - Chat Window
 * Turbo-level component for primary messaging interfaces.
 */

import { ChatzzWindowData } from './windows/ChatzzWindowData.js';
import { ChatzzWindowEvents } from './windows/ChatzzWindowEvents.js';
import { ChatzzWindowUI } from './windows/ChatzzWindowUI.js';
import { ChatzzWindowActions } from './windows/ChatzzWindowActions.js';
import { DataManager } from './DataManager.js';
import { Utils } from './Utils.js';
import { UI_SOUNDS } from './Constants.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class ChatzzWindow extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
        classes: ['ld-chatzz', 'chatzz-chat-window'],
        position: { width: 420, height: 500 },
        window: { resizable: true },
        popOut: false,
        tag: 'form',
        form: { closeOnSubmit: false }
    };

    static PARTS = {
        form: { template: 'modules/ld-chatzz/templates/chat-window.hbs' }
    };

    constructor(options = {}) {
        super(options);
        this._preservedInputValue = '';
        this._lastTypingEmit = 0;
        this._typingTimeout = null;
        this._searchQuery = '';
        this._pendingImage = null;
    }

    async _prepareContext() {
        return ChatzzWindowData.getChatContext(this);
    }

    _onRender(context, options) {
        super._onRender(context, options);
        ChatzzWindowEvents.activateListeners(this, this.element);
        ChatzzWindowUI.setupButtonImages(this.element);
        ChatzzWindowUI.scrollToBottom(this.element);
        
        const convId = this.options.groupId
            || this.options.actorId
                ? (this.options.groupId || DataManager.getActorChatKey(this.options.actorId))
                : DataManager.getPrivateChatKey(game.user.id, this.options.otherUserId);
        const bg = DataManager.getEffectiveBackground(convId, game.user.id);
        ChatzzWindowUI.applyBackground(this.element, bg);
        ChatzzWindowUI.updateImagePreview(this.element, this._pendingImage);
    }

    async close(options = {}) {
        Utils.playUISound(UI_SOUNDS.closeWindow);
        return super.close(options);
    }

    async _handleFormSubmit() {
        const textarea = this.element.querySelector('textarea[name="message"]');
        const speaker = this.element.querySelector('select[name="speaker"]');
        const message = textarea?.value?.trim();
        const speakerId = speaker?.value;
        
        if (!message && !this._pendingImage) return;

        // Play send message sound
        Utils.playUISound(UI_SOUNDS.sendMessage);

        // Force a re-render AFTER setting state so context is fresh
        const currentImage = this._pendingImage;
        this._pendingImage = null;
        this._preservedInputValue = '';
        if (textarea) textarea.value = '';

        await ChatzzWindowActions.handleMessageSubmit(this, message, speakerId, currentImage);
        
        // Use a slight delay to ensure the data layer has finished its work
        setTimeout(() => this.render(true), 100);
    }

    async _onImageSelected(e) {
        const file = e.target.files?.[0];
        if (!file) return;
        const result = await DataManager.processImage(file);
        if (result) {
            this._pendingImage = result;
            ChatzzWindowUI.updateImagePreview(this.element, result);
        }
    }
}
