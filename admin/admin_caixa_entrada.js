// admin_caixa_entrada.js (Versão Adaptada para Suporte Yelo)

window.initializePage = function() {
    console.log("Admin Chat Simplificado Iniciado");

    const token = localStorage.getItem('Yelo_token');
    if (!token) { window.location.href = 'login.html'; return; }

    // --- 1. CAPTURA DE ELEMENTOS (Conforme seu HTML) ---
    const listContainer = document.getElementById('conversation-list');
    const messagesContainer = document.getElementById('messages-thread');
    const welcomeScreen = document.getElementById('chat-welcome-screen');
    const activeChatScreen = document.getElementById('active-chat-screen');
    
    // Elementos do Chat Ativo
    const activeChatName = document.getElementById('active-chat-name');
    const activeChatAvatar = document.getElementById('active-chat-avatar');
    const activeChatStatus = document.getElementById('active-chat-status');

    // Elementos de Envio
    const messageInput = document.getElementById('rich-text-input'); // Div editável
    const sendButton = document.getElementById('send-btn');

    const btnNewChat = document.getElementById('btn-new-chat');
    let allConversations = []; // Para armazenar a lista e filtrar localmente
    let currentPsiId = null;
    
    // --- 1. CARREGAR LISTA (Alteração: Adicionado API_BASE_URL) ---
    async function loadConversations() {
        try {
            listContainer.innerHTML = '<p style="padding:20px; text-align:center; color:#999;">Carregando...</p>';
            const response = await fetch(`${API_BASE_URL}/api/admin/support/conversations`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) throw new Error('Erro ao buscar lista');

            const data = await response.json();

            allConversations = data; // Salva na memória
            renderConversationList(allConversations);

        } catch (error) {
            console.error(error);
            listContainer.innerHTML = '<p style="padding:20px; text-align:center; color:red;">Erro ao carregar lista.</p>';
        }
    }

    function renderConversationList(psis) {
        listContainer.innerHTML = '';

        if (psis.length === 0) {
            listContainer.innerHTML = '<p style="padding:20px; text-align:center; color:#666;">Nenhum chamado aberto.</p>';
            return;
        }

        psis.forEach(psi => {
            // Cria o elemento visual usando suas classes CSS originais
            const item = document.createElement('div');
            item.className = 'conversation-item';
            // Se este for o chat aberto, marca como ativo
            if (currentPsiId === psi.id) item.classList.add('active');

            item.innerHTML = `
                <img src="${psi.fotoUrl || '../assets/images/placeholder-user.png'}" alt="Avatar" class="avatar">
                <div class="conversation-details">
                    <div class="details-header">
                        <span class="contact-name">${psi.nome}</span>
                        <span class="timestamp">Ticket Aberto</span>
                    </div>
                    <div class="details-body">
                        <p class="last-message" style="color:#1B4332;">Clique para atender</p>
                    </div>
                </div>
            `;

            // Ao clicar, abre o chat
            item.onclick = () => openChat(psi);
            listContainer.appendChild(item);
        });
    }

    // --- 2. ABRIR CHAT ESPECÍFICO ---
    async function openChat(psi) {
        currentPsiId = psi.id;
        
        // Atualiza UI Lateral (Marca ativo)
        document.querySelectorAll('.conversation-item').forEach(i => i.classList.remove('active'));
        // (Re-renderizar a lista seria ideal para atualizar a classe active, mas vamos simplificar)
        
        // Troca a tela (Esconde boas-vindas, mostra chat)
        welcomeScreen.style.display = 'none';
        activeChatScreen.style.display = 'flex';

        // Preenche Header
        activeChatName.textContent = psi.nome;
        activeChatAvatar.src = psi.fotoUrl || '../assets/images/placeholder-user.png';
        activeChatStatus.textContent = psi.email; // Mostra email no status para facilitar

        // Carrega Mensagens
        await loadMessages(psi.id);
    }

    // --- 2. CARREGAR MENSAGENS (Versão Diagnóstico) ---
    async function loadMessages(psiId) {
        // Pega o container onde as mensagens devem aparecer
        const messagesContainer = document.getElementById('messages-thread'); 
        
        // Se não achar o container pelo ID novo, tenta o antigo para garantir compatibilidade
        const container = messagesContainer || document.getElementById('messages-container');

        if (!container) {
            console.error("ERRO: Container de mensagens não encontrado no HTML!");
            return;
        }

        container.innerHTML = '<div style="text-align:center; padding:20px; color:#999;">Carregando...</div>';

        try {
            console.log("Buscando mensagens para ID:", psiId);
            
            // Rota exata que configuramos no adminSupportRoutes.js
            const res = await fetch(`${API_BASE_URL}/api/admin/support/messages/${psiId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (!res.ok) throw new Error(`Erro API: ${res.status}`);

            const msgs = await res.json();
            console.log("Mensagens recebidas:", msgs); // Veja isso no Console (F12)

            renderMessages(msgs, container);
        } catch (e) {
            console.error(e);
            container.innerHTML = '<div style="color:red; text-align:center;">Erro ao carregar chat. Veja o console.</div>';
        }
    }

    function renderMessages(msgs, container) {
        container.innerHTML = '';
        
        if (msgs.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding:20px; color:#ccc;">Nenhuma mensagem anterior.</div>';
            return;
        }

        msgs.forEach(msg => {
            const div = document.createElement('div');
            
            // Lógica: Se senderType for 'admin', sou EU (msg-me / verde)
            // Se for 'psychologist', é ELE (msg-other / branco)
            const isMe = msg.senderType === 'admin';
            
            div.className = `message-bubble ${isMe ? 'sent' : 'received'}`;
            
            // Formata hora
            const time = new Date(msg.createdAt).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'});

            div.innerHTML = `
                <p>${msg.content}</p>
                <div class="message-meta">${time}</div>
            `;
            container.appendChild(div);
        });

        // Rola para o final
        container.scrollTop = container.scrollHeight;
    }

    // --- 3. ENVIAR MENSAGEM ---
    sendButton.onclick = sendMessage;
    
    // Suporte a Enter para enviar (sem Shift)
    messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // --- 3. ENVIAR MENSAGEM (Adaptado para DIV editável) ---
    async function sendMessage() {
        // Pega o texto do seu campo especial (div contenteditable)
        const text = messageInput.innerText.trim();
        
        if (!text || !currentChatId) return;

        // Feedback Visual Imediato (Otimista)
        messageInput.innerText = ''; // Limpa o campo
        
        const bubble = document.createElement('div');
        bubble.className = 'message-bubble sent'; // Classe do seu CSS
        bubble.innerHTML = `<p>${text}</p><div class="message-meta">Enviando...</div>`;
        messagesContainer.appendChild(bubble);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        try {
            await fetch(`${API_BASE_URL}/api/admin/reply`, {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    recipientId: currentParticipant.id,
                    recipientType: currentParticipant.type,
                    content: text 
                })
            });
            // Sucesso: O polling vai atualizar o status depois
        } catch (error) {
            console.error(error);
            bubble.style.opacity = 0.5;
            alert('Erro ao enviar mensagem.');
        }
    }

    // --- LÓGICA DE NOVA CONVERSA ---
    if(btnNewChat) {
        btnNewChat.onclick = async () => {
            listContainer.innerHTML = '<p style="padding:20px; text-align:center;">Carregando profissionais...</p>';
            try {
                // Busca TODOS os psicólogos da plataforma
                const res = await fetch(`${API_BASE_URL}/api/admin/psychologists?limit=100`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();
                const psis = data.data || [];

                listContainer.innerHTML = '';
                if(psis.length === 0) listContainer.innerHTML = '<p>Nenhum profissional.</p>';
                
                // Renderiza lista para selecionar
                psis.forEach(psi => {
                    const item = document.createElement('div');
                    item.className = 'conversation-item';
                    item.innerHTML = `
                        <img src="${psi.fotoUrl || '../assets/images/placeholder-user.png'}" class="avatar">
                        <div class="conversation-details">
                            <div class="details-header"><span class="contact-name">${psi.nome}</span></div>
                            <div class="details-body"><p class="last-message" style="color:#1B4332;">Iniciar atendimento</p></div>
                        </div>
                    `;
                    item.onclick = () => openChat(psi); 
                    listContainer.appendChild(item);
                });
            } catch(e) { console.error(e); }
        };
    }

    // --- LÓGICA DE FILTROS ---
    document.querySelectorAll('.filter-tab').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const filter = btn.getAttribute('data-filter');
            
            if (filter === 'all') renderConversationList(allConversations);
            // Exemplo simples: 'unread' filtra quem tem ID par (adapte conforme sua lógica real)
            else if (filter === 'unread') renderConversationList(allConversations.filter((c, i) => i % 2 === 0)); 
            else if (filter === 'waiting') renderConversationList(allConversations); 
        };
    });

};