/**
 * LD Chatzz - GM Monitor Data Engine
 */
import { DataManager } from '../DataManager.js';
import { Utils } from '../Utils.js';

export class GMMonitorData {
    /**
     * Get count of unread/new messages since last view
     */
    static getUnreadCount() {
        const lastViewed = DataManager.getGMSetting('lastMonitorView') || 0;
        return DataManager.interceptedMessages.filter(m => 
            (m.interceptedAt || m.messageData?.timestamp) > lastViewed
        ).length;
    }

    /**
     * Get all unique users involved in intercepted messages
     */
    static getInvolvedUsers() {
        const userIds = new Set();
        DataManager.interceptedMessages.forEach(m => {
            if (m.senderId) userIds.add(m.senderId);
            if (m.recipientId) userIds.add(m.recipientId);
            if (m.participants) m.participants.forEach(p => userIds.add(p));
        });
        
        return Array.from(userIds)
            .map(id => game.users.get(id))
            .filter(u => u && !u.isGM)
            .sort((a, b) => a.name.localeCompare(b.name));
    }

    /**
     * Get statistics about monitored messages
     */
    static getStats(flaggedMessages) {
        const messages = DataManager.interceptedMessages;
        const now = Date.now();
        const hourAgo = now - (60 * 60 * 1000);
        const today = new Date().setHours(0, 0, 0, 0);
        
        return {
            total: messages.length,
            private: messages.filter(m => !m.groupId).length,
            group: messages.filter(m => !!m.groupId).length,
            images: messages.filter(m => m.messageData?.imageUrl).length,
            lastHour: messages.filter(m => (m.interceptedAt || m.messageData?.timestamp) > hourAgo).length,
            today: messages.filter(m => (m.interceptedAt || m.messageData?.timestamp) > today).length,
            flagged: flaggedMessages.size
        };
    }

    static async prepareContext(instance) {
        let messages = [...DataManager.interceptedMessages];

        // Apply user filter
        if (instance._selectedUsers.size > 0) {
            messages = messages.filter(m => 
                instance._selectedUsers.has(m.senderId) || 
                instance._selectedUsers.has(m.recipientId) ||
                (m.participants && m.participants.some(p => instance._selectedUsers.has(p)))
            );
        }

        // Apply type filter
        if (instance._filterType === 'private') {
            messages = messages.filter(m => !m.groupId);
        } else if (instance._filterType === 'group') {
            messages = messages.filter(m => m.groupId);
        } else if (instance._filterType === 'flagged') {
            messages = messages.filter(m => instance._flaggedMessages.has(m.id));
        } else if (instance._filterType === 'images') {
            messages = messages.filter(m => m.messageData?.imageUrl);
        }

        // Apply search
        if (instance._searchQuery) {
            const query = instance._searchQuery.toLowerCase();
            messages = messages.filter(m => {
                const content = (m.messageData?.messageContent || '').toLowerCase();
                const sender = (m.messageData?.senderName || '').toLowerCase();
                const group = (m.groupName || '').toLowerCase();
                return content.includes(query) || sender.includes(query) || group.includes(query);
            });
        }

        // Apply sort
        switch (instance._sortOrder) {
            case 'oldest':
                messages.sort((a, b) => (a.interceptedAt || 0) - (b.interceptedAt || 0));
                break;
            case 'sender':
                messages.sort((a, b) => (a.messageData?.senderName || '').localeCompare(b.messageData?.senderName || ''));
                break;
            case 'type':
                messages.sort((a, b) => (a.groupId ? 1 : 0) - (b.groupId ? 1 : 0));
                break;
            case 'newest':
            default:
                messages.sort((a, b) => (b.interceptedAt || 0) - (a.interceptedAt || 0));
                break;
        }

        // Enrich messages
        const lastMonitorView = DataManager.getGMSetting('lastMonitorView') || 0;
        messages = messages.map(m => {
            const sender = game.users.get(m.senderId);
            const recipient = m.recipientId ? game.users.get(m.recipientId) : null;
            
            // Build participant list for group chats
            let participantNames = [];
            if (m.groupId && m.participants) {
                participantNames = m.participants
                    .map(id => game.users.get(id)?.name)
                    .filter(n => n);
            }
            
            return {
                id: m.id,
                timestamp: Utils.formatFullTimestamp(m.messageData?.timestamp || m.interceptedAt),
                relativeTime: Utils.formatRelativeTime(m.messageData?.timestamp || m.interceptedAt),
                rawTimestamp: m.messageData?.timestamp || m.interceptedAt,
                senderName: m.messageData?.senderName || sender?.name || 'Unknown',
                senderAvatar: m.messageData?.senderImg || sender?.avatar,
                senderId: m.senderId,
                recipientName: recipient?.name || null,
                recipientId: m.recipientId,
                groupName: m.groupName || null,
                groupId: m.groupId,
                isGroup: !!m.groupId,
                participantNames,
                content: m.messageData?.messageContent || '',
                contentPreview: (m.messageData?.messageContent || '').replace(/<[^>]*>/g, '').substring(0, 150),
                hasImage: !!m.messageData?.imageUrl,
                imageUrl: m.messageData?.imageUrl,
                isFlagged: instance._flaggedMessages.has(m.id),
                isNew: (m.interceptedAt || m.messageData?.timestamp) > lastMonitorView
            };
        });

        const stats = this.getStats(instance._flaggedMessages);
        const involvedUsers = this.getInvolvedUsers();

        return {
            messages,
            filterType: instance._filterType,
            sortOrder: instance._sortOrder,
            searchQuery: instance._searchQuery,
            showImages: instance._showImages,
            autoScroll: instance._autoScroll,
            stealthMode: instance._stealthMode,
            messageCount: messages.length,
            totalCount: DataManager.interceptedMessages.length,
            stats,
            involvedUsers,
            selectedUsers: Array.from(instance._selectedUsers),
            isGM: game.user.isGM
        };
    }
}
