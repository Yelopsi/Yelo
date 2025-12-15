document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('girassol_token');
    if (!token) {
        window.location.href = '/login.html';
        return;
    }

    // Elementos da UI
    const conversationsListEl = document.getElementById('conversations-list');
    const chatWelcomeEl = document.getElementById('chat-welcome');
    const chatAreaEl = document.getElementById('chat-area');
    const chatContactNameEl = document.getElementById('chat-contact-name');
    const chatContactRoleEl = document.getElementById('chat-contact-role');
    const chatMessagesEl = document.getElementById('chat-messages');
    const messageForm = document.getElementById('message-form');
    const messageInput = document.getElementById('message-input');
    const searchInput = document.getElementById('search-conversations');

    let allMessages = [];
    let conversations = {};
    let currentContact = null;
    let adminId = null;

    // Função para buscar o ID do admin logado
    const fetchAdminId = async () => {
        try {
            const response = await fetch('/api/admin/me', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Falha ao buscar dados do admin');
            const adminData = await response.json();
            adminId = adminData.id;
        } catch (error) {
            console.error(error);
            // Tratar erro, talvez deslogar
        }
    };

    // Função para processar mensagens e agrupar em conversas
    const processMessagesIntoConversations = (messages) => {
        conversations = {}; // Limpa conversas existentes
        messages.forEach(msg => {
            // Determina quem é o "outro" na conversa
            const isSentByAdmin = msg.senderId === adminId && msg.senderType === 'psychologist';
            const otherUser = isSentByAdmin ? 
                (msg.recipientPatient || msg.recipientPsychologist) : 
                (msg.senderPatient || msg.senderPsychologist);
            
            const otherUserType = isSentByAdmin ? msg.recipientType : msg.senderType;

            if (!otherUser) return; // Ignora mensagens sem um "outro" claro

            const conversationId = `${otherUserType}-${otherUser.id}`;

            if (!conversations[conversationId]) {
                conversations[conversationId] = {
                    contact: {
                        id: otherUser.id,
                        name: otherUser.nome,
                        type: otherUserType,
                        // Adicionar avatar futuramente
                        avatar: '../assets/images/placeholder-user.png'
                    },
                    messages: []
                };
            }
            conversations[conversationId].messages.push(msg);
        });

        // Ordena as mensagens dentro de cada conversa
        for (const id in conversations) {
            conversations[id].messages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        }
    };

    // Função para renderizar a lista de conversas na sidebar
    const renderConversationsList = (filter = '') => {
        conversationsListEl.innerHTML = '';
        const filteredConversationIds = Object.keys(conversations).filter(id => 
            conversations[id].contact.name.toLowerCase().includes(filter.toLowerCase())
        );

        if (filteredConversationIds.length === 0) {
            conversationsListEl.innerHTML = `<div class="empty-chat-list"><p>Nenhuma conversa encontrada.</p></div>`;
            return;
        }

        // Ordena as conversas pela mensagem mais recente
        filteredConversationIds.sort((a, b) => {
            const lastMsgA = conversations[a].messages.slice(-1)[0];
            const lastMsgB = conversations[b].messages.slice(-1)[0];
            return new Date(lastMsgB.createdAt) - new Date(lastMsgA.createdAt);
        });

        filteredConversationIds.forEach(id => {
            const convo = conversations[id];
            const lastMessage = convo.messages.slice(-1)[0];
            const item = document.createElement('div');
            item.className = 'conversation-item';
            item.dataset.conversationId = id;
            item.innerHTML = `
                <img src="${convo.contact.avatar}" alt="Avatar">
                <div class="conversation-details">
                    <div class="name">${convo.contact.name}</div>
                    <div class="last-message">${lastMessage ? lastMessage.content : 'Nenhuma mensagem'}</div>
                </div>
            `;
            item.addEventListener('click', () => selectConversation(id));
            conversationsListEl.appendChild(item);
        });
    };

    // Função para selecionar uma conversa e mostrar as mensagens
    const selectConversation = (id) => {
        const convo = conversations[id];
        if (!convo) return;

        currentContact = convo.contact;

        // Atualiza a UI
        chatWelcomeEl.classList.add('hidden');
        chatAreaEl.classList.remove('hidden');

        // Marca o item ativo na lista
        document.querySelectorAll('.conversation-item').forEach(el => el.classList.remove('active'));
        document.querySelector(`[data-conversation-id="${id}"]`).classList.add('active');

        // Atualiza o header do chat
        chatContactNameEl.textContent = currentContact.name;
        chatContactRoleEl.textContent = currentContact.type === 'patient' ? 'Paciente' : 'Psicólogo(a)';

        // Renderiza as mensagens
        chatMessagesEl.innerHTML = '';
        convo.messages.forEach(msg => {
            renderMessage(msg);
        });
        chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight; // Rola para a última mensagem
    };

    // Função para renderizar uma única mensagem na tela
    const renderMessage = (msg) => {
        const bubble = document.createElement('div');
        bubble.className = 'message-bubble';
        // Admin é sempre 'psychologist' no backend
        const isSentByAdmin = msg.senderId === adminId && msg.senderType === 'psychologist';
        bubble.classList.add(isSentByAdmin ? 'sent' : 'received');
        bubble.textContent = msg.content;
        chatMessagesEl.appendChild(bubble);
    };

    // Função para enviar uma nova mensagem
    const handleSendMessage = async (e) => {
        e.preventDefault();
        const content = messageInput.value.trim();
        if (!content || !currentContact) return;

        const sendButton = messageForm.querySelector('button[type="submit"]');
        sendButton.disabled = true;
        messageInput.disabled = true;

        const payload = {
            recipientId: currentContact.id,
            recipientType: currentContact.type,
            content: content
        };

        try {
            const response = await fetch('/api/admin/reply', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error('Falha ao enviar mensagem');

            const newMessage = await response.json();

            // Adiciona a nova mensagem à conversa localmente
            const conversationId = `${currentContact.type}-${currentContact.id}`;
            conversations[conversationId].messages.push(newMessage);

            // Atualiza a UI
            renderMessage(newMessage);
            chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
            messageInput.value = '';

            // Atualiza a lista de conversas para mostrar a nova última mensagem
            renderConversationsList(searchInput.value);
            // Re-seleciona a conversa ativa
            document.querySelector(`[data-conversation-id="${conversationId}"]`)?.classList.add('active');

        } catch (error) {
            console.error('Erro ao enviar mensagem:', error);
            alert('Não foi possível enviar a mensagem. Tente novamente.');
        } finally {
            // Reabilita o botão e o input, independentemente do resultado
            sendButton.disabled = false;
            messageInput.disabled = false;
        }
    };

    // Função principal de inicialização
    const initializeChat = async () => {
        await fetchAdminId();
        if (!adminId) return;

        try {
            const response = await fetch('/api/admin/messages', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Falha ao buscar mensagens');
            allMessages = await response.json();
            
            processMessagesIntoConversations(allMessages);
            renderConversationsList();

        } catch (error) {
            console.error(error);
            conversationsListEl.innerHTML = `<div class="empty-chat-list"><p>Erro ao carregar conversas.</p></div>`;
        }
    };

    // Event Listeners
    messageForm.addEventListener('submit', handleSendMessage);
    searchInput.addEventListener('input', (e) => renderConversationsList(e.target.value));

    // Inicia o chat
    initializeChat();
});