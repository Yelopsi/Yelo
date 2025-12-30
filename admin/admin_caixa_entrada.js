// c:\Users\Anderson\Desktop\Yelo\admin\admin_caixa_entrada.js

// Garante que o código só rode depois que a página do admin carregar
window.initializePage = function() {

    // Define a URL base da API para evitar erros de rota relativa (ERR_TOO_MANY_REDIRECTS)
    const API_BASE_URL = (typeof window.API_BASE_URL !== 'undefined') ? window.API_BASE_URL : 'http://localhost:3001';

    // Elementos da UI
    const conversationList = document.getElementById('conversation-list');
    const welcomeScreen = document.getElementById('chat-welcome-screen');
    const activeChatScreen = document.getElementById('active-chat-screen');
    const messagesThread = document.getElementById('messages-thread');
    const replyInput = document.getElementById('admin-reply-input');
    const sendBtn = document.getElementById('send-reply-btn');
    const searchInput = document.getElementById('chat-search');
    const filterSelect = document.getElementById('chat-filter'); // Novo Filtro
    const btnNewChat = document.getElementById('btn-new-chat');
    
    // Elementos do Modal de Broadcast
    const broadcastModal = document.getElementById('broadcast-modal');
    const closeBroadcastBtn = document.getElementById('close-broadcast-modal');
    const cancelBroadcastBtn = document.getElementById('btn-cancel-broadcast');
    const sendBroadcastBtn = document.getElementById('btn-send-broadcast');
    const broadcastTarget = document.getElementById('broadcast-target');
    const broadcastMessage = document.getElementById('broadcast-message');

    // CORREÇÃO CRÍTICA: Move o modal para o body para garantir que ele fique sobre tudo (z-index global)
    if (broadcastModal && broadcastModal.parentNode !== document.body) {
        document.body.appendChild(broadcastModal);
    }

    /**
     * Retorna o SVG do ícone de status da mensagem.
     * @param {string} status - 'sent', 'delivered', ou 'read'.
     * @returns {string} HTML do SVG.
     */
    function getStatusIcon(status) {
        // Ícones SVG padronizados e com xmlns (Versão Robusta)
        const sentIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#888" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle;" title="Enviado"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
        const deliveredIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#888" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle;" title="Entregue"><path d="M18 6L7 17l-5-5"></path><path d="M22 10l-7.5 7.5L13 16"></path></svg>`;
        const readIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#34B7F1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle;" title="Lido"><path d="M18 6L7 17l-5-5"></path><path d="M22 10l-7.5 7.5L13 16"></path></svg>`;

        // Normaliza o status para evitar erros de case
        const s = status ? status.toLowerCase() : 'sent';

        if (s === 'read') return readIcon;
        if (s === 'delivered') return deliveredIcon;
        return sentIcon;
    }

    // Helper para formatar a data do divisor
    function getDateLabel(dateString) {
        const date = new Date(dateString);
        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(today.getDate() - 1);

        if (date.toDateString() === today.toDateString()) return 'Hoje';
        if (date.toDateString() === yesterday.toDateString()) return 'Ontem';
        return date.toLocaleDateString('pt-BR');
    }

    // --- BOTÃO NOVA CONVERSA ---
    if (btnNewChat) {
        btnNewChat.addEventListener('click', (e) => {
            e.preventDefault(); // Previne qualquer comportamento padrão

            // Abre o modal de mensagem em massa
            if (broadcastModal) {
                // GARANTIA EXTRA: Se por algum motivo saiu do body, coloca de volta
                if (broadcastModal.parentNode !== document.body) {
                    document.body.appendChild(broadcastModal);
                }
                
                broadcastModal.style.display = 'flex';
                broadcastModal.style.opacity = '1'; // Força opacidade
                broadcastModal.style.visibility = 'visible'; // Força visibilidade
                if(broadcastTarget) broadcastTarget.value = "";
                if(broadcastMessage) broadcastMessage.value = "";
            } else {
                console.error("ERRO: Modal de broadcast não encontrado no DOM.");
            }
        });
    }

    // --- LÓGICA DO MODAL DE BROADCAST ---
    function closeBroadcast() {
        if (broadcastModal) broadcastModal.style.display = 'none';
    }

    if (closeBroadcastBtn) closeBroadcastBtn.addEventListener('click', closeBroadcast);
    if (cancelBroadcastBtn) cancelBroadcastBtn.addEventListener('click', closeBroadcast);

    if (sendBroadcastBtn) {
        sendBroadcastBtn.addEventListener('click', async () => {
            const target = broadcastTarget.value;
            const content = broadcastMessage.value.trim();

            // Validação com Toast em vez de alert
            if (!target) return window.showToast ? window.showToast("⚠️ Selecione um grupo de destinatários.") : alert("Selecione um grupo.");
            if (!content) return window.showToast ? window.showToast("⚠️ Digite uma mensagem para enviar.") : alert("Digite uma mensagem.");

            // Texto amigável do grupo selecionado
            const targetText = broadcastTarget.options[broadcastTarget.selectedIndex].text;

            // CORREÇÃO: Fecha o modal de digitação ANTES de abrir a confirmação
            closeBroadcast();

            // Função de envio encapsulada
            const executeBroadcast = async () => {
                const originalText = sendBroadcastBtn.innerText;
                sendBroadcastBtn.innerText = "Enviando...";
                sendBroadcastBtn.disabled = true;

                try {
                    const token = localStorage.getItem('Yelo_token');
                    const response = await fetch(`${API_BASE_URL}/api/admin/broadcast`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ target, content })
                    });

                    const result = await response.json();

                    if (response.ok) {
                        if (window.showToast) window.showToast("✅ Mensagem em massa enviada com sucesso!");
                        loadConversations(); // Atualiza a lista
                    } else {
                        throw new Error(result.error || 'Erro ao enviar mensagem.');
                    }
                } catch (error) {
                    console.error(error);
                    if (window.showToast) window.showToast("❌ Erro: " + error.message);
                } finally {
                    sendBroadcastBtn.innerText = originalText;
                    sendBroadcastBtn.disabled = false;
                    
                    // Se der erro e precisarmos reabrir o modal, teríamos que tratar aqui,
                    // mas por UX, melhor manter fechado e mostrar o Toast de erro.
                }
            };

            // Usa o modal de confirmação global do admin.js
            if (window.openConfirmationModal) {
                window.openConfirmationModal(
                    "Confirmar Envio em Massa",
                    `Você está prestes a enviar uma mensagem para <strong>${targetText}</strong>.<br><br>Esta ação não pode ser desfeita. Deseja continuar?`,
                    executeBroadcast
                );
            } else {
                // Fallback caso o modal não carregue
                if (confirm(`Enviar para ${targetText}?`)) executeBroadcast();
            }
        });
    }

    let activeConversationId = null;
    let activePsychologistId = null; // Guarda o ID do psicólogo da conversa ativa
    let debounceTimer = null;

    // --- FUNÇÕES PRINCIPAIS ---

    // 1. Carrega a lista de todas as conversas
    async function loadConversations(searchTerm = '', filter = 'all') {
        try {
            // Feedback visual de carregamento na lista
            if (!searchTerm && conversationList.children.length === 0) conversationList.innerHTML = `<li style="padding:20px; text-align:center; color:#999;">Carregando...</li>`;

            // Se o filtro não for passado, pega do select (útil para chamadas sem argumentos)
            const currentFilter = filterSelect ? filterSelect.value : filter;
            const token = localStorage.getItem('Yelo_token');
            
            let conversations = [];

            // LÓGICA DE FILTRO AVANÇADA
            if (currentFilter === 'unread') {
                // Para "Não Lidas", buscamos TUDO (Ativas e Arquivadas) e filtramos no front
                // Isso garante que mostre mensagens não lidas mesmo se estiverem arquivadas
                const [resActive, resArchived] = await Promise.all([
                    fetch(`${API_BASE_URL}/api/admin/messages/conversations?search=${searchTerm}&filter=all`, { headers: { 'Authorization': `Bearer ${token}` } }),
                    fetch(`${API_BASE_URL}/api/admin/messages/conversations?search=${searchTerm}&filter=archived`, { headers: { 'Authorization': `Bearer ${token}` } })
                ]);

                if (resActive.ok && resArchived.ok) {
                    const active = await resActive.json();
                    const archived = await resArchived.json();
                    // Combina, remove duplicatas por ID e filtra apenas com contador > 0
                    const combined = [...active, ...archived];
                    const uniqueMap = new Map(combined.map(c => [c.id, c]));
                    conversations = Array.from(uniqueMap.values()).filter(c => c.unreadCount > 0);
                }
            } else {
                // Comportamento padrão para 'all' (Ativas) e 'archived' (Arquivadas)
                const response = await fetch(`${API_BASE_URL}/api/admin/messages/conversations?search=${searchTerm}&filter=${currentFilter}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!response.ok) throw new Error('Falha ao buscar conversas');
                conversations = await response.json();

                // REFORÇO DE FILTRO NO FRONTEND:
                if (currentFilter === 'all') {
                    conversations = conversations.filter(c => c.status !== 'archived');
                }
            }
            
            renderConversationList(conversations);

        } catch (error) {
            console.error(error);
            // CORREÇÃO: Força a exibição do erro mesmo que tenha o item de "Carregando..."
            conversationList.innerHTML = `<li style="padding:20px; color:red; text-align:center;">Erro: ${error.message}</li>`;
        }
    }

    // 2. Renderiza a lista de conversas na barra lateral
    function renderConversationList(conversations) {
        const currentScroll = conversationList.scrollTop;
        conversationList.innerHTML = '';
        const currentFilter = filterSelect ? filterSelect.value : 'all';

        if (!conversations || conversations.length === 0) {
            conversationList.innerHTML = `<li style="padding:20px; text-align:center; color:#999;">Nenhuma conversa iniciada.</li>`;
            return;
        }

        conversations.forEach(convo => {
            // CORREÇÃO: Aceita Psychologist ou psychologist
            const psy = convo.psychologist || convo.Psychologist;
            if (!psy) return;

            const li = document.createElement('li');
            li.className = 'conversation-item';
            li.dataset.conversationId = convo.id;
            li.dataset.psychologistId = psy.id;

            if (activeConversationId === convo.id || (activePsychologistId === psy.id && String(activeConversationId).startsWith('new-'))) {
                li.classList.add('active');
            }

            const lastMessageTime = convo.lastMessage ? new Date(convo.lastMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
            const lastMsgContent = convo.lastMessage ? convo.lastMessage.content : 'Nenhuma mensagem ainda...';
            const unreadCount = convo.unreadCount || 0;
            
            // Ícones SVG simples para as ações
            const iconArchive = `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M20.54 5.23l-1.39-1.68C18.88 3.21 18.47 3 18 3H6c-.47 0-.88.21-1.16.55L3.46 5.23C3.17 5.57 3 6.02 3 6.5V19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6.5c0-.48-.17-.93-.46-1.27zM12 17.5L6.5 12H10v-2h4v2h3.5L12 17.5zM5.12 5l.81-1h12l.94 1H5.12z"/></svg>`;
            const iconUnarchive = `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M20.54 5.23l-1.39-1.68C18.88 3.21 18.47 3 18 3H6c-.47 0-.88.21-1.16.55L3.46 5.23C3.17 5.57 3 6.02 3 6.5V19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6.5c0-.48-.17-.93-.46-1.27zM6.24 5h11.52l.83 1H5.42l.82-1zM5 19V8h14v11H5zm11-5.5l-4-4-4 4 1.41 1.41L11 13.33V17h2v-3.67l1.59 1.59L16 13.5z"/></svg>`;
            const iconDelete = `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>`;

            // Define qual ícone mostrar (Arquivar ou Desarquivar)
            // Verifica o status real da conversa OU o filtro atual
            const isArchived = convo.status === 'archived' || currentFilter === 'archived';
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

            // Event Listeners para os botões (com stopPropagation para não abrir o chat)
            const btnArchive = li.querySelector('.btn-archive');
            const btnDelete = li.querySelector('.btn-delete');

            if (btnArchive) {
                btnArchive.addEventListener('click', (e) => {
                    e.stopPropagation();
                    toggleArchiveConversation(convo.id, isArchived);
                });
            }

            if (btnDelete) {
                btnDelete.addEventListener('click', (e) => {
                    e.stopPropagation();
                    deleteConversation(convo.id);
                });
            }

            li.addEventListener('click', () => selectConversation(convo));
            conversationList.appendChild(li);
        });
        conversationList.scrollTop = currentScroll;
    }

    // --- AÇÕES DE CONVERSA ---

    function toggleArchiveConversation(conversationId, isCurrentlyArchived) {
        const actionText = isCurrentlyArchived ? 'desarquivar' : 'arquivar';
        const title = isCurrentlyArchived ? 'Desarquivar Conversa' : 'Arquivar Conversa';
        const message = `Tem certeza que deseja <strong>${actionText}</strong> esta conversa?`;

        if (window.openConfirmationModal) {
            window.openConfirmationModal(title, message, () => {
                executeArchiveToggle(conversationId, isCurrentlyArchived);
            });
        } else {
            // Fallback caso o modal não carregue
            if (confirm(message.replace(/<[^>]*>/g, ''))) {
                executeArchiveToggle(conversationId, isCurrentlyArchived);
            }
        }
    }

    async function executeArchiveToggle(conversationId, isCurrentlyArchived) {
        const newStatus = isCurrentlyArchived ? 'active' : 'archived';
        const url = `${API_BASE_URL}/api/admin/messages/conversation/${conversationId}/status`;
    
        try {
            const token = localStorage.getItem('Yelo_token');
            const response = await fetch(url, {
                method: 'PUT',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ status: newStatus })
            });
    
            if (response.ok) {
                if (window.showToast) window.showToast(`Conversa ${isCurrentlyArchived ? 'desarquivada' : 'arquivada'}!`);
                // CORREÇÃO: Força o recarregamento com o filtro atual para a UI refletir a mudança
                loadConversations(searchInput.value, filterSelect.value); 
                
                // Se a conversa arquivada era a que estava ativa, fecha ela
                if (activeConversationId == conversationId && !isCurrentlyArchived) {
                    welcomeScreen.style.display = 'flex';
                    activeChatScreen.style.display = 'none';
                    activeConversationId = null;
                    activePsychologistId = null;
                }
            } else {
                const err = await response.json().catch(() => ({ error: 'Erro desconhecido.' }));
                throw new Error(err.error || 'Erro ao atualizar status da conversa.');
            }
        } catch (error) {
            console.error(error);
            if (window.showToast) window.showToast(error.message, 'error');
        }
    }

    function deleteConversation(conversationId) {
        const title = 'Excluir Conversa';
        const message = 'Tem certeza? Esta ação apagará todo o histórico e <strong>não pode ser desfeita</strong>.';

        if (window.openConfirmationModal) {
            window.openConfirmationModal(title, message, () => {
                executeDelete(conversationId);
            });
        } else {
            if (confirm(message.replace(/<[^>]*>/g, ''))) {
                executeDelete(conversationId);
            }
        }
    }

    async function executeDelete(conversationId) {
        // --- DEBUG: Verificar URL gerada ---
        const url = `${API_BASE_URL}/api/admin/messages/conversation/${conversationId}`;

        try {
            const token = localStorage.getItem('Yelo_token');
            const response = await fetch(url, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                if (window.showToast) window.showToast("Conversa excluída.");
                loadConversations(searchInput.value);
                if (activeConversationId === conversationId) {
                    welcomeScreen.style.display = 'flex';
                    activeChatScreen.style.display = 'none';
                    activeConversationId = null;
                }
            } else {
                if (window.showToast) window.showToast('Erro ao excluir conversa.', 'error');
            }
        } catch (error) {
            console.error(error);
        }
    }

    // 3. Seleciona uma conversa e carrega as mensagens
    function selectConversation(conversationData) {
        // Garante o objeto psy correto
        const psy = conversationData.psychologist || conversationData.Psychologist;
        
        activeConversationId = conversationData.id;
        activePsychologistId = psy.id;

        // CORREÇÃO CRÍTICA: Limpa a tela anterior para não misturar mensagens ou travar
        messagesThread.innerHTML = '';

        // Atualiza a UI
        welcomeScreen.style.display = 'none';
        activeChatScreen.style.display = 'flex';
        document.querySelectorAll('.conversation-item').forEach(item => item.classList.remove('active'));
        
        const activeItem = document.querySelector(`[data-conversation-id='${conversationData.id}']`);
        if(activeItem) activeItem.classList.add('active');

        if (String(conversationData.id).startsWith('new-')) {
            messagesThread.innerHTML = '<p style="text-align:center; color:#999; padding: 40px;">Inicie a conversa com este psicólogo.</p>';
            replyInput.focus();
        } else {
            loadMessages(conversationData.id);
        }
    }

    // 4. Carrega as mensagens de uma conversa específica
    async function loadMessages(conversationId) {
        if (!conversationId) return;
        try {
            const token = localStorage.getItem('Yelo_token');
            const response = await fetch(`${API_BASE_URL}/api/admin/messages/conversation/${conversationId}`, { 
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Falha ao buscar mensagens');

            const messages = await response.json();
            renderMessages(messages);

            // EMITE EVENTO DE 'LIDO' PARA O SERVIDOR
            if (window.adminSocket) {
                window.adminSocket.emit('messages_read', { conversationId: conversationId });
            }

            // --- CORREÇÃO 2: ATUALIZA O BADGE IMEDIATAMENTE ---
            // Ao carregar as mensagens, o backend já as marcou como lidas.
            // Esta parte esconde o contador da UI sem precisar esperar a próxima atualização da lista.
            const conversationItem = document.querySelector(`.conversation-item[data-conversation-id='${conversationId}']`);
            if (conversationItem) {
                const badge = conversationItem.querySelector('.unread-badge');
                if (badge) {
                    badge.classList.add('hidden');
                    badge.textContent = '0';
                }
            }

        } catch (error) {
            console.error(error);
            messagesThread.innerHTML = `<p style="color:red; text-align:center;">Erro ao carregar mensagens.</p>`;
        }
    }

    // 5. Renderiza as mensagens na tela
    function renderMessages(messages) {
        // CORREÇÃO: Smart Update para evitar piscar e regredir status
        
        // Se vazio (primeira carga), renderiza tudo do zero
        if (messagesThread.children.length === 0) {
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
            return;
        }

        // Se já tem mensagens, fazemos um "Patch" (Atualização cirúrgica)
        const domMessages = {};
        document.querySelectorAll('.message-bubble[data-message-id]').forEach(el => {
            domMessages[el.dataset.messageId] = el;
        });

        messages.forEach(msg => {
            const existingEl = domMessages[msg.id];

            if (existingEl) {
                // ATUALIZAÇÃO: Só mexe no ícone se necessário
                const isSentByAdmin = (msg.senderType && msg.senderType.toLowerCase() === 'admin');
                if (isSentByAdmin) {
                    const statusContainer = existingEl.querySelector('.message-status');
                    if (statusContainer) {
                        const currentHtml = statusContainer.innerHTML;
                        const newStatus = msg.status || 'sent';
                        
                        // BLINDAGEM: Não permite regredir de 'Lido' para 'Enviado'
                        let shouldUpdate = true;
                        if (currentHtml.includes('title="Lido"') && newStatus !== 'read') shouldUpdate = false;
                        if (currentHtml.includes('title="Entregue"') && newStatus === 'sent') shouldUpdate = false;
                        
                        if (shouldUpdate) {
                            statusContainer.innerHTML = getStatusIcon(newStatus);
                        }
                    }
                }
            } else {
                // NOVA MENSAGEM: Adiciona no final
                const lastBubble = messagesThread.querySelector('.message-bubble:last-of-type');
                const lastDate = lastBubble ? lastBubble.dataset.date : null;
                const msgDate = new Date(msg.createdAt).toDateString();

                if (msgDate !== lastDate) {
                    appendDateSeparator(msg.createdAt);
                }
                appendMessageToView(msg, true);
            }
        });
    }

    // Adiciona o divisor de data na tela
    function appendDateSeparator(dateString) {
        const div = document.createElement('div');
        div.className = 'date-separator';
        div.style.cssText = "text-align: center; margin: 15px 0; font-size: 0.75rem; color: #888; display: flex; justify-content: center;";
        div.innerHTML = `<span style="background: rgba(0,0,0,0.05); padding: 4px 12px; border-radius: 12px;">${getDateLabel(dateString)}</span>`;
        messagesThread.appendChild(div);
    }

    // 5.1 Helper para adicionar mensagem única na tela (Socket/Envio)
    function appendMessageToView(msg, scrollToBottom = true) {
        // Verifica se precisa adicionar separador de data (para mensagens novas em tempo real)
        if (scrollToBottom && messagesThread.lastElementChild) {
            const lastMsgDate = messagesThread.lastElementChild.dataset.date; // Vamos precisar salvar a data no elemento
            const currentMsgDate = new Date(msg.createdAt).toDateString();
            if (lastMsgDate && lastMsgDate !== currentMsgDate) {
                appendDateSeparator(msg.createdAt);
            }
        }

        const div = document.createElement('div');
        if (msg.id) div.dataset.messageId = msg.id; // Adiciona ID para atualização de status
        div.dataset.date = new Date(msg.createdAt).toDateString(); // Salva data para comparação futura
        // CORREÇÃO: Verificação case-insensitive e segura contra null
        const isSentByAdmin = (msg.senderType && msg.senderType.toLowerCase() === 'admin');
        div.className = `message-bubble ${isSentByAdmin ? 'sent' : 'received'}`;
        
        const time = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        // Para mensagens otimistas, o status é 'sent' por padrão
        // CORREÇÃO: Garante ABSOLUTAMENTE que mensagens recebidas não tenham ícone
        const statusIcon = (isSentByAdmin === true) ? getStatusIcon(msg.status || 'sent') : '';

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
        return div; // Retorna o elemento DOM criado
    }

    // 6. Envia uma resposta do admin (VERSÃO CORRIGIDA / BLINDADA)
    async function sendReply() {
        const content = replyInput.value.trim();
        if (!content || !activePsychologistId) return;

        // --- CORREÇÃO 1: ATUALIZAÇÃO OTIMISTA (UI IMEDIATA) ---
        // Cria um objeto de mensagem temporário e o exibe na tela imediatamente.
        const tempMessage = {
            content: content,
            senderType: 'admin',
            createdAt: new Date().toISOString(),
            status: 'sent' // Status inicial otimista
        };
        const tempBubble = appendMessageToView(tempMessage); // Captura o balão criado
        replyInput.value = ''; // Limpa o input na hora.
        // --- FIM DA ATUALIZAÇÃO OTIMISTA ---

        const payload = { content };
        if (String(activeConversationId).startsWith('new-')) {
            payload.psychologistId = activePsychologistId;
        } else {
            payload.conversationId = activeConversationId;
        }

        // Envia a mensagem para o servidor em segundo plano.
        try {
            const token = localStorage.getItem('Yelo_token');
            const response = await fetch(`${API_BASE_URL}/api/admin/messages/reply`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                const savedMessage = await response.json();
                
                // CRÍTICO: Injeta o ID real no balão que já está na tela
                if (tempBubble) {
                    tempBubble.dataset.messageId = savedMessage.id;
                    // Atualiza o ícone para garantir sincronia
                    const statusContainer = tempBubble.querySelector('.message-status');
                    if (statusContainer) statusContainer.innerHTML = getStatusIcon(savedMessage.status || 'sent');
                }

                // --- CORREÇÃO: Força o envio via Socket (Relay) para o Psicólogo ---
                if (window.adminSocket && activePsychologistId) {
                    // Adiciona o ID do alvo para o servidor saber pra quem mandar
                    const msgToRelay = { ...savedMessage, targetUserId: activePsychologistId };
                    window.adminSocket.emit('admin_sent_message', msgToRelay);
                }

                // Se era uma conversa nova, atualiza o ID para as próximas mensagens
                if (String(activeConversationId).startsWith('new-') && savedMessage.conversationId) {
                    activeConversationId = savedMessage.conversationId;
                }
                
                // Atualiza a lista lateral para reordenar a conversa para o topo
                loadConversations(searchInput.value);

            } else {
                const errText = await response.text();
                console.error('Erro API Reply:', response.status, errText);
                alert('Erro ao enviar mensagem. Verifique sua conexão.');
                // Aqui poderíamos adicionar um indicador de falha na mensagem enviada otimisticamente
            }
        } catch (error) {
            console.error(error);
            alert('Erro ao enviar mensagem. Verifique sua conexão.');
        }
    }

    // --- SOCKET.IO: OUVINTE DE MENSAGENS ---
    const socketHandler = (event) => {
        const msg = event.detail;
        // CORREÇÃO: Deduplicação para evitar mensagens duplicadas (Optimistic UI vs Socket)
        if (msg.id && document.querySelector(`.message-bubble[data-message-id='${msg.id}']`)) {
            return;
        }

        // --- CORREÇÃO: Garante que a janela de chat esteja realmente visível para o usuário ---
        const isChatWindowVisible = activeChatScreen && activeChatScreen.style.display !== 'none';

        // Se a mensagem for da conversa ativa, adiciona na tela
        if (isChatWindowVisible && activeConversationId && msg.conversationId && parseInt(msg.conversationId) === parseInt(activeConversationId)) {
            appendMessageToView(msg);
            // Se a janela está aberta, marca como LIDO imediatamente
            if (window.adminSocket) {
                window.adminSocket.emit('messages_read', { conversationId: activeConversationId });
            }
        }

        // CORREÇÃO: Emite 'entregue' para qualquer mensagem recebida, garantindo o status para o remetente
        // IMPORTANTE: Não emitir se a mensagem for minha (Admin), pois isso causa "auto-entrega" falsa em caso de colisão de IDs
        const isMyMessage = msg.senderType && msg.senderType.toLowerCase() === 'admin';
        if (window.adminSocket && msg.id && !isMyMessage) {
            window.adminSocket.emit('message_delivered', { messageId: msg.id });
        }
        // Atualiza a lista lateral (ordenação e preview)
        const termo = searchInput ? searchInput.value : '';
        loadConversations(termo);
    };
    window.addEventListener('admin:message_received', socketHandler);

    // --- OUVINTE DE STATUS (Definido fora para poder remover depois) ---
    const statusHandler = (data) => {
        const { messageId, status } = data; // CORREÇÃO: Adiciona a desestruturação que estava faltando
        // console.log("Admin recebeu status update:", data);
        
        const updateIcon = () => {
        // CORREÇÃO: Só busca balões ENVIADOS (.sent) para atualizar o ícone. Ignora os recebidos.
        const messageBubble = document.querySelector(`.message-bubble.sent[data-message-id='${messageId}']`);
        if (messageBubble) {
            const statusContainer = messageBubble.querySelector('.message-status');
            if (statusContainer) statusContainer.innerHTML = getStatusIcon(status);
                return true;
        }
            return false;
        };

        // Tenta atualizar imediatamente
        if (!updateIcon()) {
            // Se falhar (race condition: socket chegou antes do ID ser salvo no DOM), tenta de novo em 500ms
            setTimeout(updateIcon, 500);
            // Tenta novamente em 1.5s para garantir (caso de latência de rede)
            setTimeout(updateIcon, 1500);
        }
    };

    // CORREÇÃO: Ouve o evento global disparado pelo admin.js (mais seguro)
    const globalStatusHandler = (e) => statusHandler(e.detail);
    window.addEventListener('admin:message_status_updated', globalStatusHandler);

    // CORREÇÃO: Listener direto para redundância e garantia de atualização de status
    const directStatusHandler = (data) => statusHandler(data);
    if (window.adminSocket) {
        window.adminSocket.on('message_status_updated', directStatusHandler);
    }

    // --- FECHAR COM ESC (Estilo WhatsApp) ---
    const handleEscKey = (e) => {
        if (e.key === 'Escape') {
            // 1. Se modal de broadcast estiver aberto, fecha ele primeiro
            if (broadcastModal && broadcastModal.style.display === 'flex') {
                closeBroadcast();
                return;
            }

            // 2. Se tiver conversa ativa, fecha ela
            if (activeConversationId) {
                activeConversationId = null;
                activePsychologistId = null;
                
                // Remove classe active da lista
                document.querySelectorAll('.conversation-item').forEach(item => item.classList.remove('active'));
                
                // Alterna telas (Esconde chat, mostra Welcome)
                if (activeChatScreen) activeChatScreen.style.display = 'none';
                if (welcomeScreen) welcomeScreen.style.display = 'flex';
            }
        }
    };
    document.addEventListener('keydown', handleEscKey);

    // Limpeza ao sair da página (Chamado pelo admin.js)
    window.cleanupPage = () => {
        window.removeEventListener('admin:message_received', socketHandler);
        window.removeEventListener('admin:message_status_updated', globalStatusHandler);
        
        if (window.adminSocket) {
            window.adminSocket.off('message_status_updated', directStatusHandler);
        }

        document.removeEventListener('keydown', handleEscKey);
        
        // Remove o modal do body para não duplicar ao voltar para a página
        const modal = document.getElementById('broadcast-modal');
        if (modal) modal.remove();
    };

    // --- INICIALIZAÇÃO E EVENTOS ---

    // Enviar com Enter
    replyInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            sendReply();
        }
    });

    // Enviar com clique no botão
    sendBtn.addEventListener('click', sendReply);

    // Filtro de busca
    // CORREÇÃO: Busca no backend com debounce para não sobrecarregar
    searchInput.addEventListener('keyup', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            loadConversations(searchInput.value);
        }, 300); // Espera 300ms após o usuário parar de digitar
    });

    // Evento do Filtro
    if (filterSelect) {
        filterSelect.addEventListener('change', () => loadConversations(searchInput.value));
    }

    // Inicia o carregamento e o polling
    loadConversations();
};
