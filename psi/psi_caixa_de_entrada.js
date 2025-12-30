// c:/Users/Anderson/Desktop/Yelo/psi/psi_caixa_de_entrada.js

// Garante que o código só rode depois que a página do dashboard carregar
function inicializarCaixaEntrada(preFetchedData = null) {
    // --- FIX: ID único para esta instância do componente ---
    // Usado para impedir que callbacks antigos rodem se o usuário trocar de página rápido
    const componentId = Date.now();
    window.activePsiChatId = componentId;
    
    const API_BASE_URL = (typeof window.API_BASE_URL !== 'undefined') ? window.API_BASE_URL : 'http://localhost:3001';
    const token = localStorage.getItem('Yelo_token');

    // Elementos da UI
    const conversationList = document.getElementById('conversation-list');
    const messagesThread = document.getElementById('messages-thread');
    const welcomeScreen = document.getElementById('chat-welcome-screen');
    const activeChatScreen = document.getElementById('active-chat-screen');
    const replyInput = document.getElementById('psi-reply-input');
    const sendBtn = document.getElementById('send-reply-btn');
    const btnVoltarMobile = document.getElementById('btn-voltar-mobile');

    if (!messagesThread || !replyInput || !sendBtn || !token) {
        console.error("Elementos essenciais do chat ou token não encontrados.");
        return;
    }

    let adminConversationId = null;

    // --- FUNÇÃO CRÍTICA: Sincroniza Status (Corrige o bug de 1 risco) ---
    function syncMessagesStatus() {
        // Só executa se o socket estiver conectado e ativo
        if (!window.psiChatSocket || !window.psiChatSocket.connected) {
            // Tenta novamente em 500ms se o socket ainda estiver conectando
            setTimeout(syncMessagesStatus, 500);
            return;
        }
        
        if (!adminConversationId) return;

        // --- FIX: Só marca como lido se o chat estiver ABERTO e VISÍVEL ---
        // Verifica se o elemento tem tamanho (offsetParent) e se o estilo computado não é none
        const isChatOpen = activeChatScreen && activeChatScreen.offsetParent !== null && window.getComputedStyle(activeChatScreen).display !== 'none';
        const isWindowVisible = document.visibilityState === 'visible';
        if (!isChatOpen || !isWindowVisible) return;

        // 1. Marca a conversa como lida no banco
        if (adminConversationId) {
            window.psiChatSocket.emit('messages_read', { conversationId: adminConversationId });
        }

        // 2. Avisa o Admin que as mensagens na tela foram ENTREGUES
        // Isso força a atualização dos "dois riscos" nas mensagens antigas
        const receivedMessages = document.querySelectorAll('.message-bubble.received[data-message-id]');
        receivedMessages.forEach(el => {
            const msgId = el.dataset.messageId;
            if (msgId) {
                window.psiChatSocket.emit('message_delivered', { messageId: msgId });
            }
        });
    }

    // --- CARREGAMENTO DO SOCKET ---
    function loadSocketScript(callback) {
        if (window.activePsiChatId !== componentId) return;
        if (typeof io !== 'undefined') {
            callback();
            return;
        }
        const script = document.createElement('script');
        script.src = `${API_BASE_URL}/socket.io/socket.io.js`;
        script.onload = () => {
            if (window.activePsiChatId === componentId) callback();
        };
        script.onerror = () => console.error("Falha ao carregar Socket.IO.");
        document.body.appendChild(script);
    }

    // --- CONEXÃO DO SOCKET (Corrige o bug do "Socket Zumbi") ---
    function connectSocket() {
        if (window.activePsiChatId !== componentId) return;
        if (typeof io === 'undefined') return;

        // SE JÁ EXISTIR UM SOCKET ABERTO, MATA ELE ANTES DE CRIAR OUTRO
        if (window.psiChatSocket) {
            console.log("Fechando socket anterior...");
            window.psiChatSocket.disconnect();
            window.psiChatSocket = null;
        }

        // Cria nova conexão e salva no window para acesso global
        window.psiChatSocket = io(API_BASE_URL, {
            auth: { token: token },
            transports: ['websocket', 'polling']
        });

        window.psiChatSocket.on('connect', () => {
            console.log('Chat PSI Conectado:', window.psiChatSocket.id);
            // Tenta sincronizar assim que conecta (caso as mensagens já tenham carregado)
            syncMessagesStatus();
        });

        window.psiChatSocket.on('receiveMessage', (msg) => {
            // Segurança: Se o usuário já saiu da página, ignora (embora o cleanup deva ter desconectado)
            if (window.activePsiChatId !== componentId) {
                // AUTODESTRUICAO: Se este listener rodou mas o componente mudou, mata o socket
                if (window.psiChatSocket) window.psiChatSocket.disconnect();
                return;
            }

            // Deduplicação
            if (document.querySelector(`.message-bubble[data-message-id='${msg.id}']`)) return;

            if (msg.senderType && msg.senderType.toLowerCase() === 'admin') {
                appendMessageToView(msg, true);
                
                // --- FIX: Só confirma leitura se o usuário estiver OLHANDO para o chat ---
                const isChatOpen = activeChatScreen && activeChatScreen.offsetParent !== null && window.getComputedStyle(activeChatScreen).display !== 'none';
                const isWindowVisible = document.visibilityState === 'visible';

                if (isChatOpen && isWindowVisible) {
                    // Confirma recebimento e leitura
                    window.psiChatSocket.emit('message_delivered', { messageId: msg.id });
                    if (adminConversationId) {
                        window.psiChatSocket.emit('messages_read', { conversationId: adminConversationId });
                    }
                }
            }
        });

        window.psiChatSocket.on('message_status_updated', (data) => {
            if (window.activePsiChatId !== componentId) return;
            // Atualiza ícones das minhas mensagens (enviadas)
            const bubble = document.querySelector(`.message-bubble.sent[data-message-id='${data.messageId}']`);
            if (bubble) {
                const statusEl = bubble.querySelector('.message-status');
                if (statusEl) statusEl.innerHTML = getStatusIcon(data.status);
            }
        });
    }

    // --- FUNÇÃO DE LIMPEZA (Chamada pelo Dashboard ao sair) ---
    // Garante que o socket morra quando você clica em outro menu
    if (window.cleanupPsiChat) window.cleanupPsiChat(); // Limpa anterior se houver

    window.cleanupPsiChat = () => {
        console.log('[CLEANUP] Desmontando chat PSI...');
        window.activePsiChatId = null; // Invalida este componente
        
        if (window.psiChatSocket) {
            window.psiChatSocket.removeAllListeners(); // Remove ouvintes para evitar memória presa
            console.log(`[CLEANUP] Desconectando socket ID: ${window.psiChatSocket.id}`);
            window.psiChatSocket.disconnect();
            window.psiChatSocket = null;
        }
        
        document.removeEventListener('keydown', handleEscKey);
    };

    // --- CARREGAMENTO DE MENSAGENS ---
    async function loadAdminConversation() {
        try {
            let messages;
            if (preFetchedData) {
                messages = await preFetchedData;
            } else {
                const res = await fetch(`${API_BASE_URL}/api/messages?contactType=admin`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) messages = await res.json();
            }

            if (messages && messages.length > 0) {
                adminConversationId = messages[0].conversationId;
                
                // Filtro de limpeza local
                const clearedTime = localStorage.getItem(`cleared_chat_${adminConversationId}`);
                if (clearedTime) {
                    const clearDate = new Date(clearedTime);
                    messages = messages.filter(m => new Date(m.createdAt) > clearDate);
                }

                renderConversationList();
                renderMessages(messages);
                
                // Tenta sincronizar após renderizar
                syncMessagesStatus();
            } else {
                renderConversationList();
            }
        } catch (e) {
            console.error(e);
            messagesThread.innerHTML = `<p style="color:red; text-align:center; padding: 20px;">Erro ao carregar chat.</p>`;
        }
    }

    // --- HELPERS VISUAIS ---
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

    function renderConversationList() {
        if (!conversationList) return;
        conversationList.innerHTML = `
            <li class="conversation-item active" id="btn-open-support-chat">
                <img src="/assets/logos/logo-escura.png" alt="Avatar" class="avatar" style="background:#f0f0f0; padding:5px; object-fit: contain;">
                <div class="conversation-details">
                    <div class="details-header">
                        <span class="contact-name">Suporte Yelo</span>
                        <span class="timestamp">Agora</span>
                    </div>
                    <p class="last-message">Canal de suporte direto</p>
                </div>
            </li>
        `;
    }

    function renderMessages(messages) {
        messagesThread.innerHTML = '';
        let lastDate = null;
        messages.forEach(msg => {
            const msgDate = new Date(msg.createdAt).toDateString();
            if (msgDate !== lastDate) {
                appendDateSeparator(msg.createdAt);
                lastDate = msgDate;
            }
            appendMessageToView(msg, false);
        });
        messagesThread.scrollTop = messagesThread.scrollHeight;
    }

    function appendDateSeparator(dateString) {
        const div = document.createElement('div');
        div.style.cssText = "text-align: center; margin: 15px 0; font-size: 0.75rem; color: #888; display: flex; justify-content: center;";
        div.innerHTML = `<span style="background: rgba(0,0,0,0.05); padding: 4px 12px; border-radius: 12px;">${getDateLabel(dateString)}</span>`;
        messagesThread.appendChild(div);
    }

    function appendMessageToView(msg, scrollToBottom = true) {
        if (scrollToBottom && messagesThread.lastElementChild) {
            const lastMsgDate = messagesThread.lastElementChild.dataset.date;
            const currentMsgDate = new Date(msg.createdAt).toDateString();
            if (lastMsgDate && lastMsgDate !== currentMsgDate) {
                appendDateSeparator(msg.createdAt);
            }
        }

        const div = document.createElement('div');
        if (msg.id) div.dataset.messageId = msg.id;
        div.dataset.date = new Date(msg.createdAt).toDateString();
        
        const isSentByMe = (msg.senderType && msg.senderType.toLowerCase() === 'psychologist');
        div.className = `message-bubble ${isSentByMe ? 'sent' : 'received'}`;
        
        const time = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const statusIcon = (isSentByMe === true) ? getStatusIcon(msg.status || 'sent') : '';

        div.innerHTML = `
            <p>${msg.content}</p>
            <div class="message-meta">
                <span>${time}</span>
                <span class="message-status">${statusIcon}</span>
            </div>
        `;
        messagesThread.appendChild(div);
        if (scrollToBottom) {
            messagesThread.scrollTop = messagesThread.scrollHeight;
        }
        return div;
    }

    async function sendReply() {
        const content = replyInput.value.trim();
        if (!content) return;

        const tempMessage = {
            content: content,
            senderType: 'psychologist',
            createdAt: new Date().toISOString(),
            status: 'sent'
        };
        const tempBubble = appendMessageToView(tempMessage);
        replyInput.value = '';

        try {
            const response = await fetch(`${API_BASE_URL}/api/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ recipientType: 'admin', content })
            });

            if (!response.ok) throw new Error('Falha ao enviar');

            const savedMessage = await response.json();
            if (tempBubble) {
                tempBubble.dataset.messageId = savedMessage.id;
                const statusContainer = tempBubble.querySelector('.message-status');
                if (statusContainer) statusContainer.innerHTML = getStatusIcon(savedMessage.status || 'sent');
            }
        } catch (error) {
            console.error(error);
            alert('Erro ao enviar mensagem.');
            if(tempBubble) tempBubble.remove();
        }
    }

    // --- EVENTOS ---
    const handleEscKey = (e) => {
        if (e.key === 'Escape') {
            if (activeChatScreen && activeChatScreen.style.display !== 'none') {
                activeChatScreen.style.display = 'none';
                if (welcomeScreen) welcomeScreen.style.display = 'flex';
            }
        }
    };
    document.addEventListener('keydown', handleEscKey);

    // --- FIX: Sincroniza leitura ao voltar para a aba ---
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            syncMessagesStatus();
        }
    });

    if (btnVoltarMobile) {
        btnVoltarMobile.addEventListener('click', () => {
            if (typeof loadPage === 'function') loadPage('psi_visao_geral.html');
            else window.location.reload();
        });
    }

    if (conversationList) {
        conversationList.addEventListener('click', (e) => {
            const item = e.target.closest('.conversation-item');
            if (item && item.id === 'btn-open-support-chat') {
                if (welcomeScreen) welcomeScreen.style.display = 'none';
                if (activeChatScreen) activeChatScreen.style.display = 'flex';
                
                const chatViewPanel = document.querySelector('.chat-view-panel');
                if (chatViewPanel) chatViewPanel.classList.add('mobile-open');
                document.body.classList.add('chat-mobile-open');

                if (messagesThread) setTimeout(() => { messagesThread.scrollTop = messagesThread.scrollHeight; }, 50);
                
                // Marca como lido ao clicar
                syncMessagesStatus();
            }
        });
    }

    replyInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendReply();
        }
    });

    replyInput.addEventListener('blur', () => {
        setTimeout(() => { window.scrollTo(0, 0); }, 100);
    });

    sendBtn.addEventListener('click', sendReply);

    // --- INICIALIZAÇÃO ---
    loadAdminConversation();
    loadSocketScript(() => connectSocket());
}

// Expõe globalmente
window.inicializarCaixaEntrada = inicializarCaixaEntrada;

// Funções do Menu (Globais)
window.toggleChatMenu = function(event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    const menu = document.getElementById('chat-options-menu');
    if (menu) menu.style.display = (menu.style.display === 'block') ? 'none' : 'block';
};

if (!window.hasChatMenuListener) {
    document.addEventListener('click', function(e) {
        const menu = document.getElementById('chat-options-menu');
        const btn = document.getElementById('btn-chat-options');
        if (menu && menu.style.display === 'block') {
            if (!menu.contains(e.target) && (!btn || !btn.contains(e.target))) {
                menu.style.display = 'none';
            }
        }
        if (e.target.closest('#btn-opt-search')) window.acaoProcurar();
        if (e.target.closest('#btn-opt-clear')) window.acaoLimpar();
    });
    window.hasChatMenuListener = true;
}

window.acaoProcurar = function() {
    const menu = document.getElementById('chat-options-menu');
    if (menu) menu.style.display = 'none';
    const searchBar = document.getElementById('chat-search-bar');
    const input = document.getElementById('chat-search-input');
    if (searchBar) {
        searchBar.style.display = 'flex';
        if (input) setTimeout(() => input.focus(), 100);
    }
};

window.acaoLimpar = function() {
    const menu = document.getElementById('chat-options-menu');
    if (menu) menu.style.display = 'none';
    if (confirm('Deseja limpar o histórico visual?')) {
        const thread = document.getElementById('messages-thread');
        if (thread) thread.innerHTML = '<div style="padding:20px; text-align:center; color:#999; margin-top:20px;"><i>Histórico limpo.</i></div>';
    }
};
