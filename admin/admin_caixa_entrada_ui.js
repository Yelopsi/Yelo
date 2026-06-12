/**
 * Arquivo: admin_caixa_entrada_ui.js
 * Responsabilidade: Isolar a renderização de DOM, SVGs e componentes visuais do chat do admin.
 */
window.AdminChatUI = (function() {
    function getStatusIcon(status) {
        const sentIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#888" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle;" title="Enviado"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
        const deliveredIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#888" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle;" title="Entregue"><path d="M18 6L7 17l-5-5"></path><path d="M22 10l-7.5 7.5L13 16"></path></svg>`;
        const readIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#34B7F1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle;" title="Lido"><path d="M18 6L7 17l-5-5"></path><path d="M22 10l-7.5 7.5L13 16"></path></svg>`;

        const s = status ? status.toLowerCase() : 'sent';
        if (s === 'read') return readIcon;
        if (s === 'delivered') return deliveredIcon;
        return sentIcon;
    }

    function getDateLabel(dateString) {
        const date = new Date(dateString);
        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(today.getDate() - 1);

        if (date.toDateString() === today.toDateString()) return 'Hoje';
        if (date.toDateString() === yesterday.toDateString()) return 'Ontem';
        return date.toLocaleDateString('pt-BR');
    }

    function createConversationElement(convo, psy, isActive, isArchived) {
        const li = document.createElement('li');
        li.className = 'conversation-item';
        if (isActive) li.classList.add('active');
        li.dataset.conversationId = convo.id;
        li.dataset.psychologistId = psy.id;

        const lastMessageTime = convo.lastMessage ? new Date(convo.lastMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
        const lastMsgContent = convo.lastMessage ? convo.lastMessage.content : 'Nenhuma mensagem ainda...';
        const unreadCount = convo.unreadCount || 0;
        
        const iconArchive = `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M20.54 5.23l-1.39-1.68C18.88 3.21 18.47 3 18 3H6c-.47 0-.88.21-1.16.55L3.46 5.23C3.17 5.57 3 6.02 3 6.5V19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6.5c0-.48-.17-.93-.46-1.27zM12 17.5L6.5 12H10v-2h4v2h3.5L12 17.5zM5.12 5l.81-1h12l.94 1H5.12z"/></svg>`;
        const iconUnarchive = `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M20.54 5.23l-1.39-1.68C18.88 3.21 18.47 3 18 3H6c-.47 0-.88.21-1.16.55L3.46 5.23C3.17 5.57 3 6.02 3 6.5V19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6.5c0-.48-.17-.93-.46-1.27zM6.24 5h11.52l.83 1H5.42l.82-1zM5 19V8h14v11H5zm11-5.5l-4-4-4 4 1.41 1.41L11 13.33V17h2v-3.67l1.59 1.59L16 13.5z"/></svg>`;
        const iconDelete = `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>`;

        const archiveBtnTitle = isArchived ? "Desarquivar" : "Arquivar";
        const archiveIcon = isArchived ? iconUnarchive : iconArchive;

        li.innerHTML = `
            <img src="${psy.fotoUrl || 'https://placehold.co/48x48'}" onerror="this.onerror=null;this.src='https://placehold.co/48x48';" alt="Avatar" class="avatar">
            <div class="conversation-details">
                <div class="details-header">
                    <span class="contact-name">${psy.nome}</span>
                    <span class="timestamp">${lastMessageTime}</span>
                </div>
                <div class="last-message-line">
                    <p class="last-message">${lastMsgContent}</p>
                    <span class="unread-badge ${unreadCount > 0 ? '' : 'hidden'}">${unreadCount}</span>
                </div>
            </div>
            <div class="conversation-actions">
                <button class="btn-action btn-archive" title="${archiveBtnTitle}">${archiveIcon}</button>
                <button class="btn-action btn-delete delete" title="Excluir">${iconDelete}</button>
            </div>
        `;
        return li;
    }

    function createDateSeparatorElement(dateString) {
        const div = document.createElement('div');
        div.className = 'date-separator';
        div.style.cssText = "text-align: center; margin: 15px 0; font-size: 0.75rem; color: #888; display: flex; justify-content: center;";
        div.innerHTML = `<span style="background: rgba(0,0,0,0.05); padding: 4px 12px; border-radius: 12px;">${getDateLabel(dateString)}</span>`;
        return div;
    }

    function createMessageBubbleElement(msg, isSentByAdmin) {
        const div = document.createElement('div');
        if (msg.id) div.dataset.messageId = msg.id;
        div.dataset.date = new Date(msg.createdAt).toDateString();
        div.className = `message-bubble ${isSentByAdmin ? 'sent' : 'received'}`;
        
        const time = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const statusIcon = (isSentByAdmin === true) ? getStatusIcon(msg.status || 'sent') : '';

        div.innerHTML = `
            <p>${msg.content}</p>
            <div class="message-meta">
                <span>${time}</span>
                <span class="message-status">${statusIcon}</span>
            </div>
        `;
        return div;
    }

    return {
        getStatusIcon,
        getDateLabel,
        createConversationElement,
        createDateSeparatorElement,
        createMessageBubbleElement
    };
})();