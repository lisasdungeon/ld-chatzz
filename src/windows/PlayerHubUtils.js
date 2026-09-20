/**
 * LD Chatzz - Player Hub Utilities
 * Engine for exports and GM-specific hub actions.
 */

import { MODULE_ID } from '../Constants.js';
import { DataManager } from '../DataManager.js';

export class PlayerHubUtils {
    static async exportToJournal() {
        let content = `<h1>Chatzz Chat Export</h1><p>Exported: ${new Date().toLocaleString()}</p><hr>`;

        for (const section of this._getExportSections()) {
            content += `<h2>${section.title}</h2>`;
            content += this._formatExport(section.history);
        }
        
        await JournalEntry.create({
            name: `Chatzz Export ${new Date().toLocaleDateString()}`,
            pages: [{ name: 'Chat History', type: 'text', text: { content, format: 1 } }]
        });
        ui.notifications.info(game.i18n.localize('CHATZZ.ExportedToJournal'));
    }

    static async exportLocal() {
        let content = `LD Chatzz Chat Export - ${new Date().toLocaleString()}\n`;
        content += "========================================\n\n";

        for (const section of this._getExportSections()) {
            content += `${section.title}\n`;
            if (section.history) {
                section.history.forEach(m => {
                    const time = new Date(m.timestamp).toLocaleTimeString();
                    content += `[${time}] ${m.senderName}: ${m.messageContent}\n`;
                });
            }
            content += "\n----------------------------------------\n\n";
        }

        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `chatzz-export-${Date.now()}.txt`;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        ui.notifications.info(game.i18n.localize('CHATZZ.ExportedToLocalFile'));
    }

    static _formatExport(history) {
        if (!history?.length) return '<p>No messages</p>';
        let h = '<ul>';
        for (const m of history) {
            const time = new Date(m.timestamp).toLocaleTimeString();
            h += `<li>[${time}] <strong>${m.senderName}:</strong> ${m.messageContent}</li>`;
        }
        return h + '</ul>';
    }

    static _getExportSections() {
        return [
            ...this._getActorExportSections(),
            ...this._getPrivateExportSections()
        ];
    }

    static _getActorExportSections() {
        const visibleActorIds = new Set(DataManager.getVisibleActors().map(actor => actor.id));
        const sections = [];

        for (const chat of DataManager.actorChats.values()) {
            const actor = game.actors.get(chat.actorId);
            if (!actor || !visibleActorIds.has(actor.id)) continue;
            sections.push({
                title: `Character Chat with ${chat.actorName || actor.name || 'Unknown'}`,
                history: chat.history || []
            });
        }

        return sections;
    }

    static _getPrivateExportSections() {
        const sections = [];

        for (const chat of DataManager.privateChats.values()) {
            if (!chat.users?.includes(game.user.id)) continue;
            const other = game.users.get(chat.users.find(id => id !== game.user.id));
            sections.push({
                title: `Chat with ${other?.name || 'Unknown'}`,
                history: chat.history || []
            });
        }

        return sections;
    }

    static async setGlobalBackground() {
        new FilePicker({
            type: 'image',
            callback: async (path) => {
                const bgs = game.settings.get(MODULE_ID, 'gmBackgrounds') || {};
                bgs.global = path;
                await game.settings.set(MODULE_ID, 'gmBackgrounds', bgs);
            }
        }).render(true);
    }
}
