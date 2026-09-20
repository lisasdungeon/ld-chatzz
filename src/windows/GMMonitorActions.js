/**
 * LD Chatzz - GM Monitor Actions Engine
 */
import { DataManager } from '../DataManager.js';
import { Utils } from '../Utils.js';

export class GMMonitorActions {
    static exportLog(instance) {
        let messages = DataManager.interceptedMessages;
        
        if (instance._selectedUsers.size > 0) {
            messages = messages.filter(m => 
                instance._selectedUsers.has(m.senderId) || 
                instance._selectedUsers.has(m.recipientId)
            );
        }
        
        if (instance._filterType === 'private') messages = messages.filter(m => !m.groupId);
        else if (instance._filterType === 'group') messages = messages.filter(m => m.groupId);
        else if (instance._filterType === 'flagged') messages = messages.filter(m => instance._flaggedMessages.has(m.id));

        const exportData = messages.map(m => ({
            timestamp: Utils.formatFullTimestamp(m.messageData?.timestamp || m.interceptedAt),
            type: m.groupId ? 'GROUP' : 'PRIVATE',
            sender: m.messageData?.senderName || 'Unknown',
            recipient: m.groupName || (m.recipientId ? game.users.get(m.recipientId)?.name : 'Unknown'),
            content: (m.messageData?.messageContent || '').replace(/<[^>]*>/g, ''),
            hasImage: !!m.messageData?.imageUrl,
            flagged: instance._flaggedMessages.has(m.id)
        }));

        const filename = `chatzz-monitor-export-${new Date().toISOString().split('T')[0]}.json`;
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        
        ui.notifications.info(game.i18n.format('CHATZZ.ExportComplete', { count: exportData.length }));
    }

    static async exportToJournal(instance) {
        let messages = DataManager.interceptedMessages;
        if (instance._filterType === 'flagged') {
            messages = messages.filter(m => instance._flaggedMessages.has(m.id));
        }

        if (messages.length === 0) {
            ui.notifications.warn(game.i18n.localize('CHATZZ.NoMessagesToExport'));
            return;
        }

        let content = `<h2>Chatzz Monitor Log - ${new Date().toLocaleDateString()}</h2><p><em>Total: ${messages.length}</em></p><hr>`;
        const sorted = [...messages].sort((a, b) => (a.messageData?.timestamp || a.interceptedAt || 0) - (b.messageData?.timestamp || b.interceptedAt || 0));

        for (const m of sorted) {
            const timestamp = Utils.formatFullTimestamp(m.messageData?.timestamp || m.interceptedAt);
            const sender = m.messageData?.senderName || 'Unknown';
            const type = m.groupId ? `[GROUP: ${m.groupName || 'Unknown'}]` : '[PRIVATE]';
            const recipient = m.recipientId ? game.users.get(m.recipientId)?.name : '';
            const flagged = instance._flaggedMessages.has(m.id) ? 'FLAG ' : '';
            
            content += `<p><strong>${flagged}${timestamp}</strong> ${type}</p>`;
            content += `<p><strong>${sender}</strong>${recipient ? ` → ${recipient}` : ''}:</p>`;
            content += `<blockquote>${m.messageData?.messageContent || ''}</blockquote>`;
            if (m.messageData?.imageUrl) content += `<p><img src="${m.messageData.imageUrl}" style="max-width:200px;"></p>`;
            content += '<hr>';
        }

        const journal = await JournalEntry.create({
            name: `Chatzz Monitor Log - ${new Date().toLocaleString()}`,
            ownership: { default: 0 },
            pages: [{ name: 'Monitor Log', type: 'text', text: { content, format: 1 } }]
        });

        ui.notifications.info(game.i18n.format('CHATZZ.JournalExportComplete', { name: journal.name }));
        journal.sheet.render(true);
    }
}
