/**
 * LD Chatzz - Chat Window UI
 * Engine for Chat Window UI manipulation (backgrounds, scrolling, typing).
 */

import { Utils } from '../Utils.js';
import { UI_SOUNDS } from '../Constants.js';

export class ChatzzWindowUI {
    static applyBackground(element, path) {
        const container = element?.querySelector('.chatzz-chat-container');
        if (!container) return;
        if (path) {
            // The ::before overlay in chatzz-base/overrides reads --chat-background.
            // Also set an inline background-image fallback; the scrim var is themed per
            // theme in chatzz-themes.css so the tint follows the active palette.
            container.style.setProperty('--chat-background', `url("${path}")`);
            container.style.backgroundImage = `var(--chatzz-bg-scrim), url("${path}")`;
            container.style.backgroundSize = 'cover';
            container.style.backgroundPosition = 'center';
            container.style.backgroundRepeat = 'no-repeat';
            container.classList.add('has-background');
        } else {
            container.style.removeProperty('--chat-background');
            container.style.backgroundImage = '';
            container.style.removeProperty('background-size');
            container.style.removeProperty('background-position');
            container.style.removeProperty('background-repeat');
            container.classList.remove('has-background');
        }
    }

    static scrollToBottom(element, smooth = true) {
        const list = element?.querySelector('.chatzz-message-list');
        if (list) {
            requestAnimationFrame(() => {
                list.scrollTo({ top: list.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
            });
        }
    }

    static updateImagePreview(element, pendingImage) {
        const preview = element?.querySelector('.chatzz-image-preview');
        if (!preview) return;
        if (pendingImage) {
            preview.innerHTML = `
                <div class="chatzz-pending-image">
                    <img src="${pendingImage}">
                    <button type="button" class="chatzz-cancel-image"><i class="fas fa-times"></i></button>
                </div>`;
            preview.style.display = 'block';
        } else {
            preview.style.display = 'none';
        }
    }

    static updateTyping(element, text) {
        const el = element?.querySelector('.chatzz-typing-indicator');
        if (!el) return;
        if (text) {
            el.style.display = '';
            el.innerHTML = `<i class="fas fa-ellipsis-h"></i> ${Utils.sanitizeHTML(text)}`;
        } else {
            el.style.display = 'none';
        }
    }

    /**
     * Set up image-based buttons: close button replacement + pressed state image swaps.
     * Call from _onRender on any chatzz window.
     */
    static setupButtonImages(windowElement) {
        if (!windowElement) return;

        // Force white border on the window element
        windowElement.style.border = '2px solid #ffffff';
        windowElement.style.outline = 'none';

        // Replace close button icon with No.png image
        const allCloseBtns = Array.from(windowElement.querySelectorAll(
            '.header-control.close, .header-button.close, button[data-action="close"], button.close'
        ));
        let closeBtnReplaced = false;
        for (const btn of allCloseBtns) {
            if (!closeBtnReplaced) {
                btn.innerHTML = '<img class="btn-icon close-icon" src="modules/ld-chatzz/icons/No.png" data-default="modules/ld-chatzz/icons/No.png" data-active="modules/ld-chatzz/icons/No_on.png" alt="Close">';
                btn.classList.add('chatzz-close-btn');
                const img = btn.querySelector('img');
                btn.addEventListener('mousedown', () => {
                    if (img) img.src = img.dataset.active;
                });
                btn.addEventListener('mouseup', () => {
                    if (img) img.src = img.dataset.default;
                });
                btn.addEventListener('mouseleave', () => {
                    if (img) img.src = img.dataset.default;
                });
                btn._btnImgSetup = true;
                closeBtnReplaced = true;
            } else {
                btn.style.display = 'none';
            }
        }

        // Broad sweep: hide any remaining header buttons/controls that are not our custom close button
        const allHeaderControls = windowElement.querySelectorAll(
            '.window-header button, .window-header a.header-button, .window-header .header-control'
        );
        for (const el of allHeaderControls) {
            if (!el.classList.contains('chatzz-close-btn')) {
                el.style.display = 'none';
            }
        }

        // Set up pressed state image swaps for all buttons with data-default/data-active images
        const allBtnImages = windowElement.querySelectorAll('img[data-default][data-active]');
        for (const img of allBtnImages) {
            const btn = img.closest('button');
            if (!btn || btn._btnImgSetup) continue;
            btn._btnImgSetup = true;

            btn.addEventListener('mousedown', () => {
                img.src = img.dataset.active;
            });
            btn.addEventListener('mouseup', () => {
                img.src = img.dataset.default;
            });
            btn.addEventListener('mouseleave', () => {
                img.src = img.dataset.default;
            });
        }

        // For tab buttons, swap active tab image
        const tabs = windowElement.querySelectorAll('.chatzz-tab');
        for (const tab of tabs) {
            const img = tab.querySelector('img[data-default][data-active]');
            if (!img) continue;
            if (tab.classList.contains('active')) {
                img.src = img.dataset.active;
            } else {
                img.src = img.dataset.default;
            }
        }

        // Grey buttons - Play buttonPress SFX
        const greyButtons = windowElement.querySelectorAll(
            '.chatzz-btn, .chatzz-btn-icon, .chatzz-btn-small, .chatzz-toolbar-btn, .chatzz-filter-btn, .chatzz-toggle-btn, .chatzz-btn-gm'
        );
        for (const btn of greyButtons) {
            if (btn._chatzzGreySoundAttached) continue;
            btn._chatzzGreySoundAttached = true;
            btn.addEventListener('click', () => {
                if (btn.classList.contains('chatzz-send-btn') || btn.classList.contains('chatzz-close-btn')) return;
                Utils.playUISound(UI_SOUNDS.buttonPress);
            });
        }
    }
}
